/*
  Warnings:

  - You are about to drop the column `metadata` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `savings` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `savings` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `budget` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `isCompleted` on the `trips` table. All the data in the column will be lost.
  - You are about to drop the column `targetDate` on the `trips` table. All the data in the column will be lost.
  - Added the required column `amountPerFrequency` to the `savings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequency` to the `savings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `savings` table without a default value. This is not possible if the table is not empty.
  - Made the column `targetDate` on table `savings` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `budgetRange` to the `trips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `trips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxBudget` to the `trips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minBudget` to the `trips` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `trips` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "savingId" TEXT NOT NULL,
    "transactionId" TEXT,
    CONSTRAINT "contributions_savingId_fkey" FOREIGN KEY ("savingId") REFERENCES "savings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "contributions_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "summary" TEXT,
    "userContext" TEXT,
    "tripType" TEXT,
    "budgetRange" TEXT,
    "groupSize" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "metadata" TEXT,
    "intent" TEXT,
    "entities" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "criteria" TEXT,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "viewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    CONSTRAINT "ai_recommendations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ai_recommendations_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cost" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bookingDate" DATETIME,
    "travelDate" DATETIME,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bookings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_bookings" ("bookingDate", "cost", "createdAt", "description", "id", "status", "title", "tripId", "type", "updatedAt", "userId") SELECT "bookingDate", "cost", "createdAt", "description", "id", "status", "title", "tripId", "type", "updatedAt", "userId" FROM "bookings";
DROP TABLE "bookings";
ALTER TABLE "new_bookings" RENAME TO "bookings";
CREATE TABLE "new_savings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "frequency" TEXT NOT NULL,
    "amountPerFrequency" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "progress" REAL NOT NULL DEFAULT 0,
    "lastContribution" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    CONSTRAINT "savings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "savings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_savings" ("createdAt", "id", "isCompleted", "targetAmount", "targetDate", "title", "tripId", "updatedAt", "userId") SELECT "createdAt", "id", "isCompleted", "targetAmount", "targetDate", "title", "tripId", "updatedAt", "userId" FROM "savings";
DROP TABLE "savings";
ALTER TABLE "new_savings" RENAME TO "savings";
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL,
    "reference" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "savingId" TEXT,
    "bookingId" TEXT,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_savingId_fkey" FOREIGN KEY ("savingId") REFERENCES "savings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("amount", "createdAt", "id", "provider", "reference", "status", "type", "updatedAt", "userId") SELECT "amount", "createdAt", "id", "provider", "reference", "status", "type", "updatedAt", "userId" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE TABLE "new_trips" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "tags" TEXT,
    "climate" TEXT,
    "activities" TEXT,
    "amenities" TEXT,
    "budgetRange" TEXT NOT NULL,
    "minBudget" REAL NOT NULL,
    "maxBudget" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "duration" INTEGER,
    "bestSeason" TEXT,
    "groupSize" TEXT,
    "difficulty" TEXT,
    "imageUrl" TEXT,
    "gallery" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "trips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_trips" ("createdAt", "description", "destination", "id", "imageUrl", "updatedAt", "userId") SELECT "createdAt", "description", "destination", "id", "imageUrl", "updatedAt", "userId" FROM "trips";
DROP TABLE "trips";
ALTER TABLE "new_trips" RENAME TO "trips";
CREATE TABLE "new_wishlists" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "targetDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    CONSTRAINT "wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wishlists_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_wishlists" ("createdAt", "id", "notes", "tripId", "updatedAt", "userId") SELECT "createdAt", "id", "notes", "tripId", "updatedAt", "userId" FROM "wishlists";
DROP TABLE "wishlists";
ALTER TABLE "new_wishlists" RENAME TO "wishlists";
CREATE UNIQUE INDEX "wishlists_userId_tripId_key" ON "wishlists"("userId", "tripId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
