import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sequelize } from '../shared/database.js';
import { ResourceDocumentModel } from '../models/resource-document.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../../.env') });

const log = {
  info: (msg: string, data?: unknown) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: unknown) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg: string, data?: unknown) => console.error(`[ERROR] ${msg}`, data || '')
};

const main = async () => {
  log.info('开始清理数据库中的重复资源记录');

  try {
    await sequelize.authenticate();
    log.info('数据库连接成功');

    await sequelize.sync();
    log.info('模型同步完成');

    const totalBefore = await ResourceDocumentModel.count();
    log.info('清理前总记录数', { count: totalBefore });

    const titles = await ResourceDocumentModel.findAll({
      attributes: ['title'],
      group: ['title'],
      order: ['title']
    });
    log.info('唯一标题数', { count: titles.length });

    let deletedCount = 0;

    for (const titleRecord of titles) {
      const title = titleRecord.title;
      const duplicates = await ResourceDocumentModel.findAll({
        where: { title },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'createdAt', 'category']
      });

      if (duplicates.length <= 1) continue;

      const keepId = duplicates[0].id;
      const toDelete = duplicates.slice(1);

      log.info('发现重复记录', { 
        title, 
        total: duplicates.length, 
        keepId: keepId.slice(0, 8) + '...',
        deleteCount: toDelete.length 
      });

      for (const record of toDelete) {
        try {
          await ResourceDocumentModel.destroy({ where: { id: record.id } });
          deletedCount++;
        } catch (error) {
          log.error('删除记录失败', { id: record.id, error });
        }
      }
    }

    const totalAfter = await ResourceDocumentModel.count();
    log.info('清理完成', {
      before: totalBefore,
      after: totalAfter,
      deleted: deletedCount
    });

    process.exit(0);
  } catch (error) {
    log.error('清理失败', error);
    process.exit(1);
  }
};

main().catch((error) => {
  log.error('未捕获的错误', error);
  process.exit(1);
});