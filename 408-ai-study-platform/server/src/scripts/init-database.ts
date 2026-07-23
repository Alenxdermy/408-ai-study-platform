import { config } from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../../.env') });

const dbConfigSchema = z.object({
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default('ai_408_study'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string()
});

const dbConfig = dbConfigSchema.parse(process.env);
const shouldReset = process.argv.includes('--reset');

const registerModels = async () => {
  await import('../models/user.model.js');
  await import('../models/chapter.model.js');
  await import('../models/knowledge-document.model.js');
  await import('../models/question.model.js');
  await import('../models/resource-document.model.js');
  await import('../models/study-record.model.js');
  await import('../models/wrong-book.model.js');
  await import('../models/favorite.model.js');
  await import('../models/review-task.model.js');
  await import('../models/paper.model.js');
  await import('../models/chat-history.model.js');
  await import('../models/agent-log.model.js');
  await import('../models/knowledge-chunk.model.js');
};

const quoteIdentifier = (name: string) => `\`${name.replace(/`/g, '``')}\``;

const initDatabase = async () => {
  const connection = await mysql.createConnection({
    host: dbConfig.DB_HOST,
    port: dbConfig.DB_PORT,
    user: dbConfig.DB_USER,
    password: dbConfig.DB_PASSWORD
  });

  if (shouldReset) {
    await connection.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbConfig.DB_NAME)}`);
  }

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(dbConfig.DB_NAME)} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();

  await registerModels();
  const { sequelize } = await import('../shared/database.js');
  await sequelize.authenticate();
  await sequelize.sync();
  await sequelize.close();

  console.info(`database ${shouldReset ? 'reset and initialized' : 'initialized'}: ${dbConfig.DB_NAME}`);
};

initDatabase().catch(error => {
  console.error('database initialization failed', error);
  process.exit(1);
});
