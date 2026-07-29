export type VideoErrorCode =
  | 'VIDEO_MAINTENANCE'
  | 'VIDEO_PLAN_REQUIRED'
  | 'VIDEO_DISABLED'
  | 'VIDEO_LIMIT'
  | 'PLAN_EXPIRED';

export class VideoError extends Error {
  status: number;
  code: VideoErrorCode;

  constructor(message: string, status: number, code: VideoErrorCode) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendVideoError(res: import('express').Response, err: VideoError): void {
  res.status(err.status).json({ error: err.message, code: err.code });
}
