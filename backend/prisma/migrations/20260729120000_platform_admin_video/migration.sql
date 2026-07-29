-- AlterTable User
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Event
ALTER TABLE "Event" ADD COLUMN "videoEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "paidFeaturesUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "maxVideosPerContributor" INTEGER;

-- AlterTable Photo
ALTER TABLE "Photo" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'photo';
ALTER TABLE "Photo" ADD COLUMN "duration" INTEGER;
ALTER TABLE "Photo" ADD COLUMN "cloudinaryPublicId" TEXT;

-- CreateTable PlatformSettings
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "videoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "videoMaintenanceMessage" TEXT NOT NULL DEFAULT 'Video uploads are temporarily under maintenance',
    "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'SnapPool is temporarily under maintenance',
    "defaultMaxPhotosPerContributor" INTEGER NOT NULL DEFAULT 20,
    "defaultRetentionDays" INTEGER NOT NULL DEFAULT 7,
    "uploadRateLimitPerMinute" INTEGER NOT NULL DEFAULT 10,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable PlanDefinition
CREATE TABLE "PlanDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "billingType" TEXT NOT NULL,
    "priceAmount" INTEGER NOT NULL DEFAULT 0,
    "priceInterval" TEXT,
    "campayProductId" TEXT,
    "maxActiveEvents" INTEGER,
    "maxPhotosPerContributor" INTEGER NOT NULL DEFAULT 20,
    "maxRetentionDays" INTEGER NOT NULL DEFAULT 7,
    "allowCustomBranding" BOOLEAN NOT NULL DEFAULT false,
    "allowZipDownload" BOOLEAN NOT NULL DEFAULT false,
    "allowManualModeration" BOOLEAN NOT NULL DEFAULT true,
    "allowVideo" BOOLEAN NOT NULL DEFAULT false,
    "maxVideosPerEvent" INTEGER NOT NULL DEFAULT 0,
    "maxVideosPerContributor" INTEGER NOT NULL DEFAULT 0,
    "maxVideoDurationSec" INTEGER NOT NULL DEFAULT 0,
    "highlightLabel" TEXT,

    CONSTRAINT "PlanDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable AddOnDefinition
CREATE TABLE "AddOnDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priceAmount" INTEGER NOT NULL DEFAULT 0,
    "campayProductId" TEXT,
    "appliesToPlans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "grantsJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AddOnDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable EventEntitlement
CREATE TABLE "EventEntitlement" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EventEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable PaymentRecord
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventId" TEXT,
    "planId" TEXT,
    "addOnId" TEXT,
    "campayTxId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminAuditLog
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_campayTxId_key" ON "PaymentRecord"("campayTxId");

-- AddForeignKey
ALTER TABLE "EventEntitlement" ADD CONSTRAINT "EventEntitlement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
