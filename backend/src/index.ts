import path from 'path';
import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requireAuth } from './middleware/requireAuth';
import { requireContributor } from './middleware/requireContributor';
import { requireSuperAdmin } from './middleware/requireSuperAdmin';
import { uploadRateLimit, videoSignatureRateLimit } from './middleware/rateLimit';
import { initRealtime } from './realtime/io';
import { bootstrapSuperAdmin } from './lib/adminAudit';
import { getPlatformSettings } from './lib/platformConfig';
import * as auth from './routes/auth';
import * as events from './routes/events';
import * as publicRoutes from './routes/public';
import * as publicConfig from './routes/publicConfig';
import * as adminPlatform from './routes/admin/platform';
import * as adminPlans from './routes/admin/plans';
import * as adminAddons from './routes/admin/addons';
import * as adminManage from './routes/admin/manage';
import * as videoRoutes from './features/video/routes';
import * as billingRoutes from './features/billing/routes';
import { runRetentionCleanup } from './jobs/retention';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'spaisnap', env: env.NODE_ENV });
});

app.get('/api/public/config', publicConfig.publicConfig);
app.get('/api/public/plans', publicConfig.publicPlans);

app.post('/api/auth/register', auth.register);
app.post('/api/auth/login', auth.login);
app.get('/api/auth/me', requireAuth, auth.me);

app.get('/api/events', requireAuth, events.listEvents);
app.post('/api/events', requireAuth, events.createEvent);
app.get('/api/events/:id', requireAuth, events.getEvent);
app.patch('/api/events/:id', requireAuth, events.updateEvent);
app.post(
  '/api/events/:id/pro-upload',
  requireAuth,
  uploadRateLimit,
  events.upload.fields([
    { name: 'full', maxCount: 1 },
    { name: 'thumb', maxCount: 1 },
  ]),
  events.proUpload
);
app.delete('/api/events/:id/photos/:photoId', requireAuth, events.deletePhoto);

app.post(
  '/api/events/:id/video/signature',
  requireAuth,
  videoSignatureRateLimit,
  videoRoutes.ownerVideoSignature
);
app.post('/api/events/:id/video/complete', requireAuth, videoRoutes.ownerVideoComplete);

app.get('/api/e/:slug', publicRoutes.getPublicEvent);
app.get('/api/e/:slug/capabilities', publicRoutes.getCapabilities);
app.post('/api/e/:slug/session', publicRoutes.createSession);
app.get('/api/e/:slug/gallery', publicRoutes.getGallery);
app.post(
  '/api/e/:slug/upload',
  requireContributor,
  uploadRateLimit,
  events.upload.fields([
    { name: 'full', maxCount: 1 },
    { name: 'thumb', maxCount: 1 },
  ]),
  publicRoutes.contributorUpload
);
app.post(
  '/api/e/:slug/video/signature',
  requireContributor,
  videoSignatureRateLimit,
  videoRoutes.contributorVideoSignature
);
app.post('/api/e/:slug/video/complete', requireContributor, videoRoutes.contributorVideoComplete);

app.post('/api/billing/checkout', requireAuth, billingRoutes.checkout);
app.post('/api/billing/dev-complete/:reference', requireAuth, billingRoutes.devCompletePayment);
app.post('/api/webhooks/campay', billingRoutes.campayWebhook);
app.post('/api/webhooks/cloudinary', videoRoutes.cloudinaryWebhook);

app.get('/api/admin/dashboard', requireSuperAdmin, adminPlatform.getDashboard);
app.get('/api/admin/platform', requireSuperAdmin, adminPlatform.getPlatform);
app.patch('/api/admin/platform', requireSuperAdmin, adminPlatform.patchPlatform);
app.post('/api/admin/cache/invalidate', requireSuperAdmin, adminPlatform.invalidateCache);
app.get('/api/admin/plans', requireSuperAdmin, adminPlans.listPlans);
app.post('/api/admin/plans', requireSuperAdmin, adminPlans.createPlan);
app.patch('/api/admin/plans/:id', requireSuperAdmin, adminPlans.patchPlan);
app.get('/api/admin/addons', requireSuperAdmin, adminAddons.listAddons);
app.post('/api/admin/addons', requireSuperAdmin, adminAddons.createAddon);
app.patch('/api/admin/addons/:id', requireSuperAdmin, adminAddons.patchAddon);
app.get('/api/admin/audit', requireSuperAdmin, adminManage.listAudit);
app.get('/api/admin/users', requireSuperAdmin, adminManage.listUsers);
app.patch('/api/admin/users/:id', requireSuperAdmin, adminManage.patchUser);
app.get('/api/admin/events', requireSuperAdmin, adminManage.listEvents);
app.patch('/api/admin/events/:id', requireSuperAdmin, adminManage.patchEvent);
app.get('/api/admin/payments', requireSuperAdmin, adminManage.listPayments);

app.post('/api/admin/jobs/retention', requireSuperAdmin, async (_req, res, next) => {
  try {
    const result = await runRetentionCleanup();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  if (message.includes('Only image')) {
    res.status(400).json({ error: message });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
});

initRealtime(server);

void bootstrapSuperAdmin(env.SUPER_ADMIN_EMAIL);

void getPlatformSettings().then((platform) => {
  if (env.FEATURE_VIDEO_ENABLED && !platform.videoEnabled) {
    console.warn(
      'FEATURE_VIDEO_ENABLED is on but platform video is off — enable video at /admin to show the camera video mode'
    );
  }
  if (env.featureVideoRequested && env.NODE_ENV === 'production' && !env.FEATURE_VIDEO_ENABLED) {
    console.warn('FEATURE_VIDEO_ENABLED requested but Cloudinary credentials are incomplete — video disabled');
  }
});

server.listen(env.PORT, () => {
  console.log(`SnapPool API listening on port ${env.PORT}`);
});
