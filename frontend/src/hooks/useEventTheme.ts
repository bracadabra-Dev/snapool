import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { EventTheme } from '../lib/api';
import { buildEventThemeTokens, hasCustomEventTheme } from '../lib/eventThemeTokens';

export function useEventTheme(theme?: EventTheme | null): CSSProperties {
  return useMemo(
    () => buildEventThemeTokens(theme),
    [theme?.accent, theme?.accentInk, theme?.source]
  );
}

export function useHasCustomEventTheme(theme?: EventTheme | null): boolean {
  return useMemo(() => hasCustomEventTheme(theme), [theme?.accent, theme?.source]);
}
