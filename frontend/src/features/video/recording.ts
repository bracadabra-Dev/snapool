export function pickRecorderMime(): string {
  const types = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

export function cameraFrameRate(track: MediaStreamTrack | null): number {
  const fps = track?.getSettings?.().frameRate;
  return fps && fps >= 15 ? Math.min(30, Math.round(fps)) : 30;
}

export function videoBitrateForResolution(width: number, height: number): number {
  const px = width * height;
  if (px >= 1920 * 1080) return 6_000_000;
  if (px >= 1280 * 720) return 4_000_000;
  return 2_500_000;
}
