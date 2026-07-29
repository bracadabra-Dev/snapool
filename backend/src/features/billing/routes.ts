import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { AuthedRequest } from '../../middleware/requireAuth';
import { createCheckout, completePayment, verifyCampayWebhook } from './campay';
import { env } from '../../config/env';

const checkoutSchema = z.object({
  planId: z.string().optional(),
  addOnId: z.string().optional(),
  eventId: z.string().uuid().optional(),
});

export async function checkout(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = checkoutSchema.parse(req.body);
    if (!body.planId && !body.addOnId) {
      res.status(400).json({ error: 'planId or addOnId required' });
      return;
    }
    if (body.addOnId && !body.eventId) {
      res.status(400).json({ error: 'eventId required for add-on purchase' });
      return;
    }

    const result = await createCheckout({
      userId: req.user!.userId,
      planId: body.planId,
      addOnId: body.addOnId,
      eventId: body.eventId,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.flatten() });
      return;
    }
    next(err);
  }
}

export async function devCompletePayment(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!env.isDev && env.CAMPAY_API_KEY) {
      res.status(403).json({ error: 'Dev complete only available without Campay in development' });
      return;
    }
    await completePayment(req.params.reference);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function campayWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-campay-signature'] as string | undefined;
    if (!verifyCampayWebhook(req.body, signature)) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const body = req.body as { reference?: string; external_reference?: string; status?: string };
    const reference = body.external_reference || body.reference;
    if (!reference) {
      res.status(400).json({ error: 'Missing reference' });
      return;
    }

    if (body.status === 'SUCCESSFUL' || body.status === 'successful') {
      await completePayment(reference);
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
