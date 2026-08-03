# SLA — Accord de niveau de service

**Projet :** JAMPACK · **Aligné :** ITIL 4 · **Statut :** Modèle · **Version :** 1.0 · **Date :** 3 août 2026

> Document contractuel type entre l'éditeur (fournisseur de service) et le client (compte abonné).
> Les valeurs ci-dessous sont des **cibles proposées** à ajuster par offre commerciale.

## 1. Périmètre du service
Fourniture en mode SaaS de la plateforme JAMPACK (application web + API + base de données managée),
hébergée dans l'Union européenne, incluant exploitation, sauvegardes et support.

## 2. Disponibilité
| Palier | Disponibilité mensuelle cible | Indisponibilité max/mois |
|---|---|---|
| Standard | **99,5 %** | ~3 h 39 |
| Business | **99,9 %** | ~43 min |

- Mesure : taux de réponse HTTP 2xx/3xx sur l'endpoint de santé, hors **maintenances planifiées**.
- Maintenances planifiées : notifiées ≥ 72 h à l'avance, hors heures ouvrées, ≤ 4 h/mois.

## 3. Performance (objectifs de niveau de service)
| Indicateur | Cible |
|---|---|
| Temps de réponse API (P95, listes principales) | < 500 ms |
| Génération PDF d'une facture | < 3 s |
| RPO (perte de données max) | ≤ 24 h (Standard) / ≤ 1 h (Business) |
| RTO (reprise après incident majeur) | ≤ 8 h (Standard) / ≤ 2 h (Business) |

## 4. Support et gestion des incidents
| Sévérité | Définition | Prise en compte | Contournement/résolution cible |
|---|---|---|---|
| S1 — Critique | Service indisponible / perte de données | 1 h ouvrée | 4 h |
| S2 — Majeur | Fonction clé bloquée, sans contournement | 4 h ouvrées | 1 j ouvré |
| S3 — Mineur | Anomalie contournable | 1 j ouvré | Prochaine version |
| S4 — Demande | Question, évolution | 2 j ouvrés | Selon roadmap |

- Heures ouvrées : 9 h–18 h (jours ouvrés, fuseau Europe/Paris).
- Canal : portail / email de support. Escalade S1/S2 par téléphone (Business).

## 5. Sauvegarde et continuité
- Sauvegardes automatiques **chiffrées** de la base, quotidiennes (Standard) / continues PITR (Business).
- Tests de restauration périodiques. Détail opérationnel : [Runbook](RUNBOOK.md).

## 6. Sécurité et conformité
- Hébergement et données **dans l'UE** (RGPD). Chiffrement en transit (TLS) et au repos.
- Isolation stricte des comptes (RLS). Voir [Sécurité & RGPD](SECURITE-RGPD.md).
- Sous-traitance conforme (art. 28 RGPD) ; registre des sous-traitants tenu à jour.

## 7. Exclusions
Indisponibilités dues à : force majeure, mauvaise utilisation, réseau/poste du client, tiers non
maîtrisés (IdP, PDP, hébergeur au-delà de leurs propres SLA), maintenances planifiées.

## 8. Pénalités (modèle)
En cas de non-atteinte de la disponibilité cible, avoir proportionnel sur la mensualité :
| Disponibilité constatée | Avoir |
|---|---|
| < cible et ≥ cible − 0,5 pt | 5 % |
| < cible − 0,5 pt et ≥ 97 % | 10 % |
| < 97 % | 30 % |

## 9. Révision
SLA revu annuellement ou à chaque évolution majeure d'architecture/offre.
