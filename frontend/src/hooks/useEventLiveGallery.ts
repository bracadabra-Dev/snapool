import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Photo } from '../lib/api';
import {
  getSocket,
  newestUploadedAt,
  upsertPhotos,
  type LiveConnectionState,
  type PhotoCreatedEvent,
  type PhotoDeletedEvent,
} from '../lib/realtime';

type Options = {
  slug: string;
  enabled?: boolean;
  onPhotoCreated?: (photo: Photo) => void;
};

export function useEventLiveGallery({ slug, enabled = true, onPhotoCreated }: Options) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [connection, setConnection] = useState<LiveConnectionState>('offline');
  const [loading, setLoading] = useState(true);
  const photosRef = useRef<Photo[]>([]);
  const onPhotoCreatedRef = useRef(onPhotoCreated);
  onPhotoCreatedRef.current = onPhotoCreated;
  const joinedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const mergePhotos = useCallback((incoming: Photo[]) => {
    setPhotos((prev) => {
      const next = upsertPhotos(prev, incoming);
      photosRef.current = next;
      return next;
    });
  }, []);

  const catchUp = useCallback(async () => {
    if (!slug) return;
    const since = newestUploadedAt(photosRef.current);
    try {
      const res = since
        ? await api.getGallery(slug, { since })
        : await api.getGallery(slug);
      mergePhotos(res.photos);
    } catch {
      // transient
    }
  }, [slug, mergePhotos]);

  const loadSnapshot = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const res = await api.getGallery(slug);
      setPhotos(res.photos);
      photosRef.current = res.photos;
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const addLocalPhoto = useCallback((photo: Photo) => {
    mergePhotos([photo]);
  }, [mergePhotos]);

  useEffect(() => {
    if (!slug || !enabled) {
      setConnection('offline');
      setPhotos([]);
      photosRef.current = [];
      setLoading(false);
      return;
    }

    let cancelled = false;
    const socket = getSocket();

    async function boot() {
      await loadSnapshot();
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        connectAndJoin();
      } else {
        setConnection('offline');
      }
    }

    function connectAndJoin() {
      setConnection(socket.connected ? 'live' : 'connecting');

      if (!socket.connected) {
        socket.connect();
      }

      const doJoin = () => {
        socket.emit('event:join', { slug }, (ack: { ok?: boolean }) => {
          if (cancelled) return;
          if (ack?.ok) {
            joinedSlugRef.current = slug;
            setConnection('live');
            void catchUp();
          }
        });
      };

      if (socket.connected) {
        doJoin();
      } else {
        socket.once('connect', doJoin);
      }
    }

    function onConnect() {
      if (cancelled || document.visibilityState !== 'visible') return;
      setConnection('live');
      socket.emit('event:join', { slug }, () => {
        joinedSlugRef.current = slug;
        void catchUp();
      });
    }

    function onReconnectAttempt() {
      if (cancelled) return;
      setConnection('reconnecting');
    }

    function onDisconnect() {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        setConnection('offline');
      } else {
        setConnection('reconnecting');
      }
      joinedSlugRef.current = null;
    }

    function onPhotoCreated(evt: PhotoCreatedEvent) {
      if (!evt?.photo?.id) return;
      mergePhotos([evt.photo]);
      onPhotoCreatedRef.current?.(evt.photo);
    }

    function onPhotoDeleted(evt: PhotoDeletedEvent) {
      if (!evt?.photoId) return;
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== evt.photoId);
        photosRef.current = next;
        return next;
      });
    }

    function onVisibility() {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        void loadSnapshot().then(() => {
          if (cancelled) return;
          connectAndJoin();
        });
      } else {
        if (joinedSlugRef.current) {
          socket.emit('event:leave', { slug: joinedSlugRef.current });
          joinedSlugRef.current = null;
        }
        socket.disconnect();
        setConnection('offline');
      }
    }

    socket.on('connect', onConnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('disconnect', onDisconnect);
    socket.on('photo:created', onPhotoCreated);
    socket.on('photo:deleted', onPhotoDeleted);
    document.addEventListener('visibilitychange', onVisibility);

    void boot();

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('disconnect', onDisconnect);
      socket.off('photo:created', onPhotoCreated);
      socket.off('photo:deleted', onPhotoDeleted);
      document.removeEventListener('visibilitychange', onVisibility);
      if (joinedSlugRef.current) {
        socket.emit('event:leave', { slug: joinedSlugRef.current });
        joinedSlugRef.current = null;
      }
      socket.disconnect();
      setConnection('offline');
    };
  }, [slug, enabled, loadSnapshot, catchUp, mergePhotos]);

  return {
    photos,
    connection,
    loading,
    addLocalPhoto,
    refresh: loadSnapshot,
    catchUp,
  };
}
