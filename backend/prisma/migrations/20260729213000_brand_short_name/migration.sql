-- Use short product name in default maintenance message
UPDATE "PlatformSettings"
SET "maintenanceMessage" = 'PixDump is temporarily under maintenance'
WHERE "maintenanceMessage" IN (
  'SnapPool is temporarily under maintenance',
  'pixdump.net is temporarily under maintenance'
);

ALTER TABLE "PlatformSettings"
ALTER COLUMN "maintenanceMessage" SET DEFAULT 'PixDump is temporarily under maintenance';
