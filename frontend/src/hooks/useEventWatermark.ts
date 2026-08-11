import { useEffect, useMemo } from 'react';
import type { EventWatermark } from '../lib/api';
import {
  defaultPlatformWatermarkUrl,
  platformWatermarkConfig,
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
      return platformWatermarkConfig();
    }
    return watermarkFromEvent(watermark, brandingRevision);
  }, [watermark, brandingRevision]);

  useEffect(() => {
    void preloadWatermark(config).catch(() => undefined);
  }, [config.imageUrl, config.revision]);

  return config;
}

export { defaultPlatformWatermarkUrl, type WatermarkConfig };
