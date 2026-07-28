import { useEffect, useRef } from 'react';
import type { Photo } from '../lib/api';
import {
  getSocket,
  type LiveConnectionState,
  type PhotoCreatedEvent,
  type PhotoDeletedEvent,
} from '../lib/realtime';

type Options = {
  slug: string | null | undefined;
  enabled?: boolean;
  onPhotoCreated?: (photo: Photo) => void;
  onPhotoDeleted?: (photoId: string) => void;
  onReconnect?: () => void;
  onConnectionChange?: (state: LiveConnectionState) => void;
};

/** Join an event room for live photo events (owner console / shared use). */
export function useEventLiveRoom({
  slug,
  enabled = true,
  onPhotoCreated,
  onPhotoDeleted,
  onReconnect,
  onConnectionChange,
}: Options) {
  const createdRef = useRef(onPhotoCreated);
  const deletedRef = useRef(onPhotoDeleted);
  const reconnectRef = useRef(onReconnect);
  const connRef = useRef(onConnectionChange);
  createdRef.current = onPhotoCreated;
  deletedRef.current = onPhotoDeleted;
  reconnectRef.current = onReconnect;
  connRef.current = onConnectionChange;
  const joinedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (!slug || !enabled) {
      connRef.current?.('offline');
      return;
    }

    let cancelled = false;
    const socket = getSocket();

    function setConn(state: LiveConnectionState) {
      if (!cancelled) connRef.current?.(state);
    }

    function doJoin() {
      socket.emit('event:join', { slug }, (ack: { ok?: boolean }) => {
        if (cancelled) return;
        if (ack?.ok) {
          joinedSlugRef.current = slug ?? null;
          setConn('live');
          reconnectRef.current?.();
        }
      });
    }

    function connectAndJoin() {
      setConn(socket.connected ? 'live' : 'connecting');
      if (!socket.connected) socket.connect();
      if (socket.connected) doJoin();
      else socket.once('connect', doJoin);
    }

    function onConnect() {
      if (cancelled || document.visibilityState !== 'visible') return;
      setConn('live');
      doJoin();
    }

    function onReconnectAttempt() {
      setConn('reconnecting');
    }

    function onDisconnect() {
      joinedSlugRef.current = null;
      setConn(document.visibilityState === 'hidden' ? 'offline' : 'reconnecting');
    }

    function onPhotoCreated(evt: PhotoCreatedEvent) {
      if (evt?.photo) createdRef.current?.(evt.photo);
    }

    function onPhotoDeleted(evt: PhotoDeletedEvent) {
      if (evt?.photoId) deletedRef.current?.(evt.photoId);
    }

    function onVisibility() {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        connectAndJoin();
      } else {
        if (joinedSlugRef.current) {
          socket.emit('event:leave', { slug: joinedSlugRef.current });
          joinedSlugRef.current = null;
        }
        socket.disconnect();
        setConn('offline');
      }
    }

    socket.on('connect', onConnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('disconnect', onDisconnect);
    socket.on('photo:created', onPhotoCreated);
    socket.on('photo:deleted', onPhotoDeleted);
    document.addEventListener('visibilitychange', onVisibility);

    if (document.visibilityState === 'visible') connectAndJoin();
    else setConn('offline');

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
      // Don't hard-disconnect if Arena also uses the singleton — only leave room.
      // Arena hook disconnects on its own unmount; owner page leaving should leave room only.
      socket.emit('event:leave', { slug });
      setConn('offline');
    };
  }, [slug, enabled]);
}
