import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requireAuth } from './middleware/requireAuth';
import { requireContributor } from './middleware/requireContributor';
import { uploadRateLimit } from './middleware/rateLimit';
import * as auth from './routes/auth';
import * as events from './routes/events';
import * as publicRoutes from './routes/public';

const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'spaisnap', env: env.NODE_ENV });
});

app.post('/api/auth/register', auth.register);
app.post('/api/auth/login', auth.login);

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

app.get('/api/e/:slug', publicRoutes.getPublicEvent);
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

// Serve frontend static build in production (and whenever dist exists)
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

app.listen(env.PORT, () => {
  console.log(`SnapPool API listening on port ${env.PORT}`);
});
