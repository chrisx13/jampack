import React, { useEffect, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { AuthProvider, useAuth } from 'react-oidc-context';
import superjson from 'superjson';
import { trpc } from './trpc';
import { activeSociete } from './activeSociete';
import { authEnabled, oidcConfig, accessToken } from './auth';
import App from './App';

// Charte officielle Jampack (Bootstrap 5 + DM Sans + icônes)
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/700.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './theme/theme.scss';

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/trpc',
      transformer: superjson,
      headers: () => {
        const t = accessToken.get();
        return {
          'x-user-id': 'dev-user',
          'x-org-id': 'dev-org',
          'x-societe-id': activeSociete.get() || 'dev-societe',
          ...(t ? { authorization: `Bearer ${t}` } : {}),
        };
      },
    }),
  ],
});

function Providers({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
      <div className="text-center">
        <div className="fw-bold fs-3 text-primary mb-3">JAMPACK</div>
        {children}
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  useEffect(() => {
    accessToken.set(auth.user?.access_token);
  }, [auth.user]);

  if (auth.isLoading) return <Splash><div className="spinner-border text-primary" /></Splash>;
  if (auth.error) return <Splash><div className="text-danger">Erreur d'authentification : {auth.error.message}</div></Splash>;
  if (!auth.isAuthenticated)
    return (
      <Splash>
        <p className="text-secondary mb-3">Suite de gestion CRM · Facturation · Compta</p>
        <button className="btn btn-primary px-4" onClick={() => auth.signinRedirect()}>
          <i className="bi bi-box-arrow-in-right me-2" />Se connecter
        </button>
      </Splash>
    );
  return <>{children}</>;
}

const tree = authEnabled ? (
  <AuthProvider {...oidcConfig}>
    <AuthGate>
      <Providers>
        <App />
      </Providers>
    </AuthGate>
  </AuthProvider>
) : (
  <Providers>
    <App />
  </Providers>
);

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{tree}</React.StrictMode>);
