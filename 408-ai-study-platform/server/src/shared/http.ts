import type { Response } from 'express';

export const ok = <T>(res: Response, data: T, message = 'success') => {
  res.json({ code: 0, message, data });
};

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'APP_ERROR'
  ) {
    super(message);
  }
}
