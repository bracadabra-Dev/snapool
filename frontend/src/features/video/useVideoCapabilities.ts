import { useEffect, useState } from 'react';
import { api, VideoCapabilities } from '../../lib/api';

export function useVideoCapabilities(slug: string | undefined) {
  const [video, setVideo] = useState<VideoCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    api
      .getCapabilities(slug)
      .then((res) => {
        if (!cancelled) setVideo(res.video);
      })
      .catch(() => {
        if (!cancelled) setVideo({ state: 'plan_required' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { video, loading };
}
