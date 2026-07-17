import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type OwnerTokenPayload = {
  type: 'owner';
  userId: string;
  email: string;
};

export type ContributorTokenPayload = {
  type: 'contributor';
  eventId: string;
  contributorId: string;
};

export type TokenPayload = OwnerTokenPayload | ContributorTokenPayload;

export function signOwnerToken(
  payload: Omit<OwnerTokenPayload, 'type'>,
  expiresIn: SignOptions['expiresIn'] = '7d'
): string {
  return jwt.sign({ ...payload, type: 'owner' }, env.JWT_SECRET, { expiresIn });
}

export function signContributorToken(
  payload: Omit<ContributorTokenPayload, 'type'>,
  expiresIn: SignOptions['expiresIn'] = '12h'
): string {
  return jwt.sign({ ...payload, type: 'contributor' }, env.JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
