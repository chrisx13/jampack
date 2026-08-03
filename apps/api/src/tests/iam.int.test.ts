import { describe, it, expect, beforeAll } from 'vitest';
import { demoCaller } from './caller';

let C: Awaited<ReturnType<typeof demoCaller>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let caller: any;

beforeAll(async () => { C = await demoCaller(); caller = C.caller; });

describe('IAM — administration des utilisateurs & rôles', () => {
  it('invite, attribue puis révoque un rôle', async () => {
    const roles = await caller.iam.roles();
    const commercial = roles.find((r: { name: string }) => r.name === 'Commercial');
    const socId = C.soc.id;

    const u = await caller.iam.invite({ email: 'int-admin-test@demo.fr', name: 'Int Test' });
    expect(u.id).toBeTruthy();

    await caller.iam.grantRole({ userId: u.id, societeId: socId, roleId: commercial.id });
    let members = await caller.iam.members();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(members.find((m: any) => m.user.id === u.id)?.roles.some((r: any) => r.roleId === commercial.id && r.societeId === socId)).toBe(true);

    await caller.iam.revokeRole({ userId: u.id, societeId: socId, roleId: commercial.id });
    members = await caller.iam.members();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(members.find((m: any) => m.user.id === u.id)?.roles.length ?? 0).toBe(0);

    // Nettoyage
    await C.prisma.membership.deleteMany({ where: { userId: u.id } });
    await C.prisma.user.delete({ where: { id: u.id } });
  });

  it('garde-fou : refuse de révoquer le dernier administrateur', async () => {
    const roles = await caller.iam.roles();
    const admin = roles.find((r: { name: string }) => r.name === 'Admin');
    const adminUser = await C.prisma.user.findFirstOrThrow({ where: { email: 'admin@demo.fr' } });
    // Le seed n'accorde le rôle Admin qu'une seule fois (admin@demo.fr sur la Boulangerie).
    await expect(caller.iam.revokeRole({ userId: adminUser.id, societeId: C.soc.id, roleId: admin.id })).rejects.toThrow();
    // L'attribution est intacte.
    const still = await C.prisma.societeRole.findFirst({ where: { userId: adminUser.id, roleId: admin.id, societeId: C.soc.id } });
    expect(still).not.toBeNull();
  });
});
