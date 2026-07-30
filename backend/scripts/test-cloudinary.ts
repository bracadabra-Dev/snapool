import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env';
import { isCloudinaryReady, signVideoUpload } from '../src/features/video/cloudinary';

async function main() {
  console.log('--- Cloudinary env check ---');
  console.log('Cloud name:', env.CLOUDINARY_CLOUD_NAME || '(missing)');
  console.log('API key:', env.CLOUDINARY_API_KEY ? `${env.CLOUDINARY_API_KEY.slice(0, 4)}…` : '(missing)');
  console.log('API secret:', env.CLOUDINARY_API_SECRET ? 'set' : '(missing)');
  console.log('Webhook secret:', env.CLOUDINARY_WEBHOOK_SECRET ? 'set (custom)' : 'empty (will use API secret)');
  console.log('isCloudinaryReady():', isCloudinaryReady());

  if (!isCloudinaryReady()) {
    console.error('\nFAIL: Missing cloud name, API key, or API secret.');
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  console.log('\n--- API ping ---');
  try {
    const ping = await cloudinary.api.ping();
    console.log('Ping:', ping.status === 'ok' ? 'OK' : ping);
  } catch (err) {
    console.error('Ping FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log('\n--- Usage (auth check) ---');
  try {
    const usage = await cloudinary.api.usage();
    console.log('Plan:', usage.plan || 'unknown');
    console.log('Credits used:', usage.credits?.usage ?? usage.credits ?? 'n/a');
    console.log('Storage:', usage.storage?.usage ?? 'n/a');
  } catch (err) {
    console.error('Usage FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log('\n--- Signed upload params ---');
  const signed = signVideoUpload({
    eventId: 'test-event-id',
    uploadType: 'contributor',
    maxDurationSec: 30,
  });
  console.log('Signature generated:', Boolean(signed.signature));
  console.log('Folder:', signed.folder);
  console.log('Notification URL:', signed.notificationUrl ?? '(none in dev)');

  console.log('\nPASS: Cloudinary credentials are valid.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
