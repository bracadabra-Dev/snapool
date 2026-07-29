import { Request, Response, NextFunction } from 'express';
import { getPublicConfig, getPublicPlans, getPublicAddOns } from '../lib/platformConfig';

export async function publicConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await getPublicConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
}

export async function publicPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [plans, addons] = await Promise.all([getPublicPlans(), getPublicAddOns()]);
    res.json({ plans, addons });
  } catch (err) {
    next(err);
  }
}
