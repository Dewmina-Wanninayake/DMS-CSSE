import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { API_PREFIX } from '@dms/shared';
import { createAuthRouter } from './core/auth/auth.routes';
import type { AppContext } from './core/context';
import { createErrorHandler, notFoundHandler } from './core/http/error-handler';
import { modules } from './modules/registry';

const MAX_BODY_SIZE = '1mb';

/** Builds the Express application from a ready context (no listening, so tests can use it). */
export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: ctx.config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  app.use(API_PREFIX, createAuthRouter(ctx));
  for (const module of modules) app.use(API_PREFIX, module.createRouter(ctx));

  app.use(notFoundHandler);
  app.use(createErrorHandler(ctx.logger));
  return app;
}
