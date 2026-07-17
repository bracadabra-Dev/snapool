import { randomBytes } from 'crypto';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return base || 'event';
}

export function makeUniqueSlug(name: string): string {
  const suffix = randomBytes(3).toString('hex');
  return `${slugify(name)}-${suffix}`;
}
