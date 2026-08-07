// Configuration OIDC (Keycloak) et porteur de jeton lu par le client tRPC.
export const OIDC_AUTHORITY = import.meta.env.VITE_OIDC_AUTHORITY as string | undefined;
export const OIDC_CLIENT_ID = (import.meta.env.VITE_OIDC_CLIENT_ID as string) || 'jampack-web';

/** OIDC actif si une authority est configurée (sinon mode dev sans login). */
export const authEnabled = Boolean(OIDC_AUTHORITY);

export const oidcConfig = {
  authority: OIDC_AUTHORITY ?? '',
  client_id: OIDC_CLIENT_ID,
  // On revient sur le chemin courant après login (ex. /m garde /m) — Keycloak autorise origin/*.
  redirect_uri: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '/',
  post_logout_redirect_uri: typeof window !== 'undefined' ? window.location.origin + '/' : '/',
  response_type: 'code',
  scope: 'openid profile email',
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};

// Jeton d'accès courant, mis à jour par le provider et lu par tRPC à chaque requête.
let token: string | undefined;
export const accessToken = {
  get: () => token,
  set: (t: string | undefined) => {
    token = t;
  },
};
