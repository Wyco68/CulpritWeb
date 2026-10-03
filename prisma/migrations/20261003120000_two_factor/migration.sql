-- Admin two-factor sign-in by emailed code (2026-10-03, ADR-022).
--
-- Better Auth's two-factor plugin needs a flag on the user and one row of per-user state. The codes
-- themselves are short-lived hashed rows in the existing "verification" table, and so are the
-- password-reset codes from the email-otp plugin — neither needs a table of its own.
-- Additive only: the flag defaults to false, so the admin keeps signing in with a password alone
-- until 2FA is switched on from the admin app, and code that doesn't know the new column or table
-- keeps working.

-- AlterTable
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backup_codes" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "two_factor_secret_idx" ON "two_factor"("secret");

-- CreateIndex
CREATE INDEX "two_factor_user_id_idx" ON "two_factor"("user_id");

-- AddForeignKey
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
