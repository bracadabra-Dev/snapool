export type VideoUploadParams = import('../../lib/api').VideoUploadParams;

export async function uploadVideoToCloudinary(
  file: File,
  params: VideoUploadParams,
  onProgress?: (pct: number) => void
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', params.apiKey);
  form.append('timestamp', String(params.timestamp));
  form.append('signature', params.signature);
  form.append('folder', params.folder);
  form.append('resource_type', 'video');
  form.append('eager', params.eager);
  if (params.eagerAsync) form.append('eager_async', 'true');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${params.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(data.error?.message || 'Video upload failed'));
        else resolve(data);
      } catch {
        reject(new Error('Invalid Cloudinary response'));
      }
    };
    xhr.onerror = () => reject(new Error('Video upload failed'));
    xhr.send(form);
  });
}

export function parseCloudinaryUploadResult(result: Record<string, unknown>) {
  const publicId = result.public_id as string;
  const eager = (result.eager as Array<{ secure_url?: string; format?: string }>) || [];
  const mp4 = eager.find((e) => e.format === 'mp4') || eager[0];
  const poster = eager.find((e) => e.format === 'jpg');
  const fullUrl = mp4?.secure_url || (result.secure_url as string);
  const thumbUrl = poster?.secure_url || fullUrl.replace(/\.[^.]+$/, '.jpg');
  const duration = typeof result.duration === 'number' ? Math.round(result.duration) : undefined;
  return { publicId, fullUrl, thumbUrl, duration };
}
