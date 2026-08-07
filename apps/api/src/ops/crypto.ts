// Chiffrement au repos des secrets d'instance (AES-256-GCM).
//
// Si `SECRETS_KEY` (32 octets, en base64 ou hex) est défini, les valeurs sont chiffrées avant stockage
// et déchiffrées à la lecture (technicien de l'instance uniquement). Sinon (dev), stockage en clair
// avec `encrypted=false` — l'IHM avertit. La clé n'est jamais stockée en base.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** Clé 32 octets depuis SECRETS_KEY (base64 ou hex), ou null si non configurée. */
function key(): Buffer | null {
  const raw = process.env.SECRETS_KEY;
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

export function secretsEncryptionEnabled(): boolean {
  return key() !== null;
}

/** Chiffre une valeur. Renvoie `{ value, encrypted }` : enveloppe base64 `iv.tag.ct` si clé présente. */
export function encryptSecret(plain: string): { value: string; encrypted: boolean } {
  const k = key();
  if (!k) return { value: plain, encrypted: false };
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { value: `${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`, encrypted: true };
}

/** Déchiffre une valeur stockée. `encrypted=false` → renvoyée telle quelle. Lève si clé absente/incorrecte. */
export function decryptSecret(stored: string, encrypted: boolean): string {
  if (!encrypted) return stored;
  const k = key();
  if (!k) throw new Error('SECRETS_KEY absente : impossible de déchiffrer.');
  const [ivB64, tagB64, ctB64] = stored.split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Enveloppe chiffrée invalide.');
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
