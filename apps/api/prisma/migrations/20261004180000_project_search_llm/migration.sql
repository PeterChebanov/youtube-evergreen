ALTER TABLE "projects"
  ADD COLUMN "search_providers" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "llm_research_model" TEXT,
  ADD COLUMN "llm_writer_model" TEXT;
