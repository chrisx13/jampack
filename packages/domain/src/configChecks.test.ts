import { describe, it, expect } from 'vitest';
import { evaluateConfig, summarizeFindings, type ConfigObservation } from './configChecks';

const healthy: ConfigObservation = {
  nodeEnv: 'production', authDevStub: false, corsRestricted: true, secretsEncryption: true,
  aiEnabled: true, hostRunnerConfigured: true, backupConfigured: true,
  pendingOrFailedMigrations: 0, rlsMissingTables: [], societesMissingLegalIds: 0,
};

describe('evaluateConfig', () => {
  it('instance saine → aucun défaut', () => {
    expect(evaluateConfig(healthy)).toHaveLength(0);
  });

  it('auth stub en production → critique', () => {
    const f = evaluateConfig({ ...healthy, authDevStub: true });
    expect(f[0].severity).toBe('critical');
    expect(f[0].id).toBe('auth-dev-stub');
  });

  it('auth stub hors production → seulement avertissement', () => {
    const f = evaluateConfig({ ...healthy, nodeEnv: 'development', authDevStub: true });
    expect(f.find((x) => x.id === 'auth-dev-stub')?.severity).toBe('warning');
  });

  it('migrations et RLS manquants → critiques', () => {
    const f = evaluateConfig({ ...healthy, pendingOrFailedMigrations: 2, rlsMissingTables: ['Invoice'] });
    expect(f.filter((x) => x.severity === 'critical').map((x) => x.id).sort()).toEqual(['migrations', 'rls']);
  });

  it('secrets non chiffrés / CORS ouvert / pas de sauvegarde → avertissements', () => {
    const f = evaluateConfig({ ...healthy, secretsEncryption: false, corsRestricted: false, backupConfigured: false });
    const ids = f.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['secrets-encryption', 'cors', 'backups']));
    expect(f.every((x) => x.severity === 'warning')).toBe(true);
  });

  it('IA et runner hôte désactivés → informations', () => {
    const f = evaluateConfig({ ...healthy, aiEnabled: false, hostRunnerConfigured: false });
    expect(f.every((x) => x.severity === 'info')).toBe(true);
  });

  it('tri par gravité (critique d’abord)', () => {
    const f = evaluateConfig({ ...healthy, authDevStub: true, aiEnabled: false, secretsEncryption: false });
    expect(f[0].severity).toBe('critical');
    expect(f[f.length - 1].severity).toBe('info');
  });
});

describe('summarizeFindings', () => {
  it('compte par gravité', () => {
    const f = evaluateConfig({ ...healthy, authDevStub: true, secretsEncryption: false, aiEnabled: false });
    const s = summarizeFindings(f);
    expect(s).toEqual({ critical: 1, warning: 1, info: 1, total: 3 });
  });
});
