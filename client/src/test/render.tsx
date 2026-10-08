import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthUser, Role } from '@dms/shared';
import { setAuthToken } from '../shared/api/api-client';
import { AuthProvider } from '../shared/auth/AuthContext';

const SESSION_KEY = 'dms.session';

export function userFor(role: Role, id = 1): AuthUser {
  return { id, email: `${role.toLowerCase()}@dms.lk`, fullName: `Test ${role}`, role };
}

/** Stores a session exactly as the AuthProvider would after a login. */
export function signInAs(role: Role, id = 1): AuthUser {
  const user = userFor(role, id);
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'test-token', user }));
  return user;
}

interface Options {
  route?: string;
  /** Path pattern to mount `element` at, so `useParams` works (default: match everything). */
  path?: string;
  role?: Role;
  userId?: number;
}

/** Renders inside the router and auth provider, signed in as `role` when given. */
export function renderWithApp(
  element: ReactElement,
  { route = '/', path = '*', role, userId }: Options = {},
) {
  setAuthToken(null);
  if (role) signInAs(role, userId);
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="*" element={<div>other page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}
