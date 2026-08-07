import { describe, it, expect } from 'vitest';
import { OPS_CATALOG, getOp, validateOpParams, canExecute } from './opsCatalog';

describe('OPS_CATALOG', () => {
  it('ids uniques et cohérence des métadonnées', () => {
    const ids = OPS_CATALOG.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const o of OPS_CATALOG) {
      if (o.requiresConfirmation) expect(o.confirmToken, `${o.id} doit définir confirmToken`).toBeTruthy();
      // Toute opération dangereuse exige une confirmation typée.
      if (o.danger === 'danger') expect(o.requiresConfirmation, `${o.id} (danger) doit exiger confirmation`).toBe(true);
    }
  });

  it('getOp retrouve une opération et renvoie undefined sinon', () => {
    expect(getOp('db.health')?.danger).toBe('safe');
    expect(getOp('inexistante')).toBeUndefined();
  });
});

describe('validateOpParams', () => {
  it('exige les paramètres requis', () => {
    const op = getOp('db.restore')!;
    expect(validateOpParams(op, {}).ok).toBe(false);
    expect(validateOpParams(op, { file: 'dump.sql.gz' }).ok).toBe(true);
  });
  it('contrôle le type numérique', () => {
    const op = { id: 'x', label: 'x', description: '', category: 'base', danger: 'safe', scope: 'both', warnings: [], supportsDryRun: false, requiresConfirmation: false, needsHostRunner: false, params: [{ key: 'n', label: 'N', type: 'number' as const }] } as never;
    expect(validateOpParams(op, { n: 'abc' }).ok).toBe(false);
    expect(validateOpParams(op, { n: '12' }).ok).toBe(true);
  });
});

describe('canExecute — confirmation typée', () => {
  const restore = getOp('db.restore')!;

  it('bloque une exécution sensible sans confirmation', () => {
    const r = canExecute(restore, { file: 'd.gz' }, { dryRun: false });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /Confirmation requise/.test(e))).toBe(true);
  });

  it('autorise avec le jeton exact', () => {
    expect(canExecute(restore, { file: 'd.gz' }, { dryRun: false, confirmation: 'RESTAURER' }).ok).toBe(true);
  });

  it('refuse un jeton erroné', () => {
    expect(canExecute(restore, { file: 'd.gz' }, { dryRun: false, confirmation: 'restaurer' }).ok).toBe(false);
  });

  it('dry-run n’exige pas la confirmation mais garde la validation des paramètres', () => {
    expect(canExecute(restore, { file: 'd.gz' }, { dryRun: true }).ok).toBe(true);
    expect(canExecute(restore, {}, { dryRun: true }).ok).toBe(false); // fichier requis manquant
  });

  it('opération sûre sans paramètre : exécutable directement', () => {
    expect(canExecute(getOp('db.health')!, {}, { dryRun: false }).ok).toBe(true);
  });
});
