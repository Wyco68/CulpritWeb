-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "setting";
