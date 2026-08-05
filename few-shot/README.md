# 408 考研真题 Few-Shot 智能标注系统

基于 **Few-Shot（小样本学习）** 技术的 408 计算机学科专业基础综合考试真题自动标注系统。

系统集成了 **PDF/OCR 文本提取 → Few-Shot 智能标注 → 数据库存储** 的完整链路，支持从真题图片或 PDF 自动提取题目并标注科目、难度、题型、答案等多维信息，供小程序刷题系统直接调用。

---

## 目录

- [功能概览](#功能概览)
- [项目结构](#项目结构)
- [环境配置](#环境配置)
- [快速开始](#快速开始)
- [程序主入口](#程序主入口)
- [所有命令参数详解](#所有命令参数详解)
- [Few-Shot 示例库](#few-shot-示例库)
- [标注规则详解](#标注规则详解)
- [与大模型集成](#与大模型集成)
- [数据库结构](#数据库结构)
- [常见问题](#常见问题)

---

## 功能概览

系统对每道 408 真题自动标注以下维度：

| 标注维度 | 可选值 | 说明 |
|---------|--------|------|
| **科目分类** | 数据结构 / 计算机组成原理 / 操作系统 / 计算机网络 | 判断题目所属课程 |
| **难度评级** | 容易 / 中等 / 较难 | 容易=基础概念，中等=综合分析，较难=复杂计算或冷门知识点 |
| **题型识别** | 单选题 / 综合应用题 | 自动识别题目类型 |
| **答案标注** | 选项字母(A/B/C/D) 或 自由文本 | 单选题返回选项，综合应用题返回文本占位 |

**输出格式**（纯 JSON，符合 Few-Shot 标注规范）：

```json
{"subject": "数据结构", "difficulty": "容易", "answer": "B"}
```

---

## 项目结构

```
few-shot/
│
├── few_shot_examples.py    # Few-Shot 示例库（24个标注样本 + 关键词词典 + 难度规则）
├── question_annotator.py   # 标注器核心模块（科目分类/难度评级/答案标注）
├── run_annotator.py        # 程序主入口①：Few-Shot 标注器（命令行/交互/批量）
│
├── config.py               # 通用配置（枚举定义 + Few-Shot 支持集）
├── ocr_extractor.py        # OCR 文本提取模块（PaddleOCR）
├── label_classifier.py     # 通用 Few-Shot 分类器（原型网络/规则降级）
├── database.py             # SQLite 数据库模块（增删改查/统计/导出）
├── main.py                 # 程序主入口②：完整系统（PDF/OCR→标注→数据库）
│
├── verify.py               # 快速验证脚本（验证核心功能）
├── test_system.py          # 系统测试脚本
├── requirements.txt        # Python 依赖列表
└── README.md               # 本文档
```

### 两个主入口的区别

| 主入口 | 文件 | 功能 | 依赖要求 |
|--------|------|------|---------|
| **Few-Shot 标注器** | `run_annotator.py` | 纯文本标注，输入题目文本即可标注 | 无第三方依赖 |
| **完整系统** | `main.py` | PDF/OCR 识别 → 标注 → 数据库存储 | 需要 OCR/PDF 依赖 |

---

## 环境配置

### 1. Python 环境

- **Python 版本**：3.8 及以上
- **操作系统**：Windows / macOS / Linux 均可

检查 Python 版本：

```bash
python --version
```

### 2. 核心功能（零依赖运行）

`run_annotator.py` 的 Few-Shot 标注功能**不需要任何第三方库**，仅使用 Python 标准库即可运行：

```bash
cd d:\408-ai-study-platform\few-shot
python run_annotator.py --test
```

### 3. 完整功能依赖安装

如需使用 OCR 图片识别和深度学习分类功能：

```bash
cd d:\408-ai-study-platform\few-shot
pip install -r requirements.txt
```

`requirements.txt` 内容说明：

```
# ========== 核心依赖（深度学习分类）==========
torch>=2.0.0                  # PyTorch 深度学习框架
transformers>=4.30.0          # HuggingFace 模型库（BERT/RoBERTa）
numpy>=1.24.0                 # 数值计算

# ========== OCR 依赖（图片文字识别）==========
paddlepaddle>=2.4.0           # PaddlePaddle 深度学习框架
paddleocr>=2.6.0              # PaddleOCR 中文识别引擎

# ========== 图像处理 ==========
Pillow>=9.0.0                 # 图像处理库

# ========== 数据库 ==========
# SQLite 为 Python 标准库，无需额外安装
```

### 4. GPU 加速（可选）

如果拥有 NVIDIA GPU，可安装 GPU 版本以加速 OCR 和深度学习：

```bash
# GPU 版 PaddlePaddle
pip install paddlepaddle-gpu

# GPU 版 PyTorch（CUDA 11.8 示例）
pip install torch --index-url https://download.pytorch.org/whl/cu118
```

### 5. 验证安装

```bash
# 验证核心功能（无需第三方依赖）
python verify.py

# 运行内置测试
python run_annotator.py --test

# 从 PDF 提取并标注
python run_annotator.py --pdf ./exam.pdf
```

---

## 快速开始

### 30 秒快速体验

```bash
cd d:\408-ai-study-platform\few-shot

# 1. 运行内置测试（6道题，验证标注准确性）
python run_annotator.py --test

# 2. 标注一道题目
python run_annotator.py -q "下列关于栈的叙述中，错误的是（  ）。A.栈是一种线性结构 B.栈遵循后进先出原则 C.栈可以用于函数调用 D.栈的插入操作在栈底进行"

# 3. 从 PDF 标注题目
python run_annotator.py --pdf ./exam.pdf
# 4. 进入交互模式
python run_annotator.py --interactive
```

---

## 程序主入口

### 主入口①：`run_annotator.py` — Few-Shot 标注器

适用于已有题目文本，需要快速标注的场景。**零第三方依赖**。

#### 基本用法

```bash
python run_annotator.py [选项]
```

#### 所有命令参数

| 参数 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `--question` | `-q` | 标注单道题目 | `python run_annotator.py -q "题目文本"` |
| `--file` | `-f` | 从文件批量标注（每行一道题） | `python run_annotator.py -f questions.txt` |
| `--interactive` | `-i` | 进入交互模式 | `python run_annotator.py -i` |
| `--test` | `-t` | 运行内置测试（6道题） | `python run_annotator.py --test` |
| `--stats` | `-s` | 查看 Few-Shot 示例库统计 | `python run_annotator.py --stats` |
| `--prompt` | `-p` | 生成 Few-Shot Prompt（供大模型使用） | `python run_annotator.py -p "题目文本"` |
| `--mode` | `-m` | 标注模式：`rule`/`similarity`/`hybrid` | `python run_annotator.py -m rule -q "题目"` |
| `--verbose` | `-v` | 详细输出模式（显示分类依据） | `python run_annotator.py -q "题目" --verbose` |

#### 使用示例

```bash
# 标注单道题目（简洁模式）
python run_annotator.py -q "为解决计算机主机与打印机之间速度不匹配问题，通常设置一个打印数据缓冲区。该缓冲区的逻辑结构应该是（  ）。A.栈 B.队列 C.树 D.图"

# 标注单道题目（详细模式，显示分类依据）
python run_annotator.py -q "下列关于TCP协议的叙述中，正确的是？A.TCP是无连接协议 B.TCP是面向连接的可靠协议" --verbose

# 从文件批量标注
python run_annotator.py -f questions.txt

# 使用纯规则模式（最快，不计算相似度）
python run_annotator.py -m rule -q "题目文本"

# 生成 Few-Shot Prompt（发给 ChatGPT 等大模型）
python run_annotator.py -p "你的题目文本"

# 交互模式
python run_annotator.py -i
```

#### 交互模式命令

进入交互模式后（`python run_annotator.py -i`），支持以下命令：

```
📝 请输入题目> 直接输入题目文本即可标注
📝 请输入题目> test       → 运行内置测试
📝 请输入题目> stats      → 查看示例库统计
📝 请输入题目> quit       → 退出
```

---

### 主入口②：`main.py` — 完整系统（PDF/OCR + 标注 + 数据库）

适用于从真题图片或 PDF 出发的完整处理流程。**需要安装对应依赖**。

#### 基本用法

```bash
python main.py [选项]
```

#### 所有命令参数

| 参数 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `--input` | `-i` | 真题图片文件夹路径 | `python main.py -i ./exam_images/2023` |
| `--year` | `-y` | 真题年份 | `python main.py -i ./exam_images/2023 -y 2023` |
| `--db` | — | 数据库文件路径（默认 `./408_questions.db`） | `python main.py --db ./my.db` |
| `--demo` | `-d` | 运行演示模式（使用内置示例数据） | `python main.py --demo` |
| `--interactive` | `-t` | 进入交互模式 | `python main.py -t` |
| `--stats` | `-s` | 显示题库统计信息 | `python main.py --stats` |
| `--export` | `-e` | 导出题库为 JSON 文件 | `python main.py -e ./output.json` |
| `--gpu` | — | 使用 GPU 加速 OCR | `python main.py --demo --gpu` |
| `--clear` | — | 清空数据库所有题目 | `python main.py --clear` |

#### 使用示例

```bash
# 1. 演示模式（无需图片，使用内置数据）
python main.py --demo

# 2. 处理真题图片（OCR 识别 → 标注 → 存入数据库）
python main.py --input ./exam_images/2023 --year 2023

# 3. 处理真题 PDF（先文本提取，必要时 OCR 回退）
python main.py --pdf ./exam_pdfs/2023.pdf --year 2023

# 4. 查看题库统计
python main.py --stats

# 4. 导出题库为 JSON（供小程序使用）
python main.py --export ./questions.json

# 5. 交互模式
python main.py --interactive

# 6. 使用 GPU 加速 OCR
python main.py --input ./exam_images/2024 --year 2024 --gpu

# 7. 清空数据库
python main.py --clear
```

#### 交互模式命令

```
🎯 命令> demo           → 运行演示模式
🎯 命令> stats          → 查看题库统计
🎯 命令> list 10        → 列出最近 10 道题目
🎯 命令> search TCP     → 搜索包含 "TCP" 的题目
🎯 命令> export out.json → 导出题库为 JSON
🎯 命令> clear          → 清空所有题目
🎯 命令> help           → 显示帮助
🎯 命令> quit           → 退出
```

---

## 所有命令参数详解

### `run_annotator.py` 完整参数表

```
usage: run_annotator.py [-h] [--question QUESTION] [--file FILE]
                        [--interactive] [--stats] [--prompt PROMPT]
                        [--test] [--mode {rule,similarity,hybrid}]
                        [--verbose]

选项：
  -h, --help            显示帮助信息
  --question QUESTION, -q QUESTION
                        标注单道题目
  --file FILE, -f FILE  从文件批量标注（每行一道题）
  --interactive, -i     交互模式
  --stats, -s           查看示例库统计
  --prompt PROMPT, -p PROMPT
                        生成 Few-Shot Prompt
  --test, -t            运行内置测试
  --mode {rule,similarity,hybrid}, -m {rule,similarity,hybrid}
                        标注模式（默认 hybrid）
  --verbose, -v         详细输出
```

### `main.py` 完整参数表

```
usage: main.py [-h] [--input INPUT] [--pdf PDF] [--year YEAR] [--db DB]
               [--demo] [--interactive] [--stats] [--export EXPORT]
               [--gpu] [--no-ocr-fallback] [--clear]

选项：
  -h, --help            显示帮助信息
  --input INPUT, -i INPUT
                        真题图片文件夹路径
  --pdf PDF             真题 PDF 文件路径或文件夹路径
  --year YEAR, -y YEAR  真题年份
  --db DB               数据库文件路径（默认 ./408_questions.db）
  --demo, -d            运行演示模式
  --interactive, -t     进入交互模式
  --stats, -s           显示题库统计信息
  --export EXPORT, -e EXPORT
                        导出题库为 JSON 文件
  --gpu                 使用 GPU 加速 OCR
  --no-ocr-fallback     处理 PDF 时只读取文本，不回退 OCR
  --clear               清空数据库
```

---

## Few-Shot 示例库

系统内置了 **24 个** 标注示例，覆盖所有科目 × 题型 × 难度的组合：

| 科目 | 单选题(容易/中等/较难) | 综合应用题(容易/中等/较难) | 小计 |
|------|:---:|:---:|:---:|
| 数据结构 | 3 | 3 | 6 |
| 计算机组成原理 | 3 | 3 | 6 |
| 操作系统 | 3 | 3 | 6 |
| 计算机网络 | 3 | 3 | 6 |
| **合计** | **12** | **12** | **24** |

### 标注模式

| 模式 | 说明 | 适用场景 | 速度 |
|------|------|---------|------|
| `rule` | 纯规则关键词匹配 | 快速标注 | 最快 |
| `similarity` | 纯文本相似度匹配 | 与示例高度相似的题目 | 中等 |
| `hybrid`（默认） | 规则 + 相似度混合 | **推荐**，精度最高 | 中等 |

---

## 标注规则详解

### 科目分类规则

基于专业关键词加权匹配（高排他性关键词权重更高）：

- **数据结构**：栈、队列、链表、二叉树、排序、哈希、时间复杂度等
- **计算机组成原理**：CPU、Cache、IEEE754、浮点数、指令周期、I/O接口、流水线等
- **操作系统**：进程、线程、死锁、信号量、页面置换、虚拟内存、系统调用等
- **计算机网络**：TCP/IP、OSI、三次握手、子网掩码、路由、拥塞控制等

### 难度评级规则

| 难度 | 评判标准 | 典型关键词 |
|------|---------|-----------|
| **容易** | 基础概念记忆题，题干短 | 下列、属于、提供、基本概念、简述、说明 |
| **中等** | 综合应用分析题，题干中等 | 分析、区别、比较、设计、算法、时间复杂度 |
| **较难** | 复杂计算或冷门知识点 | 计算、证明、IEEE754、浮点数、CLOCK、拥塞控制、三次握手 |

### 答案标注规则

- **单选题**：返回选项字母（A/B/C/D），通过相似度匹配示例库
- **综合应用题**：返回 `（此处为自由作答的文本答案）`

---

## 与大模型集成

系统可以生成标准的 Few-Shot Prompt，供 ChatGPT / 文心一言等大模型使用：

```bash
# 命令行生成
python run_annotator.py -p "你的题目文本"
```

```python
# 代码调用
from question_annotator import QuestionAnnotator

annotator = QuestionAnnotator()
prompt = annotator.build_prompt("你的题目文本")
# 将 prompt 发送给大语言模型 API
```

生成的 Prompt 包含完整的标注规则 + 24个 Few-Shot 示例 + 待标注题目，格式符合：

```
# 角色与任务
你是一位资深的408计算机学科专业基础综合考试出题专家...

# 标注规则
1. 科目分类：数据结构 / 计算机组成原理 / 操作系统 / 计算机网络
2. 难度评级：容易 / 中等 / 较难
3. 答案格式：单选题返回选项字母，综合应用题返回文本
4. 不标注核心考点

# 输出格式
{"subject": "科目名称", "difficulty": "难度等级", "answer": "标准答案"}

# 少样本示例（Few-shot Examples）
## 【数据结构-单选题-容易】
**输入**：为解决计算机主机与打印机之间速度不匹配问题...
**输出**：{"subject": "数据结构", "difficulty": "容易", "answer": "B"}

...（共24个示例）

# 待标注题目
**输入**：你的题目文本
**输出**：
```

---

## 数据库结构

完整系统使用 SQLite 存储标注结果，表结构如下：

```sql
CREATE TABLE questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    year            INTEGER NOT NULL,         -- 年份
    qid             INTEGER NOT NULL,         -- 题目序号
    difficulty      TEXT NOT NULL,            -- 难度: easy/medium/hard
    question_type   TEXT NOT NULL,            -- 题型: choice/judgment/subjective
    output_type     TEXT NOT NULL,            -- 输出方式: option/true_false/short_answer
    subject         TEXT NOT NULL,            -- 课程: ds/os/network/database
    stem            TEXT NOT NULL,            -- 题干
    options         TEXT,                     -- 选项 (JSON)
    answer          TEXT,                     -- 答案
    analysis        TEXT,                     -- 解析
    knowledge_point TEXT,                     -- 知识点
    raw_ocr_text    TEXT,                     -- OCR 原始文本
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 代码中使用数据库

```python
from database import DatabaseManager

db = DatabaseManager('./408_questions.db')

# 插入题目
db.insert_question({
    'year': 2023, 'qid': 1,
    'difficulty': 'easy', 'question_type': 'choice',
    'output_type': 'option', 'subject': 'ds',
    'stem': '题干文本', 'options': [{'label': 'A', 'text': '...'}],
    'answer': 'B'
})

# 查询题目
questions = db.query_questions(year=2023, subject='ds')

# 导出 JSON
db.export_to_json('./output.json')

db.close()
```

---

## 常见问题

### Q: 不安装任何依赖能运行吗？

可以。`run_annotator.py` 的核心标注功能仅使用 Python 标准库，零依赖即可运行：

```bash
python run_annotator.py --test
```

### Q: OCR 功能不可用怎么办？

OCR 功能依赖 PaddleOCR，如未安装会自动降级。系统会提示 `[警告] PaddleOCR 未安装`，但标注和数据库功能仍可正常使用。可使用 `--demo` 模式用内置数据测试。

### Q: 如何添加自定义 Few-Shot 示例？

编辑 [few_shot_examples.py](few_shot_examples.py)，在 `FEW_SHOT_EXAMPLES` 列表中添加新的示例：

```python
{
    "input": "你的题目文本",
    "subject": "数据结构",
    "difficulty": "容易",
    "question_type": "单选题",
    "answer": "A"
}
```

### Q: 如何调整科目关键词？

编辑 [few_shot_examples.py](few_shot_examples.py) 中的 `SUBJECT_KEYWORDS` 字典和 `KEYWORD_WEIGHTS` 权重表。

### Q: 标注结果不准确怎么办？

1. 切换标注模式：`python run_annotator.py -m hybrid -q "题目"` （混合模式最准）
2. 添加更多 Few-Shot 示例到 `few_shot_examples.py`
3. 使用 `--prompt` 生成 Prompt 发送给大模型获取更精准的结果

### Q: 如何对接小程序？

```bash
# 导出题库为 JSON
python main.py --export ./questions.json
```

将 `questions.json` 上传到小程序后端服务器即可。

---

## 示例输出

### 标注单道题目

```
$ python run_annotator.py -q "为解决计算机主机与打印机之间速度不匹配问题，通常设置一个打印数据缓冲区...A.栈 B.队列 C.树 D.图" --verbose

--- 标注结果 ---
  科目: 数据结构
  难度: 较难
  题型: 单选题
  答案: B

--- 详细信息 ---
  科目得分: {'数据结构': 4, '计算机组成原理': 0, '操作系统': 0, '计算机网络': 0}
  最相似示例: 相似度=0.9956 → 数据结构-容易

--- JSON 输出 ---
  {"subject": "数据结构", "difficulty": "较难", "answer": "B"}
```

### 内置测试

```
$ python run_annotator.py --test

测试 1/6: 数据结构-容易  ✓ 通过
测试 2/6: 操作系统-较难  ✓ 通过
测试 3/6: 计算机组成原理-较难  ✓ 通过
测试 4/6: 计算机网络-容易  ✓ 通过
测试 5/6: 数据结构-中等  ✓ 通过
测试 6/6: 操作系统-中等  ✓ 通过

测试结果: 6/6 通过
```
