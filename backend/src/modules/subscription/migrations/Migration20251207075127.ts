import { Migration } from '@mikro-orm/migrations';

export class Migration20251207075127 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "subscription" ("id" text not null, "customer_id" text not null, "plan_id" text not null, "stripe_customer_id" text not null, "stripe_subscription_id" text not null, "stripe_latest_invoice_id" text null, "status" text check ("status" in ('incomplete', 'active', 'past_due', 'canceled', 'incomplete_expired', 'trialing', 'unpaid')) not null, "current_period_start" timestamptz null, "current_period_end" timestamptz null, "billing_email" text null, "shipping_name" text null, "shipping_phone" text null, "shipping_address_line1" text null, "shipping_address_line2" text null, "shipping_city" text null, "shipping_province" text null, "shipping_postal_code" text null, "shipping_country" text null, "last_order_id" text null, "last_order_created_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "subscription_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_deleted_at" ON "subscription" (deleted_at) WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "subscription_plan" ("id" text not null, "product_id" text not null, "name" text not null, "interval" text check ("interval" in ('day', 'week', 'month', 'year')) null, "interval_count" integer null, "stripe_price_id" text not null, "payment_link_url" text not null, "active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "subscription_plan_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_plan_deleted_at" ON "subscription_plan" (deleted_at) WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "subscription" cascade;`);

    this.addSql(`drop table if exists "subscription_plan" cascade;`);
  }

}
