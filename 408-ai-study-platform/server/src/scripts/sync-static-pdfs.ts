import { config } from 'dotenv';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ResourceDocumentModel } from '../models/resource-document.model.js';
import { UserModel } from '../models/user.model.js';
import { sequelize } from '../shared/database.js';
import { env } from '../shared/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

const PDF_MIME_TYPE = 'application/pdf';
const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000408';
const years = Array.from({ length: 17 }, (_, index) => String(2025 - index));

const ensureSystemUser = async () => {
  await UserModel.findOrCreate({
    where: { id: SYSTEM_USER_ID },
    defaults: {
      id: SYSTEM_USER_ID,
      nickname: '408 资料管理员',
      avatarUrl: '',
      status: 'active'
    }
  });
};

const buildResources = async () => {
  const docsRoot = path.resolve(env.STATIC_DOCS_DIR);
  const items = [];

  for (const year of years) {
    const paperFileName = `${year}.pdf`;
    const answerFileName = `${year}-answer.pdf`;
    const paperPath = path.resolve(docsRoot, 'papers-rebuild', paperFileName);
    const answerPath = path.resolve(docsRoot, 'answers', answerFileName);

    const paperStat = await stat(paperPath);
    items.push({
      title: `${year} 年真题`,
      description: `408 ${year} 年统考真题 PDF`,
      category: 'paper',
      originalName: paperFileName,
      storagePath: paperPath,
      size: paperStat.size
    });

    const answerStat = await stat(answerPath);
    items.push({
      title: `${year} 年答案`,
      description: `408 ${year} 年真题答案与解析 PDF`,
      category: 'answer',
      originalName: answerFileName,
      storagePath: answerPath,
      size: answerStat.size
    });
  }

  return items;
};

const syncStaticPdfs = async () => {
  await sequelize.authenticate();
  await ensureSystemUser();

  const resources = await buildResources();
  for (const item of resources) {
    const [document, created] = await ResourceDocumentModel.findOrCreate({
      where: { storagePath: item.storagePath },
      defaults: {
        uploaderId: SYSTEM_USER_ID,
        ...item,
        mimeType: PDF_MIME_TYPE,
        parseStatus: 'parsed',
        summaryStatus: 'skipped',
        summaryError: '固定真题资料暂不生成 AI 摘要',
        status: 'published'
      }
    });

    if (!created) {
      await document.update({
        uploaderId: SYSTEM_USER_ID,
        title: item.title,
        description: item.description,
        category: item.category,
        originalName: item.originalName,
        mimeType: PDF_MIME_TYPE,
        size: item.size,
        status: 'published'
      });
    }
  }

  await sequelize.close();
  console.info(`static PDF resources synchronized: ${resources.length}`);
};

syncStaticPdfs().catch(error => {
  console.error('static PDF resource synchronization failed', error);
  process.exit(1);
});
