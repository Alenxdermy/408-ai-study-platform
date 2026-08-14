# -*- coding: utf-8 -*-
"""
408 考研真题 Few-Shot 标注器
基于 Few-Shot 示例和规则匹配，对题目进行：
1. 科目分类（数据结构/计算机组成原理/操作系统/计算机网络）
2. 难度评级（容易/中等/较难）
3. 题型识别（单选题/综合应用题）
4. 答案标注

支持两种运行模式：
- 规则模式：基于关键词匹配，无需额外依赖
- 相似度模式：基于文本相似度与 Few-Shot 示例对比
"""

import re
import json
import difflib
import os
import subprocess
import urllib.error
import urllib.request
from collections import defaultdict

from few_shot_examples import (
    FEW_SHOT_EXAMPLES,
    SUBJECT_KEYWORDS,
    KEYWORD_WEIGHTS,
    DIFFICULTY_RULES,
    format_prompt
)


def _load_local_env():
    """读取项目本地 .env，避免直接运行 few-shot 时拿不到后端配置。"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "408-ai-study-platform", "server", ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as file:
        for raw_line in file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


class QuestionAnnotator:
    """408 考研真题 Few-Shot 标注器"""

    # 科目列表
    SUBJECTS = ["数据结构", "计算机组成原理", "操作系统", "计算机网络"]
    # 难度列表
    DIFFICULTIES = ["容易", "中等", "较难"]
    # 题型列表
    QUESTION_TYPES = ["单选题", "综合应用题"]

    def __init__(self, mode="llm"):
        """
        初始化标注器
        :param mode: 标注模式
            - "rule": 仅使用规则匹配
            - "similarity": 仅使用相似度匹配
            - "hybrid": 混合模式（推荐），先用规则再用相似度验证
            - "llm": 优先使用 DeepSeek 大模型，失败时回退到 hybrid
        """
        self.mode = mode
        _load_local_env()
        self.examples = FEW_SHOT_EXAMPLES
        self.keyword_map = SUBJECT_KEYWORDS
        self.difficulty_rules = DIFFICULTY_RULES
        self.api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
        self.api_base_url = (os.getenv("DEEPSEEK_BASE_URL") or os.getenv("OPENAI_BASE_URL") or "https://api.deepseek.com").rstrip("/")
        self.api_model = os.getenv("DEEPSEEK_MODEL") or os.getenv("OPENAI_MODEL") or "deepseek-v4-pro"

        # 按科目分组示例（用于相似度匹配）
        self._examples_by_subject = defaultdict(list)
        for ex in self.examples:
            self._examples_by_subject[ex["subject"]].append(ex)

        print(f"[标注器] 已加载 {len(self.examples)} 个 Few-Shot 示例，模式: {mode}")

    # ============================================================
    # 公开接口
    # ============================================================

    def annotate(self, question_text):
        """
        标注一道题目（主接口）
        :param question_text: 题目文本
        :return: JSON 格式的标注结果
        """
        detail = self.annotate_detailed(question_text)
        result = {
            "subject": detail["subject"],
            "difficulty": detail["difficulty"],
            "answer": detail["answer"]
        }

        return json.dumps(result, ensure_ascii=False)

    def annotate_detailed(self, question_text):
        """
        标注一道题目（详细模式，返回更多信息）
        :param question_text: 题目文本
        :return: 包含详细信息的字典
        """
        q_type = self._detect_question_type(question_text)
        subject, subject_scores = self._classify_subject_detailed(question_text)
        difficulty, difficulty_reason = self._classify_difficulty_detailed(question_text)
        answer = self._generate_answer(question_text, q_type)

        # 相似度匹配结果
        sim_result = self._find_most_similar(question_text)

        result = {
            "subject": subject,
            "difficulty": difficulty,
            "question_type": q_type,
            "answer": answer,
            "subject_scores": subject_scores,
            "difficulty_reason": difficulty_reason,
            "most_similar_example": sim_result,
            "json_output": json.dumps({
                "subject": subject,
                "difficulty": difficulty,
                "answer": answer
            }, ensure_ascii=False)
        }

        if self.mode == "llm":
            llm_result = self._annotate_with_llm(question_text)
            if llm_result:
                result.update(llm_result)
                result["json_output"] = json.dumps({
                    "subject": result["subject"],
                    "difficulty": result["difficulty"],
                    "answer": result["answer"]
                }, ensure_ascii=False)
                result["difficulty_reason"] = "DeepSeek few-shot 标注"

        return result

    def build_prompt(self, question_text):
        """
        构建 Few-Shot Prompt（供大语言模型使用）
        :param question_text: 题目文本
        :return: 完整的 Few-Shot Prompt
        """
        return format_prompt(question_text)

    def _annotate_with_llm(self, question_text):
        """调用 DeepSeek/OpenAI 兼容接口进行 few-shot 标注，失败时返回 None。"""
        if not self.api_key:
            return None

        payload = {
            "model": self.api_model,
            "messages": [
                {
                    "role": "system",
                    "content": "你只返回纯 JSON，不要输出 Markdown、解释或代码块。"
                },
                {
                    "role": "user",
                    "content": self.build_prompt(question_text)
                }
            ],
            "temperature": 0.1,
            "max_tokens": 500,
            "thinking": {"type": "enabled"},
            "reasoning_effort": "high",
            "stream": False
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            f"{self.api_base_url}/chat/completions",
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )

        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(request) as response:
                body = response.read().decode("utf-8")
            parsed = json.loads(body)
            content = parsed["choices"][0]["message"].get("content", "").strip()
            return self._normalize_llm_annotation(content, question_text)
        except (KeyError, json.JSONDecodeError, urllib.error.URLError, TimeoutError, OSError) as exc:
            try:
                return self._annotate_with_curl(data, question_text)
            except (KeyError, json.JSONDecodeError, subprocess.SubprocessError, OSError) as curl_exc:
                curl_message = getattr(curl_exc, "stderr", b"")
                if isinstance(curl_message, bytes):
                    curl_message = curl_message.decode("utf-8", errors="ignore").strip()
                print(f"[标注器] DeepSeek 标注失败，已回退本地规则: {exc}; curl={curl_message or type(curl_exc).__name__}")
                return None

    def _annotate_with_curl(self, data, question_text):
        """当前 Python SSL 不可用时，使用系统 curl.exe 作为 HTTPS 备用通道。"""
        proc = subprocess.run(
            [
                "curl.exe",
                "--silent",
                "--show-error",
                "--fail",
                "--noproxy",
                "*",
                "-X",
                "POST",
                f"{self.api_base_url}/chat/completions",
                "-H",
                f"Authorization: Bearer {self.api_key}",
                "-H",
                "Content-Type: application/json",
                "--data-binary",
                "@-"
            ],
            input=data,
            capture_output=True,
            check=True
        )
        parsed = json.loads(proc.stdout.decode("utf-8"))
        content = parsed["choices"][0]["message"].get("content", "").strip()
        return self._normalize_llm_annotation(content, question_text)

    def _normalize_llm_annotation(self, content, question_text):
        """清理并校验大模型返回的标注结果。"""
        content = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.I | re.M).strip()
        match = re.search(r"\{.*\}", content, re.S)
        if match:
            content = match.group(0)
        data = json.loads(content)

        subject = str(data.get("subject", "")).strip()
        difficulty = str(data.get("difficulty", "")).strip()
        answer = str(data.get("answer", "")).strip()
        question_type = str(data.get("question_type", "")).strip()

        if subject not in self.SUBJECTS:
            subject = self._classify_subject(question_text)
        if difficulty not in self.DIFFICULTIES:
            difficulty = self._classify_difficulty(question_text)
        if question_type not in self.QUESTION_TYPES:
            question_type = self._detect_question_type(question_text)
        if not answer:
            answer = self._generate_answer(question_text, question_type)

        return {
            "subject": subject,
            "difficulty": difficulty,
            "question_type": question_type,
            "answer": answer
        }

    # ============================================================
    # 题型识别
    # ============================================================

    def _detect_question_type(self, text):
        """
        识别题型：单选题 / 综合应用题
        """
        # 检查是否包含选项标记
        option_patterns = [
            r'[A-D][\.、\)）:：\s]',       # A. / A、 / A) / A：
            r'[A-D]\s*[\.．]',               # A. (全角点)
        ]

        has_options = False
        for pattern in option_patterns:
            if re.search(pattern, text):
                has_options = True
                break

        # 检查是否有选择题特征词
        choice_keywords = ["下列", "以下", "哪个", "哪种", "哪项", "正确的是",
                          "错误的是", "不属于", "属于", "是（", "为（"]
        has_choice_kw = any(kw in text for kw in choice_keywords)

        # 检查是否有综合题特征词
        subjective_keywords = ["请简述", "请说明", "请分析", "请设计", "请计算",
                              "请解释", "请证明", "请举例", "请比较", "请描述",
                              "试计算", "试分析", "试说明"]
        has_subjective_kw = any(kw in text for kw in subjective_keywords)

        # 判断逻辑
        if has_options and (has_choice_kw or "（  ）" in text or "(  )" in text):
            return "单选题"
        elif has_subjective_kw or "「此处插入题目图片」" in text:
            return "综合应用题"
        elif has_options:
            return "单选题"
        else:
            return "综合应用题"

    # ============================================================
    # 科目分类
    # ============================================================

    def _classify_subject(self, text):
        """科目分类（简洁返回）"""
        subject, _ = self._classify_subject_detailed(text)
        return subject

    def _classify_subject_detailed(self, text):
        """
        基于关键词匹配的科目分类（带权重）
        :return: (科目名, 各科目得分字典)
        """
        scores = {subj: 0 for subj in self.SUBJECTS}

        # 统一为大写匹配（部分关键词含英文）
        text_upper = text.upper()

        for subject, keywords in self.keyword_map.items():
            for kw in keywords:
                if kw.upper() in text_upper:
                    # 使用权重表中的权重，默认为1
                    weight = KEYWORD_WEIGHTS.get(kw, 1)
                    scores[subject] += weight

        # 如果是混合模式，结合相似度匹配
        # 相似度匹配仅在关键词得分较低时作为辅助
        if self.mode in ("hybrid", "similarity"):
            max_kw_score = max(scores.values())
            sim_subject = self._classify_subject_by_similarity(text)
            if sim_subject:
                if max_kw_score == 0:
                    # 无关键词匹配时，相似度决定
                    scores[sim_subject] += 5
                elif max_kw_score <= 2:
                    # 关键词得分较低时，相似度作为辅助
                    scores[sim_subject] += 2
                # 关键词得分高时，相似度不干预

        # 选择得分最高的科目
        max_score = max(scores.values())
        if max_score == 0:
            return "数据结构", scores  # 默认返回数据结构

        best_subject = max(scores, key=scores.get)
        return best_subject, scores

    def _classify_subject_by_similarity(self, text):
        """基于与 Few-Shot 示例的相似度进行科目分类"""
        subject_scores = defaultdict(float)

        for ex in self.examples:
            sim = difflib.SequenceMatcher(None, text, ex["input"]).ratio()
            subject_scores[ex["subject"]] += sim

        if subject_scores:
            return max(subject_scores, key=subject_scores.get)
        return None

    # ============================================================
    # 难度评级
    # ============================================================

    def _classify_difficulty(self, text):
        """难度评级（简洁返回）"""
        difficulty, _ = self._classify_difficulty_detailed(text)
        return difficulty

    def _classify_difficulty_detailed(self, text):
        """
        基于规则 + 相似度的难度评级
        评判标准：基础概念记忆题为"容易"，综合应用分析题为"中等"，涉及复杂计算或冷门知识点的为"较难"
        :return: (难度, 判断理由)
        """
        text_length = len(text)
        reasons = []

        # 规则1：检查难度关键词
        hard_keywords = self.difficulty_rules["较难"]["keywords"]
        medium_keywords = self.difficulty_rules["中等"]["keywords"]
        easy_keywords = self.difficulty_rules["容易"]["keywords"]

        hard_score = sum(1 for kw in hard_keywords if kw in text)
        medium_score = sum(1 for kw in medium_keywords if kw in text)
        easy_score = sum(1 for kw in easy_keywords if kw in text)

        # 判断题型
        q_type = self._detect_question_type(text)

        # 规则2：高优先级——困难关键词直接判定
        if hard_score >= 2:
            reasons.append(f"包含{hard_score}个困难关键词(计算/证明/复杂等)")
            return "较难", "; ".join(reasons)

        # 规则3：选择题难度判断
        if q_type == "单选题":
            # 单选题：短题干+基础概念=容易
            if text_length < 80 and easy_score >= 1 and hard_score == 0:
                reasons.append(f"单选题,题干短({text_length}字),含基础概念词")
                return "容易", "; ".join(reasons)
            # 单选题：含复杂计算或冷门知识点=较难
            if hard_score >= 1:
                reasons.append(f"单选题,含困难关键词")
                return "较难", "; ".join(reasons)
            # 单选题：中等长度+分析类=中等
            if medium_score >= 1 or text_length >= 80:
                reasons.append(f"单选题,含分析类关键词或题干较长")
                return "中等", "; ".join(reasons)
            # 单选题默认容易
            reasons.append(f"单选题,默认容易")
            return "容易", "; ".join(reasons)

        # 规则4：综合应用题难度判断
        else:
            # 综合题：含困难关键词=较难
            if hard_score >= 1:
                reasons.append(f"综合题,含困难关键词")
                return "较难", "; ".join(reasons)
            # 综合题：短题干+简述/说明=容易
            if text_length < 100 and easy_score >= 1:
                reasons.append(f"综合题,题干短({text_length}字),含简述/说明词")
                return "容易", "; ".join(reasons)
            # 综合题：中等长度+分析/比较=中等
            if medium_score >= 1 or text_length >= 100:
                reasons.append(f"综合题,含分析类关键词或题干较长({text_length}字)")
                return "中等", "; ".join(reasons)
            # 综合题默认中等
            reasons.append(f"综合题,默认中等")
            return "中等", "; ".join(reasons)

    def _classify_difficulty_by_similarity(self, text):
        """基于与 Few-Shot 示例的相似度进行难度分类"""
        difficulty_scores = defaultdict(float)

        for ex in self.examples:
            sim = difflib.SequenceMatcher(None, text, ex["input"]).ratio()
            difficulty_scores[ex["difficulty"]] += sim

        if difficulty_scores:
            return max(difficulty_scores, key=difficulty_scores.get)
        return None

    # ============================================================
    # 答案生成
    # ============================================================

    def _generate_answer(self, text, q_type):
        """
        生成答案
        - 单选题：返回选项字母（A/B/C/D）
        - 综合应用题：返回自由文本占位符
        """
        if q_type == "单选题":
            # 尝试通过相似度匹配找到答案
            best_match = self._find_most_similar(text)
            if best_match and best_match["similarity"] > 0.4:
                matched_ex = best_match["example"]
                if matched_ex["question_type"] == "单选题":
                    return matched_ex["answer"]
            # 无法匹配时返回默认
            return "（需要人工标注答案）"
        else:
            return "（此处为自由作答的文本答案）"

    # ============================================================
    # 相似度匹配
    # ============================================================

    def _find_most_similar(self, text):
        """找到与输入文本最相似的 Few-Shot 示例"""
        best_sim = 0
        best_example = None

        for ex in self.examples:
            sim = difflib.SequenceMatcher(None, text, ex["input"]).ratio()
            if sim > best_sim:
                best_sim = sim
                best_example = ex

        if best_example:
            return {
                "similarity": round(best_sim, 4),
                "example": best_example
            }
        return None

    # ============================================================
    # 批量标注
    # ============================================================

    def annotate_batch(self, questions):
        """
        批量标注题目
        :param questions: 题目文本列表
        :return: 标注结果列表
        """
        results = []
        for i, q in enumerate(questions, 1):
            result = self.annotate(q)
            results.append(result)
            print(f"  [{i}/{len(questions)}] {q[:40]}... → {result}")
        return results

    # ============================================================
    # 统计信息
    # ============================================================

    def get_stats(self):
        """获取 Few-Shot 示例库的统计信息"""
        stats = {
            "total_examples": len(self.examples),
            "by_subject": {},
            "by_difficulty": {},
            "by_type": {}
        }

        for ex in self.examples:
            stats["by_subject"][ex["subject"]] = stats["by_subject"].get(ex["subject"], 0) + 1
            stats["by_difficulty"][ex["difficulty"]] = stats["by_difficulty"].get(ex["difficulty"], 0) + 1
            stats["by_type"][ex["question_type"]] = stats["by_type"].get(ex["question_type"], 0) + 1

        return stats
