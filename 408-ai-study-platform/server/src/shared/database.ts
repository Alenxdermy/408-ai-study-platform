import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { logger } from './logger.js';

export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  logging: env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
  timezone: '+08:00',
  define: {
    timestamps: true,
    underscored: true
  }
});

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('mysql connected');

    if (env.DB_SYNC_MODE === 'alter') {
      logger.warn('mysql model sync is running in alter mode; do not use this mode for long-term development');
      await sequelize.sync({ alter: true });
      logger.info('mysql models synchronized with alter mode');
      return;
    }

    if (env.DB_SYNC_MODE === 'create') {
      await sequelize.sync();
      logger.info('mysql missing tables synchronized');
      return;
    }

    logger.info('mysql model synchronization skipped');
  } catch (error) {
    logger.error(error, 'mysql connection failed');
    throw error;
  }
};
