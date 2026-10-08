import jwt from 'jsonwebtoken';
import { ROLES, type AuthUser, type Role } from '@dms/shared';
import { UnauthenticatedError } from '../http/errors';

export interface TokenService {
  sign(user: AuthUser): string;
  verify(token: string): AuthUser;
}

/** HS256 JWT service. The secret and lifetime come from configuration only. */
export function createTokenService(secret: string, expiresIn: string): TokenService {
  return {
    sign(user) {
      return jwt.sign({ email: user.email, name: user.fullName, role: user.role }, secret, {
        subject: String(user.id),
        expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      });
    },
    verify(token) {
      try {
        const payload = jwt.verify(token, secret) as jwt.JwtPayload;
        const role = payload.role as Role;
        if (!payload.sub || !ROLES.includes(role)) throw new Error('malformed payload');
        return {
          id: Number(payload.sub),
          email: String(payload.email),
          fullName: String(payload.name),
          role,
        };
      } catch {
        throw new UnauthenticatedError('Your session is invalid or has expired.');
      }
    },
  };
}
