# Evergreen Studio

Desktop app (Electron + Angular) with a local NestJS API. It helps you produce long-form YouTube videos (roughly 45–60 minutes): build a research library from reference channels, pick a topic, plan chapters, gather web facts, and write the script chapter by chapter.

The UI is English-only. One local user, no login. Export finished scripts as Markdown from **My Videos**.

## What each part of the app does

| Tab | What it does |
|-----|----------------|
| **Research** | Add a YouTube channel URL. The server lists all long-form uploads (not Shorts), saves metadata and chapters, runs basic AI analysis on every video, then builds an **AuthorStyle** profile. Subtitles are **not** collected here. Re-runs only fetch new videos and refresh view counts on known ones. |
| **Advice** | From your library: three topic ideas (one “rework” of a hit + two structural analogues), with period and genre filters. Or use **Custom request** — your own brief; the library is used only if you ask for it. Create a **project** from a topic. |
| **Plan** | Turn the chosen topic into timed chapters with hooks and a mystery thread. **Refine** with natural language as often as you like. **Send to research** locks the plan and starts fact gathering. |
| **Fact research** | For each chapter: search the web (Tavily, Brave, Perplexity Search, Reddit — whichever keys you configured), fetch pages, extract cited facts with URLs. **Refine** per chapter or globally. **Send to writer** when ready. |
| **Writer** | Writes one chapter at a time in your chosen language (RU/EN), using plan, facts, genre, channel style, and optional author overlay. Approve each chapter before the next. **Refine** snippets or the full script. Finish → **My Videos**. |
| **Subtitles** | Paste a video URL: checks the DB, fetches subtitles on demand via `yt-dlp`, optional structure/transcript analysis for tone reference (not bulk research). |
| **Database** | Read-only spreadsheet view of stored channels, videos, and analysis fields; copy cells or selections. |
| **My Videos** | Finished scripts and duplicate guard for future Advice runs. |
| **Style & Genres** | Edit **ChannelStyle** (your channel voice) and manage **genres** (prompt modules). Approved genres shape Plan, Facts, and Writer. |

**Project AI** (Plan, Facts, Writer): pick one LLM vendor per pipeline step and toggle web search sources. Defaults come from `.env`; overrides are stored on the project.

Status bar: API health, BullMQ queue depth, YouTube quota, LLM spend today, video count in Postgres.

## Prerequisites

- **Node.js** ≥ 20, **pnpm** 9
- **Docker Desktop** — PostgreSQL (pgvector) and Redis for the API and job queues
- **`yt-dlp`** on `PATH` for real subtitles (`brew install yt-dlp` on macOS)
- **API keys** in `.env` for real providers (see below). Without keys the stack still runs using mock YouTube, mock LLM, and offline mock search.

## First-time setup

From the repository root:

```bash
cp config/env.example .env
# Edit .env: DATABASE_URL must match POSTGRES_PORT if you change it from 5432

pnpm install
pnpm docker:up
pnpm build:shared
pnpm --filter @youtube-ai-tool/api prisma:generate
pnpm --filter @youtube-ai-tool/api prisma:deploy
pnpm build
```

If postinstall skipped native binaries:

```bash
pnpm --filter @youtube-ai-tool/desktop setup:binaries
```

### Minimum `.env` for real AI and YouTube

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL`, `REDIS_URL` | Postgres + Redis (usually via Docker) |
| `YOUTUBE_API_KEY` | Real channel research (YouTube Data API v3) |
| At least one of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `PERPLEXITY_API_KEY` | Real LLM calls |
| `OPENAI_API_KEY` | Also required for **embeddings** (Advice dedup, vectors) even if Writer uses Claude |
| `TAVILY_API_KEY` and/or `BRAVE_API_KEY` and/or `PERPLEXITY_API_KEY` (search) | Real fact research from the web |

Full variable list: [`docs/SETUP_API_KEYS.md`](docs/SETUP_API_KEYS.md). After changing `.env`, restart the app completely so the API reloads config.

## Run the app

**Development (two terminals):**

```bash
pnpm dev                 # API → http://localhost:3000, Swagger → /docs
pnpm dev:desktop         # builds UI and opens Electron
```

**Electron only:** if nothing responds on `/health`, the desktop app starts `apps/api/dist/main.js` (run `pnpm build` first) and stops it on quit.

**Live UI reload:** `pnpm --filter @youtube-ai-tool/desktop ui:dev`, then  
`EVERGREEN_UI_URL=http://localhost:4200 pnpm --filter @youtube-ai-tool/desktop start`.

**macOS shortcut:** run `scripts/install-desktop-icon.sh` once, then use **Evergreen Studio** on the desktop (starts Docker, migrates DB, opens Electron). Log: `~/Library/Logs/Evergreen Studio.log`.

## Typical workflow

1. **Research** — add reference channels; wait until status is ready (or partial for single-video adds).
2. **Style & Genres** — approve genres; draft or update **ChannelStyle** when prompted.
3. **Advice** — pick period/genre, run topics, open a project from one row (or custom request).
4. **Plan** — generate, refine, then **Send to research**.
5. **Fact research** — run, refine weak chapters, **Send to writer**.
6. **Writer** — generate chapters, approve in order, refine, mark done → **My Videos**.

Keyboard: `g` then a letter jumps tabs (see tab `data-key` hints). ⌘K command palette where implemented.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **API unreachable** in the status bar | Docker not running, Postgres/Redis down, or API failed to start (check terminal / Evergreen log). Run `pnpm docker:up` and ensure port 3000 is free. |
| **Mock** channel names / 12 fake videos | Missing or empty `YOUTUBE_API_KEY`, or API not restarted after editing `.env`. |
| AI steps fail instantly | No LLM keys, invalid key, or `LLM_PROVIDER=mock`. |
| Embeddings / Advice errors with Claude-only setup | Set `OPENAI_API_KEY` for embeddings. |
| Subtitles fail | Install `yt-dlp`, set `SUBTITLES_PROVIDER=ytdlp`, optional cookies/proxy in `.env`. |
| Fact research empty | Enable at least one search API key and select providers in **Project AI**. |

Smoke checks: [`docs/API_SMOKE_TEST.md`](docs/API_SMOKE_TEST.md), [`docs/REAL_WORLD_TEST.md`](docs/REAL_WORLD_TEST.md).

## Tests

| Command | Scope |
|---------|--------|
| `pnpm test` | Shared + API unit tests + desktop Vitest |
| `pnpm test:int` | API integration (needs `TEST_DATABASE_URL` / `TEST_REDIS_URL`) |
| `pnpm test:int:pglite` | Same without Docker (PGlite) |
| `pnpm --filter @youtube-ai-tool/desktop check:layout` | UI overflow check on production build |
| `pnpm --filter @youtube-ai-tool/desktop smoke:electron` | Electron + fixture API |

## Repository layout

| Path | Role |
|------|------|
| `apps/api` | NestJS backend, Prisma, BullMQ workers, LLM router, prompts |
| `apps/desktop` | Electron + Angular UI |
| `packages/shared` | Zod schemas, shared types |
| `evergreen-studio-ui/` | Design tokens and reference HTML |
| `docs/` | API keys, smoke tests |

## Stack

Node.js, TypeScript, NestJS, Prisma, PostgreSQL + pgvector, BullMQ, Redis, Electron, Angular. YouTube Data API v3 for metadata; `yt-dlp` for subtitles only. Multi-vendor LLM routing with structured JSON outputs and per-call logging.
