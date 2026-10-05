-- Mandatory admin 2FA with a fixed code recipient (2026-10-05, ADR-023).
--
-- 1. The single admin signs in as culpritteam@gmail.com — the mailbox every sign-in and reset code
--    now goes to (ADMIN_EMAIL in src/modules/auth/auth-policy.ts). Only `user.email` changes: the
--    credential row in "account" is keyed by the user id (Better Auth 1.6.25 writes
--    account_id = user.id for a credential account, and finds it by user_id at sign-in, never by
--    email), so the existing password keeps working.
--
--    Defensive, because staging and production share this database:
--      - exactly one user: it is the admin, rename it;
--      - no user at all: nothing to rename. This is a fresh database — including the empty shadow
--        database `prisma migrate dev` replays every migration into — and prisma/seed.ts creates the
--        admin with this address afterwards. Raising here would break every fresh setup;
--      - more than one user: the single-admin assumption is broken and there's no safe way to pick
--        one, so stop the migration (and the deploy) instead of guessing.
--
-- 2. Every session is signed out. All of them were opened with a password alone, before the second
--    factor became mandatory; the next sign-in goes through the emailed code.
--
-- 3. Any "trust this browser" record is deleted. The app has never issued one (trustDevice is forced
--    off), but a valid one is the only way the two-factor plugin skips its challenge.
--
-- 4. At most one "two_factor" row per user, enforced. Sign-in now enrols automatically, and two
--    concurrent first sign-ins could each insert a row; with the unique index the second insert
--    fails and the enrolment hook re-reads the winner instead. Any duplicates already present are
--    removed first, keeping the row with the lowest id per user (deterministic; before this change
--    only `/two-factor/enable` wrote rows, and it deletes a user's rows before inserting, so none
--    are expected). The index swap is what `prisma migrate diff` generates for `userId @unique`.

DO $$
DECLARE
  user_count integer;
BEGIN
  SELECT count(*) INTO user_count FROM "user";

  IF user_count > 1 THEN
    RAISE EXCEPTION
      'ADR-023: expected at most one user (the single admin), found %. Refusing to change any login email.',
      user_count;
  END IF;

  UPDATE "user"
  SET "email" = 'culpritteam@gmail.com', "updated_at" = CURRENT_TIMESTAMP
  WHERE "email" <> 'culpritteam@gmail.com';
END
$$;

DELETE FROM "session";

DELETE FROM "verification" WHERE "identifier" LIKE 'trust-device-%';

DELETE FROM "two_factor" AS duplicate
USING "two_factor" AS kept
WHERE duplicate."user_id" = kept."user_id"
  AND duplicate."id" > kept."id";

-- DropIndex
DROP INDEX "two_factor_user_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_user_id_key" ON "two_factor"("user_id");
