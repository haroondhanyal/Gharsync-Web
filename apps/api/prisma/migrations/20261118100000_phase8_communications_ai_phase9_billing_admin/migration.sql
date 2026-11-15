CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

CREATE TABLE "notification_templates" (
  "id" UUID NOT NULL, "organizationId" UUID, "eventKey" VARCHAR(100) NOT NULL,
  "channel" "NotificationChannel" NOT NULL, "subject" VARCHAR(200), "body" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_templates_organizationId_eventKey_channel_key" ON "notification_templates"("organizationId", "eventKey", "channel");
CREATE INDEX "notification_templates_eventKey_channel_enabled_idx" ON "notification_templates"("eventKey", "channel", "enabled");

CREATE TABLE "notification_logs" (
  "id" UUID NOT NULL, "organizationId" UUID, "userId" UUID, "eventKey" VARCHAR(100) NOT NULL,
  "channel" "NotificationChannel" NOT NULL, "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "recipient" VARCHAR(320), "subject" VARCHAR(200), "body" TEXT NOT NULL, "providerReference" VARCHAR(200),
  "error" VARCHAR(500), "metadata" JSONB, "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notification_logs_organizationId_createdAt_idx" ON "notification_logs"("organizationId", "createdAt");
CREATE INDEX "notification_logs_userId_readAt_createdAt_idx" ON "notification_logs"("userId", "readAt", "createdAt");
CREATE INDEX "notification_logs_status_createdAt_idx" ON "notification_logs"("status", "createdAt");

CREATE TABLE "ai_usage_logs" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "userId" UUID NOT NULL,
  "task" VARCHAR(80) NOT NULL, "provider" VARCHAR(80) NOT NULL, "status" VARCHAR(30) NOT NULL,
  "inputCharacters" INTEGER NOT NULL DEFAULT 0, "outputCharacters" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ai_usage_logs_organizationId_task_createdAt_idx" ON "ai_usage_logs"("organizationId", "task", "createdAt");

CREATE TABLE "subscription_plans" (
  "id" UUID NOT NULL, "key" VARCHAR(40) NOT NULL, "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500) NOT NULL, "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "annualPrice" DECIMAL(12,2) NOT NULL DEFAULT 0, "currency" CHAR(3) NOT NULL DEFAULT 'PKR',
  "maxBranches" INTEGER, "maxStaff" INTEGER, "maxMonthlyJobs" INTEGER, "features" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscription_plans_key_key" ON "subscription_plans"("key");

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "planId" UUID NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL', "interval" VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  "periodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "periodEnd" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3), "canceledAt" TIMESTAMP(3), "provider" VARCHAR(40) NOT NULL DEFAULT 'MANUAL',
  "providerReference" VARCHAR(200), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "subscriptions_organizationId_status_periodEnd_idx" ON "subscriptions"("organizationId", "status", "periodEnd");
CREATE INDEX "subscriptions_status_periodEnd_idx" ON "subscriptions"("status", "periodEnd");

CREATE TABLE "feature_flags" (
  "id" UUID NOT NULL, "key" VARCHAR(80) NOT NULL, "description" VARCHAR(300) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

CREATE TABLE "support_tickets" (
  "id" UUID NOT NULL, "organizationId" UUID, "userId" UUID NOT NULL, "ticketNumber" VARCHAR(30) NOT NULL,
  "subject" VARCHAR(180) NOT NULL, "description" TEXT NOT NULL, "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN', "assignedTo" VARCHAR(320),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");
CREATE INDEX "support_tickets_status_priority_createdAt_idx" ON "support_tickets"("status", "priority", "createdAt");
CREATE INDEX "support_tickets_organizationId_createdAt_idx" ON "support_tickets"("organizationId", "createdAt");
