import type { ErrorRequestHandler } from 'express';
import { AppError } from '../shared/http.js';
import { logger } from '../shared/logger.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ code: error.code, message: error.message, data: null });
    return;
  }

  logger.error(error, 'unhandled request error');
  res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: '服务器内部错误', data: null });
};
