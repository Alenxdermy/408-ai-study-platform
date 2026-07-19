import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from '../middlewares/error-handler.js';
import { aiRouter } from '../modules/ai/ai.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { knowledgeRouter } from '../modules/knowledge/knowledge.routes.js';
import { questionRouter } from '../modules/question/question.routes.js';
import { resourceRouter } from '../modules/resource/resource.routes.js';
import { studyRouter } from '../modules/study/study.routes.js';
import { env } from './env.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

  app.get('/health', (_req, res) => res.json({ code: 0, message: 'ok', data: { uptime: process.uptime() } }));
  app.use('/api/auth', authRouter);
  app.use('/api/questions', questionRouter);
  app.use('/api/resources', resourceRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/knowledge', knowledgeRouter);
  app.use('/api/study', studyRouter);
  app.use(errorHandler);

  return app;
};
