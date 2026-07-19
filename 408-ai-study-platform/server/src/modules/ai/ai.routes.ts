import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.js';
import { supervisorAgent } from '../../agents/supervisor.agent.js';
import type { AgentName } from '../../agents/agent.types.js';
import { asyncHandler } from '../../shared/async-handler.js';
import { ok } from '../../shared/http.js';

export const aiRouter = Router();

aiRouter.post('/agent/:agent', requireAuth, asyncHandler(async (req, res) => {
  const body = z.object({ sessionId: z.string().optional(), payload: z.record(z.unknown()).default({}) }).parse(req.body);
  const result = await supervisorAgent.dispatch(req.params.agent as AgentName, {
    userId: req.userId,
    sessionId: body.sessionId,
    payload: body.payload
  });
  ok(res, result);
}));
