-- Rebrand default maintenance message from SnapPool to pixdump.net
UPDATE "PlatformSettings"
SET "maintenanceMessage" = 'pixdump.net is temporarily under maintenance'
WHERE "maintenanceMessage" = 'SnapPool is temporarily under maintenance';

ALTER TABLE "PlatformSettings"
ALTER COLUMN "maintenanceMessage" SET DEFAULT 'pixdump.net is temporarily under maintenance';
