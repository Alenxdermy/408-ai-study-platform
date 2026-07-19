import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRequest = Request & {
  userId?: string;
  file?: Express.Multer.File;
};

export const asyncHandler = (
  handler: (req: AsyncRequest, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
};
