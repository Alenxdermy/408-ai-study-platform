import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sequelize } from '../shared/database.js';
import { ResourceDocumentModel } from '../models/resource-document.model.js';
import { resourceService } from '../modules/resource/resource.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

const log = {
  info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data || '')
};

const main = async () => {
  log.info('开始重新解析所有PDF文件');

  try {
    await sequelize.authenticate();
    log.info('数据库连接成功');

    const documents = await ResourceDocumentModel.findAll({
      where: { mimeType: 'application/pdf', status: 'published' },
      order: [['title', 'ASC']]
    });

    log.info('待解析PDF文件数', { count: documents.length });

    let successCount = 0;
    let failCount = 0;

    for (const doc of documents) {
      log.info(`正在处理: ${doc.title}`);
      try {
        await resourceService.parseAndSummarize(doc.id, {
          path: doc.storagePath,
          originalname: doc.originalName,
          mimetype: doc.mimeType,
          size: doc.size,
          filename: doc.originalName
        } as Express.Multer.File);

        const updatedDoc = await ResourceDocumentModel.findByPk(doc.id);
        if (updatedDoc) {
          log.info(`处理成功: ${doc.title} - 摘要状态: ${updatedDoc.summaryStatus}`);
        }
        successCount++;
      } catch (error) {
        failCount++;
        log.error(`处理失败: ${doc.title}`, error);
      }
    }

    log.info('重新解析完成', {
      total: documents.length,
      success: successCount,
      fail: failCount
    });

    process.exit(0);
  } catch (error) {
    log.error('重新解析失败', error);
    process.exit(1);
  }
};

main().catch((error) => {
  log.error('未捕获的错误', error);
  process.exit(1);
});