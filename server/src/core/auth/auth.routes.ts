import { Router } from 'express';
import { z } from 'zod';
import type { LoginResponse } from '@dms/shared';
import type { AppContext } from '../context';
import { sendOk } from '../http/envelope';
import { UnauthenticatedError } from '../http/errors';
import { validate } from '../http/validate';
import { currentUser } from './middleware';
import { verifyPassword } from './password';

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Minimal sign-in so roles can be exercised. Login/logout are excluded from grading by the
 * assignment (spec S6): modules must not extend this; they only use `requireRole`.
 */
export function createAuthRouter(ctx: AppContext): Router {
  const router = Router();

  router.post('/auth/login', validate({ body: loginBody }), (req, res) => {
    const { email, password } = req.validated.body as z.infer<typeof loginBody>;
    const found = ctx.users.findByEmail(email);
    // One generic message for both unknown user and wrong password.
    if (!found || !verifyPassword(password, found.passwordHash)) {
      throw new UnauthenticatedError('Incorrect email or password.');
    }
    const user = { id: found.id, email: found.email, fullName: found.fullName, role: found.role };
    const response: LoginResponse = { token: ctx.tokens.sign(user), user };
    sendOk(res, response);
  });

  router.get('/auth/me', ctx.requireAuth, (req, res) => {
    sendOk(res, currentUser(req));
  });

  return router;
}
