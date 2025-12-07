// src/modules/subscription/migrations/20251207-add-price-to-subscription-plan.ts
import { Migration } from "@mikro-orm/migrations"

export class Migration20251207 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "subscription_plan"
      ADD COLUMN "unit_amount" INTEGER NULL,
      ADD COLUMN "currency" VARCHAR(3) NULL;
    `)
  }

  async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "subscription_plan"
      DROP COLUMN "unit_amount",
      DROP COLUMN "currency";
    `)
  }
}