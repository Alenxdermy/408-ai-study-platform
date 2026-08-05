"""
408 考研真题智能标注系统 - 主程序
整合 OCR 识别、Few-Shot 分类、数据库存储三大模块

功能：
1. 从真题图片中 OCR 提取文本
2. 使用 Few-Shot 技术自动标注：题型、输出方式、课程、难易程度
3. 将标注后的数据存入数据库
"""

import os
import sys
import argparse
import json

from config import (
    DIFFICULTY_LEVELS,
    QUESTION_TYPES,
    OUTPUT_TYPES,
    SUBJECTS
)
from ocr_extractor import OCRExtractor
from label_classifier import PrototypicalClassifier
from database import DatabaseManager


def print_banner():
    """打印启动横幅"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║         408 考研真题智能标注系统                              ║
║         OCR + Few-Shot 小样本学习                            ║
╠══════════════════════════════════════════════════════════════╣
║  功能：                                                       ║
║  • 图片 OCR 识别真题内容                                     ║
║  • 自动标注题型（选择/判断/主观）                             ║
║  • 自动标注输出方式（选项/对错/简答）                         ║
║  • 自动标注课程归属（数据结构/操作系统/网络/组成原理）         ║
║  • 自动标注难易程度（简单/中等/困难）                         ║
║  • 存入数据库供小程序使用                                     ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def print_label_options():
    """打印标注选项说明"""
    print("\n" + "=" * 60)
    print("标注字段说明：")
    print("=" * 60)
    
    print("\n📊 难易程度 (difficulty):")
    for key, value in DIFFICULTY_LEVELS.items():
        print(f"  {key:10s} → {value}")
    
    print("\n📝 题型分类 (question_type):")
    for key, value in QUESTION_TYPES.items():
        print(f"  {key:12s} → {value}")
    
    print("\n📤 输出方式 (output_type):")
    for key, value in OUTPUT_TYPES.items():
        print(f"  {key:12s} → {value}")
    
    print("\n📚 课程归属 (subject):")
    for key, value in SUBJECTS.items():
        print(f"  {key:12s} → {value}")
    
    print("=" * 60)


def init_modules(args, need_ocr=True):
    """
    初始化系统模块
    :param args: 命令行参数
    :return: (ocr_extractor, classifier, db)
    """
    print("\n[初始化] 正在加载模块...")
    
    # 1. OCR 提取器
    ocr = OCRExtractor(use_gpu=args.gpu, init_ocr=need_ocr)
    print("  ✓ OCR 提取器已加载")
    
    # 2. Few-Shot 分类器
    classifier = PrototypicalClassifier()
    print("  ✓ 分类器已加载")
    
    # 3. 数据库
    db = DatabaseManager(db_path=args.db)
    print("  ✓ 数据库已连接")
    
    return ocr, classifier, db


def process_single_question(question, classifier):
    """
    处理单道题目的标注
    :param question: 原始题目数据
    :param classifier: 分类器
    :return: 标注后的题目数据
    """
    # 优先使用更完整的原始文本做分类，避免 PDF 分段后信息丢失
    source_text = (
        question.get('raw_ocr_text')
        or question.get('raw_text')
        or question.get('stem', '')
    )
    if not source_text:
        source_text = question.get('stem', '')
        options = question.get('options', [])
        if options:
            option_texts = [f"{opt.get('label', '')}.{opt.get('text', '')}" for opt in options]
            source_text = source_text + ' ' + ' '.join(option_texts)

    question_for_classify = dict(question)
    question_for_classify['stem'] = source_text

    # 执行自动标注
    annotations = classifier.classify_question(question_for_classify)
    
    # 构建完整的题目数据
    labeled_question = {
        'year': question.get('year', 0),
        'qid': question.get('id', 0),
        'difficulty': annotations.get('difficulty', {}).get('label', 'medium') 
            if isinstance(annotations.get('difficulty'), dict) 
            else annotations.get('difficulty', 'medium'),
        'question_type': annotations.get('question_type', {}).get('label', 'choice')
            if isinstance(annotations.get('question_type'), dict)
            else annotations.get('question_type', 'choice'),
        'output_type': annotations.get('output_type', {}).get('label', 'option')
            if isinstance(annotations.get('output_type'), dict)
            else annotations.get('output_type', 'option'),
        'subject': annotations.get('subject', {}).get('label', 'unknown')
            if isinstance(annotations.get('subject'), dict)
            else annotations.get('subject', 'unknown'),
        'stem': question.get('stem', ''),
        'options': question.get('options', []),
        'answer': '',
        'analysis': '',
        'knowledge_point': '',
        'raw_ocr_text': question.get('raw_text', '')
    }
    
    # 提取置信度信息
    confidences = {}
    for key in ['question_type', 'output_type', 'subject', 'difficulty']:
        val = annotations.get(key)
        if isinstance(val, dict) and 'confidence' in val:
            confidences[key] = val['confidence']
    
    return labeled_question, confidences


def process_images(ocr, classifier, db, image_dir, year=None):
    """
    处理图片文件夹
    :param ocr: OCR 提取器
    :param classifier: 分类器
    :param db: 数据库
    :param image_dir: 图片文件夹
    :param year: 年份
    """
    print(f"\n{'='*60}")
    print(f"[处理] 开始处理图片文件夹: {image_dir}")
    print(f"{'='*60}")
    
    # OCR 识别
    raw_questions = ocr.process_image_folder(image_dir, year=year)
    
    if not raw_questions:
        print("[警告] 未识别到任何题目")
        return []
    
    # Few-Shot 标注
    print("\n[标注] 正在使用 Few-Shot 技术进行自动标注...")
    labeled_questions = []
    
    for idx, question in enumerate(raw_questions, 1):
        print(f"  [{idx}/{len(raw_questions)}] 标注题目 {question.get('id', '?')}...", end=' ')
        
        labeled_q, confidences = process_single_question(question, classifier)
        labeled_questions.append(labeled_q)
        
        # 显示标注结果
        qtype = labeled_q['question_type']
        difficulty = labeled_q['difficulty']
        subject = labeled_q['subject']
        print(f"题型={qtype}, 难度={difficulty}, 课程={subject}")
    
    # 存入数据库
    print("\n[存储] 正在写入数据库...")
    db.insert_batch(labeled_questions)
    
    return labeled_questions


def process_pdfs(ocr, classifier, db, pdf_path, year=None, use_ocr_fallback=True):
    """
    处理 PDF 文件或 PDF 文件夹
    :param ocr: OCR 提取器
    :param classifier: 分类器
    :param db: 数据库
    :param pdf_path: PDF 文件或文件夹路径
    :param year: 年份
    :param use_ocr_fallback: 文本提取失败时是否回退 OCR
    """
    from pdf_extractor import PDFQuestionExtractor

    print(f"\n{'='*60}")
    print(f"[处理] 开始处理 PDF: {pdf_path}")
    print(f"{'='*60}")

    extractor = PDFQuestionExtractor(ocr_extractor=ocr)
    raw_questions = extractor.process_path(
        pdf_path,
        year=year,
        use_ocr_fallback=use_ocr_fallback
    )

    if not raw_questions:
        print("[警告] 未从 PDF 中提取到任何题目")
        return []

    print("\n[标注] 正在使用 Few-Shot 技术进行自动标注...")
    labeled_questions = []

    for idx, question in enumerate(raw_questions, 1):
        source = question.get("source_pdf", "")
        print(f"  [{idx}/{len(raw_questions)}] 标注题目 {question.get('id', '?')} ({source})...", end=' ')

        labeled_q, confidences = process_single_question(question, classifier)
        labeled_questions.append(labeled_q)

        qtype = labeled_q['question_type']
        difficulty = labeled_q['difficulty']
        subject = labeled_q['subject']
        print(f"题型={qtype}, 难度={difficulty}, 课程={subject}")

    print("\n[存储] 正在写入数据库...")
    db.insert_batch(labeled_questions)

    return labeled_questions


def run_demo_mode(ocr, classifier, db):
    """
    运行演示模式（使用示例数据）
    """
    print("\n" + "=" * 60)
    print("[演示] 使用示例数据进行标注演示")
    print("=" * 60)
    
    # 获取示例题目
    demo_questions = ocr.create_demo_questions()
    print(f"\n已加载 {len(demo_questions)} 道示例题目")
    
    # 标注
    print("\n[标注] 正在进行 Few-Shot 自动标注...")
    labeled_questions = []
    
    for idx, question in enumerate(demo_questions, 1):
        print(f"\n  题目 {idx}: {question['stem'][:50]}...")
        
        labeled_q, confidences = process_single_question(question, classifier)
        labeled_questions.append(labeled_q)
        
        print(f"    题型: {QUESTION_TYPES.get(labeled_q['question_type'], labeled_q['question_type'])}")
        print(f"    输出: {OUTPUT_TYPES.get(labeled_q['output_type'], labeled_q['output_type'])}")
        print(f"    课程: {SUBJECTS.get(labeled_q['subject'], labeled_q['subject'])}")
        print(f"    难度: {DIFFICULTY_LEVELS.get(labeled_q['difficulty'], labeled_q['difficulty'])}")
        
        if confidences:
            print(f"    置信度: {json.dumps(confidences, ensure_ascii=False)}")
    
    # 存入数据库
    print("\n[存储] 正在写入数据库...")
    db.insert_batch(labeled_questions)
    
    return labeled_questions


def show_statistics(db):
    """
    显示题库统计信息
    """
    stats = db.get_statistics()
    
    print("\n" + "=" * 60)
    print("📊 题库统计信息")
    print("=" * 60)
    
    print(f"\n总题数: {stats['total_questions']}")
    
    if stats['by_year']:
        print("\n📅 年份分布:")
        for item in stats['by_year']:
            print(f"  {item['year']}年: {item['count']} 题")
    
    if stats['by_type']:
        print("\n📝 题型分布:")
        for item in stats['by_type']:
            type_name = QUESTION_TYPES.get(item['question_type'], item['question_type'])
            print(f"  {type_name}: {item['count']} 题")
    
    if stats['by_subject']:
        print("\n📚 课程分布:")
        for item in stats['by_subject']:
            subject_name = SUBJECTS.get(item['subject'], item['subject'])
            print(f"  {subject_name}: {item['count']} 题")
    
    if stats['by_difficulty']:
        print("\n📊 难易程度分布:")
        for item in stats['by_difficulty']:
            diff_name = DIFFICULTY_LEVELS.get(item['difficulty'], item['difficulty'])
            print(f"  {diff_name}: {item['count']} 题")
    
    if stats['by_output_type']:
        print("\n📤 输出方式分布:")
        for item in stats['by_output_type']:
            output_name = OUTPUT_TYPES.get(item['output_type'], item['output_type'])
            print(f"  {output_name}: {item['count']} 题")
    
    print("=" * 60)


def interactive_mode(ocr, classifier, db):
    """
    交互式模式
    """
    print("\n" + "=" * 60)
    print("🎮 进入交互模式")
    print("=" * 60)
    print("输入命令（或 'help' 查看帮助）：")
    print()
    
    while True:
        try:
            cmd = input("🎯 命令> ").strip()
            
            if cmd.lower() in ['quit', 'exit', 'q']:
                print("👋 退出程序")
                break
                
            elif cmd.lower() == 'help':
                print("""
可用命令：
  demo          运行演示模式
  stats         查看题库统计
  list [n]      列出最近 n 道题目
  search <关键词> 搜索题目
  export [路径] 导出题库为 JSON
  clear         清空所有题目
  help          显示帮助
  quit          退出程序
                """)
                
            elif cmd.lower() == 'demo':
                run_demo_mode(ocr, classifier, db)
                
            elif cmd.lower() == 'stats':
                show_statistics(db)
                
            elif cmd.lower().startswith('list'):
                parts = cmd.split()
                n = int(parts[1]) if len(parts) > 1 else 10
                questions = db.query_questions(limit=n)
                if questions:
                    print(f"\n📋 最近 {len(questions)} 道题目:")
                    print("-" * 60)
                    for q in questions:
                        print(f"  [{q['id']}] {q['stem'][:50]}...")
                        print(f"      年={q['year']} | 题型={q['question_type']} | "
                              f"课程={q['subject']} | 难度={q['difficulty']}")
                else:
                    print("题库为空")
                    
            elif cmd.lower().startswith('search'):
                parts = cmd.split(maxsplit=1)
                if len(parts) > 1:
                    keyword = parts[1]
                    results = db.search_questions(keyword)
                    if results:
                        print(f"\n🔍 搜索 '{keyword}' 找到 {len(results)} 条结果:")
                        for q in results:
                            print(f"  [{q['id']}] {q['stem'][:60]}...")
                    else:
                        print(f"未找到包含 '{keyword}' 的题目")
                        
            elif cmd.lower().startswith('export'):
                parts = cmd.split()
                path = parts[1] if len(parts) > 1 else './questions_export.json'
                db.export_to_json(path)
                
            elif cmd.lower() == 'clear':
                confirm = input("⚠️ 确定要清空所有题目吗？(y/N): ")
                if confirm.lower() == 'y':
                    db.clear_all()
                    
            elif cmd.strip():
                print(f"❌ 未知命令: {cmd}，输入 'help' 查看可用命令")
                
        except KeyboardInterrupt:
            print("\n👋 退出程序")
            break
        except EOFError:
            print("\n👋 退出程序")
            break
        except Exception as e:
            print(f"❌ 错误: {e}")


def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(
        description='408 考研真题智能标注系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 处理指定文件夹的真题
  python main.py --input ./exam_images/2023

  # 处理 PDF 真题并写入数据库
  python main.py --pdf ./exam_pdfs/2023.pdf --year 2023
  
  # 运行演示模式
  python main.py --demo
  
  # 查看统计信息
  python main.py --stats
  
  # 导出题库
  python main.py --export ./questions.json
  
  # 交互模式
  python main.py --interactive
        """
    )
    
    parser.add_argument('--input', '-i', type=str, 
                        help='真题图片文件夹路径')
    parser.add_argument('--pdf', type=str,
                        help='真题 PDF 文件路径或包含 PDF 的文件夹路径')
    parser.add_argument('--year', '-y', type=int, 
                        help='真题年份')
    parser.add_argument('--db', type=str, default='./408_questions.db',
                        help='数据库文件路径')
    parser.add_argument('--demo', '-d', action='store_true',
                        help='运行演示模式')
    parser.add_argument('--interactive', '-t', action='store_true',
                        help='进入交互模式')
    parser.add_argument('--stats', '-s', action='store_true',
                        help='显示题库统计信息')
    parser.add_argument('--export', '-e', type=str, metavar='PATH',
                        help='导出题库为 JSON 文件')
    parser.add_argument('--gpu', action='store_true',
                        help='使用 GPU 加速 OCR')
    parser.add_argument('--no-ocr-fallback', action='store_true',
                        help='处理 PDF 时只读取可复制文本，不回退到 OCR')
    parser.add_argument('--clear', action='store_true',
                        help='清空数据库')
    
    args = parser.parse_args()
    
    # 打印横幅
    print_banner()
    print_label_options()
    
    need_ocr = bool(args.input or (args.pdf and not args.no_ocr_fallback))

    # 初始化模块
    ocr, classifier, db = init_modules(args, need_ocr=need_ocr)
    
    try:
        if args.clear:
            confirm = input("⚠️ 确定要清空所有题目吗？(y/N): ")
            if confirm.lower() == 'y':
                db.clear_all()
        
        elif args.stats:
            show_statistics(db)
            
        elif args.demo:
            run_demo_mode(ocr, classifier, db)
            show_statistics(db)

        elif args.pdf:
            if os.path.exists(args.pdf):
                process_pdfs(
                    ocr,
                    classifier,
                    db,
                    args.pdf,
                    year=args.year,
                    use_ocr_fallback=not args.no_ocr_fallback
                )
                show_statistics(db)
            else:
                print(f"[错误] PDF 路径不存在: {args.pdf}")
            
        elif args.input:
            if os.path.isdir(args.input):
                process_images(ocr, classifier, db, args.input, year=args.year)
                show_statistics(db)
            else:
                print(f"[错误] 文件夹不存在: {args.input}")
                
        elif args.export:
            db.export_to_json(args.export)
            
        elif args.interactive:
            interactive_mode(ocr, classifier, db)
            
        else:
            # 默认：演示模式
            print("\n[提示] 未指定参数，默认运行演示模式。")
            print("       使用 --help 查看所有可用选项。\n")
            run_demo_mode(ocr, classifier, db)
            show_statistics(db)
            
    finally:
        # 清理
        db.close()


if __name__ == '__main__':
    main()
