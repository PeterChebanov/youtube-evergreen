# Первый прогон на реальных ключах

Краткий чеклист перед тестом Plan → Facts → Writer с живыми API.

## 1. `.env`

```bash
cp config/env.example .env
```

| Переменная | Зачем |
|---|---|
| `LLM_PROVIDER` | **Не** `mock` — любое другое значение включает роутер по ключам |
| `OPENAI_API_KEY` | Embeddings (Advice, pgvector) и опционально LLM |
| `ANTHROPIC_API_KEY` | Writer по умолчанию (Opus) |
| `ANTHROPIC_OPUS_MODEL` | Точный id Opus 4.5, см. ниже |
| `ANTHROPIC_MODEL` | Sonnet для лёгких шагов (например chapter summary) |
| `PERPLEXITY_API_KEY` | Research LLM + Perplexity Search |
| `TAVILY_API_KEY`, `BRAVE_API_KEY` | Доп. источники в fact pipeline |
| `YOUTUBE_API_KEY` | Реальный Research каналов (без ключа — mock 12 видео) |

Пример Opus 4.5 (Anthropic API):

```env
ANTHROPIC_OPUS_MODEL=claude-opus-4-5-20251101
```

Алиас `claude-opus-4-5` тоже работает, но для продакшена надёжнее **dated** id.

Writer/refine по умолчанию: `anthropic:${ANTHROPIC_OPUS_MODEL}`. На UI в **Project AI** каждый шаг переопределяется отдельно (`writer`, `writer_refine`, `planning`, …).

## 2. Инфраструктура

```bash
pnpm install
pnpm docker:up
pnpm build:shared
pnpm --filter @youtube-ai-tool/api prisma:generate
pnpm --filter @youtube-ai-tool/api prisma:deploy
pnpm --filter @youtube-ai-tool/api build
pnpm --filter @youtube-ai-tool/desktop build
```

Или двойной клик по иконке / `scripts/launch-evergreen.sh` (Docker + migrate + Electron).

Проверка API: `curl -s http://localhost:3000/health` → `ok`.

## 3. Сценарий smoke

1. **Research** — один канал, дождаться `ready` (или mock без YouTube key).
2. **Advice** или **Custom request** → создать проект.
3. **Plan** — в Project AI: источники поиска + модели по шагам → Generate plan → Refine.
4. **Facts** — Send to research → дождаться фактов с URL.
5. **Writer** — черновик главы → Refine (можно сменить модель только для `writer_refine` в Project AI между проходами).

Статус-бар: очереди BullMQ, траты LLM (`/ops/spend`).

## 4. Если что-то падает

| Симптом | Что проверить |
|---|---|
| Local API not reachable | `apps/api/dist/main.js`, Postgres, миграции |
| LLM provider not configured | Формат `provider:model`, ключ в `.env`, не `mock` |
| Embeddings error | Нужен `OPENAI_API_KEY` даже при Writer на Claude |
| No search providers | Хотя бы один ключ Tavily/Brave/Perplexity/Reddit |
| Migration failed | `pnpm --filter @youtube-ai-tool/api prisma:deploy` |

Лог launcher (macOS): `~/Library/Logs/Evergreen Studio.log`.

Подробнее по ключам: [`SETUP_API_KEYS.md`](SETUP_API_KEYS.md).
