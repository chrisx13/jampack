import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const ISSUER = process.env.OIDC_ISSUER; // ex. http://localhost:8080/realms/jampack
const AUDIENCE = process.env.OIDC_AUDIENCE; // optionnel (ex. jampack-web)
const JWKS_URL =
  process.env.OIDC_JWKS_URL || (ISSUER ? `${ISSUER}/protocol/openid-connect/certs` : undefined);

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function keySet() {
  if (!jwks) {
    if (!JWKS_URL) throw new Error('OIDC non configuré (OIDC_ISSUER / OIDC_JWKS_URL manquant)');
    jwks = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return jwks;
}

/** OIDC est actif si un émetteur ou un endpoint JWKS est configuré. */
export const oidcEnabled = () => Boolean(ISSUER || process.env.OIDC_JWKS_URL);

export interface TokenIdentity {
  sub: string;
  email: string;
  name?: string;
}

/** Vérifie un access token (signature via JWKS, issuer et audience) et en extrait l'identité. */
export async function verifyAccessToken(token: string): Promise<TokenIdentity> {
  const { payload } = await jwtVerify(token, keySet(), {
    issuer: ISSUER || undefined,
    audience: AUDIENCE || undefined,
  });
  const p = payload as JWTPayload & { email?: string; preferred_username?: string; name?: string };
  const email = p.email || p.preferred_username;
  if (!email) throw new Error('Token sans email/username');
  return { sub: String(p.sub), email, name: p.name };
}
