CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "llm_calls" (
    "id" TEXT NOT NULL,
    "prompt_name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "project_id" TEXT,
    "db_tools_used" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_records" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 100,
    "payload" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_records_status_idx" ON "job_records"("status");
