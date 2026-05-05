ALTER TABLE "payments" DROP CONSTRAINT "payments_stripe_session_id_unique";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_payment_intent_id" varchar(255);