import { useEffect, useMemo } from 'react';
import type { EventWatermark } from '../lib/api';
import {
  defaultPlatformWatermarkUrl,
  preloadWatermark,
  type WatermarkConfig,
  watermarkFromEvent,
} from '../lib/watermark';

export function useEventWatermark(
  watermark?: EventWatermark | null,
  brandingRevision = 0
): WatermarkConfig {
  const config = useMemo(() => {
    if (!watermark) {
      return { imageUrl: defaultPlatformWatermarkUrl(), revision: 0 };
    }
    return watermarkFromEvent(watermark, brandingRevision);
  }, [watermark, brandingRevision]);

  useEffect(() => {
    void preloadWatermark(config).catch(() => undefined);
  }, [config.imageUrl, config.revision]);

  return config;
}
