-- CreateTable
CREATE TABLE "EventPageView" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventPageView_eventId_idx" ON "EventPageView"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPageView_eventId_ipHash_key" ON "EventPageView"("eventId", "ipHash");

-- AddForeignKey
ALTER TABLE "EventPageView" ADD CONSTRAINT "EventPageView_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
