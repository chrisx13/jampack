import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

export const prisma = new PrismaClient();

/**
 * Exécute `fn` dans une transaction où le contexte tenant (RLS) est positionné.
 * La valeur est passée en paramètre lié (set_config) : pas d'injection SQL.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

/**
 * Alloue le prochain numéro de pièce (facture, devis…) de façon ATOMIQUE.
 * L'UPDATE ... incrément + RETURNING garantit qu'aucun numéro n'est attribué deux fois,
 * même en cas de créations concurrentes. À appeler dans une transaction (withTenant).
 */
export async function nextDocumentNumber(
  tx: PrismaClient,
  societeId: string,
  docType: string
): Promise<string> {
  const seq = await tx.numberSequence.update({
    where: { societeId_docType: { societeId, docType } },
    data: { nextValue: { increment: 1 } },
  });
  const value = seq.nextValue - 1;
  return `${seq.prefix}${String(value).padStart(seq.padding, '0')}`;
}

/**
 * Contexte "utilisateur" (amorçage d'auth) : positionne app.current_user pour que
 * la policy RLS `membership_self` autorise l'utilisateur à lire SES appartenances,
 * avant même qu'un compte ne soit sélectionné.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user', ${userId}, true)`;
    return fn(tx as unknown as PrismaClient);
  });
}
