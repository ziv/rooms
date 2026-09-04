ALTER TABLE "sites" DROP CONSTRAINT "sites_window_check";--> statement-breakpoint
DROP INDEX IF EXISTS "users_single_super_admin";--> statement-breakpoint
ALTER TABLE "sites" DROP COLUMN "booking_window_days";