# API-ключи и подключение сервисов

Документ для локального запуска **Evergreen Studio** (не для CI). Секреты храните только в `.env` в корне проекта; файл **не коммитится** в git.

---

## 1. Минимум, чтобы не было «mock»

| Переменная | Обязательно? | Зачем |
|---|---|---|
| `DATABASE_URL` | да | Postgres (обычно через `pnpm docker:up`) |
| `REDIS_URL` | да | Очереди BullMQ (Research, facts, …) |
| `YOUTUBE_API_KEY` | да для реального Research | Без ключа — **Mock YouTube**, 12 фиктивных роликов и имя `Mock …` |
| `LLM_PROVIDER=openai` + `OPENAI_API_KEY` | да для реального AI | Без этого — **Mock LLM**, фиктивные анализы и тексты |

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

### LLM (все этапы: анализ роликов, Advice, Plan, Facts extract, Writer, …)

| Переменная | Обязательно | Назначение |
|---|---|---|
| `LLM_PROVIDER` | да | `mock` — заглушка; **`openai`** — реальные вызовы |
| `OPENAI_API_KEY` | да при `openai` | Ключ провайдера с **Chat Completions + JSON** и **Embeddings** |
| `LLM_EMBEDDING_MODEL` | нет | Модель embeddings (pgvector, Advice «похожие темы») |
| `LLM_MODEL_DEFAULT` | нет | Fallback, если не задана модель для промпта |
| `LLM_MODEL_VIDEO_BASIC` | нет | Базовый AI-анализ каждого ролика при Research |
| `LLM_MODEL_VIDEO_STRUCTURE` | нет | Главы/структура по необходимости |
| `LLM_MODEL_AUTHOR_STYLE` | нет | AuthorStyle — «фишки автора» канала |
| `LLM_MODEL_GENRE_PRACTICES` | нет | Жанры |
| `LLM_MODEL_CHANNEL_STYLE` | нет | Общий ChannelStyle |
| `LLM_MODEL_TRANSCRIPT_ANALYSIS` | нет | Анализ тона по субтитрам |
| `LLM_MODEL_ADVICE` | нет | 3 темы Advice |
| `LLM_MODEL_PLANNING` | нет | План ролика |
| `LLM_MODEL_RESEARCH_QUERIES` | нет | Поисковые запросы для fact research |
| `LLM_MODEL_FACT_EXTRACT` | нет | Извлечение фактов со страниц |
| `LLM_MODEL_WRITER` | нет | Написание главы |
| `LLM_MODEL_WRITER_REFINE` | нет | Refine главы |
| `LLM_MODEL_CHAPTER_SUMMARY` | нет | Резюме главы для следующих |
| `LLM_PRICE_INPUT_PER_1M` | нет | Оценка стоимости Research в UI ($/1M input tokens) |
| `LLM_PRICE_OUTPUT_PER_1M` | нет | То же для output |
| `LLM_EST_INPUT_TOKENS_PER_VIDEO` | нет | Оценка токенов на ролик в попапе Research |
| `LLM_EST_OUTPUT_TOKENS_PER_VIDEO` | нет | То же output |

Имена промптов в коде: `apps/api/src/modules/llm/prompt-names.ts`.

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

На вкладках **Plan**, **Fact research** и **Writer** блок **Project AI** сохраняет, **какие** из настроенных источников использовать для этого ролика (любая комбинация чекбоксов), а также опциональные overrides моделей **Research** и **Author (Writer)**.
| `SEARCH_RESULTS_PER_QUERY` | Сколько ссылок на запрос |
| `SEARCH_MAX_PAGES_PER_CHAPTER` | Лимит страниц на главу |
| `SEARCH_FETCH_TIMEOUT_MS` | Таймаут загрузки страницы |

---

## 3. Ваши ключи: Perplexity, Grok, Claude, Gemini

**Как устроено сейчас в коде**

- LLM: только **`mock`** или **`openai`** (`OpenAiLlmProvider` — SDK OpenAI, `response_format: json_object`, embeddings).
- Отдельных переменных `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROK_API_KEY`, `PERPLEXITY_API_KEY` **нет**.
- Fact research **не** использует Perplexity как поисковик — только Tavily / Brave / Reddit (или mock).

**Что можно сделать без доработки кода**

1. **OpenAI** — положить ключ в `OPENAI_API_KEY`, выставить `LLM_PROVIDER=openai`, модели в `LLM_MODEL_*`.
2. **Один «шлюз» с OpenAI-совместимым API** (OpenRouter, LiteLLM, Azure OpenAI и т.п.) — **пока не поддерживается**: в коде нет `OPENAI_BASE_URL`. Нужна небольшая доработка API.

**Что вы просите дополнительно (ещё не в UI)**

- Выбор **модели LLM на экране** для «research» и «автора» **на каждый ролик (проект)**.
- Сейчас:
  - модели задаются **только в `.env`** по типу промпта (одинаково для всех проектов);
  - «автор» в Writer — это **`authorOverlayChannelId`**: стилистические приёмы **исследованного канала** из БД, а не выбор Claude vs Gemini.

Это отдельная фича: поля в `Project`, API, экраны Research/Writer/Plan, провайдеры Anthropic/Google/xAI. Имеет смысл оформить отдельным этапом после базовых ключей.

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
- Карта промптов и Writer-слоёв: `PROMPTS.md`
- Smoke-тест API: `docs/API_SMOKE_TEST.md`
