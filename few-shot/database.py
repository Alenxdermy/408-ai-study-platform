"""
数据库存储模块
使用 SQLite 存储结构化的真题数据，支持小程序直接读取
"""

import sqlite3
import json
import os
from datetime import datetime

from config import DB_TABLES


class DatabaseManager:
    """真题数据库管理器"""
    
    def __init__(self, db_path='./408_questions.db'):
        """
        初始化数据库连接
        :param db_path: 数据库文件路径
        """
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        self._init_tables()
        print(f"[数据库] 已连接: {db_path}")

    def _init_tables(self):
        """初始化数据表结构"""
        for table_name, create_sql in DB_TABLES.items():
            self.cursor.execute(create_sql)
        self.conn.commit()
        
        # 检查并添加缺失的列（兼容旧版本）
        self._migrate_schema()

    def _migrate_schema(self):
        """数据库结构迁移：添加新列"""
        # 获取现有列
        self.cursor.execute("PRAGMA table_info(questions)")
        existing_columns = {row['name'] for row in self.cursor.fetchall()}
        
        # 需要添加的列
        new_columns = {
            'difficulty': 'TEXT NOT NULL DEFAULT "medium"',
            'question_type': 'TEXT NOT NULL DEFAULT "choice"',
            'output_type': 'TEXT NOT NULL DEFAULT "option"',
            'subject': 'TEXT NOT NULL DEFAULT "unknown"'
        }
        
        for col_name, col_type in new_columns.items():
            if col_name not in existing_columns:
                try:
                    self.cursor.execute(
                        f"ALTER TABLE questions ADD COLUMN {col_name} {col_type}"
                    )
                    print(f"[数据库] 添加列: {col_name}")
                except sqlite3.OperationalError as e:
                    # 列已存在，忽略错误
                    pass
        
        self.conn.commit()

    def insert_question(self, question_data):
        """
        插入一道题目
        :param question_data: 题目数据字典
        :return: 新记录的 ID
        """
        sql = '''
            INSERT INTO questions 
            (year, qid, difficulty, question_type, output_type, subject,
             stem, options, answer, analysis, knowledge_point, raw_ocr_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        # 处理选项为 JSON 字符串
        options_json = json.dumps(
            question_data.get('options', []), 
            ensure_ascii=False
        )
        
        values = (
            question_data.get('year', 0),
            question_data.get('qid', 0),
            question_data.get('difficulty', 'medium'),
            question_data.get('question_type', 'choice'),
            question_data.get('output_type', 'option'),
            question_data.get('subject', 'unknown'),
            question_data.get('stem', ''),
            options_json,
            question_data.get('answer', ''),
            question_data.get('analysis', ''),
            question_data.get('knowledge_point', ''),
            question_data.get('raw_ocr_text', '')
        )
        
        self.cursor.execute(sql, values)
        self.conn.commit()
        return self.cursor.lastrowid

    def insert_batch(self, questions_list):
        """
        批量插入题目
        :param questions_list: 题目数据列表
        :return: 插入的题目数量
        """
        count = 0
        for q in questions_list:
            try:
                self.insert_question(q)
                count += 1
            except Exception as e:
                print(f"[错误] 插入题目失败 (id={q.get('id', '?')}): {e}")
        
        print(f"[数据库] 成功插入 {count}/{len(questions_list)} 道题目")
        return count

    def query_questions(self, year=None, difficulty=None, 
                       question_type=None, subject=None,
                       limit=None, offset=0):
        """
        根据条件查询题目
        :param year: 年份筛选
        :param difficulty: 难易程度筛选
        :param question_type: 题型筛选
        :param subject: 课程筛选
        :param limit: 返回数量限制
        :param offset: 偏移量
        :return: 题目列表
        """
        sql = "SELECT * FROM questions WHERE 1=1"
        params = []
        
        if year is not None:
            sql += " AND year = ?"
            params.append(year)
            
        if difficulty is not None:
            sql += " AND difficulty = ?"
            params.append(difficulty)
            
        if question_type is not None:
            sql += " AND question_type = ?"
            params.append(question_type)
            
        if subject is not None:
            sql += " AND subject = ?"
            params.append(subject)
        
        sql += " ORDER BY year DESC, qid ASC"
        
        if limit is not None:
            sql += " LIMIT ? OFFSET ?"
            params.extend([limit, offset])
        
        self.cursor.execute(sql, params)
        rows = self.cursor.fetchall()
        
        # 转换为字典列表
        results = []
        for row in rows:
            q = dict(row)
            # 解析选项 JSON
            if q.get('options'):
                try:
                    q['options'] = json.loads(q['options'])
                except json.JSONDecodeError:
                    q['options'] = []
            results.append(q)
        
        return results

    def get_question_by_id(self, question_id):
        """
        根据 ID 获取单个题目
        :param question_id: 题目 ID
        :return: 题目字典或 None
        """
        self.cursor.execute("SELECT * FROM questions WHERE id = ?", (question_id,))
        row = self.cursor.fetchone()
        
        if row:
            q = dict(row)
            if q.get('options'):
                try:
                    q['options'] = json.loads(q['options'])
                except json.JSONDecodeError:
                    q['options'] = []
            return q
        return None

    def update_question(self, question_id, updates):
        """
        更新题目数据
        :param question_id: 题目 ID
        :param updates: 要更新的字段字典
        """
        allowed_fields = [
            'difficulty', 'question_type', 'output_type', 'subject',
            'stem', 'options', 'answer', 'analysis', 'knowledge_point'
        ]
        
        set_clause = []
        values = []
        
        for key, value in updates.items():
            if key in allowed_fields:
                if key == 'options':
                    value = json.dumps(value, ensure_ascii=False)
                set_clause.append(f"{key} = ?")
                values.append(value)
        
        if not set_clause:
            return False
        
        sql = f"UPDATE questions SET {', '.join(set_clause)} WHERE id = ?"
        values.append(question_id)
        
        self.cursor.execute(sql, values)
        self.conn.commit()
        return True

    def delete_question(self, question_id):
        """
        删除一道题目
        :param question_id: 题目 ID
        """
        self.cursor.execute("DELETE FROM questions WHERE id = ?", (question_id,))
        self.conn.commit()

    def get_statistics(self):
        """
        获取题库统计信息
        :return: 统计数据字典
        """
        stats = {}
        
        # 总题数
        self.cursor.execute("SELECT COUNT(*) as total FROM questions")
        stats['total_questions'] = self.cursor.fetchone()['total']
        
        # 年份分布
        self.cursor.execute("""
            SELECT year, COUNT(*) as count 
            FROM questions 
            GROUP BY year 
            ORDER BY year DESC
        """)
        stats['by_year'] = [dict(row) for row in self.cursor.fetchall()]
        
        # 题型分布
        self.cursor.execute("""
            SELECT question_type, COUNT(*) as count 
            FROM questions 
            GROUP BY question_type
        """)
        stats['by_type'] = [dict(row) for row in self.cursor.fetchall()]
        
        # 课程分布
        self.cursor.execute("""
            SELECT subject, COUNT(*) as count 
            FROM questions 
            GROUP BY subject
        """)
        stats['by_subject'] = [dict(row) for row in self.cursor.fetchall()]
        
        # 难易程度分布
        self.cursor.execute("""
            SELECT difficulty, COUNT(*) as count 
            FROM questions 
            GROUP BY difficulty
        """)
        stats['by_difficulty'] = [dict(row) for row in self.cursor.fetchall()]
        
        # 输出方式分布
        self.cursor.execute("""
            SELECT output_type, COUNT(*) as count 
            FROM questions 
            GROUP BY output_type
        """)
        stats['by_output_type'] = [dict(row) for row in self.cursor.fetchall()]
        
        return stats

    def search_questions(self, keyword, limit=20):
        """
        搜索题目（全文检索）
        :param keyword: 搜索关键词
        :param limit: 返回数量
        :return: 匹配的题目列表
        """
        sql = """
            SELECT * FROM questions 
            WHERE stem LIKE ? OR knowledge_point LIKE ?
            ORDER BY year DESC
            LIMIT ?
        """
        pattern = f"%{keyword}%"
        self.cursor.execute(sql, (pattern, pattern, limit))
        rows = self.cursor.fetchall()
        
        results = []
        for row in rows:
            q = dict(row)
            if q.get('options'):
                try:
                    q['options'] = json.loads(q['options'])
                except json.JSONDecodeError:
                    q['options'] = []
            results.append(q)
        
        return results

    def export_to_json(self, output_path, filters=None):
        """
        导出题库为 JSON 文件
        :param output_path: 输出文件路径
        :param filters: 筛选条件字典
        """
        if filters is None:
            filters = {}
        
        questions = self.query_questions(**filters)
        
        # 转换为可序列化格式
        export_data = []
        for q in questions:
            export_item = {
                'id': q['id'],
                'year': q['year'],
                'qid': q['qid'],
                'difficulty': q['difficulty'],
                'question_type': q['question_type'],
                'output_type': q['output_type'],
                'subject': q['subject'],
                'stem': q['stem'],
                'options': q['options'],
                'answer': q['answer'],
                'analysis': q['analysis'],
                'knowledge_point': q['knowledge_point']
            }
            export_data.append(export_item)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        print(f"[导出] 已导出 {len(export_data)} 道题目到: {output_path}")

    def clear_all(self):
        """清空所有题目（谨慎使用）"""
        self.cursor.execute("DELETE FROM questions")
        self.conn.commit()
        print("[数据库] 已清空所有题目")

    def close(self):
        """关闭数据库连接"""
        self.conn.close()
        print("[数据库] 连接已关闭")
