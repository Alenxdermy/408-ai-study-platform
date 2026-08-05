# -*- coding: utf-8 -*-
"""
PDF 真题提取模块

处理流程：
1. 优先从文本型 PDF 中直接提取文字。
2. 如果没有有效文字或解析不到题目，则把 PDF 页面渲染成图片，再交给 OCR 识别。
3. 复用 OCRExtractor 的题目切分逻辑，输出结构化题目列表。
"""

import os
import re
import tempfile

from ocr_extractor import OCRExtractor


class PDFQuestionExtractor:
    """从 PDF 中提取 408 真题题目。"""

    def __init__(self, ocr_extractor=None, render_dpi=200, min_text_chars=80):
        """
        :param ocr_extractor: 可选 OCRExtractor；扫描版 PDF 回退 OCR 时使用
        :param render_dpi: PDF 转图片分辨率
        :param min_text_chars: 判定文本型 PDF 有效的最少字符数
        """
        self.parser = OCRExtractor(init_ocr=False)
        self.ocr_extractor = ocr_extractor
        self.render_dpi = render_dpi
        self.min_text_chars = min_text_chars

    def process_path(self, path, year=None, use_ocr_fallback=True):
        """
        处理单个 PDF 文件或包含 PDF 的文件夹。
        :return: 结构化题目列表
        """
        pdf_files = self._collect_pdf_files(path)
        if not pdf_files:
            print(f"[PDF] 未找到 PDF 文件: {path}")
            return []

        all_questions = []
        for pdf_path in pdf_files:
            all_questions.extend(
                self.process_pdf(
                    pdf_path,
                    year=year,
                    use_ocr_fallback=use_ocr_fallback
                )
            )
        return all_questions

    def process_pdf(self, pdf_path, year=None, use_ocr_fallback=True):
        """
        处理单个 PDF 文件。
        :return: 结构化题目列表
        """
        if not os.path.isfile(pdf_path):
            print(f"[PDF] 文件不存在: {pdf_path}")
            return []

        inferred_year = year if year is not None else self._infer_year(pdf_path)
        print(f"\n[PDF] 开始处理: {pdf_path}")

        raw_text = self.extract_text_from_pdf(pdf_path)
        questions = []
        extraction_method = "text"

        if len(raw_text.strip()) >= self.min_text_chars:
            questions = self.parse_questions_from_text(raw_text)
            print(f"[PDF] 文本提取解析到 {len(questions)} 道题")
        else:
            print("[PDF] 未提取到足够文本，准备尝试 OCR 回退")

        if not questions and use_ocr_fallback:
            extraction_method = "ocr"
            questions = self.extract_questions_with_ocr(pdf_path)
            print(f"[PDF] OCR 回退解析到 {len(questions)} 道题")

        for idx, question in enumerate(questions, 1):
            question["year"] = inferred_year
            question["source_pdf"] = os.path.basename(pdf_path)
            question["source_pdf_path"] = os.path.abspath(pdf_path)
            question["extraction_method"] = extraction_method
            if not question.get("id"):
                question["id"] = idx

        return questions

    def extract_text_from_pdf(self, pdf_path):
        """从文本型 PDF 中提取文字。"""
        text = self._extract_text_with_pymupdf(pdf_path)
        if text.strip():
            return text

        text = self._extract_text_with_pdfplumber(pdf_path)
        if text.strip():
            return text
        return self._extract_text_with_pypdf(pdf_path)

    def parse_questions_from_text(self, text):
        """
        将 PDF 文本解析为题目列表。
        PDF 常把 A/B/C/D 选项挤在一行，这里先做行切分再复用通用解析器。
        """
        lines = self._normalize_pdf_text_lines(text)
        raw_texts = [(line, 1.0) for line in lines]
        return self.parser.parse_questions(raw_texts)

    def extract_questions_with_ocr(self, pdf_path):
        """把扫描版 PDF 渲染为图片后 OCR 识别。"""
        if self.ocr_extractor is None:
            self.ocr_extractor = OCRExtractor()

        if self.ocr_extractor.ocr is None:
            print("[PDF] OCR 依赖不可用，请先安装 paddleocr")
            return []

        image_paths = self._render_pdf_to_images(pdf_path)
        if not image_paths:
            return []

        raw_texts = []
        for image_path in image_paths:
            raw_texts.extend(self.ocr_extractor.extract_text_from_image(image_path))

        return self.parser.parse_questions(raw_texts)

    def _collect_pdf_files(self, path):
        if os.path.isfile(path) and path.lower().endswith(".pdf"):
            return [path]

        if os.path.isdir(path):
            return [
                os.path.join(path, name)
                for name in sorted(os.listdir(path))
                if name.lower().endswith(".pdf")
            ]

        return []

    def _infer_year(self, path):
        match = re.search(r"(19|20)\d{2}", os.path.basename(path))
        return int(match.group()) if match else 0

    def _extract_text_with_pymupdf(self, pdf_path):
        try:
            import fitz
        except ImportError:
            return ""

        pages = []
        try:
            document = fitz.open(pdf_path)
            for page in document:
                page_text = page.get_text("text") or ""
                if page_text.strip():
                    pages.append(page_text)
            document.close()
        except Exception as exc:
            print(f"[PDF] PyMuPDF 提取失败: {exc}")
            return ""

        return "\n".join(pages)

    def _extract_text_with_pdfplumber(self, pdf_path):
        try:
            import pdfplumber
        except ImportError:
            return ""

        pages = []
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        pages.append(page_text)
        except Exception as exc:
            print(f"[PDF] pdfplumber 提取失败: {exc}")
            return ""

        return "\n".join(pages)

    def _extract_text_with_pypdf(self, pdf_path):
        try:
            from pypdf import PdfReader
        except ImportError:
            print("[PDF] 未安装 pypdf/pdfplumber，无法读取文本型 PDF")
            return ""

        pages = []
        try:
            reader = PdfReader(pdf_path)
            for page in reader.pages:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    pages.append(page_text)
        except Exception as exc:
            print(f"[PDF] pypdf 提取失败: {exc}")
            return ""

        return "\n".join(pages)

    def _normalize_pdf_text_lines(self, text):
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+", " ", text)

        normalized_lines = []
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            normalized_lines.extend(self._split_inline_options(line))

        return normalized_lines

    def _split_inline_options(self, line):
        option_pattern = re.compile(r"(?<![A-Za-z0-9])([A-D])[\.\uFF0E、\)）:：]\s*")
        matches = list(option_pattern.finditer(line))
        if not matches:
            return [line]

        parts = []
        first_start = matches[0].start()
        prefix = line[:first_start].strip()
        if prefix:
            parts.append(prefix)

        for index, match in enumerate(matches):
            next_start = matches[index + 1].start() if index + 1 < len(matches) else len(line)
            option_text = line[match.start():next_start].strip()
            if option_text:
                parts.append(option_text)

        return parts

    def _render_pdf_to_images(self, pdf_path):
        try:
            import fitz
        except ImportError:
            print("[PDF] 未安装 PyMuPDF(fitz)，无法把扫描版 PDF 转为图片")
            return []

        image_paths = []
        temp_dir = tempfile.mkdtemp(prefix="few_shot_pdf_")
        scale = self.render_dpi / 72

        try:
            document = fitz.open(pdf_path)
            matrix = fitz.Matrix(scale, scale)
            for page_index in range(len(document)):
                page = document.load_page(page_index)
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                image_path = os.path.join(temp_dir, f"page_{page_index + 1:03d}.png")
                pix.save(image_path)
                image_paths.append(image_path)
            document.close()
        except Exception as exc:
            print(f"[PDF] PDF 转图片失败: {exc}")
            return []

        return image_paths
