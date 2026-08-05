# Interopérabilité avec les logiciels d'expert-comptable

**Objet :** cartographier les moyens d'échange entre JAMPACK et les logiciels comptables / d'expert-comptable
du marché **français**, et définir ce qui est **implémentable en autonomie** (sans dépendance externe) vs ce
qui exige une **décision + des identifiants** de ta part (API partenaire).

## 1. Deux familles d'intégration

### A. Échange de fichiers (autonome, sans identifiants) — **privilégié**
Tous les logiciels comptables FR **importent des écritures**. Les formats universels/portables :
- **FEC** (Fichier des Écritures Comptables, arrêté du 29/07/2013) — **standard légal DGFiP**, importé par
  Sage, Cegid, EBP, ACD, Quadratus, Pennylane, etc. → **déjà livré** (`accounting.fec`).
- **CSV d'écritures** (journal) — layout simple et largement importable → **livré** (`accounting.exportEntries`,
  voir §3). Colonnes : Journal ; Date ; N° pièce ; Compte ; Libellé ; Débit ; Crédit.
- Exports **balance** et **grand livre** en CSV → déjà livrés (`exportBalance`, `exportLedger`).

Formats **propriétaires** (ajoutables à la demande, **si leur spécification exacte est fournie** — on
n'invente pas un format) :
- **Cegid / Quadratus** : ASCII « Quadra » (fichier `.txt` à structure fixe).
- **Sage** : import PNM / format « grand livre » Sage.
- **EBP** : ASCII EBP. · **Ciel** : import texte (XIMPORT). · **ACD/CADOR**, **Coala**.

### B. API en ligne (REST) — **exigent des identifiants partenaire / OAuth (ta décision)**
Ces éditeurs proposent des API REST, mais leur usage nécessite une **inscription développeur/partenaire**,
un **client OAuth** et des **jetons** propres à ton cabinet/expert — que JAMPACK ne peut pas détenir seul.
Ils sont donc modélisés en **connecteur découplé** (branché quand tu fournis les accès) :

| Éditeur | API | Nature | Prérequis |
|---|---|---|---|
| **Pennylane** | REST publique | Écritures, tiers, factures | Clé API / OAuth du cabinet |
| **Tiime** | REST | Entreprise ↔ expert-comptable | Partenariat / OAuth |
| **Fulll (ex MyUnisoft)** | REST (API-first) | Compta collaborative | OAuth partenaire |
| **Sage** | Sage API | Compta/gestion | App partenaire Sage |
| **Cegid** | Cegid API (Loop…) | Compta/fiscalité | Compte développeur Cegid |
| **EBP** | API / connecteurs | Gestion/compta | Clé / partenariat |

> ⚠️ **On n'invente ni endpoints ni schémas.** Un connecteur en ligne ne sera implémenté qu'avec la
> **documentation officielle** de l'API visée et **tes identifiants** (clé/OAuth). D'ici là, l'échange
> se fait par **fichiers** (FEC + CSV d'écritures), accepté par 100 % des logiciels ci-dessus.

## 2. Recommandation
- **Aujourd'hui (autonome)** : FEC + **export CSV des écritures** couvrent l'immense majorité des besoins
  d'un expert-comptable (import périodique des écritures de vente/achat/banque/OD).
- **À la demande** : sur fourniture d'une spec, ajouter un **format propriétaire** (Quadratus/Sage/EBP).
- **Sur décision + identifiants** : brancher une **API en ligne** (Pennylane/Tiime/Fulll…) via un
  connecteur découplé (jeton stocké côté société, mapping des comptes).

## 3. Livré : export CSV des écritures (`accounting.exportEntries`)
CSV (séparateur `;`, décimale FR, date JJ/MM/AAAA), une ligne par ligne d'écriture, ordonné par date :
`Journal ; Date ; N° pièce ; Compte ; Libellé ; Débit ; Crédit`. Bouton **CSV** sur Comptabilité ▸ Écritures.
Importable tel quel (ou via mapping simple) dans les logiciels d'expert-comptable listés.
