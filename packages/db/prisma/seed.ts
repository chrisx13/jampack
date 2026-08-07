import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── Compte (tenant) ──
  const org = await prisma.organization.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Groupe', slug: 'demo' },
  });

  // ── Sociétés du compte ──
  const boulangerie = await prisma.societe.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Boulangerie Martin SARL' } },
    update: {},
    create: { organizationId: org.id, name: 'Boulangerie Martin SARL', siret: '80012345600018', tvaNumber: 'FR40800123456', city: 'Lyon' },
  });
  const studio = await prisma.societe.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Studio Design SAS' } },
    update: {},
    create: { organizationId: org.id, name: 'Studio Design SAS', siret: '85298765400027', tvaNumber: 'FR55852987654', city: 'Nantes' },
  });

  // Paramétrage facturation de démonstration (Boulangerie)
  await prisma.societe.update({
    where: { id: boulangerie.id },
    data: {
      legalForm: 'SARL', capital: '10 000 €', siren: '800123456', rcs: 'Lyon B 800 123 456', ape: '1071C',
      addressLine1: '12 rue de la République', postalCode: '69002', city: 'Lyon',
      phone: '04 78 00 00 00', email: 'contact@boulangerie-martin.fr', website: 'boulangerie-martin.fr',
      legalMentions: "Pénalités de retard : 3× le taux d'intérêt légal. Indemnité forfaitaire de recouvrement des frais : 40 €.",
    },
  });

  // ── Catalogue de permissions ──
  const permCatalog: [string, string][] = [
    ['manage', 'all'],
    ['read', 'Company'], ['create', 'Company'], ['update', 'Company'],
    ['read', 'Contact'], ['create', 'Contact'], ['update', 'Contact'],
    ['read', 'Opportunity'], ['create', 'Opportunity'], ['update', 'Opportunity'],
    ['read', 'Product'], ['create', 'Product'], ['update', 'Product'],
    ['read', 'Quote'], ['create', 'Quote'], ['update', 'Quote'],
    ['read', 'Invoice'], ['create', 'Invoice'], ['update', 'Invoice'],
    ['read', 'CreditNote'], ['create', 'CreditNote'], ['update', 'CreditNote'],
    ['read', 'Payment'], ['create', 'Payment'], ['delete', 'Payment'],
    ['read', 'Warehouse'], ['create', 'Warehouse'], ['update', 'Warehouse'],
    ['read', 'StockMovement'], ['create', 'StockMovement'], ['delete', 'StockMovement'],
    ['read', 'PurchaseOrder'], ['create', 'PurchaseOrder'], ['update', 'PurchaseOrder'],
    ['read', 'SupplierInvoice'], ['create', 'SupplierInvoice'], ['update', 'SupplierInvoice'],
    ['read', 'Accounting'], ['create', 'Accounting'],
    ['read', 'Note'], ['create', 'Note'], ['update', 'Note'], ['delete', 'Note'],
    ['read', 'Expense'], ['create', 'Expense'], ['update', 'Expense'], ['delete', 'Expense'],
    ['manage', 'Ops'], // super-admin technicien d'instance (pilotage + clés en clair de son instance)
    ['manage', 'PlatformOps'], // super-admin général JAMPACK (flotte ; clés vues tronquées)
  ];
  const perms = Object.fromEntries(
    await Promise.all(
      permCatalog.map(async ([action, subject]) => {
        const p = await prisma.permission.upsert({ where: { action_subject: { action, subject } }, update: {}, create: { action, subject } });
        return [`${action}:${subject}`, p] as const;
      })
    )
  );

  // ── Rôles (définis au niveau compte, attribués par société) ──
  const role = async (name: string, keys: string[]) =>
    prisma.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name } },
      update: { permissions: { set: keys.map((k) => ({ id: perms[k].id })) } },
      create: { organizationId: org.id, name, permissions: { connect: keys.map((k) => ({ id: perms[k].id })) } },
    });
  const admin = await role('Admin', ['manage:all']);
  const commercial = await role('Commercial', [
    'read:Company', 'create:Company', 'update:Company',
    'read:Contact', 'create:Contact', 'update:Contact',
    'read:Opportunity', 'create:Opportunity', 'update:Opportunity',
    'read:Product', 'create:Product', 'update:Product',
    'read:Quote', 'create:Quote', 'update:Quote',
    'read:Invoice', 'create:Invoice', 'update:Invoice',
    'read:CreditNote', 'create:CreditNote', 'update:CreditNote',
    'read:Payment', 'create:Payment', 'delete:Payment',
    'read:Warehouse', 'create:Warehouse', 'update:Warehouse',
    'read:StockMovement', 'create:StockMovement', 'delete:StockMovement',
    'read:PurchaseOrder', 'create:PurchaseOrder', 'update:PurchaseOrder',
    'read:SupplierInvoice', 'create:SupplierInvoice', 'update:SupplierInvoice',
    'read:Note', 'create:Note', 'update:Note', 'delete:Note',
    // Notes de frais : un commercial en déplacement peut saisir/gérer ses frais (validation/compta = Comptable).
    'read:Expense', 'create:Expense', 'update:Expense', 'delete:Expense',
  ]);
  const comptable = await role('Comptable', [
    'read:Company', 'read:Contact', 'read:Opportunity', 'read:Product',
    'read:Quote', 'read:Invoice', 'read:CreditNote',
    'read:Payment', 'create:Payment', 'delete:Payment',
    'read:PurchaseOrder', 'read:SupplierInvoice', 'create:SupplierInvoice', 'update:SupplierInvoice',
    'read:Accounting', 'create:Accounting',
    'read:Note', 'create:Note', 'update:Note', 'delete:Note',
    'read:Expense', 'create:Expense', 'update:Expense', 'delete:Expense',
  ]);

  // ── Utilisateurs ──
  const userAdmin = await prisma.user.upsert({ where: { email: 'admin@demo.fr' }, update: {}, create: { email: 'admin@demo.fr', name: 'Admin Demo' } });
  const userCompta = await prisma.user.upsert({ where: { email: 'compta@demo.fr' }, update: {}, create: { email: 'compta@demo.fr', name: 'Claire Comptable' } });

  // Accès au compte
  for (const u of [userAdmin, userCompta]) {
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: u.id, organizationId: org.id } },
      update: {},
      create: { userId: u.id, organizationId: org.id },
    });
  }

  // ── Rôles par société (cumulables) ──
  const grant = (userId: string, societeId: string, roleId: string) =>
    prisma.societeRole.upsert({
      where: { userId_societeId_roleId: { userId, societeId, roleId } },
      update: {},
      create: { userId, societeId, roleId, organizationId: org.id },
    });

  // Admin : Admin + Comptable dans la Boulangerie (2 rôles cumulés), Commercial dans le Studio
  await grant(userAdmin.id, boulangerie.id, admin.id);
  await grant(userAdmin.id, boulangerie.id, comptable.id);
  await grant(userAdmin.id, studio.id, commercial.id);
  // Claire : Comptable UNIQUEMENT dans la Boulangerie (présente en A, pas en B)
  await grant(userCompta.id, boulangerie.id, comptable.id);

  // ── Pipeline (niveau compte) ──
  const stageDefs = [
    { name: 'Prospect', probability: 10 },
    { name: 'Qualifie', probability: 40 },
    { name: 'Proposition', probability: 70 },
    { name: 'Gagne', probability: 100 },
    { name: 'Perdu', probability: 0 },
  ];
  const stages = await Promise.all(
    stageDefs.map((s, i) =>
      prisma.pipelineStage.upsert({ where: { organizationId_name: { organizationId: org.id, name: s.name } }, update: { probability: s.probability }, create: { organizationId: org.id, name: s.name, order: i, probability: s.probability } })
    )
  );
  const stageByName = Object.fromEntries(stages.map((s) => [s.name, s]));

  // ── Données CRM par société ──
  const ensureCompany = async (societeId: string, name: string, ids?: { siren?: string; siret?: string; tvaNumber?: string }) => {
    const f = await prisma.company.findFirst({ where: { organizationId: org.id, societeId, name } });
    return f ?? prisma.company.create({ data: { organizationId: org.id, societeId, name, ...ids } });
  };
  const ensureContact = async (societeId: string, firstName: string, lastName: string, email: string, companyId?: string) => {
    const f = await prisma.contact.findFirst({ where: { organizationId: org.id, societeId, email } });
    return f ?? prisma.contact.create({ data: { organizationId: org.id, societeId, firstName, lastName, email, companyId } });
  };
  const ensureOpp = async (societeId: string, title: string, amount: number, stageName: string, companyId?: string) => {
    const f = await prisma.opportunity.findFirst({ where: { organizationId: org.id, societeId, title } });
    return f ?? prisma.opportunity.create({ data: { organizationId: org.id, societeId, title, amount, stageId: stageByName[stageName].id, companyId } });
  };

  const ensureEstab = async (
    societeId: string, companyId: string, name: string,
    data: { siret?: string; addressLine1?: string; postalCode?: string; city?: string; isHeadquarters?: boolean; isBilling?: boolean; isDelivery?: boolean }
  ) => {
    const f = await prisma.establishment.findFirst({ where: { companyId, name } });
    return f ?? prisma.establishment.create({ data: { organizationId: org.id, societeId, companyId, name, ...data } });
  };

  const c1 = await ensureCompany(boulangerie.id, 'Fournil Central', { siren: '520123456', siret: '52012345600018', tvaNumber: 'FR31520123456' });
  await ensureEstab(boulangerie.id, c1.id, 'Siège', { siret: '52012345600018', addressLine1: '12 rue de la Ré', postalCode: '69002', city: 'Lyon', isHeadquarters: true, isBilling: true, isDelivery: true });
  await ensureEstab(boulangerie.id, c1.id, 'Entrepôt Villeurbanne', { siret: '52012345600026', addressLine1: '8 av. des Frères Lumière', postalCode: '69100', city: 'Villeurbanne', isDelivery: true });
  const c2 = await ensureCompany(boulangerie.id, 'Cafe des Halles');
  await ensureEstab(boulangerie.id, c2.id, 'Siège', { addressLine1: '3 place des Halles', postalCode: '69003', city: 'Lyon', isHeadquarters: true, isBilling: true, isDelivery: true });
  await ensureContact(boulangerie.id, 'Julie', 'Ferrand', 'julie@fournil-central.fr', c1.id);
  await ensureContact(boulangerie.id, 'Marc', 'Olivier', 'marc@cafedeshalles.fr', c2.id);
  await ensureOpp(boulangerie.id, 'Contrat viennoiseries 2026', 8400, 'Proposition', c1.id);
  await ensureOpp(boulangerie.id, 'Fourniture pains speciaux', 3200, 'Qualifie', c2.id);

  const c3 = await ensureCompany(studio.id, 'Agence Web Pixel', { siren: '853123456', siret: '85312345600011', tvaNumber: 'FR42853123456' });
  await ensureEstab(studio.id, c3.id, 'Siège', { siret: '85312345600011', addressLine1: '21 rue Crébillon', postalCode: '44000', city: 'Nantes', isHeadquarters: true, isBilling: true, isDelivery: true });
  const c4 = await ensureCompany(studio.id, 'Studio Photo Lumen');
  await ensureContact(studio.id, 'Sophie', 'Renard', 'sophie@pixel.fr', c3.id);
  await ensureContact(studio.id, 'Idriss', 'Benali', 'idriss@lumen.fr', c4.id);
  await ensureOpp(studio.id, 'Refonte site vitrine', 12500, 'Gagne', c3.id);
  await ensureOpp(studio.id, 'Identite visuelle', 5600, 'Prospect', c4.id);

  // ── Référentiels : TVA (niveau compte) ──
  const rates: { name: string; rate: number; isDefault?: boolean }[] = [
    { name: 'TVA 20 %', rate: 20, isDefault: true },
    { name: 'TVA 10 %', rate: 10 },
    { name: 'TVA 5,5 %', rate: 5.5 },
    { name: 'TVA 2,1 %', rate: 2.1 },
    { name: 'Exonéré (0 %)', rate: 0 },
  ];
  const tr: Record<string, { id: string }> = {};
  for (const t of rates) {
    tr[t.name] = await prisma.taxRate.upsert({
      where: { organizationId_name: { organizationId: org.id, name: t.name } },
      update: {},
      create: { organizationId: org.id, name: t.name, rate: t.rate, isDefault: t.isDefault ?? false },
    });
  }

  // ── Référentiels : catégories d'articles (par société) ──
  const ensureCategory = async (societeId: string, name: string) => {
    const f = await prisma.productCategory.findFirst({ where: { societeId, name } });
    return f ?? prisma.productCategory.create({ data: { organizationId: org.id, societeId, name } });
  };
  const catPains = await ensureCategory(boulangerie.id, 'Pains');
  const catVienn = await ensureCategory(boulangerie.id, 'Viennoiseries');
  const catDesign = await ensureCategory(studio.id, 'Design');
  const catDev = await ensureCategory(studio.id, 'Développement');

  // ── Référentiels : articles & services (par société) ──
  const ensureProduct = async (societeId: string, name: string, data: Record<string, unknown>) => {
    const f = await prisma.product.findFirst({ where: { organizationId: org.id, societeId, name } });
    return f ?? prisma.product.create({ data: { organizationId: org.id, societeId, name, ...data } });
  };
  await ensureProduct(boulangerie.id, 'Baguette tradition', { reference: 'PAIN-001', kind: 'bien', unit: 'pièce', priceHt: 1.1, reorderPoint: 50, taxRateId: tr['TVA 5,5 %'].id, categoryId: catPains.id });
  await ensureProduct(boulangerie.id, 'Croissant', { reference: 'VIEN-001', kind: 'bien', unit: 'pièce', priceHt: 1.2, reorderPoint: 100, taxRateId: tr['TVA 5,5 %'].id, categoryId: catVienn.id });
  await ensureProduct(studio.id, 'Création logo', { reference: 'SRV-LOGO', kind: 'service', unit: 'forfait', priceHt: 900, taxRateId: tr['TVA 20 %'].id, categoryId: catDesign.id });
  await ensureProduct(studio.id, 'Journée de développement', { reference: 'SRV-DEV', kind: 'service', unit: 'jour', priceHt: 650, taxRateId: tr['TVA 20 %'].id, categoryId: catDev.id });

  // ── Facturation : adresses, comptes bancaires, conditions de paiement, affactureurs (Boulangerie) ──
  const first = async <T,>(p: Promise<T | null>, create: () => Promise<T>) => (await p) ?? (await create());
  const bank = await first(
    prisma.bankAccount.findFirst({ where: { societeId: boulangerie.id } }),
    () => prisma.bankAccount.create({ data: { organizationId: org.id, societeId: boulangerie.id, label: 'Crédit Agricole', iban: 'FR76 3000 4000 0100 0001 2345 678', bic: 'AGRIFRPPXXX', isDefault: true } })
  );
  const term30 = await first(
    prisma.paymentTerm.findFirst({ where: { societeId: boulangerie.id, label: '30 jours' } }),
    () => prisma.paymentTerm.create({ data: { organizationId: org.id, societeId: boulangerie.id, label: '30 jours', days: 30, isDefault: true } })
  );
  await first(
    prisma.paymentTerm.findFirst({ where: { societeId: boulangerie.id, label: 'Comptant' } }),
    () => prisma.paymentTerm.create({ data: { organizationId: org.id, societeId: boulangerie.id, label: 'Comptant', days: 0 } })
  );
  const factor = await first(
    prisma.factor.findFirst({ where: { societeId: boulangerie.id, name: 'BNP Factor' } }),
    () => prisma.factor.create({ data: { organizationId: org.id, societeId: boulangerie.id, name: 'BNP Factor', iban: 'FR76 3000 1000 0400 0000 9999 111', bic: 'BNPAFRPPXXX' } })
  );
  await first(
    prisma.societeAddress.findFirst({ where: { societeId: boulangerie.id } }),
    () => prisma.societeAddress.create({ data: { organizationId: org.id, societeId: boulangerie.id, label: 'Siège', addressLine1: '12 rue de la République', postalCode: '69002', city: 'Lyon', isHeadquarters: true, isBilling: true, isDefault: true } })
  );
  // Client Fournil Central : condition par défaut + affactureur OBLIGATOIRE
  await prisma.company.update({ where: { id: c1.id }, data: { paymentTermId: term30.id, factorId: factor.id, factorMandatory: true } });

  // ── Facture de démonstration (brouillon) ──
  const existingInvoice = await prisma.invoice.findFirst({ where: { societeId: boulangerie.id, docType: 'facture' } });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        organizationId: org.id, societeId: boulangerie.id, companyId: c1.id, docType: 'facture', status: 'draft',
        notes: 'Facture de démonstration',
        factorId: factor.id, bankAccountId: bank.id, paymentTermId: term30.id,
        lines: {
          create: [
            { label: 'Baguette tradition', quantity: 100, unitPriceHt: 1.1, taxRatePct: 5.5, position: 0 },
            { label: 'Croissant', quantity: 50, unitPriceHt: 1.2, taxRatePct: 5.5, position: 1 },
          ],
        },
      },
    });
  }

  // ── Devis de démonstration (brouillon) ──
  const existingQuote = await prisma.invoice.findFirst({ where: { societeId: boulangerie.id, docType: 'devis' } });
  if (!existingQuote) {
    await prisma.invoice.create({
      data: {
        organizationId: org.id, societeId: boulangerie.id, companyId: c2.id, docType: 'devis', status: 'draft',
        notes: 'Devis de démonstration',
        paymentTermId: term30.id,
        lines: {
          create: [
            { label: 'Pain de campagne', quantity: 80, unitPriceHt: 2.4, taxRatePct: 5.5, position: 0 },
            { label: 'Fourniture hebdomadaire', quantity: 1, unitPriceHt: 120, taxRatePct: 20, position: 1 },
          ],
        },
      },
    });
  }

  // ── Référentiels : numérotation des pièces (par société) ──
  const seqs: [string, string][] = [['facture', 'FA-'], ['devis', 'DE-'], ['avoir', 'AV-'], ['commande', 'CM-'], ['bl', 'BL-']];
  for (const s of [boulangerie, studio]) {
    for (const [docType, prefix] of seqs) {
      await prisma.numberSequence.upsert({
        where: { societeId_docType: { societeId: s.id, docType } },
        update: {},
        create: { organizationId: org.id, societeId: s.id, docType, prefix },
      });
    }
  }

  // ── Stock : entrepôts + stock initial de démonstration ──
  const ensureWarehouse = async (societeId: string, name: string, data: Record<string, unknown> = {}) => {
    const f = await prisma.warehouse.findFirst({ where: { societeId, name } });
    return f ?? prisma.warehouse.create({ data: { organizationId: org.id, societeId, name, ...data } });
  };
  const whBoul = await ensureWarehouse(boulangerie.id, 'Fournil — Réserve', { code: 'BOUL-1', city: 'Lyon', isDefault: true });
  await ensureWarehouse(studio.id, 'Studio — Local', { code: 'STU-1', city: 'Nantes', isDefault: true });

  const boulHasStock = await prisma.stockMovement.findFirst({ where: { societeId: boulangerie.id } });
  if (!boulHasStock) {
    for (const [productName, qty, unitCost] of [['Baguette tradition', 500, 0.45], ['Croissant', 300, 0.55]] as [string, number, number][]) {
      const p = await prisma.product.findFirst({ where: { societeId: boulangerie.id, name: productName } });
      if (p) await prisma.stockMovement.create({ data: { organizationId: org.id, societeId: boulangerie.id, warehouseId: whBoul.id, productId: p.id, kind: 'entree', quantity: qty, unitCost, note: 'Stock initial' } });
    }
  }

  // ── Achats : fournisseur + commande de démonstration (brouillon) ──
  const supplier = await ensureCompany(boulangerie.id, 'Moulins de Lyon');
  await prisma.company.update({ where: { id: supplier.id }, data: { isSupplier: true, isCustomer: false } });
  const poExists = await prisma.purchaseOrder.findFirst({ where: { societeId: boulangerie.id } });
  if (!poExists) {
    await prisma.purchaseOrder.create({
      data: {
        organizationId: org.id, societeId: boulangerie.id, supplierId: supplier.id, warehouseId: whBoul.id, status: 'draft',
        notes: 'Commande de démonstration',
        lines: {
          create: [
            { label: 'Farine T65 (sac 25 kg)', quantity: 40, unitPriceHt: 18, position: 0 },
            { label: 'Levure fraîche (kg)', quantity: 10, unitPriceHt: 3.5, position: 1 },
          ],
        },
      },
    });
  }

  // ── Achats : facture fournisseur de démonstration (validée, à payer) ──
  const supInvExists = await prisma.supplierInvoice.findFirst({ where: { societeId: boulangerie.id } });
  if (!supInvExists) {
    await prisma.supplierInvoice.create({
      data: {
        organizationId: org.id, societeId: boulangerie.id, supplierId: supplier.id, status: 'validated',
        reference: 'FR-2026-0421', issueDate: new Date('2026-07-20'), dueDate: new Date('2026-08-19'),
        notes: 'Facture fournisseur de démonstration',
        lines: {
          create: [
            { label: 'Farine T65 (sac 25 kg)', quantity: 40, unitPriceHt: 18, taxRatePct: 5.5, position: 0 },
            { label: 'Levure fraîche (kg)', quantity: 10, unitPriceHt: 3.5, taxRatePct: 5.5, position: 1 },
          ],
        },
      },
    });
  }

  // ── Comptabilité : plan comptable général (PCG standard) + journaux (par société) ──
  // Jeu standard TPE/PME (classes 1 à 7). Reste aligné avec PCG_STANDARD de @jampack/domain.
  const PCG_STANDARD: { code: string; name: string }[] = [
    { code: '101000', name: 'Capital' }, { code: '106000', name: 'Réserves' },
    { code: '120000', name: 'Résultat de l’exercice (bénéfice)' }, { code: '129000', name: 'Résultat de l’exercice (perte)' },
    { code: '164000', name: 'Emprunts auprès des établissements de crédit' },
    { code: '205000', name: 'Concessions, brevets, logiciels' }, { code: '215000', name: 'Installations techniques, matériel et outillage' },
    { code: '218300', name: 'Matériel informatique' }, { code: '218400', name: 'Mobilier' },
    { code: '280500', name: 'Amortissements des immobilisations incorporelles' }, { code: '281800', name: 'Amortissements des autres immobilisations corporelles' },
    { code: '401000', name: 'Fournisseurs' }, { code: '404000', name: 'Fournisseurs d’immobilisations' }, { code: '408000', name: 'Fournisseurs — factures non parvenues' },
    { code: '411000', name: 'Clients' }, { code: '416000', name: 'Clients douteux ou litigieux' }, { code: '418000', name: 'Clients — factures à établir' },
    { code: '421000', name: 'Personnel — rémunérations dues' }, { code: '431000', name: 'Sécurité sociale' },
    { code: '445660', name: 'TVA déductible' }, { code: '445620', name: 'TVA déductible sur immobilisations' }, { code: '445710', name: 'TVA collectée' },
    { code: '445510', name: 'TVA à décaisser' }, { code: '445670', name: 'Crédit de TVA à reporter' },
    { code: '447000', name: 'Autres impôts, taxes et versements assimilés' }, { code: '455000', name: 'Associés — comptes courants' },
    { code: '512000', name: 'Banque' }, { code: '514000', name: 'Chèques postaux' }, { code: '530000', name: 'Caisse' }, { code: '580000', name: 'Virements internes' },
    { code: '601000', name: 'Achats de matières premières' }, { code: '607000', name: 'Achats de marchandises' },
    { code: '606300', name: 'Fournitures d’entretien et petit équipement' }, { code: '606400', name: 'Fournitures administratives' },
    { code: '613000', name: 'Locations' }, { code: '615000', name: 'Entretien et réparations' }, { code: '616000', name: 'Primes d’assurance' },
    { code: '622600', name: 'Honoraires' }, { code: '623000', name: 'Publicité, publications' }, { code: '625000', name: 'Déplacements, missions et réceptions' },
    { code: '626000', name: 'Frais postaux et de télécommunications' }, { code: '627000', name: 'Services bancaires' }, { code: '635000', name: 'Impôts et taxes' },
    { code: '641000', name: 'Rémunérations du personnel' }, { code: '645000', name: 'Charges de sécurité sociale et de prévoyance' },
    { code: '661000', name: 'Charges d’intérêts' }, { code: '681000', name: 'Dotations aux amortissements' },
    { code: '701000', name: 'Ventes de produits finis' }, { code: '706000', name: 'Prestations de services' }, { code: '707000', name: 'Ventes de marchandises' },
    { code: '708000', name: 'Produits des activités annexes' }, { code: '758000', name: 'Produits divers de gestion courante' }, { code: '764000', name: 'Produits financiers' },
  ];
  const JOURNALS: [string, string, string][] = [
    ['VT', 'Ventes', 'vente'], ['AC', 'Achats', 'achat'], ['BQ', 'Banque', 'banque'], ['OD', 'Opérations diverses', 'od'],
  ];
  for (const s of [boulangerie, studio]) {
    for (const { code, name } of PCG_STANDARD) {
      await prisma.account.upsert({
        where: { societeId_code: { societeId: s.id, code } },
        update: {},
        create: { organizationId: org.id, societeId: s.id, code, name, class: Number(code[0]) },
      });
    }
    for (const [code, name, type] of JOURNALS) {
      await prisma.journal.upsert({
        where: { societeId_code: { societeId: s.id, code } },
        update: {},
        create: { organizationId: org.id, societeId: s.id, code, name, type },
      });
    }
  }

  console.log('Seed OK — compte=%s ; sociétés=[Boulangerie, Studio] ; users: admin@demo.fr (Admin+Comptable@Boulangerie, Commercial@Studio), compta@demo.fr (Comptable@Boulangerie)', org.name);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
