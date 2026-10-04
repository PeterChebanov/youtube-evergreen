# API smoke test (mock providers, no keys)

Prerequisites: `pnpm docker:up`, `pnpm --filter @youtube-ai-tool/api prisma:deploy`, `pnpm dev`. Swagger: http://localhost:3000/docs.
The same flow runs automatically in `apps/api/test/integration/pipeline.int-spec.ts` (`pnpm test:int` or `pnpm test:int:pglite`).

## Research

1. `GET /health`, `GET /ops/status`
2. `POST /library/research/preview` `{ "channelUrl": "https://www.youtube.com/@toples" }` — video count and cost estimate
3. `POST /library/research` with the same body — returns the job; poll `GET /library/channels` until the channel is `ready`
4. `GET /library/channels/{id}` — stats and AuthorStyle; `POST /library/research-jobs/{jobId}/retry` after a failure; `POST /library/channels/{id}/rerun`; `POST /library/refresh`

## Topic → plan → facts → script

5. `POST /advice` `{ "period": { "kind": "olderThan", "years": 2 }, "genreIds": [], "skipMyVideos": true }` — three topics and a `runId`
6. `POST /projects/from-advice` `{ "runId": "...", "topicIndex": 0 }` — or `POST /projects/custom` `{ "request": "..." }`
7. `POST /projects/{id}/plan/generate`, optional `POST /projects/{id}/plan/refine` `{ "feedback": "..." }`, then `POST /projects/{id}/plan/approve`
8. Poll `GET /projects/{id}/facts` until `status=done`; optional `POST /projects/{id}/facts/refine` `{ "feedback": "...", "chapterOrder": 2 }`, `POST /projects/{id}/facts` (manual fact with `sourceUrl`), then `POST /projects/{id}/facts/approve`
9. For each chapter: `POST /projects/{id}/script/chapters/{n}/write`, then `POST /projects/{id}/script/chapters/{n}/approve`
10. `POST /projects/{id}/script/finalize`, `GET /projects/{id}/script/export` (Markdown)

## My Videos, subtitles, database

11. `GET /my-videos`, `GET /my-videos/memory` — `{ indexed, total, closestPair }`
12. `POST /subtitles/check` `{ "url": "https://www.youtube.com/watch?v=..." }` → scenario; `POST /subtitles/fetch` with the confirmation flag the scenario asks for (`confirmTitleMismatch` / `confirmAddVideo` / `confirmOverwrite`); `POST /subtitles/videos/{videoId}/analyze`
13. `GET /database/tables`, `GET /database/tables/videos?sort=views_at_research&dir=desc&q=&limit=200&offset=0`, `GET /database/tables/videos/export`
14. `GET /style`, `PUT /style`, `POST /style/draft`; `GET /genres`, `POST /genres/recompute`; `GET /ops/spend`
