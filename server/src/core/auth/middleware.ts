import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthUser, Role } from '@dms/shared';
import { ForbiddenError, UnauthenticatedError } from '../http/errors';
import type { TokenService } from './token';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Authenticates `Authorization: Bearer <token>` and attaches `req.user`. */
export function createRequireAuth(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next(new UnauthenticatedError());
      return;
    }
    try {
      req.user = tokens.verify(header.slice('Bearer '.length));
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Allows the request only for the given roles (deny by default). Use after `requireAuth`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new UnauthenticatedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/** Returns the authenticated user or throws; for use inside controllers behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthenticatedError();
  return req.user;
}
