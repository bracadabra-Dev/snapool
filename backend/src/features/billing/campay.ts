import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { invalidatePlatformCache } from '../../lib/platformConfig';

type CheckoutBody = {
  planId?: string;
  addOnId?: string;
  eventId?: string;
};

type CampayInitResponse = {
  reference?: string;
  uuid?: string;
  link?: string;
};

export async function createCheckout(params: {
  userId: string;
  planId?: string;
  addOnId?: string;
  eventId?: string;
}): Promise<{ paymentId: string; checkoutUrl: string | null; reference: string; devComplete?: boolean }> {
  let amount = 0;
  let currency = 'XAF';
  let planId: string | null = null;
  let addOnId: string | null = null;

  if (params.planId) {
    const plan = await prisma.planDefinition.findUnique({ where: { id: params.planId } });
    if (!plan || !plan.active) throw new Error('Plan not found');
    amount = plan.priceAmount;
    planId = plan.id;
  } else if (params.addOnId) {
    const addon = await prisma.addOnDefinition.findUnique({ where: { id: params.addOnId } });
    if (!addon || !addon.active) throw new Error('Add-on not found');
    if (!params.eventId) throw new Error('eventId required for add-on purchase');
    amount = addon.priceAmount;
    addOnId = addon.id;
  } else {
    throw new Error('planId or addOnId required');
  }

  const platform = await prisma.platformSettings.findUnique({ where: { id: 'platform' } });
  if (platform) currency = platform.currency;

  const reference = randomUUID();
  const payment = await prisma.paymentRecord.create({
    data: {
      userId: params.userId,
      eventId: params.eventId ?? null,
      planId,
      addOnId,
      amount,
      currency,
      status: 'pending',
      campayTxId: reference,
      metadata: { source: 'checkout' },
    },
  });

  if (!env.CAMPAY_API_KEY) {
    return {
      paymentId: payment.id,
      checkoutUrl: null,
      reference,
      devComplete: true,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  const res = await fetch(`${env.CAMPAY_API_URL}/collect/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.CAMPAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(amount),
      currency,
      description: planId ? `SnapPool ${planId}` : `SnapPool add-on ${addOnId}`,
      external_reference: reference,
      redirect_url: `${env.APP_PUBLIC_URL}/dashboard?payment=${reference}`,
      username: user?.email,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as CampayInitResponse;
  if (!res.ok) {
    await prisma.paymentRecord.update({
      where: { id: payment.id },
      data: { status: 'failed', metadata: { error: data } },
    });
    throw new Error('Failed to initiate Campay payment');
  }

  await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: {
      campayTxId: data.reference || data.uuid || reference,
      metadata: { campay: data },
    },
  });

  return {
    paymentId: payment.id,
    checkoutUrl: data.link ?? null,
    reference: data.reference || reference,
  };
}

export async function completePayment(reference: string): Promise<void> {
  const payment = await prisma.paymentRecord.findFirst({
    where: {
      OR: [{ campayTxId: reference }, { id: reference }],
    },
  });
  if (!payment || payment.status === 'completed') return;

  await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: { status: 'completed', completedAt: new Date() },
  });

  if (payment.planId && payment.userId) {
    const plan = await prisma.planDefinition.findUnique({ where: { id: payment.planId } });
    if (!plan) return;

    const expiresAt = new Date();
    if (plan.billingType === 'subscription') {
      if (plan.priceInterval === 'year') expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      else expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan.billingType === 'one_time') {
      expiresAt.setDate(expiresAt.getDate() + plan.maxRetentionDays);
    }

    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        plan: plan.id,
        planExpiresAt: plan.billingType === 'free' ? null : expiresAt,
      },
    });

    if (plan.id === 'event_pass' && payment.eventId) {
      await prisma.event.update({
        where: { id: payment.eventId },
        data: { paidFeaturesUnlocked: true },
      });
    }
  }

  if (payment.addOnId && payment.eventId) {
    await prisma.eventEntitlement.create({
      data: { eventId: payment.eventId, addOnId: payment.addOnId },
    });
  }

  invalidatePlatformCache();
}

export function verifyCampayWebhook(payload: unknown, signature: string | undefined): boolean {
  if (!env.CAMPAY_WEBHOOK_SECRET) return env.isDev;
  if (!signature) return false;
  const crypto = require('crypto') as typeof import('crypto');
  const expected = crypto
    .createHmac('sha256', env.CAMPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  return expected === signature;
}

export type { CheckoutBody };
