import { VideoCompleteBody, VideoUploadParams } from '../../lib/api';
import { uploadVideoToCloudinary, parseCloudinaryUploadResult } from './uploadVideo';
import { validateVideoFile, getRecordedVideoDuration } from './validateVideo';

type SignatureFn = () => Promise<{ upload: VideoUploadParams; maxDurationSec: number }>;
type CompleteFn = (body: VideoCompleteBody) => Promise<void>;

export async function runVideoUpload(
  file: File,
  getSignature: SignatureFn,
  onComplete: CompleteFn,
  onProgress?: (pct: number) => void
): Promise<void> {
  const { upload, maxDurationSec } = await getSignature();
  const knownDuration = getRecordedVideoDuration(file);
  const { durationSec } = await validateVideoFile(file, maxDurationSec, knownDuration);
  const result = await uploadVideoToCloudinary(file, upload, onProgress);
  const duration =
    typeof result.duration === 'number'
      ? Math.round(result.duration as number)
      : durationSec;
  if (duration > maxDurationSec) {
    throw new Error(`Video must be ${maxDurationSec}s or shorter`);
  }
  const parsed = parseCloudinaryUploadResult(result);
  await onComplete({ ...parsed, duration });
}
