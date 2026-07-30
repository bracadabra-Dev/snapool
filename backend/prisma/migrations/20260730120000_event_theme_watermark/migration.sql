-- Event theme + watermark branding
ALTER TABLE "Event" ADD COLUMN "themeAccent" TEXT;
ALTER TABLE "Event" ADD COLUMN "themeAccentInk" TEXT;
ALTER TABLE "Event" ADD COLUMN "themeSource" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Event" ADD COLUMN "themeVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Event" ADD COLUMN "watermarkImageUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "brandingRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PlatformSettings" ADD COLUMN "platformWatermarkUrl" TEXT;
