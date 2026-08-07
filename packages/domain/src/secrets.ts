// Masquage des valeurs secrètes (clés/API) — utilitaire PUR partagé web/api.
//
// Règle de visibilité (console super-admin, cf. jampack-superadmin-ops-console) :
//  - technicien de l'instance : peut RÉVÉLER la valeur en clair (action explicite) ;
//  - super-admin général (société JAMPACK) : ne voit JAMAIS la valeur en entier → masquée ici.

/** Masque une valeur : ne révèle que les `visible` derniers caractères (longueur/prefix cachés). */
export function maskSecret(value?: string | null, visible = 4): string {
  if (!value) return '';
  if (value.length <= visible) return '••••••';
  return '••••••' + value.slice(-visible);
}

/** Vrai si la chaîne ressemble déjà à une valeur masquée (pour éviter de ré-enregistrer un masque). */
export function isMasked(value?: string | null): boolean {
  return !!value && value.startsWith('••••');
}
