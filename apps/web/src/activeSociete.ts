// Société active courante, lue par le client tRPC à chaque requête.
// ''         → le serveur choisit (1re société du compte)
// '__all__'  → vue consolidée (toutes les sociétés)
// '<id>'     → société précise
let current = '';

export const ALL = '__all__';

export const activeSociete = {
  get: () => current,
  set: (v: string) => {
    current = v;
  },
};
