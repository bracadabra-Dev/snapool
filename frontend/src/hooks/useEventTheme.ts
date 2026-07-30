import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { EventTheme } from '../lib/api';

const DEFAULT_ACCENT = '#d6ff3c';
const DEFAULT_ACCENT_INK = '#0a0a0a';

export function useEventTheme(theme?: EventTheme | null): CSSProperties {
  return useMemo(() => {
    if (!theme || theme.source === 'default') {
      return {
        ['--accent' as string]: DEFAULT_ACCENT,
        ['--accent-ink' as string]: DEFAULT_ACCENT_INK,
      };
    }
    return {
      ['--accent' as string]: theme.accent,
      ['--accent-ink' as string]: theme.accentInk,
    };
  }, [theme?.accent, theme?.accentInk, theme?.source]);
}
