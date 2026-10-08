import type { Role } from './enums';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
