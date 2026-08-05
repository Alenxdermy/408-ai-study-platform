"""
Few-Shot 标注分类器模块
使用预训练语言模型 + 原型网络实现小样本分类
用于自动标注：题型、输出方式、课程、难易程度
"""

import numpy as np

try:
    import torch
    from transformers import BertTokenizer, BertModel
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("[警告] PyTorch 或 Transformers 未安装，Few-Shot 分类功能不可用。")
    print("       请运行: pip install torch transformers")

from config import (
    QUESTION_TYPE_SUPPORT_SET,
    OUTPUT_TYPE_SUPPORT_SET,
    SUBJECT_SUPPORT_SET,
    DIFFICULTY_SUPPORT_SET
)


class PrototypicalClassifier:
    """
    基于原型网络的 Few-Shot 文本分类器
    
    特点：
    - 只需少量标注样本（每类3-5个）即可实现高精度分类
    - 基于预训练语言模型（BERT/RoBERTa）提取语义特征
    - 无需大规模训练数据
    """
    
    def __init__(self, model_name='hfl/chinese-roberta-wwm-ext', device=None):
        """
        初始化分类器
        :param model_name: 预训练模型名称
        :param device: 计算设备（cuda/cpu）
        """
        self.device = device or ('cuda' if TORCH_AVAILABLE and torch.cuda.is_available() else 'cpu')
        
        if not TORCH_AVAILABLE:
            self.encoder = None
            self.tokenizer = None
            self._fallback_mode = True
            print("[提示] 使用基于规则的降级模式进行分类")
        else:
            self._fallback_mode = False
            try:
                self.tokenizer = BertTokenizer.from_pretrained(model_name)
                self.encoder = BertModel.from_pretrained(model_name)
                self.encoder.to(self.device)
                self.encoder.eval()
                print(f"[分类器] 已加载预训练模型: {model_name} (设备: {self.device})")
            except Exception as e:
                print(f"[警告] 模型加载失败: {e}")
                print("[提示] 切换到基于规则的降级模式")
                self._fallback_mode = True
                self.encoder = None
                self.tokenizer = None
        
        # 存储各任务的原型向量
        self.prototypes = {}
        self.class_names = {}
        
        # 初始化所有分类任务
        self._init_all_tasks()

    def _init_all_tasks(self):
        """初始化所有分类任务的支持集"""
        tasks = {
            'question_type': QUESTION_TYPE_SUPPORT_SET,
            'output_type': OUTPUT_TYPE_SUPPORT_SET,
            'subject': SUBJECT_SUPPORT_SET,
            'difficulty': DIFFICULTY_SUPPORT_SET
        }
        
        for task_name, support_set in tasks.items():
            self.set_support_set(task_name, support_set)

    def encode_texts(self, texts):
        """
        将文本编码为特征向量
        :param texts: 文本列表
        :return: 向量矩阵 (num_texts, hidden_dim)
        """
        if self._fallback_mode:
            return self._rule_based_encode(texts)
            
        inputs = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors='pt'
        ).to(self.device)
        
        with torch.no_grad():
            outputs = self.encoder(**inputs)
            # 使用 CLS token 的输出作为句向量
            embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy()
            
        return embeddings

    def _rule_based_encode(self, texts):
        """
        基于规则的文本编码（降级模式）
        使用 TF-IDF 风格的简单特征
        """
        # 简单的字符 n-gram 特征
        features = []
        for text in texts:
            # 提取字符 n-gram
            ngrams = self._extract_ngrams(text, n=2)
            # 计算特征向量
            feature_vec = np.zeros(1024)  # 固定维度
            for ng in ngrams:
                hash_val = hash(ng) % 1024
                feature_vec[hash_val] += 1
            # 归一化
            norm = np.linalg.norm(feature_vec)
            if norm > 0:
                feature_vec = feature_vec / norm
            features.append(feature_vec)
        return np.array(features)

    def _extract_ngrams(self, text, n=2):
        """提取字符 n-gram"""
        ngrams = set()
        text = text.lower().replace(' ', '')
        for i in range(len(text) - n + 1):
            ngram = text[i:i+n]
            ngrams.add(ngram)
        return ngrams

    def set_support_set(self, task_name, support_data):
        """
        设置某一任务的支持集
        :param task_name: 任务名称 (question_type/output_type/subject/difficulty)
        :param support_data: 支持集数据 { '类别A': ['样本1', '样本2'], ... }
        """
        class_names = list(support_data.keys())
        prototypes = {}
        
        for class_name, samples in support_data.items():
            if not samples:
                continue
            # 编码同类别的所有样本
            embeddings = self.encode_texts(samples)
            # 计算原型向量（均值）
            prototype = np.mean(embeddings, axis=0)
            prototypes[class_name] = prototype
            
        self.prototypes[task_name] = prototypes
        self.class_names[task_name] = class_names

    def classify(self, text, task_name):
        """
        对单段文本进行分类
        :param text: 待分类文本
        :param task_name: 任务名称
        :return: (预测类别, 置信度分数)
        """
        if task_name not in self.prototypes:
            raise ValueError(f"未知任务: {task_name}")
            
        if not self.prototypes[task_name]:
            raise ValueError(f"任务 {task_name} 的支持集为空")
        
        # 编码查询文本
        query_embedding = self.encode_texts([text])[0]
        
        # 计算与每个原型的距离
        distances = {}
        for class_name, prototype in self.prototypes[task_name].items():
            dist = np.sqrt(np.sum((query_embedding - prototype) ** 2))
            distances[class_name] = dist
        
        # 选择距离最近的类别
        predicted_class = min(distances, key=distances.get)
        
        # 计算置信度（基于距离的 softmax）
        dists = list(distances.values())
        # 距离越小置信度越高
        confidences = {}
        for class_name, dist in distances.items():
            confidences[class_name] = 1.0 / (1.0 + dist)
        
        # 归一化
        total = sum(confidences.values())
        for class_name in confidences:
            confidences[class_name] /= total
            
        max_confidence = confidences[predicted_class]
        
        return predicted_class, max_confidence

    def classify_question(self, question):
        """
        对一道题目进行全维度分类标注
        :param question: 题目字典
        :return: 标注结果字典
        """
        # 组合题干和选项作为分类文本
        stem = question.get('stem', '')
        options = question.get('options', [])
        full_text = stem
        if options:
            option_texts = [f"{opt['label']}.{opt['text']}" for opt in options]
            full_text += ' ' + ' '.join(option_texts)
        
        # 执行四项分类任务
        results = {
            'question_type': self._classify_with_rules(full_text, 'question_type'),
            'output_type': self._classify_with_rules(full_text, 'output_type'),
            'subject': self._classify_with_rules(full_text, 'subject'),
            'difficulty': self._classify_with_rules(full_text, 'difficulty')
        }
        
        # 如果有神经网络模型，使用原型网络重新分类
        if not self._fallback_mode:
            for task_name in results:
                try:
                    cls, confidence = self.classify(full_text, task_name)
                    results[task_name] = {
                        'label': cls,
                        'confidence': round(confidence, 4)
                    }
                except Exception as e:
                    # 保持规则分类结果
                    pass
        
        return results

    def _classify_with_rules(self, text, task_name):
        """
        基于规则的快速分类（作为基线或降级模式）
        """
        text_lower = text.lower()
        
        if task_name == 'question_type':
            return self._rule_classify_question_type(text)
        elif task_name == 'output_type':
            return self._rule_classify_output_type(text)
        elif task_name == 'subject':
            return self._rule_classify_subject(text)
        elif task_name == 'difficulty':
            return self._rule_classify_difficulty(text)
        else:
            return {'label': 'unknown', 'confidence': 0.0}

    def _rule_classify_question_type(self, text):
        """规则判断题型"""
        # 判断题特征
        judgment_indicators = ['正确', '错误', '（ ）', '( )', '判断']
        judgment_score = sum(1 for ind in judgment_indicators if ind in text)
        
        # 选择题特征
        choice_indicators = [
            '下列', '以下', '哪个', '哪种', '哪项', '有关',
            '正确的是', '错误的是', '不正确', '不属于'
        ]
        choice_score = sum(1 for ind in choice_indicators if ind in text)
        
        # 主观题特征
        subjective_indicators = [
            '请简述', '请说明', '请分析', '请设计', '请编写',
            '请计算', '假设', '已知', '要求', '步骤', '过程',
            '算法', '代码', '程序', '证明', '推导'
        ]
        subjective_score = sum(1 for ind in subjective_indicators if ind in text)
        
        # 综合判断
        if judgment_score >= 2 and choice_score == 0:
            return {'label': 'judgment', 'confidence': 0.9}
        elif choice_score >= 1 and len(text) < 100:
            return {'label': 'choice', 'confidence': 0.85}
        elif subjective_score >= 1:
            return {'label': 'subjective', 'confidence': 0.8}
        elif choice_score >= 1:
            return {'label': 'choice', 'confidence': 0.7}
        else:
            return {'label': 'subjective', 'confidence': 0.5}

    def _rule_classify_output_type(self, text):
        """规则判断输出方式"""
        # 检查是否有选项
        has_options = any(f'{letter}.' in text or f'{letter}、' in text 
                         for letter in ['A', 'B', 'C', 'D'])
        
        # 判断题输出
        if '正确' in text or '错误' in text:
            if '（ ）' in text or '( )' in text:
                return {'label': 'true_false', 'confidence': 0.9}
        
        if has_options:
            return {'label': 'option', 'confidence': 0.9}
        
        # 其余为主观简答
        return {'label': 'short_answer', 'confidence': 0.8}

    def _rule_classify_subject(self, text):
        """规则判断课程归属"""
        # 数据结构关键词
        ds_keywords = [
            '栈', '队列', '链表', '二叉树', '二叉搜索树', '红黑树',
            '哈希', '散列', '排序', '快排', '归并', '堆', '数组',
            '线性表', '图', '广度优先', '深度优先', 'BFS', 'DFS',
            '查找', '搜索', '平衡树', 'AVL', 'B树', 'B+树'
        ]
        
        # 操作系统关键词
        os_keywords = [
            '进程', '线程', '调度', '死锁', '内存', '虚拟', '分页',
            '分段', '页面置换', '信号量', 'PV操作', '管程', '文件系统',
            'I/O', '中断', '设备管理', '就绪', '运行', '阻塞',
            'FCFS', 'SJF', 'RR', '优先级', '银行家'
        ]
        
        # 计算机网络关键词
        network_keywords = [
            'TCP', 'UDP', 'IP', 'HTTP', 'HTTPS', 'DNS', 'FTP', 'SMTP',
            '子网', '掩码', '路由', 'OSI', '七层', '物理层', '数据链路层',
            '网络层', '传输层', '会话层', '表示层', '应用层',
            '三次握手', '四次挥手', '拥塞', '流量控制', '以太网',
            '帧', '包', '报文', '协议'
        ]
        
        # 计算机组成原理关键词
        database_keywords = [
            'CPU', 'ALU', '寄存器', 'Cache', '缓存', '流水线', '指令',
            '数据通路', '控制器', '运算器', '存储器', '主存', '辅存',
            '硬盘', '内存', 'ROM', 'RAM', '地址', '数据总线', '控制总线',
            '时钟', '周期', '主频', 'MIPS', 'CPI', '冒险', '冲突'
        ]
        
        # 计算各类关键词匹配数
        scores = {
            'ds': sum(1 for kw in ds_keywords if kw in text),
            'os': sum(1 for kw in os_keywords if kw in text),
            'network': sum(1 for kw in network_keywords if kw in text.upper()),
            'database': sum(1 for kw in database_keywords if kw in text.upper())
        }
        
        # 选择得分最高的
        max_score = max(scores.values())
        if max_score == 0:
            return {'label': 'unknown', 'confidence': 0.3}
        
        # 找到最高分对应的类别
        best_subject = max(scores, key=scores.get)
        confidence = min(0.95, 0.5 + max_score * 0.1)
        
        return {'label': best_subject, 'confidence': round(confidence, 2)}

    def _rule_classify_difficulty(self, text):
        """规则判断难易程度"""
        # 简单题特征
        easy_indicators = {
            'max_length': 50,  # 题干较短
            'keywords': ['正确的是', '错误的是', '下列关于', '以下哪个']
        }
        
        # 困难题特征
        hard_indicators = {
            'min_length': 150,  # 题干较长
            'keywords': [
                '假设', '已知', '要求', '计算', '设计', '分析',
                '分别', '比较', '说明', '证明', '推导', '算法',
                '时间复杂度', '空间复杂度', '最坏情况', '最优'
            ]
        }
        
        text_length = len(text)
        
        # 检查简单题
        if text_length < easy_indicators['max_length']:
            return {'label': 'easy', 'confidence': 0.8}
        
        # 检查困难题
        hard_score = sum(1 for kw in hard_indicators['keywords'] if kw in text)
        if text_length > hard_indicators['min_length'] or hard_score >= 3:
            confidence = min(0.95, 0.6 + hard_score * 0.1)
            return {'label': 'hard', 'confidence': round(confidence, 2)}
        
        # 中等题
        return {'label': 'medium', 'confidence': 0.7}

    def get_support_set_stats(self):
        """获取支持集统计信息"""
        stats = {}
        for task_name, prototypes in self.prototypes.items():
            stats[task_name] = {
                'num_classes': len(prototypes),
                'classes': list(prototypes.keys())
            }
        return stats
