import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(8),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL_BASE: z.string().url(),
  APP_PUBLIC_URL: z.string().url(),
  FEATURE_VIDEO_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_WEBHOOK_SECRET: z.string().optional(),
  CAMPAY_API_KEY: z.string().optional(),
  CAMPAY_WEBHOOK_SECRET: z.string().optional(),
  CAMPAY_API_URL: z.string().url().optional(),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
const featureVideoRequested =
  process.env.FEATURE_VIDEO_ENABLED === 'true' || process.env.FEATURE_VIDEO_ENABLED === '1';
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

let featureVideoEnabled = featureVideoRequested;
if (featureVideoRequested && nodeEnv === 'production' && !cloudinaryConfigured) {
  console.warn(
    'FEATURE_VIDEO_ENABLED is true but Cloudinary credentials are incomplete — video uploads disabled until configured'
  );
  featureVideoEnabled = false;
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT || 3000),
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'spaisnap',
  R2_PUBLIC_URL_BASE: (process.env.R2_PUBLIC_URL_BASE || 'http://localhost').replace(/\/$/, ''),
  APP_PUBLIC_URL: (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  FEATURE_VIDEO_ENABLED: featureVideoEnabled,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_WEBHOOK_SECRET: process.env.CLOUDINARY_WEBHOOK_SECRET || '',
  CAMPAY_API_KEY: process.env.CAMPAY_API_KEY || '',
  CAMPAY_WEBHOOK_SECRET: process.env.CAMPAY_WEBHOOK_SECRET || '',
  CAMPAY_API_URL: (process.env.CAMPAY_API_URL || 'https://api.campay.net/api').replace(/\/$/, ''),
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || '',
  isDev: nodeEnv !== 'production',
  featureVideoRequested,
};
