-- Full domain schema (stages 2-11)

CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "youtube_channel_id" TEXT NOT NULL,
    "channel_name" TEXT NOT NULL,
    "youtube_url" TEXT NOT NULL,
    "description" TEXT,
    "subscribers" INTEGER,
    "uploads_playlist_id" TEXT,
    "research_status" TEXT NOT NULL DEFAULT 'collecting',
    "last_researched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "channels_youtube_channel_id_key" ON "channels"("youtube_channel_id");

CREATE TABLE "research_jobs" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "estimated_cost" DOUBLE PRECISION,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "cursor" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "research_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "research_jobs_channel_id_idx" ON "research_jobs"("channel_id");
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "api_quota_usage" (
    "id" TEXT NOT NULL,
    "usage_date" DATE NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "api_quota_usage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "api_quota_usage_usage_date_key" ON "api_quota_usage"("usage_date");

CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "youtube_video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "views_at_research" INTEGER NOT NULL,
    "duration_sec" INTEGER NOT NULL,
    "description" TEXT,
    "chapters_status" TEXT NOT NULL DEFAULT 'unavailable',
    "transcript" TEXT,
    "transcript_status" TEXT NOT NULL DEFAULT 'empty',
    "structure_status" TEXT NOT NULL DEFAULT 'none',
    "researched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "videos_youtube_video_id_key" ON "videos"("youtube_video_id");
CREATE INDEX "videos_channel_id_idx" ON "videos"("channel_id");
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_timestamp" TEXT NOT NULL,
    "end_timestamp" TEXT,
    "order" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'youtube',
    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chapters_video_id_idx" ON "chapters"("video_id");
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "subsections" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "timestamp" TEXT,
    CONSTRAINT "subsections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subsections_chapter_id_idx" ON "subsections"("chapter_id");
ALTER TABLE "subsections" ADD CONSTRAINT "subsections_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "research_snapshots" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "researched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL,
    CONSTRAINT "research_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "research_snapshots_video_id_researched_at_key" ON "research_snapshots"("video_id", "researched_at");
ALTER TABLE "research_snapshots" ADD CONSTRAINT "research_snapshots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "genres" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "focus" TEXT NOT NULL,
    "retention_best_practices" TEXT,
    "top_authors" JSONB,
    "prompt_module" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    CONSTRAINT "genres_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "genres_name_key" ON "genres"("name");

CREATE TABLE "video_analyses" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "genre_id" TEXT,
    "content_type" TEXT,
    "topic" TEXT,
    "subtopic" TEXT,
    "format" TEXT,
    "title_type" TEXT,
    "hook" TEXT,
    "embedding_json" TEXT,
    "transcript_analysis" JSONB,
    "transcript_analyzed_at" TIMESTAMP(3),
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_analyses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "video_analyses_video_id_key" ON "video_analyses"("video_id");
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_analyses" ADD CONSTRAINT "video_analyses_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "author_styles" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "technique" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "example_video_ids" TEXT[],
    "order" INTEGER NOT NULL,
    CONSTRAINT "author_styles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "author_styles_channel_id_idx" ON "author_styles"("channel_id");
ALTER TABLE "author_styles" ADD CONSTRAINT "author_styles_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "channel_styles" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "voice" TEXT NOT NULL,
    "themes" TEXT NOT NULL,
    "techniques" JSONB NOT NULL,
    "retention_rules" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_styles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "target_duration_min" INTEGER NOT NULL,
    "genre_id" TEXT,
    "author_overlay_channel_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source_video_snapshot" JSONB,
    "tone_reference_video_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topic" TEXT,
    "subtopic" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "projects" ADD CONSTRAINT "projects_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "advice_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "filters" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advice_runs_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "advice_runs" ADD CONSTRAINT "advice_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "plan_versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plan_versions_project_id_version_key" ON "plan_versions"("project_id", "version");
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "research_facts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "plan_chapter_order" INTEGER NOT NULL,
    "iteration" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_title" TEXT,
    "related_fact_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "research_facts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "research_facts_project_id_plan_chapter_order_idx" ON "research_facts"("project_id", "plan_chapter_order");
ALTER TABLE "research_facts" ADD CONSTRAINT "research_facts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "script_chapters" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "chapter_order" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT NOT NULL DEFAULT '',
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "script_chapters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "script_chapters_project_id_chapter_order_version_key" ON "script_chapters"("project_id", "chapter_order", "version");
ALTER TABLE "script_chapters" ADD CONSTRAINT "script_chapters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "my_videos" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subtopic" TEXT,
    "genre_id" TEXT,
    "chapters_json" JSONB NOT NULL,
    "script_text" TEXT NOT NULL,
    "embedding_json" TEXT,
    "finished_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "my_videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "my_videos_project_id_key" ON "my_videos"("project_id");
ALTER TABLE "my_videos" ADD CONSTRAINT "my_videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "my_videos" ADD CONSTRAINT "my_videos_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
