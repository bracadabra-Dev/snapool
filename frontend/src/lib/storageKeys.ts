import { PLATFORM_SLUG } from './brand';

export function readStorageItem(key: string, legacyKey: string): string | null {
  const value = localStorage.getItem(key) ?? localStorage.getItem(legacyKey);
  if (value && localStorage.getItem(legacyKey) && !localStorage.getItem(key)) {
    localStorage.setItem(key, value);
    localStorage.removeItem(legacyKey);
  }
  return value;
}

export function storageKey(suffix: string): string {
  return `${PLATFORM_SLUG}_${suffix}`;
}

export function legacyStorageKey(suffix: string): string {
  return `spaisnap_${suffix}`;
}
