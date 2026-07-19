import { describe, expect, it } from 'vitest';
import { AppError } from './http.js';

describe('AppError', () => {
  it('keeps http status and business code', () => {
    const error = new AppError(401, '请先登录', 'UNAUTHORIZED');

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('请先登录');
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
