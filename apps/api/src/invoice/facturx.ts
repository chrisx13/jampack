// Génération Factur-X — XML CII (UN/CEFACT CrossIndustryInvoice), aligné EN 16931.
// Profil pragmatique « BASIC » : identités vendeur/acheteur, lignes, ventilation de TVA, totaux.
// Indépendant de toute PDP : ce document est la donnée structurée à embarquer (PDF/A-3) et/ou transmettre.

type Line = { label: string; quantity: unknown; unitPriceHt: unknown; taxRatePct: unknown };
type Invoice = {
  number: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  vatReverseCharge?: boolean | null;
  company: { name: string; siren?: string | null; siret?: string | null; tvaNumber?: string | null } | null;
  establishment: { addressLine1?: string | null; postalCode?: string | null; city?: string | null } | null;
  lines: Line[];
};
type Societe = Record<string, unknown> & { name: string };
type Totals = { totalHt: number; totalTva: number; totalTtc: number };

const n = (v: unknown) => { const x = Number(v as never); return Number.isFinite(x) ? x : 0; };
const r2 = (v: number) => Math.round(v * 100) / 100;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));
const dt = (d: Date | null) => { const x = d ? new Date(d) : new Date(); return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`; };
const s = (soc: Societe, k: string) => (soc[k] ? String(soc[k]) : '');

/** Ventilation de TVA par taux (base HT + montant) — requis par EN 16931 (BG-23). */
function taxBreakdown(lines: Line[]) {
  const map = new Map<number, { base: number; tax: number }>();
  for (const l of lines) {
    const rate = n(l.taxRatePct);
    const ht = r2(n(l.quantity) * n(l.unitPriceHt));
    const e = map.get(rate) ?? { base: 0, tax: 0 };
    e.base = r2(e.base + ht);
    e.tax = r2(e.tax + r2(ht * (rate / 100)));
    map.set(rate, e);
  }
  return [...map.entries()].map(([rate, v]) => ({ rate, base: v.base, tax: v.tax })).sort((a, b) => b.rate - a.rate);
}

/** Rendu du XML CII (Factur-X) d'une facture. */
export function renderFacturXml(inv: Invoice, soc: Societe, totals: Totals): string {
  const bd = taxBreakdown(inv.lines);
  // Régime de TVA → catégorie d'exonération EN 16931 : franchise « E » (293 B), autoliquidation « AE ».
  const franchise = !!soc.vatFranchise;
  const reverse = !!inv.vatReverseCharge;
  const zeroVat = franchise || reverse;
  const cat = franchise ? 'E' : reverse ? 'AE' : 'S';
  const exemption = franchise
    ? `<ram:ExemptionReasonCode>VATEX-EU-D</ram:ExemptionReasonCode><ram:ExemptionReason>Franchise en base de TVA (art. 293 B du CGI)</ram:ExemptionReason>`
    : reverse
      ? `<ram:ExemptionReasonCode>VATEX-EU-AE</ram:ExemptionReasonCode><ram:ExemptionReason>Autoliquidation — TVA due par le preneur (art. 283-2 du CGI)</ram:ExemptionReason>`
      : '';
  const line = (l: Line, i: number) => {
    const qty = n(l.quantity), pu = n(l.unitPriceHt), rate = n(l.taxRatePct), ht = r2(qty * pu);
    return `      <ram:IncludedSupplyChainTradeLineItem>
        <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
        <ram:SpecifiedTradeProduct><ram:Name>${esc(l.label)}</ram:Name></ram:SpecifiedTradeProduct>
        <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${pu.toFixed(2)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
        <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">${qty}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
        <ram:SpecifiedLineTradeSettlement>
          <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat}</ram:CategoryCode><ram:RateApplicablePercent>${zeroVat ? 0 : rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
          <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${ht.toFixed(2)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
        </ram:SpecifiedLineTradeSettlement>
      </ram:IncludedSupplyChainTradeLineItem>`;
  };
  const taxLine = (t: { rate: number; base: number; tax: number }) =>
    `        <ram:ApplicableTradeTax><ram:CalculatedAmount>${t.tax.toFixed(2)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat}</ram:CategoryCode>${exemption}<ram:BasisAmount>${t.base.toFixed(2)}</ram:BasisAmount><ram:RateApplicablePercent>${zeroVat ? 0 : t.rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>`;
  const buyerAddr = inv.establishment;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(inv.number ?? '')}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${dt(inv.issueDate)}</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${inv.lines.map(line).join('\n')}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${esc(soc.name)}</ram:Name>
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(s(soc, 'siret'))}</ram:ID></ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress><ram:PostcodeCode>${esc(s(soc, 'postalCode'))}</ram:PostcodeCode><ram:LineOne>${esc(s(soc, 'addressLine1'))}</ram:LineOne><ram:CityName>${esc(s(soc, 'city'))}</ram:CityName><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(s(soc, 'tvaNumber'))}</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(inv.company?.name ?? '')}</ram:Name>${inv.company?.siren ? `
        <ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(inv.company.siren)}</ram:ID></ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress><ram:PostcodeCode>${esc(buyerAddr?.postalCode ?? '')}</ram:PostcodeCode><ram:LineOne>${esc(buyerAddr?.addressLine1 ?? '')}</ram:LineOne><ram:CityName>${esc(buyerAddr?.city ?? '')}</ram:CityName><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>${inv.company?.tvaNumber ? `
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(inv.company.tvaNumber)}</ram:ID></ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${bd.map(taxLine).join('\n')}
      <ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${dt(inv.dueDate)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${totals.totalHt.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${totals.totalHt.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${totals.totalTva.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${totals.totalTtc.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${totals.totalTtc.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
