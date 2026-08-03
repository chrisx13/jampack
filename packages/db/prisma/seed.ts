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
    ['read', 'Invoice'], ['create', 'Invoice'], ['update', 'Invoice'],
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
    'read:Invoice', 'create:Invoice', 'update:Invoice',
  ]);
  const comptable = await role('Comptable', ['read:Company', 'read:Contact', 'read:Opportunity', 'read:Product']);

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
  const stageNames = ['Prospect', 'Qualifie', 'Proposition', 'Gagne', 'Perdu'];
  const stages = await Promise.all(
    stageNames.map((name, i) =>
      prisma.pipelineStage.upsert({ where: { organizationId_name: { organizationId: org.id, name } }, update: {}, create: { organizationId: org.id, name, order: i } })
    )
  );
  const stageByName = Object.fromEntries(stages.map((s) => [s.name, s]));

  // ── Données CRM par société ──
  const ensureCompany = async (societeId: string, name: string) => {
    const f = await prisma.company.findFirst({ where: { organizationId: org.id, societeId, name } });
    return f ?? prisma.company.create({ data: { organizationId: org.id, societeId, name } });
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

  const c1 = await ensureCompany(boulangerie.id, 'Fournil Central');
  await ensureEstab(boulangerie.id, c1.id, 'Siège', { siret: '52012345600018', addressLine1: '12 rue de la Ré', postalCode: '69002', city: 'Lyon', isHeadquarters: true, isBilling: true, isDelivery: true });
  await ensureEstab(boulangerie.id, c1.id, 'Entrepôt Villeurbanne', { siret: '52012345600026', addressLine1: '8 av. des Frères Lumière', postalCode: '69100', city: 'Villeurbanne', isDelivery: true });
  const c2 = await ensureCompany(boulangerie.id, 'Cafe des Halles');
  await ensureEstab(boulangerie.id, c2.id, 'Siège', { addressLine1: '3 place des Halles', postalCode: '69003', city: 'Lyon', isHeadquarters: true, isBilling: true, isDelivery: true });
  await ensureContact(boulangerie.id, 'Julie', 'Ferrand', 'julie@fournil-central.fr', c1.id);
  await ensureContact(boulangerie.id, 'Marc', 'Olivier', 'marc@cafedeshalles.fr', c2.id);
  await ensureOpp(boulangerie.id, 'Contrat viennoiseries 2026', 8400, 'Proposition', c1.id);
  await ensureOpp(boulangerie.id, 'Fourniture pains speciaux', 3200, 'Qualifie', c2.id);

  const c3 = await ensureCompany(studio.id, 'Agence Web Pixel');
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
  await ensureProduct(boulangerie.id, 'Baguette tradition', { reference: 'PAIN-001', kind: 'bien', unit: 'pièce', priceHt: 1.1, taxRateId: tr['TVA 5,5 %'].id, categoryId: catPains.id });
  await ensureProduct(boulangerie.id, 'Croissant', { reference: 'VIEN-001', kind: 'bien', unit: 'pièce', priceHt: 1.2, taxRateId: tr['TVA 5,5 %'].id, categoryId: catVienn.id });
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
  const existingInvoice = await prisma.invoice.findFirst({ where: { societeId: boulangerie.id } });
  if (!existingInvoice) {
    await prisma.invoice.create({
      data: {
        organizationId: org.id, societeId: boulangerie.id, companyId: c1.id, status: 'draft',
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

  // ── Référentiels : numérotation des pièces (par société) ──
  const seqs: [string, string][] = [['facture', 'FA-'], ['devis', 'DE-'], ['avoir', 'AV-'], ['commande', 'CM-']];
  for (const s of [boulangerie, studio]) {
    for (const [docType, prefix] of seqs) {
      await prisma.numberSequence.upsert({
        where: { societeId_docType: { societeId: s.id, docType } },
        update: {},
        create: { organizationId: org.id, societeId: s.id, docType, prefix },
      });
    }
  }

  console.log('Seed OK — compte=%s ; sociétés=[Boulangerie, Studio] ; users: admin@demo.fr (Admin+Comptable@Boulangerie, Commercial@Studio), compta@demo.fr (Comptable@Boulangerie)', org.name);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
