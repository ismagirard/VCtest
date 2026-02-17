-- Step 1: Add new columns with defaults
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarBase64" TEXT;
ALTER TABLE "User" ADD COLUMN "streetAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "city" TEXT;
ALTER TABLE "User" ADD COLUMN "province" TEXT NOT NULL DEFAULT 'QC';
ALTER TABLE "User" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "User" ADD COLUMN "budgetPreference" TEXT NOT NULL DEFAULT 'moderate';
ALTER TABLE "User" ADD COLUMN "groceryDay" TEXT;
ALTER TABLE "User" ADD COLUMN "groceryFrequency" TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE "User" ADD COLUMN "agentMode" TEXT NOT NULL DEFAULT 'ask';
ALTER TABLE "User" ADD COLUMN "emailNotifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "smsNotifications" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "pushNotifications" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate existing data
UPDATE "User" SET "firstName" = "name" WHERE "name" IS NOT NULL;
UPDATE "User" SET "postalCode" = "location" WHERE "location" IS NOT NULL;

-- Step 3: Drop old columns
ALTER TABLE "User" DROP COLUMN "name";
ALTER TABLE "User" DROP COLUMN "location";
