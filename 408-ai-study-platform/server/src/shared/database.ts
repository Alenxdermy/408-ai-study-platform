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
    await sequelize.sync({ alter: true });
    logger.info('mysql models synchronized');
  } catch (error) {
    logger.error(error, 'mysql connection failed');
    throw error;
  }
};
