# API-ключи и подключение сервисов

Документ для локального запуска **Evergreen Studio** (не для CI). Секреты храните только в `.env` в корне проекта; файл **не коммитится** в git.

---

## 1. Минимум, чтобы не было «mock»

| Переменная | Обязательно? | Зачем |
|---|---|---|
| `DATABASE_URL` | да | Postgres (обычно через `pnpm docker:up`) |
| `REDIS_URL` | да | Очереди BullMQ (Research, facts, …) |
| `YOUTUBE_API_KEY` | да для реального Research | Без ключа — **Mock YouTube**, 12 фиктивных роликов и имя `Mock …` |
| Хотя бы один ключ LLM (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …) | да для реального AI | Без ключей (или с `LLM_PROVIDER=mock`) — **Mock LLM** |

Остальное ниже — для полного пайплайна (факты из веба, субтитры, embeddings).

---

## 2. Полный список переменных `.env`

Скопируйте шаблон:

```bash
cp config/env.example .env
```

### Инфраструктура

| Переменная | Пример | Назначение |
|---|---|---|
| `PORT` | `3000` | Порт NestJS API (Electron ходит на `http://localhost:3000`) |
| `POSTGRES_PORT` | `5432` или `55432` | Порт Postgres в Docker, если 5432 занят |
| `DATABASE_URL` | `postgresql://youtube_ai:youtube_ai@localhost:5432/youtube_ai?schema=public` | Строка должна совпадать с `POSTGRES_PORT` |
| `REDIS_URL` | `redis://localhost:6379` | Redis из `docker compose` |

### YouTube (Research — сбор списка роликов и метаданных)

| Переменная | Обязательно | Назначение |
|---|---|---|
| `YOUTUBE_API_KEY` | **да** для реальных каналов | YouTube Data API v3 |
| `YOUTUBE_DAILY_QUOTA_UNITS` | нет (по умолчанию 10000) | Дневная квота units в приложении |
| `YOUTUBE_QUOTA_RESERVE_UNITS` | нет (200) | Запас до паузы `paused_quota` |
| `SHORTS_MIN_DURATION_SEC` | нет (60) | Ролики короче считаются Shorts и **не** попадают в long-form research |

### LLM (пять вендоров, одна модель на вендор из `.env`)

Настройте **ключ + модель** для каждого провайдера, который хотите видеть в dropdown UI. На каждом AI-шаге в приложении выбирается **один** вендор (GPT / Claude / Gemini / Grok / Perplexity).

| Переменная | Назначение |
|---|---|
| `LLM_PROVIDER=mock` | Принудительная заглушка даже при наличии ключей (обычно не нужно) |
| `OPENAI_API_KEY` + `OPENAI_MODEL` | GPT; **embeddings** тоже через OpenAI |
| `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` | Claude |
| `GEMINI_API_KEY` + `GEMINI_MODEL` | Gemini |
| `XAI_API_KEY` + `XAI_MODEL` | Grok |
| `PERPLEXITY_API_KEY` + `PERPLEXITY_MODEL` | Sonar chat (не путать с веб-поиском ниже) |
| `LLM_EMBEDDING_MODEL` | Модель embeddings (pgvector, Advice) |
| `LLM_PRICE_*`, `LLM_EST_*` | Оценка стоимости Research в UI |

Defaults по этапам задаёт сервер (`stageDefaults` в `app.config.ts`); в UI можно переопределить вендор на проект (Plan/Facts/Writer) или на запуск (Research, Advice, Subtitles, Style).

### Субтитры (вкладка Subtitles, тон для Writer)

| Переменная | Обязательно | Назначение |
|---|---|---|
| `SUBTITLES_PROVIDER` | нет | `ytdlp` (реально) или `mock` |
| `YTDLP_PATH` | да при ytdlp | `yt-dlp` в PATH или полный путь |
| `YTDLP_DELAY_MS` | нет | Пауза между запросами |
| `YTDLP_MAX_RETRIES` | нет | Повторы |
| `YTDLP_PROXY` | нет | Прокси при блокировках |
| `YTDLP_COOKIES_FILE` | нет | cookies.txt для age-restricted |
| `YTDLP_SUB_LANGS` | нет | `ru,en` |

На macOS: `brew install yt-dlp`.

### Веб-поиск (Fact research — факты с URL)

Нужен **хотя бы один** ключ; иначе — offline mock search.

| Переменная | Назначение |
|---|---|
| `TAVILY_API_KEY` | [Tavily](https://tavily.com/) — поиск для LLM |
| `BRAVE_API_KEY` | [Brave Search API](https://brave.com/search/api/) |
| `PERPLEXITY_API_KEY` | [Perplexity Search API](https://docs.perplexity.ai/) — веб-поиск (отдельно от Sonar chat) |
| `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` | Reddit API (опционально) |

На вкладках **Plan**, **Fact research** и **Writer** блок **Project AI**: чекбоксы веб-поиска (Tavily, Brave, …) и dropdown LLM **на каждый шаг** pipeline.
| `SEARCH_RESULTS_PER_QUERY` | Сколько ссылок на запрос |
| `SEARCH_MAX_PAGES_PER_CHAPTER` | Лимит страниц на главу |
| `SEARCH_FETCH_TIMEOUT_MS` | Таймаут загрузки страницы |

---

## 3. Несколько LLM-провайдеров и Perplexity vs Tavily/Brave

**LLM (текст / JSON)** — роутер по префиксу модели:

| Переменные | Провайдер |
|---|---|
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | OpenAI (+ embeddings для pgvector) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_OPUS_MODEL`, `ANTHROPIC_MODEL`, `ANTHROPIC_VERSION`, `ANTHROPIC_MAX_TOKENS` | Claude — Writer/refine по умолчанию **Opus** (`ANTHROPIC_OPUS_MODEL`, напр. `claude-opus-4-5-20251101`); Sonnet — `ANTHROPIC_MODEL` для summary и экспериментов |
| `GEMINI_API_KEY`, `GEMINI_BASE_URL` | Gemini (OpenAI-compatible endpoint) |
| `XAI_API_KEY`, `XAI_BASE_URL` | Grok |
| `PERPLEXITY_API_KEY`, `PERPLEXITY_BASE_URL`, `PERPLEXITY_MODEL` | Sonar chat (`perplexity:sonar-pro` и т.д.) |

`LLM_PROVIDER=mock` — заглушка для тестов. Иначе API поднимается с любым набором ключей выше.

**Два разных слоя «поиска» (их не путать):**

1. **Sonar (LLM)** — модель `perplexity:…` сама ходит в индекс Perplexity при вызове chat (planning, queries, fact_extract).
2. **Search API** (чекбоксы в UI) — приложение **само параллельно** дергает Tavily, Brave, **Perplexity Search**, Reddit, склеивает URL, скачивает страницы, потом LLM извлекает факты. Perplexity **не** вызывает Tavily/Brave за вас; комбинация источников = больше разных ссылок и углов.

**Дефолты без overrides в UI:** research → `perplexity:PERPLEXITY_MODEL`; `writer` / `writer_refine` → `anthropic:ANTHROPIC_OPUS_MODEL`; `chapter_summary` → `anthropic:ANTHROPIC_MODEL` (Sonnet). На каждом шаге pipeline в **Project AI** можно указать любую комбинацию провайдеров.

Первый прогон: [`REAL_WORLD_TEST.md`](REAL_WORLD_TEST.md).

**Автор в Writer** — это и **модель** (`writer` / `writer_refine`), и опционально **`authorOverlayChannelId`** (стиль канала из Research).

---

## 4. Пример `.env` для «всё по-настоящему» (OpenAI + YouTube + поиск)

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

LLM_EMBEDDING_MODEL=text-embedding-3-small
LLM_MODEL_DEFAULT=gpt-4o-mini
LLM_MODEL_VIDEO_BASIC=gpt-4o-mini
LLM_MODEL_AUTHOR_STYLE=gpt-4o-mini
LLM_MODEL_PLANNING=gpt-4o
LLM_MODEL_WRITER=gpt-4o
LLM_MODEL_FACT_EXTRACT=gpt-4o-mini

YOUTUBE_API_KEY=AIza...

TAVILY_API_KEY=tvly-...
# или BRAVE_API_KEY=...

SUBTITLES_PROVIDER=ytdlp
YTDLP_PATH=yt-dlp
```

После правок **полностью перезапустите** приложение (⌘Q → иконка на рабочем столе), чтобы API перечитал `.env`.

---

## 5. YouTube Data API: где взять ключ и как подключить

### Шаг 1. Google Cloud

1. Откройте [Google Cloud Console](https://console.cloud.google.com/).
2. Создайте проект (или выберите существующий), например `evergreen-studio`.

### Шаг 2. Включить API

1. **APIs & Services → Library**.
2. Найдите **YouTube Data API v3**.
3. Нажмите **Enable**.

### Шаг 3. Создать API key

1. **APIs & Services → Credentials**.
2. **Create credentials → API key**.
3. Скопируйте ключ (формат `AIza…`).

### Шаг 4. Ограничить ключ (рекомендуется)

1. Откройте созданный ключ → **Edit**.
2. **Application restrictions**: для локальной разработки часто **None**; для продакшена — IP.
3. **API restrictions** → **Restrict key** → только **YouTube Data API v3**.
4. Сохраните.

### Шаг 5. Квота

- По умолчанию у проекта ~**10 000 units/день** (можно запросить increase в Google).
- Research тратит units на `channels.list`, `playlistItems.list`, `videos.list` (зависит от числа роликов).
- В приложении: `YOUTUBE_DAILY_QUOTA_UNITS` и пауза `paused_quota` при лимите.

### Шаг 6. Прописать в проект

В `.env` в корне репозитория:

```env
YOUTUBE_API_KEY=AIzaSy................................
```

Убедитесь, что `DATABASE_URL` указывает на ваш Postgres (после `docker compose up -d`).

### Шаг 7. Проверка

С запущенным API:

```bash
curl -s -X POST http://localhost:3000/library/research/preview \
  -H 'Content-Type: application/json' \
  -d '{"channelUrl":"https://www.youtube.com/@toples"}' | python3 -m json.tool
```

Ожидается:

- `channelName` **без** префикса `Mock`;
- `videoCount` — реальное число long-form роликов (не 12).

### Частые проблемы

| Симптом | Причина |
|---|---|
| `Mock Toplesofficial`, 12 videos | Пустой `YOUTUBE_API_KEY` или API не перезапускали |
| `403` / quota | Исчерпана дневная квота Google |
| `403` API not enabled | Не включён YouTube Data API v3 |
| Канал не находится | Неверный URL; нужен `@handle` или `/channel/UC…` |

---

## 6. Чеклист перед первым реальным Research

- [ ] Docker: Postgres + Redis (`pnpm docker:up`)
- [ ] Миграции (`pnpm --filter @youtube-ai-tool/api prisma:deploy`) — при первом запуске делает launcher
- [ ] `YOUTUBE_API_KEY` в `.env`
- [ ] `LLM_PROVIDER=openai` и `OPENAI_API_KEY`
- [ ] Для фактов: `TAVILY_API_KEY` или `BRAVE_API_KEY`
- [ ] Для субтитров: `yt-dlp` установлен
- [ ] Перезапуск Evergreen Studio после изменения `.env`

---

## 7. Связанные файлы

- Шаблон env: `config/env.example`
- Файлы промптов и Writer-слоёв: `apps/api/src/prompts/`
- Smoke-тест API: `docs/API_SMOKE_TEST.md`
