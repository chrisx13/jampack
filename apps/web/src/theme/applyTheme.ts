import { DEFAULT_THEME, type ThemeColors } from '@jampack/domain';

export { DEFAULT_THEME };
export type { ThemeColors };

const KEYS: (keyof ThemeColors)[] = ['primary', 'success', 'info', 'warning', 'danger'];

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('');

/** Mélange `hex` vers `target` selon un poids (0..1). */
function mix(hex: string, target: string, weight: number): string {
  const [r1, g1, b1] = toRgb(hex);
  const [r2, g2, b2] = toRgb(target);
  return toHex(r1 + (r2 - r1) * weight, g1 + (g2 - g1) * weight, b1 + (b2 - b1) * weight);
}
const tint = (hex: string, w: number) => mix(hex, '#ffffff', w);
const shade = (hex: string, w: number) => mix(hex, '#000000', w);

/** Construit le CSS du thème (partageable / exportable). */
export function buildThemeCss(theme: ThemeColors): string {
  let root = ':root{';
  let rules = '';
  for (const c of KEYS) {
    const hex = theme[c];
    const [r, g, b] = toRgb(hex);
    root += `--bs-${c}:${hex};--bs-${c}-rgb:${r}, ${g}, ${b};`;
    root += `--bs-${c}-bg-subtle:${tint(hex, 0.8)};--bs-${c}-border-subtle:${tint(hex, 0.6)};--bs-${c}-text-emphasis:${shade(hex, 0.4)};`;
    rules += `.text-${c}{color:${hex}!important}.bg-${c}{background-color:${hex}!important}`;
    rules +=
      `.btn-${c}{--bs-btn-bg:${hex};--bs-btn-border-color:${hex};` +
      `--bs-btn-hover-bg:${shade(hex, 0.12)};--bs-btn-hover-border-color:${shade(hex, 0.15)};` +
      `--bs-btn-active-bg:${shade(hex, 0.2)};--bs-btn-active-border-color:${shade(hex, 0.2)};` +
      `--bs-btn-disabled-bg:${hex};--bs-btn-disabled-border-color:${hex};}`;
  }
  root += `--bs-link-color:${theme.primary};--bs-link-hover-color:${shade(theme.primary, 0.2)};`;
  root += '}';
  rules += `.hk-navbar .brand{color:${theme.primary}}`;
  return `/* JAMPACK — thème (look & feel) */\n${root}\n${rules}`;
}

/** Applique le thème en injectant une balise <style> dédiée. */
export function applyTheme(theme: ThemeColors): void {
  let el = document.getElementById('jampack-theme') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'jampack-theme';
    document.head.appendChild(el);
  }
  el.textContent = buildThemeCss(theme);
}

/** Exporte le thème en JSON (partage entre comptes / instances). */
export function exportThemeJson(theme: ThemeColors): string {
  return JSON.stringify(theme, null, 2);
}

/** Importe un thème depuis du JSON OU du CSS (`--bs-primary:#...`). Complète avec les défauts. */
export function importTheme(text: string): ThemeColors {
  const out: ThemeColors = { ...DEFAULT_THEME };
  const trimmed = text.trim();
  try {
    const j = JSON.parse(trimmed);
    for (const k of KEYS) if (typeof j?.[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(j[k])) out[k] = j[k];
    return out;
  } catch {
    // Sinon, on lit un CSS : --bs-<couleur>:#RRGGBB
    for (const k of KEYS) {
      const m = new RegExp(`--bs-${k}\\s*:\\s*(#[0-9a-fA-F]{6})`).exec(trimmed);
      if (m) out[k] = m[1];
    }
    return out;
  }
}
