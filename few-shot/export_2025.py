from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from question_annotator import QuestionAnnotator  # noqa: E402


QUESTION_START_RE = re.compile(r'^\s*(\d{1,2})\.\s*(.*)$')
OPTION_RE = re.compile(r'^\s*([A-D])[\.．、\)）:：]\s*(.*)$')
PAGE_HEADER_RE = re.compile(r'^2025 年全国硕士研究生入学统一考试.*|^第\s*\d+\s*页.*|^一、.*|^二、.*')
ANSWER_KEY_RE = re.compile(r'(\d{1,2})\s*[\.．)]\s*([ABCD])', re.I)
ANSWER_BLOCK_RE = re.compile(r'(?m)^\s*(4[1-7])\.\s*')

QUESTION_PDF = Path(r'E:\python chapter\408\docs\papers-rebuild\2025.pdf')
ANSWER_PDF = Path(r'E:\python chapter\408\docs\answers\2025-answer.pdf')
PLACEHOLDER_ANSWER = '（需要人工标注答案）'


def find_tesseract() -> str:
    env = os.environ.get('TESSERACT_EXE')
    if env and Path(env).exists():
        return env

    candidates = [
      r'E:\apply\Tesseract\tesseract.exe',
      r'C:\Program Files\Tesseract-OCR\tesseract.exe',
      r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe'
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate

    found = shutil.which('tesseract')
    if found:
        return found
    raise FileNotFoundError('未找到 tesseract.exe')


def normalize_line(text: str) -> str:
    text = text.replace('\u3000', ' ')
    text = text.replace('\xa0', ' ')
    text = text.replace('\r', '')
    return re.sub(r'\s+', ' ', text).strip()


def extract_question_blocks(pdf_path: Path):
    doc = fitz.open(str(pdf_path))
    lines: list[str] = []
    for page in doc:
        page_text = page.get_text('text') or ''
        lines.extend(page_text.replace('\r\n', '\n').replace('\r', '\n').split('\n'))

    blocks = []
    current = None
    stem_lines: list[str] = []
    options: list[dict[str, str]] = []
    current_option = None

    def finalize():
        if not current:
            return
        stem = '\n'.join(item for item in stem_lines if item).strip()
        blocks.append({
            'qid': current['qid'],
            'stem': stem,
            'options': options.copy(),
            'raw_text': '\n'.join(current['raw_lines']).strip()
        })

    for raw in lines:
        line = normalize_line(raw)
        if not line:
            continue
        if PAGE_HEADER_RE.match(line):
            continue

        q_match = QUESTION_START_RE.match(line)
        if q_match:
            qid = int(q_match.group(1))
            if 1 <= qid <= 47:
                finalize()
                current = {'qid': qid, 'raw_lines': [line]}
                stem_lines = []
                options = []
                current_option = None
                stem_part = q_match.group(2).strip()
                if stem_part:
                    stem_lines.append(stem_part)
                continue

        if current is None:
            continue

        current['raw_lines'].append(line)
        o_match = OPTION_RE.match(line)
        if o_match:
            options.append({'key': o_match.group(1), 'content': o_match.group(2).strip()})
            current_option = len(options) - 1
            continue

        if current_option is not None and options:
            options[current_option]['content'] = f"{options[current_option]['content']} {line}".strip()
        else:
            stem_lines.append(line)

    finalize()
    return blocks


def ocr_pdf_pages(pdf_path: Path, pages: list[int] | None = None, zoom: float = 2.0) -> list[str]:
    tesseract = find_tesseract()
    doc = fitz.open(str(pdf_path))
    if pages is None:
        pages = list(range(doc.page_count))

    outputs = []
    with tempfile.TemporaryDirectory(prefix='ai408-ocr-') as temp_dir:
        temp_dir_path = Path(temp_dir)
        for page_index in pages:
            page = doc[page_index]
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            image_path = temp_dir_path / f'page-{page_index + 1}.png'
            pix.save(str(image_path))
            proc = subprocess.run(
                [tesseract, str(image_path), 'stdout', '--psm', '11', '-l', 'eng'],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                check=False
            )
            outputs.append(proc.stdout or '')
    return outputs


def extract_choice_answers(answer_text: str) -> dict[int, str]:
    answers: dict[int, str] = {}
    key_text = answer_text.split('41.', 1)[0]
    for match in re.finditer(r'(?<!\d)(\d{1,2})\D{0,8}([ABCD])', key_text, re.I):
        answers[int(match.group(1))] = match.group(2).upper()
    return answers


def extract_subjective_explanations(answer_texts: list[str]) -> dict[int, str]:
    merged = '\n'.join(answer_texts)
    matches = list(ANSWER_BLOCK_RE.finditer(merged))
    result: dict[int, str] = {}
    for idx, match in enumerate(matches):
        qid = int(match.group(1))
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(merged)
        chunk = merged[start:end].strip()
        chunk = re.sub(r'\s+\n', '\n', chunk)
        chunk = re.sub(r'\n{3,}', '\n\n', chunk)
        chunk = re.sub(r'[ \t]+', ' ', chunk)
        result[qid] = chunk.strip()
    return result


def classify_questions(blocks):
    annotator = QuestionAnnotator(mode='hybrid')
    results = []

    for block in blocks:
        question_text = block['stem']
        if block['options']:
            option_text = '\n'.join(f"{item['key']}. {item['content']}" for item in block['options'])
            question_text = f"{question_text}\n{option_text}".strip()

        annotation = annotator.annotate_detailed(question_text)
        qtype = annotation['question_type']
        if block['options']:
            qtype = '单选题' if len(block['options']) >= 2 else qtype

        results.append({
            'qid': block['qid'],
            'year': 2025,
            'stem': block['stem'].strip(),
            'options': block['options'],
            'raw_text': block['raw_text'],
            'source_pdf': '2025.pdf',
            'annotation': {
                'subject': annotation['subject'],
                'difficulty': annotation['difficulty'],
                'question_type': qtype,
                'answer': PLACEHOLDER_ANSWER
            },
            'analysis': annotation.get('difficulty_reason', ''),
            'detail': {
                'subject_scores': annotation.get('subject_scores', {}),
                'most_similar_similarity': (
                    annotation['most_similar_example']['similarity']
                    if annotation.get('most_similar_example') else None
                )
            }
        })

    return results


def merge_answers(items, choice_answers, subjective_answers):
    for item in items:
        qid = item['qid']
        if item['options']:
            item['annotation']['answer'] = choice_answers.get(qid, PLACEHOLDER_ANSWER)
            item['answer'] = choice_answers.get(qid, PLACEHOLDER_ANSWER)
            item['analysis'] = ''
        else:
            item['annotation']['answer'] = PLACEHOLDER_ANSWER
            item['answer'] = PLACEHOLDER_ANSWER
            item['analysis'] = subjective_answers.get(qid, '')
    return items


def main():
    parser = argparse.ArgumentParser(description='Export 2025 408 papers to JSON')
    parser.add_argument('--paper', default=str(QUESTION_PDF))
    parser.add_argument('--answer', default=str(ANSWER_PDF))
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    paper_pdf = Path(args.paper)
    answer_pdf = Path(args.answer)
    output_path = Path(args.output)

    blocks = extract_question_blocks(paper_pdf)
    items = classify_questions(blocks)

    answer_pages = ocr_pdf_pages(answer_pdf)
    choice_answers = extract_choice_answers(answer_pages[0] if answer_pages else '')
    subjective_answers = extract_subjective_explanations(answer_pages)
    merged = merge_answers(items, choice_answers, subjective_answers)

    output_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'paper': str(paper_pdf),
        'answer': str(answer_pdf),
        'count': len(merged),
        'output': str(output_path)
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
