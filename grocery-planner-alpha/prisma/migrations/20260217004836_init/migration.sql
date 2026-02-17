-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "householdSize" INTEGER NOT NULL DEFAULT 1,
    "mealsPerDay" INTEGER NOT NULL DEFAULT 3,
    "cookingTimePreference" TEXT NOT NULL DEFAULT 'moderate',
    "location" TEXT,
    "preferredStores" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
