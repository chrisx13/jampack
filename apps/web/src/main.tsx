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
import PublicQuote from './pages/PublicQuote';
import MobileApp from './MobileApp';
import { ToastProvider } from './components/Toast';

// Thème JAMPACK (Bootstrap 5 + Plus Jakarta Sans + icônes)
// Police VARIABLE, plus douce/arrondie qu'Inter, rendu net (surtout sous Windows).
import '@fontsource-variable/plus-jakarta-sans/wght.css';
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
      <QueryClientProvider client={queryClient}><ToastProvider>{children}</ToastProvider></QueryClientProvider>
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

// Route PUBLIQUE (sans authentification) : page de signature en ligne d'un devis, /devis/<token>.
const publicMatch = window.location.pathname.match(/^\/devis\/([a-f0-9]{16,})$/i);
// Application MOBILE minimaliste (authentifiée) : /m — pour les utilisateurs en déplacement.
const isMobile = window.location.pathname.startsWith('/m');
const Root = isMobile ? <MobileApp /> : <App />;

const tree = publicMatch ? (
  <Providers>
    <PublicQuote token={publicMatch[1]} />
  </Providers>
) : authEnabled ? (
  <AuthProvider {...oidcConfig}>
    <AuthGate>
      <Providers>{Root}</Providers>
    </AuthGate>
  </AuthProvider>
) : (
  <Providers>{Root}</Providers>
);

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{tree}</React.StrictMode>);

// Service worker (PWA) : enregistré hors développement uniquement (évite les soucis de cache avec Vite/HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
