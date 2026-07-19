import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '../.env') });

// Import all models before database connection to ensure they're registered
// Order matters for foreign key dependencies
import './models/user.model.js';
import './models/chapter.model.js';
import './models/knowledge-document.model.js';
import './models/question.model.js';
import './models/resource-document.model.js';
import './models/study-record.model.js';
import './models/wrong-book.model.js';
import './models/favorite.model.js';
import './models/review-task.model.js';
import './models/paper.model.js';
import './models/chat-history.model.js';
import './models/agent-log.model.js';
import './models/knowledge-chunk.model.js';

const bootstrap = async () => {
  const { createServer } = await import('node:http');
  const { Server } = await import('socket.io');
  const { createApp } = await import('./shared/app.js');
  const { connectDatabase } = await import('./shared/database.js');
  const { env } = await import('./shared/env.js');
  const { logger } = await import('./shared/logger.js');

  await connectDatabase();

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true }
  });

  io.on('connection', socket => {
    logger.info({ socketId: socket.id }, 'socket connected');
  });

  httpServer.listen(env.PORT, () => {
    logger.info(`server listening on http://localhost:${env.PORT}`);
  });
};

bootstrap().catch(error => {
  console.error('server bootstrap failed', error);
  process.exit(1);
});
