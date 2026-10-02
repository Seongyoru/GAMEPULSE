CREATE TYPE "public"."banner_type" AS ENUM('CHARACTER', 'WEAPON', 'STANDARD', 'CHRONICLED', 'COLLAB', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."collector_mode" AS ENUM('fixture', 'mock', 'live');--> statement-breakpoint
CREATE TYPE "public"."collector_status" AS ENUM('ENABLED', 'DISABLED', 'MANUAL_ONLY', 'FIXTURE_ONLY', 'PENDING_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('PUBLISHED', 'PENDING_REVIEW', 'REJECTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('PATCH', 'UPDATE', 'EVENT', 'REWARD', 'REDEEM_CODE', 'MAINTENANCE', 'BANNER', 'ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('CHAMPION', 'ITEM', 'RUNE', 'CHARACTER', 'WEAPON', 'CLASS', 'BOSS', 'MODE', 'SYSTEM', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('IN_GAME', 'WEB', 'LOGIN', 'LIMITED_MODE', 'COLLAB', 'SEASONAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('ACTIVE', 'BETA', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."ingestion_trigger" AS ENUM('CLI', 'SCHEDULE', 'MANUAL', 'SEED', 'TEST', 'WEB_FIXTURES');--> statement-breakpoint
CREATE TYPE "public"."localization_origin" AS ENUM('SOURCE', 'HUMAN', 'MACHINE');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('SCHEDULED', 'EMERGENCY', 'EXTENDED');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."patch_change_type" AS ENUM('BUFF', 'NERF', 'ADJUST', 'NEW', 'REMOVED', 'REWORK', 'FIX', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."provenance_role" AS ENUM('PRIMARY', 'SUPPORTING');--> statement-breakpoint
CREATE TYPE "public"."reset_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM_RRULE');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('EVENT', 'ATTENDANCE', 'LOGIN', 'COMPENSATION', 'REDEEM_CODE', 'WEB_EVENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."source_authentication" AS ENUM('NONE', 'API_KEY', 'NOT_APPLICABLE');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('OFFICIAL_API', 'OFFICIAL_FEED', 'OFFICIAL_WEB', 'MANUAL', 'TRUSTED_FALLBACK', 'FIXTURE');--> statement-breakpoint
CREATE TYPE "public"."time_precision" AS ENUM('DATETIME', 'DATE');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('VALID', 'WARNING', 'REVIEW', 'INVALID');--> statement-breakpoint
CREATE TYPE "public"."verification_state" AS ENUM('AUTO_VERIFIED', 'MANUAL_VERIFIED', 'UNVERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "banner_featured" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"banner_id" uuid NOT NULL,
	"entity_id" uuid,
	"entity_key" text,
	"name" text NOT NULL,
	"rarity" smallint,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"content_item_id" uuid PRIMARY KEY NOT NULL,
	"banner_type" "banner_type" NOT NULL,
	"phase" smallint
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"type" "content_type" NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"source_timezone" text,
	"start_at_source" text,
	"end_at_source" text,
	"region" text,
	"time_precision" time_precision DEFAULT 'DATETIME' NOT NULL,
	"has_timing" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"source_published_at" timestamp with time zone,
	"status" "content_status" NOT NULL,
	"priority" smallint DEFAULT 50 NOT NULL,
	"source_id" text NOT NULL,
	"source_key" text NOT NULL,
	"source_url" text NOT NULL,
	"source_locale" text NOT NULL,
	"raw_document_id" uuid,
	"semantic_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"confidence" real NOT NULL,
	"verification" "verification_state" NOT NULL,
	"verified_at" timestamp with time zone,
	"validation_status" "validation_status" NOT NULL,
	"parser_id" text NOT NULL,
	"parser_version" text NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_slug_unique" UNIQUE("slug"),
	CONSTRAINT "content_items_chronology" CHECK ("content_items"."end_at" IS NULL OR "content_items"."start_at" IS NULL OR "content_items"."end_at" >= "content_items"."start_at"),
	CONSTRAINT "content_items_priority_range" CHECK ("content_items"."priority" BETWEEN 0 AND 100),
	CONSTRAINT "content_items_confidence_range" CHECK ("content_items"."confidence" >= 0 AND "content_items"."confidence" <= 1)
);
--> statement-breakpoint
CREATE TABLE "content_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"source_key" text NOT NULL,
	"source_url" text NOT NULL,
	"raw_document_id" uuid,
	"role" "provenance_role" NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"content_item_id" uuid PRIMARY KEY NOT NULL,
	"event_type" "event_type" NOT NULL,
	"eligibility" text,
	"reward_summary" text
);
--> statement-breakpoint
CREATE TABLE "game_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"type" "entity_type" NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"name_locale" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"publisher" text NOT NULL,
	"developer" text NOT NULL,
	"default_timezone" text NOT NULL,
	"official_url" text NOT NULL,
	"status" "game_status" NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter_id" text NOT NULL,
	"source_id" text NOT NULL,
	"game_id" text NOT NULL,
	"trigger" "ingestion_trigger" NOT NULL,
	"mode" "collector_mode" NOT NULL,
	"status" "ingestion_run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"discovered" integer DEFAULT 0 NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "localizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"locale" text NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"origin" "localization_origin" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenances" (
	"content_item_id" uuid PRIMARY KEY NOT NULL,
	"maintenance_type" "maintenance_type" NOT NULL,
	"affected_servers" text[] DEFAULT '{}'::text[] NOT NULL,
	"compensation_source_key" text
);
--> statement-breakpoint
CREATE TABLE "parse_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_document_id" uuid,
	"parser_id" text NOT NULL,
	"parser_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"status" "parse_status" NOT NULL,
	"output" jsonb,
	"error" text,
	"model" text,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patch_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patch_id" uuid NOT NULL,
	"target_type" "entity_type" NOT NULL,
	"target_id" uuid,
	"target_key" text,
	"target_name" text NOT NULL,
	"change_type" "patch_change_type" NOT NULL,
	"field" text,
	"before_value" text,
	"after_value" text,
	"unit" text,
	"description" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patches" (
	"content_item_id" uuid PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"release_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "raw_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"document_key" text NOT NULL,
	"external_id" text,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"content_type" text NOT NULL,
	"raw_text" text,
	"fetched_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	"http_status" integer,
	"etag" text,
	"last_modified" text,
	"locale" text,
	"ingestion_run_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redeem_codes" (
	"content_item_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"region" text
);
--> statement-breakpoint
CREATE TABLE "reset_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"frequency" "reset_frequency" NOT NULL,
	"timezone" text NOT NULL,
	"hour" smallint NOT NULL,
	"minute" smallint NOT NULL,
	"day_of_week" smallint,
	"day_of_month" smallint,
	"rrule" text,
	"anchor" timestamp with time zone,
	"region" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verification" "verification_state" NOT NULL,
	"is_synthetic" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reset_rules_hour_range" CHECK ("reset_rules"."hour" BETWEEN 0 AND 23),
	CONSTRAINT "reset_rules_minute_range" CHECK ("reset_rules"."minute" BETWEEN 0 AND 59),
	CONSTRAINT "reset_rules_day_of_week_range" CHECK ("reset_rules"."day_of_week" IS NULL OR "reset_rules"."day_of_week" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE TABLE "reward_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"sort_order" integer NOT NULL,
	CONSTRAINT "reward_items_quantity_positive" CHECK ("reward_items"."quantity" IS NULL OR "reward_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"content_item_id" uuid PRIMARY KEY NOT NULL,
	"reward_type" "reward_type" NOT NULL,
	"how_to_claim" text,
	"related_source_key" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "source_type" NOT NULL,
	"is_official" boolean NOT NULL,
	"homepage_url" text NOT NULL,
	"allowed_hosts" text[] NOT NULL,
	"authentication" "source_authentication" NOT NULL,
	"rate_limit" text,
	"content_types" text[] NOT NULL,
	"collector_status" "collector_status" NOT NULL,
	"terms_url" text,
	"terms_reviewed_at" date,
	"robots_policy" text,
	"attribution" text,
	"data_retention_days" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingestion_run_id" uuid,
	"raw_document_id" uuid,
	"content_item_id" uuid,
	"source_id" text NOT NULL,
	"candidate_key" text NOT NULL,
	"status" "validation_status" NOT NULL,
	"issues" jsonb NOT NULL,
	"validator_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "banner_featured" ADD CONSTRAINT "banner_featured_banner_id_banners_content_item_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."banners"("content_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_featured" ADD CONSTRAINT "banner_featured_entity_id_game_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."game_entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banners" ADD CONSTRAINT "banners_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_raw_document_id_raw_documents_id_fk" FOREIGN KEY ("raw_document_id") REFERENCES "public"."raw_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_sources" ADD CONSTRAINT "content_sources_raw_document_id_raw_documents_id_fk" FOREIGN KEY ("raw_document_id") REFERENCES "public"."raw_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_entities" ADD CONSTRAINT "game_entities_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parse_results" ADD CONSTRAINT "parse_results_raw_document_id_raw_documents_id_fk" FOREIGN KEY ("raw_document_id") REFERENCES "public"."raw_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patch_changes" ADD CONSTRAINT "patch_changes_patch_id_patches_content_item_id_fk" FOREIGN KEY ("patch_id") REFERENCES "public"."patches"("content_item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patch_changes" ADD CONSTRAINT "patch_changes_target_id_game_entities_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."game_entities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patches" ADD CONSTRAINT "patches_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_documents" ADD CONSTRAINT "raw_documents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_documents" ADD CONSTRAINT "raw_documents_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reset_rules" ADD CONSTRAINT "reset_rules_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_items" ADD CONSTRAINT "reward_items_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_ingestion_run_id_ingestion_runs_id_fk" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_raw_document_id_raw_documents_id_fk" FOREIGN KEY ("raw_document_id") REFERENCES "public"."raw_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "banner_featured_banner_idx" ON "banner_featured" USING btree ("banner_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "content_items_source_key_uq" ON "content_items" USING btree ("source_id","source_key");--> statement-breakpoint
CREATE INDEX "content_items_game_type_idx" ON "content_items" USING btree ("game_id","type");--> statement-breakpoint
CREATE INDEX "content_items_type_idx" ON "content_items" USING btree ("type");--> statement-breakpoint
CREATE INDEX "content_items_status_idx" ON "content_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_items_start_at_idx" ON "content_items" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "content_items_end_at_idx" ON "content_items" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "content_items_published_at_idx" ON "content_items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "content_items_semantic_key_idx" ON "content_items" USING btree ("game_id","semantic_key");--> statement-breakpoint
CREATE INDEX "content_items_content_hash_idx" ON "content_items" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "content_sources_item_source_key_uq" ON "content_sources" USING btree ("content_item_id","source_id","source_key");--> statement-breakpoint
CREATE INDEX "content_sources_source_key_idx" ON "content_sources" USING btree ("source_id","source_key");--> statement-breakpoint
CREATE UNIQUE INDEX "game_entities_game_type_key_uq" ON "game_entities" USING btree ("game_id","type","key");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_runs_one_running_per_adapter" ON "ingestion_runs" USING btree ("adapter_id") WHERE "ingestion_runs"."status" = 'RUNNING';--> statement-breakpoint
CREATE INDEX "ingestion_runs_started_at_idx" ON "ingestion_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source_idx" ON "ingestion_runs" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "localizations_entity_locale_field_uq" ON "localizations" USING btree ("entity_kind","entity_id","locale","field");--> statement-breakpoint
CREATE UNIQUE INDEX "parse_results_cache_uq" ON "parse_results" USING btree ("input_hash","parser_id","parser_version");--> statement-breakpoint
CREATE INDEX "patch_changes_patch_idx" ON "patch_changes" USING btree ("patch_id","sort_order");--> statement-breakpoint
CREATE INDEX "patch_changes_target_idx" ON "patch_changes" USING btree ("target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_documents_source_document_hash_uq" ON "raw_documents" USING btree ("source_id","document_key","content_hash");--> statement-breakpoint
CREATE INDEX "raw_documents_source_document_fetched_idx" ON "raw_documents" USING btree ("source_id","document_key","fetched_at");--> statement-breakpoint
CREATE INDEX "raw_documents_content_hash_idx" ON "raw_documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "redeem_codes_code_idx" ON "redeem_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "reset_rules_game_idx" ON "reset_rules" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "reward_items_content_item_idx" ON "reward_items" USING btree ("content_item_id","sort_order");--> statement-breakpoint
CREATE INDEX "sources_game_id_idx" ON "sources" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "validation_results_run_idx" ON "validation_results" USING btree ("ingestion_run_id");--> statement-breakpoint
CREATE INDEX "validation_results_content_idx" ON "validation_results" USING btree ("content_item_id");--> statement-breakpoint
CREATE INDEX "validation_results_status_idx" ON "validation_results" USING btree ("status");