ALTER TABLE "channels" ADD COLUMN "analysis_error" TEXT;

ALTER TABLE "research_jobs"
  ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'collect',
  ADD COLUMN "total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "new_videos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "paused_until" TIMESTAMP(3);

ALTER TABLE "video_analyses" DROP COLUMN "embedding_json";
ALTER TABLE "video_analyses" ADD COLUMN "embedding" vector(1536);
CREATE INDEX "video_analyses_embedding_idx" ON "video_analyses" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "channel_styles" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "channel_styles_version_key" ON "channel_styles"("version");

ALTER TABLE "projects"
  ADD COLUMN "use_database" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "source_video_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "shallow_research" JSONB;

ALTER TABLE "research_facts" DROP COLUMN "related_fact_ids";
ALTER TABLE "research_facts"
  ADD COLUMN "related_facts" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "script_chapters"
  ADD COLUMN "feedback" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "my_videos" DROP COLUMN "embedding_json";
ALTER TABLE "my_videos"
  ADD COLUMN "embedding" vector(1536),
  ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ru',
  ADD COLUMN "duration_min" INTEGER;

ALTER TABLE "llm_calls" ADD COLUMN "succeeded" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "llm_calls_created_at_idx" ON "llm_calls"("created_at");
