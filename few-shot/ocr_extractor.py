"""
OCR 文本提取模块
使用 PaddleOCR 识别图片中的真题内容，并进行结构化解析
"""

import re
import os

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    PADDLEOCR_AVAILABLE = False


class OCRExtractor:
    """真题图片 OCR 提取器"""

    def __init__(self, use_gpu=False, init_ocr=True):
        """
        初始化 OCR 引擎
        :param use_gpu: 是否使用 GPU 加速
        :param init_ocr: 是否初始化 PaddleOCR；仅解析文本时可关闭
        """
        self.ocr = None
        self._init_patterns()

        if not init_ocr:
            return

        if not PADDLEOCR_AVAILABLE:
            print("[警告] PaddleOCR 未安装，OCR 功能不可用。请运行: pip install paddleocr")
            print("[错误] 无法初始化 OCR 引擎，请先安装 paddleocr。")
            return

        self.ocr = PaddleOCR(
            use_angle_cls=True,
            lang='ch',
            use_gpu=use_gpu,
            show_log=False
        )

    def _init_patterns(self):
        """初始化题目解析正则。"""
        # 正则表达式模式
        # 题号模式：兼容 "1." "1、" "(1)" "1)" "第1题" 等
        self.qid_pattern = re.compile(r'^\s*(?:第)?(\d+)(?:题)?[\.、\)）:\s]')
        
        # 选项模式：兼容 "A." "A、" "A)" "A:" "A．" 等
        self.option_pattern = re.compile(r'^\s*([A-D])[\.、\)）:：\s]')
        
        # 判断题模式
        self.judgment_pattern = re.compile(r'[（(]\s*[)）]')
        
        # 公式/特殊符号清理
        self.formula_pattern = re.compile(r'[=+×÷≤≥≠∞∑∫√]+')

    def extract_text_from_image(self, image_path):
        """
        从图片中提取原始文本行
        :param image_path: 图片路径
        :return: 文本行列表 [(text, confidence), ...]
        """
        if self.ocr is None:
            return []
            
        if not os.path.exists(image_path):
            print(f"[错误] 图片不存在: {image_path}")
            return []
            
        try:
            result = self.ocr.ocr(image_path, cls=True)
            if not result or not result[0]:
                print(f"[警告] OCR 识别结果为空: {image_path}")
                return []
                
            texts = []
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                if confidence > 0.6:  # 降低阈值以获取更多内容
                    texts.append((text, confidence))
                    
            return texts
            
        except Exception as e:
            print(f"[错误] OCR 识别失败: {e}")
            return []

    def parse_questions(self, raw_texts):
        """
        解析原始文本，按题目切分并结构化
        :param raw_texts: OCR 提取的原始文本行列表
        :return: 结构化题目列表
        """
        questions = []
        current_question = None
        raw_lines = [text for text, _ in raw_texts] if raw_texts else []
        
        for text in raw_lines:
            # 清理特殊字符
            cleaned_text = self._clean_text(text)
            
            # 尝试匹配新题号
            qid_match = self.qid_pattern.match(cleaned_text)
            if qid_match:
                # 保存上一题
                if current_question and current_question.get('stem'):
                    questions.append(current_question)
                    
                # 初始化新题目
                current_question = {
                    'id': int(qid_match.group(1)),
                    'stem': '',
                    'options': [],
                    'raw_text': cleaned_text,
                    'raw_lines': [cleaned_text]
                }
                
                # 提取题干（题号后面的内容）
                stem_part = cleaned_text[qid_match.end():].strip()
                if stem_part:
                    current_question['stem'] = stem_part
                    
            elif current_question is not None:
                # 尝试匹配选项
                opt_match = self.option_pattern.match(cleaned_text)
                if opt_match:
                    opt_letter = opt_match.group(1)
                    opt_content = cleaned_text[opt_match.end():].strip()
                    current_question['options'].append({
                        'label': opt_letter,
                        'text': opt_content
                    })
                else:
                    # 补充题干或选项内容
                    if not current_question['options']:
                        # 题干阶段
                        current_question['stem'] += cleaned_text.strip()
                    elif current_question['options']:
                        # 选项阶段，补充当前选项内容
                        current_question['options'][-1]['text'] += cleaned_text.strip()
                        
                current_question['raw_text'] += '\n' + cleaned_text
                current_question['raw_lines'].append(cleaned_text)
                
        # 保存最后一题
        if current_question and current_question.get('stem'):
            questions.append(current_question)
            
        # 进一步处理：识别判断题并自动补充选项
        questions = self._post_process_questions(questions)
        
        return questions

    def _clean_text(self, text):
        """清理 OCR 识别的文本"""
        # 全角转半角
        text = self._fullwidth_to_halfwidth(text)
        # 清理多余空白
        text = re.sub(r'\s+', ' ', text).strip()
        # 清理特殊标点符号
        text = text.replace('　', ' ')
        return text

    def _fullwidth_to_halfwidth(self, text):
        """全角字符转半角"""
        result = []
        for char in text:
            code = ord(char)
            if 0xFF01 <= code <= 0xFF5E:
                # 全角可打印字符
                result.append(chr(code - 0xFEE0))
            elif code == 0x3000:
                # 全角空格
                result.append(' ')
            else:
                result.append(char)
        return ''.join(result)

    def _post_process_questions(self, questions):
        """
        后处理：识别题型特征，自动补充判断题选项
        """
        processed = []
        for q in questions:
            stem = q.get('stem', '')
            options = q.get('options', [])
            
            # 检查是否为判断题
            if self._is_judgment_question(stem, options):
                # 判断题默认选项
                q['options'] = [
                    {'label': 'A', 'text': '正确'},
                    {'label': 'B', 'text': '错误'}
                ]
            
            processed.append(q)
            
        return processed

    def _is_judgment_question(self, stem, options):
        """判断是否为判断题"""
        # 检查题干中是否有判断题特征
        judgment_keywords = ['正确', '错误', '判断', '对错']
        has_judgment_word = any(kw in stem for kw in judgment_keywords)
        
        # 检查是否有括号（判断题常见格式）
        has_parenthesis = '（' in stem or '(' in stem or ')' in stem or '）' in stem
        
        # 检查是否没有选项（判断题通常没有 A/B/C/D 选项）
        no_options = len(options) == 0
        
        # 满足任意两个条件即可判定为判断题
        conditions = sum([has_judgment_word, has_parenthesis, no_options])
        return conditions >= 2

    def process_image_folder(self, folder_path, year=None):
        """
        批量处理文件夹中的真题图片
        :param folder_path: 图片文件夹路径
        :param year: 真题年份（可选，从文件夹名推断）
        :return: 所有题目列表
        """
        if not os.path.isdir(folder_path):
            print(f"[错误] 文件夹不存在: {folder_path}")
            return []
            
        # 从文件夹名推断年份
        if year is None:
            folder_name = os.path.basename(folder_path)
            year_match = re.search(r'\d{4}', folder_name)
            if year_match:
                year = int(year_match.group())
            else:
                year = 0
                
        # 获取所有图片文件
        image_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif')
        image_files = sorted([
            f for f in os.listdir(folder_path)
            if f.lower().endswith(image_extensions)
        ])
        
        if not image_files:
            print(f"[警告] 文件夹中没有找到图片: {folder_path}")
            return []
            
        print(f"\n[OCR] 开始处理 {len(image_files)} 张图片 (年份: {year})")
        all_questions = []
        
        for idx, img_file in enumerate(image_files, 1):
            img_path = os.path.join(folder_path, img_file)
            print(f"  [{idx}/{len(image_files)}] 处理: {img_file}")
            
            # OCR 识别
            raw_texts = self.extract_text_from_image(img_path)
            if not raw_texts:
                print(f"    → 跳过（无有效识别内容）")
                continue
                
            # 解析题目
            questions = self.parse_questions(raw_texts)
            print(f"    → 识别到 {len(questions)} 道题目")
            
            # 添加年份信息
            for q in questions:
                q['year'] = year
                q['source_image'] = img_file
                
            all_questions.extend(questions)
            
        print(f"[OCR] 处理完成，共识别 {len(all_questions)} 道题目")
        return all_questions

    def create_demo_questions(self):
        """
        创建示例题目数据（用于演示和测试）
        :return: 示例题目列表
        """
        demo_questions = [
            {
                'id': 1,
                'year': 2023,
                'stem': '下列关于栈的叙述正确的是？',
                'options': [
                    {'label': 'A', 'text': '栈是非线性结构'},
                    {'label': 'B', 'text': '栈是线性结构'},
                    {'label': 'C', 'text': '栈是树形结构'},
                    {'label': 'D', 'text': '栈是图形结构'}
                ],
                'raw_text': '1. 下列关于栈的叙述正确的是？\nA.栈是非线性结构\nB.栈是线性结构\nC.栈是树形结构\nD.栈是图形结构',
                'raw_lines': ['1. 下列关于栈的叙述正确的是？', 'A.栈是非线性结构', 'B.栈是线性结构', 'C.栈是树形结构', 'D.栈是图形结构'],
                'source_image': 'demo.png'
            },
            {
                'id': 2,
                'year': 2023,
                'stem': 'TCP协议是一种面向连接的可靠传输协议。（ ）',
                'options': [
                    {'label': 'A', 'text': '正确'},
                    {'label': 'B', 'text': '错误'}
                ],
                'raw_text': '2. TCP协议是一种面向连接的可靠传输协议。（ ）',
                'raw_lines': ['2. TCP协议是一种面向连接的可靠传输协议。（ ）'],
                'source_image': 'demo.png'
            },
            {
                'id': 3,
                'year': 2023,
                'stem': '请简述TCP三次握手的过程及其作用。',
                'options': [],
                'raw_text': '3. 请简述TCP三次握手的过程及其作用。',
                'raw_lines': ['3. 请简述TCP三次握手的过程及其作用。'],
                'source_image': 'demo.png'
            },
            {
                'id': 4,
                'year': 2023,
                'stem': '下列关于IP地址的说法错误的是？',
                'options': [
                    {'label': 'A', 'text': 'IPv4地址长度为32位'},
                    {'label': 'B', 'text': 'IPv6地址长度为128位'},
                    {'label': 'C', 'text': 'IP地址可以重复使用'},
                    {'label': 'D', 'text': 'IP地址由网络号和主机号组成'}
                ],
                'raw_text': '4. 下列关于IP地址的说法错误的是？\nA.IPv4地址长度为32位\nB.IPv6地址长度为128位\nC.IP地址可以重复使用\nD.IP地址由网络号和主机号组成',
                'raw_lines': ['4. 下列关于IP地址的说法错误的是？', 'A.IPv4地址长度为32位', 'B.IPv6地址长度为128位', 'C.IP地址可以重复使用', 'D.IP地址由网络号和主机号组成'],
                'source_image': 'demo.png'
            },
            {
                'id': 5,
                'year': 2023,
                'stem': '假设系统中有4个进程P1、P2、P3、P4，它们到达就绪队列的时间和需要的CPU时间如下表所示。请分别使用FCFS、SJF、RR算法计算每个进程的周转时间和带权周转时间。',
                'options': [],
                'raw_text': '5. 假设系统中有4个进程P1、P2、P3、P4，它们到达就绪队列的时间和需要的CPU时间如下表所示。请分别使用FCFS、SJF、RR算法计算每个进程的周转时间和带权周转时间。',
                'raw_lines': ['5. 假设系统中有4个进程P1、P2、P3、P4，它们到达就绪队列的时间和需要的CPU时间如下表所示。请分别使用FCFS、SJF、RR算法计算每个进程的周转时间和带权周转时间。'],
                'source_image': 'demo.png'
            }
        ]
        
        return demo_questions
