"""
快速测试脚本 - 验证核心功能
"""
import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("测试 1: 配置模块")
print("=" * 50)
try:
    from config import (
        DIFFICULTY_LEVELS,
        QUESTION_TYPES,
        OUTPUT_TYPES,
        SUBJECTS,
        QUESTION_TYPE_SUPPORT_SET,
        OUTPUT_TYPE_SUPPORT_SET,
        SUBJECT_SUPPORT_SET,
        DIFFICULTY_SUPPORT_SET
    )
    print("✓ 配置模块导入成功")
    print(f"  - 难易程度: {list(DIFFICULTY_LEVELS.keys())}")
    print(f"  - 题型分类: {list(QUESTION_TYPES.keys())}")
    print(f"  - 输出方式: {list(OUTPUT_TYPES.keys())}")
    print(f"  - 课程归属: {list(SUBJECTS.keys())}")
    print(f"  - 支持集样本数:")
    for task, data in [
        ('题型', QUESTION_TYPE_SUPPORT_SET),
        ('输出方式', OUTPUT_TYPE_SUPPORT_SET),
        ('课程', SUBJECT_SUPPORT_SET),
        ('难度', DIFFICULTY_SUPPORT_SET)
    ]:
        total_samples = sum(len(v) for v in data.values())
        print(f"    {task}: {len(data)} 类, {total_samples} 样本")
except Exception as e:
    print(f"✗ 配置模块导入失败: {e}")

print()
print("=" * 50)
print("测试 2: OCR 提取模块")
print("=" * 50)
try:
    from ocr_extractor import OCRExtractor
    ocr = OCRExtractor()
    print("✓ OCR 提取器初始化成功")
    print(f"  - PaddleOCR 可用: {ocr.ocr is not None}")
    
    # 测试示例数据创建
    demo_data = ocr.create_demo_questions()
    print(f"  - 示例题目数量: {len(demo_data)}")
    
    # 测试解析功能
    raw_texts = [(q['stem'], 0.9) for q in demo_data[:3]]
    parsed = ocr.parse_questions(raw_texts)
    print(f"  - 解析测试: {len(parsed)} 道题")
    
except Exception as e:
    print(f"✗ OCR 模块测试失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 50)
print("测试 3: Few-Shot 分类器")
print("=" * 50)
try:
    from label_classifier import PrototypicalClassifier
    classifier = PrototypicalClassifier()
    print("✓ 分类器初始化成功")
    print(f"  - 降级模式: {classifier._fallback_mode}")
    print(f"  - 已加载任务: {list(classifier.prototypes.keys())}")
    
    # 测试规则分类
    test_texts = [
        "下列关于栈的叙述正确的是？A.栈是非线性结构 B.栈是线性结构",
        "TCP协议是面向连接的可靠传输协议。（ ）",
        "请简述TCP三次握手的过程及其作用。",
        "下列关于IP地址的说法错误的是？A.IPv4地址长度为32位",
        "假设系统中有4个进程P1、P2、P3、P4，它们到达就绪队列的时间和需要的CPU时间如下表所示。"
    ]
    
    print("\n  分类测试结果:")
    for text in test_texts:
        annotations = classifier._classify_with_rules(text, 'question_type')
        output_type = classifier._classify_with_rules(text, 'output_type')
        subject = classifier._classify_with_rules(text, 'subject')
        difficulty = classifier._classify_with_rules(text, 'difficulty')
        
        print(f"\n    题目: {text[:40]}...")
        print(f"    题型={annotations['label']}, 输出={output_type['label']}, "
              f"课程={subject['label']}, 难度={difficulty['label']}")
    
except Exception as e:
    print(f"✗ 分类器测试失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 50)
print("测试 4: 数据库模块")
print("=" * 50)
try:
    from database import DatabaseManager
    db = DatabaseManager(db_path='./test_408.db')
    print("✓ 数据库管理器初始化成功")
    
    # 插入测试数据
    test_questions = [
        {
            'year': 2023,
            'qid': 1,
            'difficulty': 'easy',
            'question_type': 'choice',
            'output_type': 'option',
            'subject': 'ds',
            'stem': '下列关于栈的叙述正确的是？',
            'options': [
                {'label': 'A', 'text': '栈是非线性结构'},
                {'label': 'B', 'text': '栈是线性结构'}
            ],
            'raw_ocr_text': '1. 下列关于栈的叙述正确的是？'
        },
        {
            'year': 2023,
            'qid': 2,
            'difficulty': 'medium',
            'question_type': 'judgment',
            'output_type': 'true_false',
            'subject': 'network',
            'stem': 'TCP协议是面向连接的可靠传输协议。（ ）',
            'options': [
                {'label': 'A', 'text': '正确'},
                {'label': 'B', 'text': '错误'}
            ],
            'raw_ocr_text': '2. TCP协议是面向连接的可靠传输协议。（ ）'
        }
    ]
    
    count = db.insert_batch(test_questions)
    print(f"  - 插入题目数量: {count}")
    
    # 查询统计
    stats = db.get_statistics()
    print(f"  - 题库总题数: {stats['total_questions']}")
    print(f"  - 题型分布: {stats['by_type']}")
    
    # 导出测试
    db.export_to_json('./test_export.json')
    print("  - 导出成功")
    
    # 清理
    db.clear_all()
    db.close()
    
    # 清理测试文件
    if os.path.exists('./test_408.db'):
        os.remove('./test_408.db')
    if os.path.exists('./test_export.json'):
        os.remove('./test_export.json')
        
except Exception as e:
    print(f"✗ 数据库测试失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 50)
print("所有测试完成！")
print("=" * 50)
