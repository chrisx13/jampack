// Base de connaissances d'aide à l'utilisation — contenu STRUCTURÉ (articles + scénarios pas à pas).
// Sert : (1) la recherche d'aide GRATUITE et locale, (2) l'ancrage de l'assistant IA (Claude), et
// (3) la génération de la doc scénarios. Contenu franco-français, aligné sur l'app réelle.

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  /** Où réaliser l'action dans l'app (fil d'Ariane). */
  screen: string;
  keywords: string[];
  summary: string;
  /** Marche à suivre, une étape par entrée. */
  steps: string[];
  related?: string[];
}

export const HELP_CATEGORIES = ['Démarrage', 'Ventes', 'Achats', 'Frais', 'Comptabilité', 'IA & documents', 'Administration'] as const;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'demarrage-connexion', title: 'Se connecter et choisir sa société', category: 'Démarrage', screen: 'Connexion',
    keywords: ['connexion', 'login', 'société', 'compte', 'démarrer', 'commencer'],
    summary: 'Accéder à JAMPACK et sélectionner la société active sur laquelle vous travaillez.',
    steps: ['Cliquez sur « Se connecter » et authentifiez-vous.', 'En haut de l’écran, choisissez la société active si vous en gérez plusieurs.', 'Les écrans et les droits s’adaptent à la société sélectionnée.'],
    related: ['admin-roles'],
  },
  {
    id: 'ventes-client', title: 'Créer un client', category: 'Ventes', screen: 'CRM ▸ Clients',
    keywords: ['client', 'tiers', 'créer', 'contact', 'entreprise', 'siren'],
    summary: 'Enregistrer un client (tiers) pour établir devis et factures.',
    steps: ['Ouvrez CRM ▸ Clients puis « Nouveau ».', 'Renseignez la raison sociale ; le SIREN est contrôlé (clé de Luhn) et propose le n° de TVA.', 'Enregistrez : le client est disponible dans les devis et factures.'],
    related: ['ventes-devis'],
  },
  {
    id: 'ventes-devis', title: 'Établir un devis', category: 'Ventes', screen: 'Ventes ▸ Devis',
    keywords: ['devis', 'proposition', 'chiffrage', 'lignes', 'remise'],
    summary: 'Créer un devis avec lignes, remises et TVA, prêt à envoyer.',
    steps: ['Ouvrez Ventes ▸ Devis puis « Nouveau ».', 'Choisissez le client, ajoutez des lignes (le prix HT se résout via la grille tarifaire si définie).', 'Ajoutez une remise globale au pied si besoin.', 'Enregistrez, puis générez le PDF (« Bon pour accord ») ou la page de signature en ligne.'],
    related: ['ventes-signature', 'ventes-convertir'],
  },
  {
    id: 'ventes-signature', title: 'Faire signer un devis en ligne', category: 'Ventes', screen: 'Ventes ▸ Devis',
    keywords: ['signature', 'accepter', 'en ligne', 'lien', 'jeton', 'accord'],
    summary: 'Envoyer un lien sécurisé au client pour accepter ou refuser le devis.',
    steps: ['Sur le devis, ouvrez la page de signature (lien à jeton).', 'Le client accepte ou refuse ; nom, horodatage et IP sont conservés comme preuve.', 'Un devis accepté peut être converti en facture.'],
    related: ['ventes-convertir'],
  },
  {
    id: 'ventes-convertir', title: 'Convertir un devis en facture', category: 'Ventes', screen: 'Ventes ▸ Devis',
    keywords: ['convertir', 'facture', 'devis', 'transformer'],
    summary: 'Transformer un devis accepté en facture, sans ressaisie.',
    steps: ['Ouvrez le devis accepté.', 'Cliquez « Convertir en facture ».', 'Vérifiez, puis validez la facture (elle devient non modifiable).'],
    related: ['ventes-encaisser', 'facturx'],
  },
  {
    id: 'ventes-encaisser', title: 'Encaisser un règlement client', category: 'Ventes', screen: 'Ventes ▸ Factures',
    keywords: ['règlement', 'paiement', 'encaisser', 'reste dû', 'payée'],
    summary: 'Saisir un règlement partiel ou total ; la facture passe « payée » automatiquement.',
    steps: ['Ouvrez la facture validée.', 'Ajoutez un règlement (montant, moyen, date).', 'Au solde nul, la facture est marquée « payée » ; comptabilisez le règlement (512).'],
    related: ['compta-tva'],
  },
  {
    id: 'facturx', title: 'Générer une facture électronique (Factur-X)', category: 'Ventes', screen: 'Ventes ▸ Factures',
    keywords: ['factur-x', 'electronique', 'e-invoicing', 'pdp', 'cii', '2026'],
    summary: 'Produire le PDF avec le XML Factur-X embarqué (EN 16931).',
    steps: ['Ouvrez une facture validée.', 'Cliquez « Factur-X » : le PDF contient les données structurées (SIREN, TVA, totaux).', 'La transmission via PDP est modélisée à part (connecteur).'],
  },
  {
    id: 'frais-saisir', title: 'Saisir une note de frais', category: 'Frais', screen: 'Achats ▸ Notes de frais',
    keywords: ['frais', 'dépense', 'salarié', 'remboursement', 'note'],
    summary: 'Enregistrer une dépense, la valider puis la comptabiliser (6xx / TVA / 421).',
    steps: ['Ouvrez Achats ▸ Notes de frais puis « Nouvelle note ».', 'Renseignez date, catégorie, description, HT, TVA.', 'Validez, puis comptabilisez ; marquez « remboursée » après paiement.'],
    related: ['scanner', 'mobile'],
  },
  {
    id: 'scanner', title: 'Scanner une facture ou un justificatif', category: 'IA & documents', screen: 'Notes de frais / Facture fournisseur ▸ Scanner',
    keywords: ['scanner', 'reconnaissance', 'ocr', 'pdf', 'photo', 'ia', 'crédit', 'gratuit'],
    summary: 'Extraire les données d’un PDF ou d’une photo pour pré-remplir une pièce.',
    steps: ['Cliquez « Scanner » et déposez un PDF ou une photo.', 'GRATUIT : sur un PDF, JAMPACK extrait fournisseur, montants, date (indice de confiance par champ).', 'OPTION PAYANTE : « Affiner avec l’IA (1 crédit) » envoie le document à Claude (photos, cas difficiles).', 'Cliquez « Pré-remplir » et VALIDEZ (rien n’est créé sans validation).'],
    related: ['credits-ia', 'frais-saisir'],
  },
  {
    id: 'mobile', title: 'Utiliser l’application mobile en déplacement', category: 'Frais', screen: 'PWA /m',
    keywords: ['mobile', 'pwa', 'déplacement', 'photo', 'téléphone', 'installer'],
    summary: 'Saisir frais et traiter ses tâches depuis le téléphone, photo de justificatif incluse.',
    steps: ['Ouvrez /m sur le téléphone, puis « Ajouter à l’écran d’accueil ».', 'Saisissez un frais (catégorie, montant, TVA) et prenez une photo du justificatif.', 'Si l’IA est disponible, « Reconnaître (1 crédit) » pré-remplit ; sinon la photo sert de justificatif gratuit.'],
    related: ['scanner'],
  },
  {
    id: 'achats-facture', title: 'Enregistrer une facture fournisseur', category: 'Achats', screen: 'Achats ▸ Factures fournisseurs',
    keywords: ['fournisseur', 'achat', 'facture', 'décaissement', 'rapprochement'],
    summary: 'Saisir une facture fournisseur, la rapprocher d’une commande, la régler et la comptabiliser.',
    steps: ['Ouvrez Achats ▸ Factures fournisseurs puis « Nouvelle facture » (ou « Scanner »).', 'Choisissez le fournisseur, ajoutez les lignes, rattachez une commande pour le rapprochement 3 voies.', 'Validez, réglez, puis comptabilisez (journal des achats).'],
    related: ['scanner'],
  },
  {
    id: 'compta-tva', title: 'Préparer la déclaration de TVA (CA3)', category: 'Comptabilité', screen: 'Comptabilité ▸ Déclaration TVA',
    keywords: ['tva', 'ca3', 'déclaration', 'collectée', 'déductible', 'clôture'],
    summary: 'Calculer la TVA à reverser et clôturer la période.',
    steps: ['Ouvrez Comptabilité ▸ Déclaration TVA.', 'Vérifiez collectée (44571) − déductible (44566) selon le régime.', 'Clôturez la période ; l’écriture de clôture est générée.'],
    related: ['compta-fec'],
  },
  {
    id: 'compta-fec', title: 'Exporter le FEC et les journaux', category: 'Comptabilité', screen: 'Comptabilité ▸ Exports',
    keywords: ['fec', 'export', 'journaux', 'grand livre', 'balance', 'expert-comptable'],
    summary: 'Produire le Fichier des Écritures Comptables et les états pour l’expert-comptable.',
    steps: ['Ouvrez Comptabilité ▸ Exports.', 'Exportez le FEC (18 colonnes normées) et/ou les journaux, balance, grand livre en CSV.', 'Transmettez à votre expert-comptable.'],
  },
  {
    id: 'admin-legalform', title: 'Choisir la forme juridique et ses mentions', category: 'Administration', screen: 'Administration ▸ Société',
    keywords: ['forme juridique', 'sarl', 'sas', 'micro', 'auto-entrepreneur', 'ei', 'capital', 'mentions', '293b'],
    summary: 'Sélectionner la forme juridique : mentions légales, TVA par défaut et compta suggérée s’ajustent.',
    steps: ['Ouvrez Administration ▸ Société.', 'Choisissez la forme juridique dans la liste : les mentions (capital, RCS/RNE, franchise 293 B…) et les défauts TVA s’appliquent.', 'Vérifiez l’aperçu des mentions ; elles figureront sur vos pièces.'],
    related: ['facturx'],
  },
  {
    id: 'credits-ia', title: 'Gérer les crédits d’IA', category: 'IA & documents', screen: 'Administration ▸ Crédits IA',
    keywords: ['crédit', 'ia', 'claude', 'recharge', 'solde', 'payant', 'gratuit'],
    summary: 'Comprendre le niveau gratuit et recharger les crédits pour l’enrichissement IA.',
    steps: ['Le niveau 1 (extraction locale des PDF) est GRATUIT et illimité.', 'Le niveau 2 (IA Claude, photos/cas difficiles) consomme 1 crédit par document.', 'Dans Administration ▸ Crédits IA : consultez le solde, rechargez, suivez l’historique.'],
    related: ['scanner'],
  },
  {
    id: 'admin-roles', title: 'Gérer les utilisateurs et les rôles', category: 'Administration', screen: 'Administration ▸ Utilisateurs & rôles',
    keywords: ['utilisateur', 'rôle', 'droit', 'permission', 'inviter', 'rbac'],
    summary: 'Inviter des utilisateurs et leur attribuer des rôles par société.',
    steps: ['Ouvrez Administration ▸ Utilisateurs & rôles.', 'Invitez un utilisateur, attribuez-lui un ou plusieurs rôles sur les sociétés.', 'Un garde-fou empêche de supprimer le dernier administrateur actif.'],
  },
  {
    id: 'pilotage', title: 'Piloter techniquement l’instance (super-admin)', category: 'Administration', screen: 'Administration ▸ Pilotage technique',
    keywords: ['pilotage', 'super-admin', 'ops', 'sauvegarde', 'diagnostic', 'clés', 'prod', 'test'],
    summary: 'Réaliser des actions d’exploitation sans SSH : diagnostic, config/clés, opérations.',
    steps: ['Ouvrez Administration ▸ Pilotage technique (réservé aux profils habilités).', 'Onglet État : mode test/prod et diagnostic de configuration.', 'Onglet Configuration & clés : réglages et secrets (masqués). Onglet Opérations : actions prédéfinies (dry-run + confirmation typée).'],
  },
];

// ── Recherche d'aide GRATUITE (locale, déterministe) ──

function tokens(s: string): string[] {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

/** Score de pertinence d'un article pour une requête (titre > mots-clés > résumé > étapes). */
export function scoreArticle(a: HelpArticle, query: string): number {
  const qs = tokens(query);
  if (!qs.length) return 0;
  const title = tokens(a.title), keys = a.keywords.flatMap(tokens), summary = tokens(a.summary), steps = tokens(a.steps.join(' '));
  let score = 0;
  for (const q of qs) {
    if (title.includes(q)) score += 3;
    if (keys.includes(q)) score += 2;
    if (summary.includes(q)) score += 1;
    if (steps.includes(q)) score += 0.5;
  }
  return score;
}

/** Renvoie les articles les plus pertinents pour une requête (score décroissant). */
export function searchHelp(query: string, limit = 6): HelpArticle[] {
  return HELP_ARTICLES
    .map((a) => ({ a, s: scoreArticle(a, query) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, limit)
    .map((x) => x.a);
}

export function getArticle(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}
