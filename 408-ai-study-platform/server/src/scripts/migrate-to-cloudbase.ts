import { config } from 'dotenv';
import fs from 'node:fs';
import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentLogModel } from '../models/agent-log.model.js';
import { ChapterModel } from '../models/chapter.model.js';
import { ChatHistoryModel } from '../models/chat-history.model.js';
import { FavoriteModel } from '../models/favorite.model.js';
import { KnowledgeChunkModel } from '../models/knowledge-chunk.model.js';
import { KnowledgeDocumentModel } from '../models/knowledge-document.model.js';
import { PaperModel } from '../models/paper.model.js';
import { QuestionModel } from '../models/question.model.js';
import { ResourceDocumentModel } from '../models/resource-document.model.js';
import { ReviewTaskModel } from '../models/review-task.model.js';
import { sequelize } from '../shared/database.js';
import { StudyRecordModel } from '../models/study-record.model.js';
import { UserModel } from '../models/user.model.js';
import { WrongBookModel } from '../models/wrong-book.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const serverEnvPath = path.resolve(__dirname, '../../.env');
const rootEnvPath = path.resolve(projectRoot, '.env');
const staticYears = Array.from({ length: 17 }, (_, index) => String(2025 - index));

if (fs.existsSync(serverEnvPath)) config({ path: serverEnvPath });
if (fs.existsSync(rootEnvPath)) config({ path: rootEnvPath });

const CLOUD_ENV = process.env.VITE_CLOUD_ENV?.trim();
const CLOUD_ACCESS_KEY = process.env.VITE_CLOUD_PUBLISHABLE_KEY?.trim();
const require = createRequire(import.meta.url);
const cloudbase = require('@cloudbase/js-sdk');

const resolveStaticDocsRoot = () => {
  const candidates = [
    process.env.STATIC_DOCS_DIR?.trim(),
    path.resolve(projectRoot, 'docs'),
    path.resolve(projectRoot, '..', 'docs')
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.resolve(candidate, 'papers-rebuild')) &&
      fs.existsSync(path.resolve(candidate, 'answers'))
    ) {
      return candidate;
    }
  }

  return candidates[0] || path.resolve(projectRoot, '..', 'docs');
};

const staticDocsRoot = resolveStaticDocsRoot();

if (!CLOUD_ENV) throw new Error('缺少 VITE_CLOUD_ENV');
if (!CLOUD_ACCESS_KEY) throw new Error('缺少 VITE_CLOUD_PUBLISHABLE_KEY');

const cloudApp = cloudbase.init({
  env: CLOUD_ENV,
  accessKey: CLOUD_ACCESS_KEY
});

const db = cloudApp.database();

const ensureCloudLogin = async () => {
  const auth = cloudApp.auth();
  try {
    const result = await auth.signInAnonymously({});
    if (result?.error) {
      console.warn('CloudBase 匿名登录失败，继续尝试直接写入数据库', result.error.message || result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('CloudBase 匿名登录失败，继续尝试直接写入数据库', error);
    return false;
  }
};

const sanitizeValue = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item)).filter(item => item !== undefined);
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, sanitizeValue(item)])
        .filter(([, item]) => item !== undefined)
    );
  }
  return value;
};

const toDocId = (row: any) => String(row.id || row._id || '').trim();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const now = () => new Date().toISOString();

const isStaticPdfResource = (row: any) => {
  const originalName = String(row.originalName || '').trim();
  const category = String(row.category || '').trim();
  const mimeType = String(row.mimeType || '').trim().toLowerCase();
  return mimeType === 'application/pdf' && (category === 'paper' || category === 'answer') && /^20\d{2}(?:-answer)?\.pdf$/i.test(originalName);
};

const resolvePdfSource = (row: any) => {
  const originalName = String(row.originalName || '').trim();
  const isAnswer = /-answer\.pdf$/i.test(originalName) || String(row.category || '').trim() === 'answer';
  const group = isAnswer ? 'answers' : 'papers-rebuild';
  const filePath = path.resolve(staticDocsRoot, group, originalName);
  const cloudPath = `migrations/resource-documents/${group}/${originalName}`;
  return { group, filePath, cloudPath };
};

const upsertCloudDocument = async (collectionName: string, row: any, patch: Record<string, unknown>) => {
  const collection = db.collection(collectionName);
  try {
    await collection.doc(String(row.id)).update({ data: sanitizeValue(patch) });
  } catch {
    await collection.doc(String(row.id)).set(sanitizeValue({
      ...row,
      ...patch,
      id: String(row.id)
    }));
  }
};

const syncStaticPdfs = async (resourceRows: any[]) => {
  const staticRows = resourceRows.filter(isStaticPdfResource);
  const targets = staticRows.length ? staticRows : await buildFallbackStaticPdfRows();
  if (!targets.length) {
    console.log('[resources] 没有需要上传的真题 PDF');
    return;
  }

  const storage = cloudApp.storage.from();
  let uploaded = 0;

  for (const row of targets) {
    const { filePath, cloudPath } = resolvePdfSource(row);
    if (!fs.existsSync(filePath)) {
      console.warn(`[resources] 跳过缺失文件: ${filePath}`);
      continue;
    }

    const signedResult = await storage.createSignedUploadUrl(cloudPath, { upsert: true });
    if (signedResult.error) {
      throw new Error(signedResult.error.message || `生成上传签名失败: ${cloudPath}`);
    }

    const uploadResult = await storage.uploadToSignedUrl(
      cloudPath,
      signedResult.data.token,
      fs.createReadStream(filePath),
      { contentType: 'application/pdf' }
    );
    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || `上传失败: ${cloudPath}`);
    }
    const fileID = uploadResult.data.fullPath || uploadResult.data.path || cloudPath;
    const patch = {
      fileID,
      storagePath: cloudPath,
      mimeType: 'application/pdf',
      status: 'published',
      updatedAt: now()
    };

    await upsertCloudDocument('resources', row, patch);
    await upsertCloudDocument('resource_documents', row, patch);

    uploaded += 1;
    console.log(`[resources] 已上传 ${String(row.originalName || row.id)}`);
  }

  console.log(`[resources] 云存储同步完成 ${uploaded} 条`);
};

const buildFallbackStaticPdfRows = async () => {
  const rows: any[] = [];
  for (const year of staticYears) {
    for (const kind of ['paper', 'answer'] as const) {
      const originalName = kind === 'paper' ? `${year}.pdf` : `${year}-answer.pdf`;
      const group = kind === 'paper' ? 'papers-rebuild' : 'answers';
      const filePath = path.resolve(staticDocsRoot, group, originalName);
      if (!fs.existsSync(filePath)) continue;

      const fileStat = await stat(filePath);
      rows.push({
        id: `${kind}-${year}`,
        title: kind === 'paper' ? `${year} 年真题` : `${year} 年答案`,
        description: kind === 'paper' ? `408 ${year} 年统考真题 PDF` : `408 ${year} 年真题答案与解析 PDF`,
        category: kind,
        originalName,
        mimeType: 'application/pdf',
        size: fileStat.size,
        status: 'published',
        viewCount: 0,
        downloadCount: 0,
        createdAt: now(),
        updatedAt: now(),
        storagePath: filePath
      });
    }
  }
  return rows;
};

const writeCollection = async (collectionName: string, rows: any[]) => {
  const collection = db.collection(collectionName);
  let success = 0;
  for (const row of rows) {
    const docId = toDocId(row);
    if (!docId) continue;
    const { _id, ...rest } = row;
    const payload = sanitizeValue({ ...rest, id: docId });
    let lastError: any;
    for (const delay of [0, 300, 900]) {
      try {
        if (delay) await sleep(delay);
        await collection.doc(docId).set(payload);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        try {
          const existing = await collection.doc(docId).get();
          if (existing?.data) {
            lastError = null;
            break;
          }
        } catch {
          // ignore and continue retrying
        }
      }
    }
    if (lastError) throw lastError;
    success += 1;
    if (success % 100 === 0) {
      console.log(`[${collectionName}] 已写入 ${success} 条`);
    }
  }
  console.log(`[${collectionName}] 完成 ${success} 条`);
  return success;
};

const clearCollection = async (collectionName: string) => {
  const collection = db.collection(collectionName);
  while (true) {
    const result = await collection.limit(1000).get();
    const rows = result.data || [];
    if (!rows.length) break;
    for (const row of rows) {
      await collection.doc(String(row._id || row.id)).remove();
    }
    if (rows.length < 1000) break;
  }
};

const loadRows = async (model: any) => {
  const rows = await model.findAll({ raw: true });
  return rows.map((row: any) => sanitizeValue(row));
};

const migrate = async () => {
  await sequelize.authenticate();
  console.log('本地 MySQL 已连接');
  const loggedIn = await ensureCloudLogin();
  console.log(loggedIn ? 'CloudBase 匿名登录成功' : 'CloudBase 匿名登录跳过');

  const chapters = await loadRows(ChapterModel);
  const users = await loadRows(UserModel);
  const questions = await loadRows(QuestionModel);
  const papers = await loadRows(PaperModel);
  const favorites = await loadRows(FavoriteModel);
  const wrongBooks = await loadRows(WrongBookModel);
  const studyRecords = await loadRows(StudyRecordModel);
  const reviewTasks = await loadRows(ReviewTaskModel);
  const chatHistories = await loadRows(ChatHistoryModel);
  const agentLogs = await loadRows(AgentLogModel);
  const knowledgeDocuments = await loadRows(KnowledgeDocumentModel);
  const knowledgeChunks = await loadRows(KnowledgeChunkModel);
  const resourceDocuments = await loadRows(ResourceDocumentModel);

  const resources = resourceDocuments.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    originalName: row.originalName,
    mimeType: row.mimeType,
    fileID: row.fileID || '',
    storagePath: row.storagePath,
    size: row.size,
    status: row.status,
    viewCount: row.viewCount,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));

  const summary = [
    ['chapters', chapters],
    ['users', users],
    ['questions', questions],
    ['papers', papers],
    ['favorites', favorites],
    ['wrong_books', wrongBooks],
    ['study_records', studyRecords],
    ['review_tasks', reviewTasks],
    ['chat_histories', chatHistories],
    ['agent_logs', agentLogs],
    ['knowledge_documents', knowledgeDocuments],
    ['knowledge_chunks', knowledgeChunks],
    ['resource_documents', resourceDocuments],
    ['resources', resources]
  ] as const;

  for (const [collectionName] of summary) {
    await clearCollection(collectionName);
    console.log(`[${collectionName}] 已清空旧数据`);
  }

  for (const [collectionName, rows] of summary) {
    await writeCollection(collectionName, rows as any[]);
  }

  await syncStaticPdfs(resourceDocuments);

  await sequelize.close();
  console.log('云端迁移完成');
};

migrate().catch(async error => {
  console.error('云端迁移失败', error);
  try {
    await sequelize.close();
  } catch {
    // ignore
  }
  process.exit(1);
});
