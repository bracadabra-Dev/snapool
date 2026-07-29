import { prisma } from '../lib/prisma';
import { invalidatePlatformCache } from '../lib/platformConfig';
import { refreshUploadRateLimit } from '../middleware/rateLimit';

export async function writeAuditLog(params: {
  adminId: string;
  action: string;
  target?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      target: params.target,
      before: params.before as object | undefined,
      after: params.after as object | undefined,
      ip: params.ip,
    },
  });
  invalidatePlatformCache();
  void refreshUploadRateLimit();
}

export async function bootstrapSuperAdmin(email: string): Promise<void> {
  if (!email) return;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.warn(`SUPER_ADMIN_EMAIL ${email} not found — register first to bootstrap admin`);
    return;
  }
  if (!user.isSuperAdmin) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isSuperAdmin: true },
    });
    console.log(`Promoted ${email} to super admin`);
  }
}
