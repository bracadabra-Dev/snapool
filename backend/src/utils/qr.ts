import QRCode from 'qrcode';
import { uploadToR2 } from '../lib/r2';

export async function generateAndStoreQr(eventId: string, publicUrl: string): Promise<string> {
  const png = await QRCode.toBuffer(publicUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  const key = `events/${eventId}/qr.png`;
  return uploadToR2(key, png, 'image/png');
}

export async function generateQrDataUrl(publicUrl: string): Promise<string> {
  return QRCode.toDataURL(publicUrl, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
