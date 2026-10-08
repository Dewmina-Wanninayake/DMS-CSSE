import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './shared/styles/tokens.css';
import './shared/styles/base.css';
import './shared/styles/components.css';
import './app/moduleRegistry';
import { createRoutes } from './app/routes';
import { AuthProvider } from './shared/auth/AuthContext';

const router = createBrowserRouter(createRoutes());

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
