# -*- coding: utf-8 -*-
"""
408 考研真题 Few-Shot 标注系统 - 运行入口

使用方法：
  # 标注单道题目
  python run_annotator.py --question "你的题目文本"

  # 交互模式
  python run_annotator.py --interactive

  # 从文件批量标注
  python run_annotator.py --file questions.txt

  # 从 PDF 提取题目并批量标注
  python run_annotator.py --pdf exam.pdf --output exam_annotated.json

  # 查看示例库统计
  python run_annotator.py --stats

  # 生成 Few-Shot Prompt（供大模型使用）
  python run_annotator.py --prompt "你的题目文本"

  # 运行内置测试
  python run_annotator.py --test
"""

import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from question_annotator import QuestionAnnotator


# ============================================================
# 内置测试用例
# ============================================================

TEST_QUESTIONS = [
    {
        "text": "下列关于栈的叙述中，错误的是（  ）。\nA. 栈是一种线性结构  B. 栈遵循后进先出原则\nC. 栈可以用于函数调用  D. 栈的插入操作在栈底进行",
        "expected": {"subject": "数据结构", "difficulty": "容易"}
    },
    {
        "text": "某计算机主存按字节编址，地址空间为2GB。若采用页式虚拟存储管理，页面大小为4KB，则页表项至少需要多少位？（  ）\nA. 16  B. 18  C. 20  D. 22",
        "expected": {"subject": "操作系统", "difficulty": "较难"}
    },
    {
        "text": "已知float型变量用IEEE754单精度浮点数格式表示。若float型变量x的机器数为BFC00000H，则x的值为（  ）。\nA. -1.5  B. -1.0  C. -0.5  D. -2.0",
        "expected": {"subject": "计算机组成原理", "difficulty": "较难"}
    },
    {
        "text": "在TCP/IP协议栈中，TCP协议工作在（  ）。\nA. 应用层  B. 传输层  C. 网络层  D. 数据链路层",
        "expected": {"subject": "计算机网络", "difficulty": "容易"}
    },
    {
        "text": "请设计一个算法，将两个有序链表合并为一个新的有序链表，并分析算法的时间复杂度。「此处插入题目图片」",
        "expected": {"subject": "数据结构", "difficulty": "中等"}
    },
    {
        "text": "某系统中有n个进程共享一个临界资源，每个进程需要互斥访问该资源。请使用信号量机制实现进程间的互斥，并给出PV操作的具体描述。「此处插入题目图片」",
        "expected": {"subject": "操作系统", "difficulty": "中等"}
    },
]


def print_banner():
    """打印横幅"""
    print("""
╔══════════════════════════════════════════════════════════════╗
║       408 考研真题 Few-Shot 标注系统                         ║
║       科目分类 | 难度评级 | 答案标注                          ║
╠══════════════════════════════════════════════════════════════╣
║  科目: 数据结构 / 计算机组成原理 / 操作系统 / 计算机网络     ║
║  难度: 容易 / 中等 / 较难                                    ║
║  题型: 单选题 / 综合应用题                                   ║
╚══════════════════════════════════════════════════════════════╝
""")


def run_single_question(annotator, question_text, verbose=False):
    """标注单道题目"""
    print(f"\n{'='*60}")
    print(f"输入题目：{question_text[:80]}...")
    print(f"{'='*60}")

    if verbose:
        result = annotator.annotate_detailed(question_text)
        print(f"\n--- 标注结果 ---")
        print(f"  科目: {result['subject']}")
        print(f"  难度: {result['difficulty']}")
        print(f"  题型: {result['question_type']}")
        print(f"  答案: {result['answer']}")
        print(f"\n--- 详细信息 ---")
        print(f"  科目得分: {result['subject_scores']}")
        print(f"  难度理由: {result['difficulty_reason']}")
        if result['most_similar_example']:
            sim = result['most_similar_example']
            print(f"  最相似示例: 相似度={sim['similarity']}")
            print(f"    → {sim['example']['subject']}-{sim['example']['difficulty']}")
        print(f"\n--- JSON 输出 ---")
        print(f"  {result['json_output']}")
    else:
        result = annotator.annotate(question_text)
        print(f"\n输出：{result}")

    return result


def run_test(annotator):
    """运行内置测试"""
    print("\n" + "=" * 60)
    print("运行内置测试用例")
    print("=" * 60)

    passed = 0
    total = len(TEST_QUESTIONS)

    for i, test in enumerate(TEST_QUESTIONS, 1):
        print(f"\n--- 测试 {i}/{total} ---")
        result = annotator.annotate_detailed(test["text"])
        expected = test["expected"]

        subject_ok = result["subject"] == expected["subject"]
        difficulty_ok = result["difficulty"] == expected["difficulty"]

        status = "✓ 通过" if (subject_ok and difficulty_ok) else "✗ 不一致"

        print(f"  题目: {test['text'][:50]}...")
        print(f"  标注: 科目={result['subject']}, 难度={result['difficulty']}")
        print(f"  期望: 科目={expected['subject']}, 难度={expected['difficulty']}")
        print(f"  结果: {status}")

        if subject_ok and difficulty_ok:
            passed += 1

    print(f"\n{'='*60}")
    print(f"测试结果: {passed}/{total} 通过")
    print(f"{'='*60}")
    return passed == total


def run_interactive(annotator):
    """交互模式"""
    print("\n" + "=" * 60)
    print("交互模式 - 输入题目进行标注")
    print("=" * 60)
    print("命令: test(运行测试) | stats(查看统计) | quit(退出)\n")

    while True:
        try:
            user_input = input("📝 请输入题目> ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["quit", "exit", "q"]:
                print("👋 退出")
                break
            elif user_input.lower() == "test":
                run_test(annotator)
            elif user_input.lower() == "stats":
                show_stats(annotator)
            else:
                run_single_question(annotator, user_input, verbose=True)

        except KeyboardInterrupt:
            print("\n👋 退出")
            break
        except EOFError:
            print("\n👋 退出")
            break


def run_batch_file(annotator, file_path):
    """从文件批量标注"""
    if not os.path.exists(file_path):
        print(f"[错误] 文件不存在: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        questions = [line.strip() for line in f if line.strip()]

    print(f"\n从 {file_path} 加载了 {len(questions)} 道题目")
    print("=" * 60)

    results = []
    for i, q in enumerate(questions, 1):
        print(f"\n[{i}/{len(questions)}]")
        result = run_single_question(annotator, q, verbose=False)
        results.append(result)

    print(f"\n{'='*60}")
    print(f"批量标注完成，共 {len(results)} 道")

    # 保存结果
    output_path = file_path.rsplit('.', 1)[0] + '_annotated.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"结果已保存到: {output_path}")


def run_pdf_file(annotator, pdf_path, output_path=None, year=None, use_ocr_fallback=True):
    """从 PDF 提取题目并批量标注"""
    from pdf_extractor import PDFQuestionExtractor

    extractor = PDFQuestionExtractor()
    questions = extractor.process_path(
        pdf_path,
        year=year,
        use_ocr_fallback=use_ocr_fallback
    )

    if not questions:
        print("[警告] 未从 PDF 中提取到题目")
        return []

    print(f"\n从 PDF 提取了 {len(questions)} 道题目")
    print("=" * 60)

    results = []
    for index, question in enumerate(questions, 1):
        question_text = _format_question_text(question)
        annotation = annotator.annotate_detailed(question_text)
        item = {
            "qid": question.get("id", index),
            "year": question.get("year", year or 0),
            "stem": question.get("stem", ""),
            "options": question.get("options", []),
            "raw_text": question.get("raw_text", ""),
            "source_pdf": question.get("source_pdf", ""),
            "extraction_method": question.get("extraction_method", ""),
            "annotation": {
                "subject": annotation["subject"],
                "difficulty": annotation["difficulty"],
                "question_type": annotation["question_type"],
                "answer": annotation["answer"]
            },
            "detail": {
                "subject_scores": annotation["subject_scores"],
                "difficulty_reason": annotation["difficulty_reason"],
                "most_similar_similarity": (
                    annotation["most_similar_example"]["similarity"]
                    if annotation["most_similar_example"] else None
                )
            }
        }
        results.append(item)

        print(
            f"  [{index}/{len(questions)}] 题号={item['qid']} "
            f"科目={item['annotation']['subject']} "
            f"难度={item['annotation']['difficulty']} "
            f"题型={item['annotation']['question_type']}"
        )

    if output_path is None:
        base = os.path.splitext(os.path.basename(pdf_path.rstrip("\\/")))[0]
        output_path = f"{base}_annotated.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n结果已保存到: {output_path}")
    return results


def _format_question_text(question):
    """把结构化题目还原为 Few-Shot 标注器输入文本"""
    text = question.get("raw_text") or question.get("raw_ocr_text") or question.get("stem", "")
    options = question.get("options") or []
    if not text and options:
        text = question.get("stem", "")
    if options and text == question.get("stem", ""):
        option_text = " ".join(
            f"{opt.get('label', '')}. {opt.get('text', '')}".strip()
            for opt in options
        )
        text = f"{text}\n{option_text}".strip()
    return text


def show_stats(annotator):
    """显示统计信息"""
    stats = annotator.get_stats()
    print("\n" + "=" * 60)
    print("📊 Few-Shot 示例库统计")
    print("=" * 60)
    print(f"\n总示例数: {stats['total_examples']}")

    print("\n按科目分布:")
    for subj, count in stats['by_subject'].items():
        print(f"  {subj}: {count} 个示例")

    print("\n按难度分布:")
    for diff, count in stats['by_difficulty'].items():
        print(f"  {diff}: {count} 个示例")

    print("\n按题型分布:")
    for qtype, count in stats['by_type'].items():
        print(f"  {qtype}: {count} 个示例")


def main():
    parser = argparse.ArgumentParser(
        description='408 考研真题 Few-Shot 标注系统',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--question', '-q', type=str, help='标注单道题目')
    parser.add_argument('--file', '-f', type=str, help='从文件批量标注')
    parser.add_argument('--pdf', type=str, help='从 PDF 文件或文件夹提取题目并批量标注')
    parser.add_argument('--output', '-o', type=str, help='保存批量标注结果的 JSON 路径')
    parser.add_argument('--year', '-y', type=int, help='PDF 真题年份')
    parser.add_argument('--no-ocr-fallback', action='store_true',
                       help='处理 PDF 时只读取可复制文本，不回退到 OCR')
    parser.add_argument('--interactive', '-i', action='store_true', help='交互模式')
    parser.add_argument('--stats', '-s', action='store_true', help='查看示例库统计')
    parser.add_argument('--prompt', '-p', type=str, help='生成 Few-Shot Prompt')
    parser.add_argument('--test', '-t', action='store_true', help='运行内置测试')
    parser.add_argument('--mode', '-m', type=str, default='hybrid',
                       choices=['rule', 'similarity', 'hybrid'],
                       help='标注模式: rule/similarity/hybrid (默认hybrid)')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')

    args = parser.parse_args()

    print_banner()

    # 初始化标注器
    annotator = QuestionAnnotator(mode=args.mode)

    # 执行对应功能
    if args.test:
        run_test(annotator)
    elif args.stats:
        show_stats(annotator)
    elif args.prompt:
        prompt = annotator.build_prompt(args.prompt)
        print(prompt)
    elif args.question:
        run_single_question(annotator, args.question, verbose=args.verbose)
    elif args.file:
        run_batch_file(annotator, args.file)
    elif args.pdf:
        run_pdf_file(
            annotator,
            args.pdf,
            output_path=args.output,
            year=args.year,
            use_ocr_fallback=not args.no_ocr_fallback
        )
    elif args.interactive:
        run_interactive(annotator)
    else:
        # 默认运行内置测试
        print("\n[提示] 未指定参数，运行内置测试。使用 --help 查看所有选项。\n")
        run_test(annotator)


if __name__ == '__main__':
    main()
