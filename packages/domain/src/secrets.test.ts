import { describe, it, expect } from 'vitest';
import { maskSecret, isMasked } from './secrets';

describe('maskSecret', () => {
  it('ne révèle que les derniers caractères', () => {
    const m = maskSecret('sk-ant-api03-ABCDEFGH1234');
    expect(m.endsWith('1234')).toBe(true);
    expect(m).not.toContain('ABCDEFGH');
    expect(m).not.toContain('sk-ant');
  });
  it('masque entièrement une valeur courte', () => {
    expect(maskSecret('abcd')).toBe('••••••');
    expect(maskSecret('ab')).toBe('••••••');
  });
  it('chaîne vide → vide', () => {
    expect(maskSecret('')).toBe('');
    expect(maskSecret(null)).toBe('');
  });
  it('nombre de caractères visibles paramétrable', () => {
    expect(maskSecret('0123456789', 2).endsWith('89')).toBe(true);
  });
});

describe('isMasked', () => {
  it('détecte une valeur déjà masquée', () => {
    expect(isMasked(maskSecret('supersecretvalue'))).toBe(true);
    expect(isMasked('vraie-valeur')).toBe(false);
    expect(isMasked('')).toBe(false);
  });
});
