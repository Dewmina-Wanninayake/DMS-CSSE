import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { useAuth } from '../shared/auth/AuthContext';
import { AppShell } from '../shared/layout/AppShell';
import { homePathFor, registeredModules } from '../shared/layout/navigation';
import { EmptyState } from '../shared/ui/feedback';
import { PageHeader } from '../shared/ui/PageHeader';
import { LoginPage } from './LoginPage';

/** Sends a signed-in user to the first page their role may use. */
function HomeRedirect() {
  const { user } = useAuth();
  const home = user ? homePathFor(user.role) : undefined;
  if (home) return <Navigate to={home} replace />;
  return (
    <>
      <PageHeader title="DMC Admin" subtitle="No screens available" />
      <div className="shell__content">
        <EmptyState
          title="Nothing to show for your role yet"
          description="Ask an administrator which module your role should use."
        />
      </div>
    </>
  );
}

/** Everything inside requires a session; the shell renders the navigation. */
function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" backTo="/" />
      <div className="shell__content">
        <EmptyState
          title="This page does not exist"
          description="Check the address or go back to the start."
        />
      </div>
    </>
  );
}

/** The application's routes; each module contributes its own through `registerModules`. */
export function createRoutes(): RouteObject[] {
  return [
    { path: '/login', element: <LoginPage /> },
    {
      element: <ProtectedLayout />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <HomeRedirect /> },
            ...registeredModules().flatMap((module) => module.routes),
            { path: '*', element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ];
}
