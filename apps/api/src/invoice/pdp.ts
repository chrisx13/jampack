// Module PDP / e-invoicing (fonctions logicielles d'une plateforme de dématérialisation).
// ⚠️ IMPORTANT : ce module ne rend PAS l'entreprise « PDP » au sens réglementaire.
// L'immatriculation DGFiP, le raccordement au PPF (annuaire + concentrateur), l'e-reporting officiel,
// l'interopérabilité inter-PDP et la certification sécurité sont HORS périmètre logiciel.
// Voir docs/CONFORMITE.md §3.1. Ce connecteur est conçu pour brancher soit une PDP INTERNE (à raccorder
// au PPF), soit une PDP PARTENAIRE (via son API), sans réécrire le métier.

export interface PdpResult { provider: string; status: 'sent' | 'accepted' | 'rejected'; providerRef: string }

export interface PdpConnector {
  provider: string;
  /** Transmet une facture (flux Factur-X). */
  transmit(payload: { invoiceNumber: string; xml: string }): Promise<PdpResult>;
}

/** PDP interne : contrôle minimal + accusé. Point d'intégration PPF à implémenter (TODO). */
class InternalPdp implements PdpConnector {
  provider = 'internal';
  async transmit(payload: { invoiceNumber: string; xml: string }): Promise<PdpResult> {
    const wellFormed = payload.xml.includes('<rsm:CrossIndustryInvoice') && !!payload.invoiceNumber;
    // TODO PPF : dépôt annuaire/concentrateur, routage vers la PDP du destinataire, e-reporting.
    return { provider: this.provider, status: wellFormed ? 'accepted' : 'rejected', providerRef: `INT-${payload.invoiceNumber || 'X'}` };
  }
}

/** Sélectionne le connecteur PDP (défaut : interne). Brancher ici un adaptateur partenaire si besoin. */
export function getPdp(): PdpConnector {
  // const provider = process.env.PDP_PROVIDER; // 'internal' | '<partenaire>'
  return new InternalPdp();
}
