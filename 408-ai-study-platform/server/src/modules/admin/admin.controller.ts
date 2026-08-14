import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Response } from 'express';
import { Op, type Transaction } from 'sequelize';
import { ChapterModel } from '../../models/chapter.model.js';
import { FavoriteModel } from '../../models/favorite.model.js';
import { PaperModel } from '../../models/paper.model.js';
import { QuestionModel } from '../../models/question.model.js';
import { ReviewTaskModel } from '../../models/review-task.model.js';
import { StudyRecordModel } from '../../models/study-record.model.js';
import { WrongBookModel } from '../../models/wrong-book.model.js';
import { sequelize } from '../../shared/database.js';
import { AppError, ok } from '../../shared/http.js';
import { serializeQuestion, serializeQuestions } from '../question/question.serializer.js';

type QuestionType = 'single' | 'multiple' | 'judge' | 'blank' | 'essay';
type SubjectKey = 'data_structure' | 'computer_organization' | 'os' | 'computer_network';
type ImportJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';
type ImportJob = {
  id: string;
  status: ImportJobStatus;
  fileName: string;
  year?: number;
  stage: string;
  result?: {
    created: number;
    updated: number;
    skipped: number;
    total: number;
    items: any[];
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const importJobs = new Map<string, ImportJob>();

const SUBJECT_LABELS: Record<SubjectKey, string> = {
  data_structure: '数据结构',
  computer_organization: '计算机组成原理',
  os: '操作系统',
  computer_network: '计算机网络'
};

const SUBJECT_ALIASES: Record<string, SubjectKey> = {
  data_structure: 'data_structure',
  data_structures: 'data_structure',
  数据结构: 'data_structure',
  ds: 'data_structure',
  computer_organization: 'computer_organization',
  计算机组成原理: 'computer_organization',
  组成原理: 'computer_organization',
  co: 'computer_organization',
  os: 'os',
  操作系统: 'os',
  computer_network: 'computer_network',
  计算机网络: 'computer_network',
  network: 'computer_network',
  net: 'computer_network'
};

const QUESTION_TYPE_ALIASES: Record<string, QuestionType> = {
  single: 'single',
  单选题: 'single',
  choice: 'single',
  multiple: 'multiple',
  多选题: 'multiple',
  judge: 'judge',
  judgment: 'judge',
  判断题: 'judge',
  blank: 'blank',
  填空题: 'blank',
  essay: 'essay',
  subjective: 'essay',
  主观题: 'essay',
  综合应用题: 'essay'
};

const DEFAULT_CHAPTER_TITLES: Record<SubjectKey, string> = {
  data_structure: '导入题库',
  computer_organization: '导入题库',
  os: '导入题库',
  computer_network: '导入题库'
};

const normalizeSubject = (value: unknown): SubjectKey => {
  const key = String(value ?? '').trim();
  if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key];
  return 'data_structure';
};

const normalizeQuestionType = (value: unknown): QuestionType => {
  const key = String(value ?? '').trim();
  return QUESTION_TYPE_ALIASES[key] ?? 'single';
};

const normalizeDifficulty = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.min(5, Math.round(value)));
  }

  const text = String(value ?? '').trim().toLowerCase();
  if (['easy', '容易', '简单'].includes(text)) return 1;
  if (['medium', '中等'].includes(text)) return 3;
  if (['hard', '较难', '困难'].includes(text)) return 5;

  const numeric = Number(text);
  if (Number.isFinite(numeric)) return Math.max(1, Math.min(5, Math.round(numeric)));
  return 3;
};

const normalizeStatus = (value: unknown) => (String(value ?? '').trim() === 'draft' ? 'draft' : 'published');

const normalizeTags = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  const text = String(value ?? '').trim();
  if (!text) return [];
  return text
    .split(/[，,;；\n]/)
    .map(item => item.trim())
    .filter(Boolean);
};

const normalizeOptions = (value: unknown) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (typeof item === 'string') {
          return { key: String.fromCharCode(65 + index), content: item.trim() };
        }
        const key = String(item?.key ?? item?.label ?? item?.option ?? String.fromCharCode(65 + index)).trim();
        const content = String(item?.content ?? item?.text ?? item?.value ?? '').trim();
        return content ? { key, content } : null;
      })
      .filter(Boolean);
  }

  const text = String(value).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return normalizeOptions(parsed);
  } catch {
    // fall back to line parsing
  }

  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^([A-H])[\.\、\)\：:]\s*(.+)$/);
      if (match) return { key: match[1], content: match[2].trim() };
      return { key: String.fromCharCode(65 + index), content: line };
    });
};

const normalizeAnswer = (value: unknown, questionType: QuestionType) => {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  const text = String(value ?? '').trim();
  if (!text) return '';

  if (questionType === 'multiple') {
    if (/^[A-H]+$/.test(text) && text.length > 1) return text.split('');
    return text.split(/[，,、\s]+/).map(item => item.trim()).filter(Boolean);
  }

  if (/^[A-H]$/.test(text)) return text;
  return text;
};

const normalizeSource = (source: unknown, qid: unknown) => {
  const base = String(source ?? '').trim() || '后台录入';
  const id = String(qid ?? '').trim();
  return id ? `${base}#${id}` : base;
};

const resolveChapterId = async (subject: SubjectKey, chapterId?: string | null) => {
  if (chapterId) {
    const chapter = await ChapterModel.findByPk(chapterId);
    if (!chapter) throw new AppError(400, '章节不存在', 'CHAPTER_NOT_FOUND');
    return chapter.id;
  }

  const [chapter] = await ChapterModel.findOrCreate({
    where: { subject, title: DEFAULT_CHAPTER_TITLES[subject] },
    defaults: {
      subject,
      title: DEFAULT_CHAPTER_TITLES[subject],
      order: 0,
      knowledgePoints: []
    }
  });
  return chapter.id;
};

const extractPayloads = (body: any) => {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.questions)) return body.questions;
  if (Array.isArray(body?.items)) return body.items;
  return [];
};

const buildQuestionPayload = async (
  raw: Record<string, any>,
  fallbackSource = '',
  fallbackChapterId?: string | null
) => {
  const sourceData = raw.annotation ?? raw;
  const questionType = normalizeQuestionType(sourceData.question_type ?? raw.question_type ?? raw.type);
  const subject = normalizeSubject(sourceData.subject ?? raw.subject);
  const chapterId = await resolveChapterId(subject, raw.chapterId ?? fallbackChapterId ?? null);
  const source = normalizeSource(raw.source ?? raw.source_pdf ?? fallbackSource, raw.qid ?? raw.id);

  const stem = String(raw.stem ?? raw.question ?? raw.text ?? '').trim();
  if (!stem) throw new AppError(400, '题干不能为空', 'QUESTION_STEM_REQUIRED');

  const options = normalizeOptions(raw.options ?? sourceData.options ?? []);
  const answer = normalizeAnswer(sourceData.answer ?? raw.answer ?? '', questionType);
  const difficulty = normalizeDifficulty(sourceData.difficulty ?? raw.difficulty);
  const tags = normalizeTags(raw.tags ?? sourceData.tags ?? raw.knowledge_point);
  const explanation = String(raw.explanation ?? sourceData.explanation ?? raw.analysis ?? '').trim();
  const year = Number(raw.year ?? 0) || null;
  const score = Number(raw.score ?? (questionType === 'essay' ? 5 : questionType === 'multiple' ? 3 : 2));
  const status = normalizeStatus(raw.status ?? 'published');

  return {
    subject,
    chapterId,
    type: questionType,
    stem,
    options,
    answer,
    explanation,
    difficulty,
    tags,
    source,
    year,
    score,
    status
  };
};

const toQuestionDTO = serializeQuestion;
const execFileAsync = promisify(execFile);

const isSingleChoicePayload = (payload: { type: QuestionType; options: unknown[] }) => (
  payload.type === 'single' && payload.options.length >= 2
);

const removeQuestionReferences = async (questionIds: string[], transaction?: Transaction) => {
  if (!questionIds.length) return;
  const where = { questionId: { [Op.in]: questionIds } };

  await Promise.all([
    FavoriteModel.destroy({ where, transaction }),
    WrongBookModel.destroy({ where, transaction }),
    StudyRecordModel.destroy({ where, transaction }),
    ReviewTaskModel.destroy({ where, transaction })
  ]);

  const papers = await PaperModel.findAll({ transaction });
  await Promise.all(papers.map(async paper => {
    const currentIds = Array.isArray(paper.questionIds) ? paper.questionIds : [];
    const nextIds = currentIds.filter(id => !questionIds.includes(String(id)));
    if (nextIds.length !== currentIds.length) {
      await paper.update({ questionIds: nextIds }, { transaction });
    }
  }));
};

const findFewShotDir = () => {
  const candidates = [
    path.resolve(process.cwd(), 'few-shot'),
    path.resolve(process.cwd(), '..', 'few-shot'),
    path.resolve(process.cwd(), '..', '..', 'few-shot')
  ];

  const dir = candidates.find(item => existsSync(path.join(item, 'run_annotator.py')));
  if (!dir) throw new AppError(500, '未找到 few-shot 目录', 'FEW_SHOT_NOT_FOUND');
  return dir;
};

const importQuestionRows = async (rows: Array<Record<string, any>>, source = '') => {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const items = [];

  for (const raw of rows) {
    const payload = await buildQuestionPayload(raw, source);
    if (!isSingleChoicePayload(payload)) {
      skipped += 1;
      continue;
    }

    const existed = await QuestionModel.findOne({
      where: {
        source: payload.source,
        stem: payload.stem
      }
    });

    if (existed) {
      await existed.update(payload);
      updated += 1;
      items.push(toQuestionDTO(existed));
    } else {
      const question = await QuestionModel.create(payload);
      created += 1;
      items.push(toQuestionDTO(question));
    }
  }

  return { created, updated, skipped, total: rows.length, items };
};

const updateImportJob = (id: string, patch: Partial<ImportJob>) => {
  const job = importJobs.get(id);
  if (!job) return;
  importJobs.set(id, {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString()
  });
};

const startPdfImportJob = (file: Express.Multer.File, year?: number) => {
  const id = randomUUID();
  const now = new Date().toISOString();
  importJobs.set(id, {
    id,
    status: 'queued',
    fileName: file.originalname,
    year,
    stage: '任务已创建，等待开始识别',
    createdAt: now,
    updatedAt: now
  });

  setImmediate(async () => {
    try {
      updateImportJob(id, { status: 'processing', stage: '正在读取 PDF 并提取题目' });
      const extracted = await extractPdfWithFewShot(file, year);
      const rows = extractPayloads(extracted);
      if (!rows.length) {
        throw new AppError(400, 'PDF 未识别到可导入的选择题', 'PDF_EMPTY_IMPORT');
      }

      updateImportJob(id, { stage: `已识别 ${rows.length} 道候选题，正在筛选选择题并入库` });
      const result = await importQuestionRows(rows, file.originalname);
      updateImportJob(id, {
        status: 'succeeded',
        stage: `导入完成：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
        result
      });
    } catch (error: any) {
      updateImportJob(id, {
        status: 'failed',
        stage: '导入失败',
        error: String(error?.message || error || 'PDF 导入失败')
      });
    }
  });

  return importJobs.get(id)!;
};

const extractPdfWithFewShot = async (file: Express.Multer.File, year?: number) => {
  const fewShotDir = findFewShotDir();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ai-408-pdf-'));
  const inputPath = path.join(tempDir, 'input.pdf');
  const outputPath = path.join(tempDir, 'questions.json');

  try {
    await writeFile(inputPath, file.buffer);
    const args = ['run_annotator.py', '--pdf', inputPath, '--output', outputPath];
    if (year) args.push('--year', String(year));

    await execFileAsync('python', args, {
      cwd: fewShotDir,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });

    try {
      return JSON.parse(await readFile(outputPath, 'utf-8'));
    } catch {
      throw new AppError(400, 'PDF 未识别到可导入的题目', 'PDF_EMPTY_IMPORT');
    }
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const message = String(error.stderr || error.stdout || error.message || '').trim();
    throw new AppError(500, message ? `PDF 识别失败：${message}` : 'PDF 识别失败', 'PDF_IMPORT_FAILED');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const import2025FromDocs = async () => {
  const fewShotDir = findFewShotDir();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ai-408-import-2025-'));
  const outputPath = path.join(tempDir, '2025.json');
  const scriptPath = path.join(fewShotDir, 'export_2025.py');
  const paperPath = path.resolve(fewShotDir, '..', 'docs', 'papers-rebuild', '2025.pdf');
  const answerPath = path.resolve(fewShotDir, '..', 'docs', 'answers', '2025-answer.pdf');

  try {
    await execFileAsync('python', [scriptPath, '--paper', paperPath, '--answer', answerPath, '--output', outputPath], {
      cwd: fewShotDir,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    });

    const rows = JSON.parse(await readFile(outputPath, 'utf-8'));
    if (!Array.isArray(rows) || !rows.length) {
      throw new AppError(400, '2025 题目未解析到有效数据', 'IMPORT_2025_EMPTY');
    }

    return importQuestionRows(rows, '2025真题');
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    const message = String(error.stderr || error.stdout || error.message || '').trim();
    throw new AppError(500, message ? `2025 题目导入失败：${message}` : '2025 题目导入失败', 'IMPORT_2025_FAILED');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

export class AdminQuestionController {
  static async list(req: any, res: Response) {
    const { subject, type, year, status, keyword, page = '1', pageSize = '20' } = req.query;
    const where: any = {};

    if (subject) where.subject = String(subject);
    if (type) where.type = String(type);
    if (status) where.status = String(status);
    if (year) where.year = Number(year);
    if (keyword) {
      where[Op.or] = [
        { stem: { [Op.like]: `%${keyword}%` } },
        { source: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const limit = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * limit;

    const { rows, count } = await QuestionModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    ok(res, {
      items: serializeQuestions(rows),
      total: count,
      page: Math.max(1, Number(page) || 1),
      pageSize: limit
    });
  }

  static async detail(req: any, res: Response) {
    const question = await QuestionModel.findByPk(String(req.params.id));
    if (!question) throw new AppError(404, '题目不存在', 'QUESTION_NOT_FOUND');
    ok(res, toQuestionDTO(question));
  }

  static async create(req: any, res: Response) {
    const payload = await buildQuestionPayload(req.body ?? {});
    if (!isSingleChoicePayload(payload)) {
      throw new AppError(400, 'Only single choice questions can be saved', 'ONLY_SINGLE_CHOICE_ALLOWED');
    }
    const question = await QuestionModel.create(payload);
    ok(res, toQuestionDTO(question), '题目已创建');
  }

  static async update(req: any, res: Response) {
    const question = await QuestionModel.findByPk(String(req.params.id));
    if (!question) throw new AppError(404, '题目不存在', 'QUESTION_NOT_FOUND');

    const payload = await buildQuestionPayload({ ...question.toJSON(), ...req.body }, question.source, question.chapterId);
    if (!isSingleChoicePayload(payload)) {
      throw new AppError(400, 'Only single choice questions can be saved', 'ONLY_SINGLE_CHOICE_ALLOWED');
    }
    await question.update(payload);
    ok(res, toQuestionDTO(question), '题目已更新');
  }

  static async remove(req: any, res: Response) {
    const questionId = String(req.params.id);
    const deleted = await sequelize.transaction(async transaction => {
      await removeQuestionReferences([questionId], transaction);
      return QuestionModel.destroy({ where: { id: questionId }, transaction });
    });
    if (!deleted) throw new AppError(404, '题目不存在', 'QUESTION_NOT_FOUND');
    ok(res, { deleted: true }, '题目已删除');
  }

  static async importQuestions(req: any, res: Response) {
    const { jsonText, source = '' } = req.body ?? {};
    let input = req.body?.questions ?? req.body?.items ?? [];

    if (jsonText) {
      try {
        input = JSON.parse(String(jsonText));
      } catch {
        throw new AppError(400, 'JSON 格式不正确', 'INVALID_JSON');
      }
    }

    const rows = extractPayloads(input);
    if (!rows.length) throw new AppError(400, '没有可导入的题目', 'EMPTY_IMPORT');

    ok(res, await importQuestionRows(rows, source), '题目导入完成');
  }

  static async importPdf(req: any, res: Response) {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new AppError(400, '请上传 PDF 文件', 'PDF_FILE_REQUIRED');

    const year = Number(req.body?.year ?? 0) || undefined;
    const extracted = await extractPdfWithFewShot(file, year);
    const rows = extractPayloads(extracted);
    if (!rows.length) throw new AppError(400, 'PDF 未识别到可导入的题目', 'PDF_EMPTY_IMPORT');

    const data = await importQuestionRows(rows, file.originalname);
    ok(res, data, 'PDF 题目导入完成');
  }

  static async createPdfImportJob(req: any, res: Response) {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) throw new AppError(400, '请上传 PDF 文件', 'PDF_FILE_REQUIRED');

    const year = Number(req.body?.year ?? 0) || undefined;
    ok(res, startPdfImportJob(file, year), 'PDF 识别任务已开始');
  }

  static async getImportJob(req: any, res: Response) {
    const job = importJobs.get(String(req.params.id));
    if (!job) throw new AppError(404, '导入任务不存在或后端已重启', 'IMPORT_JOB_NOT_FOUND');
    ok(res, job);
  }

  static async import2025(_req: any, res: Response) {
    ok(res, await import2025FromDocs(), '2025 题目导入完成');
  }

  static async stats(_req: any, res: Response) {
    const [total, published, draft] = await Promise.all([
      QuestionModel.count(),
      QuestionModel.count({ where: { status: 'published' } }),
      QuestionModel.count({ where: { status: 'draft' } })
    ]);

    const [bySubject, byType, byDifficulty] = await Promise.all([
      QuestionModel.findAll({ attributes: ['subject', [QuestionModel.sequelize!.literal('COUNT(*)'), 'count']], group: ['subject'], raw: true }),
      QuestionModel.findAll({ attributes: ['type', [QuestionModel.sequelize!.literal('COUNT(*)'), 'count']], group: ['type'], raw: true }),
      QuestionModel.findAll({ attributes: ['difficulty', [QuestionModel.sequelize!.literal('COUNT(*)'), 'count']], group: ['difficulty'], raw: true })
    ]);

    ok(res, {
      total,
      published,
      draft,
      bySubject: bySubject.map((item: any) => ({ subject: item.subject, count: Number(item.count) })),
      byType: byType.map((item: any) => ({ type: item.type, count: Number(item.count) })),
      byDifficulty: byDifficulty.map((item: any) => ({ difficulty: item.difficulty, count: Number(item.count) })),
      subjectLabels: SUBJECT_LABELS
    });
  }
}
