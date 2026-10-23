# Evergreen Studio UI specification

For an AI coding agent. Implement the interface **exactly** as the reference. If this file and the reference disagree, the reference (`reference/index.html` + `tokens.css` + `components.css`) wins. If this file and product requirements disagree on behavior, product requirements win.

## 0. How to use this package

| File | Role |
|---|---|
| `tokens.css` | All colors, fonts, sizes, spacing. Light and dark. Copy verbatim into the app's global styles. |
| `components.css` | Every component class. Copy verbatim. Do not restyle with a UI kit on top. |
| `reference/index.html` | Static, working reference of all 8 screens. Open it in a browser and compare. |
| `reference/screens/*.html` | The exact markup of each screen. Reuse the structure and class names. |
| `tokens.json` | Same tokens as data, for tooling. |
| `overflow-check.js`, `check-layout.js` | Automated layout test. Must pass (section 8). |
| `build.py` | Rebuilds `reference/index.html` from the fragments. Not part of the app. |

Target: Electron window with Angular. Keep the CSS framework-agnostic: put `tokens.css` and `components.css` in global styles and build Angular components that render the same markup and classes. Do not add Angular Material, Tailwind or similar.

The product UI is **English only**. Script text (Writer) may be Russian or English. The sample data in the reference is placeholder data.

## 1. Direction

"Console": dense, mono accents, one amber accent, 2px radius, tables over cards. Navigation is a **top bar** (not a sidebar). Status bar at the bottom shows live system state.

## 2. Tokens

Light is the base in `:root`. Dark applies when the OS is dark and `<html data-theme>` is not `light`, or when `data-theme="dark"`. Components must use tokens only. Never write a literal color in a component.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ECEDEF` | `#0F1013` | App background |
| `--panel` | `#F8F8F9` | `#15161B` | Panels, buttons, selects |
| `--side` | `#E1E2E6` | `#0B0C0F` | Top nav, status bar |
| `--fg` | `#1A1B20` | `#DCDDE3` | Text |
| `--mute` | `#666A75` | `#7E8190` | Secondary text, labels |
| `--line` | `#CFD1D8` | `#26272F` | All borders, progress track |
| `--acc` | `#B26B00` | `#F0B232` | The only accent: primary buttons, active tab, links, riddle |
| `--acc-fg` | `#FFFFFF` | `#14120A` | Text on `--acc` |
| `--soft` | `#F5E6CC` | `#2B2412` | Accent tint: selected row, chips, active list item, banners |
| `--ok` | `#1B7F4B` | `#4CC38A` | Ready, done, analyzed |
| `--warn` | `#A15C00` | `#E8A33D` | Paused, pending, quota |
| `--bad` | `#B3261E` | `#F0786E` | Errors, failed jobs |

Semantic colors (`--ok --warn --bad`) are never used as decoration.

### Typography

Fonts (Google Fonts): **Inter Tight** 400/500/600 for UI, **JetBrains Mono** 400/500 for data. Always keep the fallback stacks from `tokens.css`.

| Token | Size | Used for |
|---|---|---|
| `--t-2xs` | 10.5px | Uppercase labels (panel titles, table headers), pills, timeline text |
| `--t-xs` | 11.5px | Secondary lines, meta, chips, log |
| `--t-sm` | 12px | Brand, status bar base |
| `--t-base` | 13px | Body, tables, inputs, buttons (12.5px) |
| `--t-script` | 15px | Script reading text (line-height 1.7) |
| `--t-title` | 16px / 600 | Page title (one per screen) |
| `--t-num` | 15px mono 600 | Stat numbers |

Uppercase labels: `letter-spacing: 0.08em` (panel titles) or `0.05em` (table headers). Numbers in tables use `font-variant-numeric: tabular-nums`. Ids, dates, durations, counts, URLs, and job states use the mono font.

### Shape and spacing

Radius is `--r: 2px` for everything, pills and chips included. No shadows anywhere. Spacing scale: 4, 8, 12, 16, 24 (`--s1..--s5`). Page padding 12px 16px 16px. Gap between blocks 12px. Panel padding 10px 12px.

## 3. App shell

```
.app (grid rows: 38px | 1fr | 26px, min-width 1100px, height 100%)
├─ .topnav     brand · .tabs (8 tabs) · .nav-right (Jump ⌘K, Project selector)
├─ .main       scrolls vertically; holds exactly one visible .screen
└─ .statusbar  API · BullMQ · YouTube quota · LLM spend · Postgres
```

- Minimum window width is **1100px**. Below that the window must not shrink further (set Electron `minWidth: 1100`).
- Tabs, in order: Research, Advice, Plan, Facts, Writer, Subtitles, Database, My Videos. Labels are exactly these. The Facts tab opens the screen titled "Fact research".
- Active tab: `--fg`, weight 600, 2px `--acc` bottom border. Inactive: `--mute`.
- Keyboard: `g` then `r a p f w s d m` jumps to the tabs in order. `⌘K` / `Ctrl+K` opens the jump palette (not designed here; a simple command list is enough).
- The status bar always shows the five items. Values are live. The green dot is `--ok` when the local API is reachable and `--bad` otherwise.
- Theme follows the OS. No in-app toggle is required.

## 4. Component catalogue

All classes are defined in `components.css`. Use these names.

| Component | Class | Notes |
|---|---|---|
| Page head | `.page-head` > `h1` + `.sub`, `.actions` | One `h1` per screen. Actions on the right, wrap if narrow. |
| Panel | `.panel`, `.panel-flush` | Flush when it contains a table. `.panel-head` holds `h2` (uppercase label) and `.meta` (mono, right). |
| Grid | `.grid` + `.grid-research \| -advice \| -writer \| -facts \| -subs \| -videos` | Column templates are fixed per screen. Do not invent new ones. |
| Stack | `.stack` | Vertical column with 12px gap. |
| Table | `.table-scroll` > `table.tbl` + `<colgroup>` | See section 5. |
| Buttons | `.btn`, `.btn-primary`, `.btn-sm` | One primary button per page head or panel at most. |
| Field | `.field` | Input and textarea. Textarea height 72px, no resize. |
| URL bar | `.urlbar` | Input grows, button fixed. |
| Refine bar | `.refine` | Input grows, button fixed. |
| Select (mock) | `.select` | Mono, 11.5px, shows "Label: value ▾". |
| Segmented | `.seg` > `span.is-on` | Active segment uses `--fg` background. |
| Checkbox | `label.check` > `i` + `span` | `i.is-on` shows ✓ on `--acc`. |
| Pill | `.pill` + `-ok \| -warn \| -acc \| -bad` | Status. Mono 10.5px, 1px border in current color. |
| Chip | `.chip`, `.chip-riddle` | Hooks, riddles, relations. Riddle chips are solid `--acc`. |
| Progress | `.progress` (+ `-ok \| -warn`) in `.progress-row` | 5px high. Percent on the right in mono. |
| Stats | `.stats` > div > `.stat-n` + `.stat-l` | Two columns. |
| Key-value | `ul.kv` > `li` > `span` + `div` | Label column 84px. |
| Job log | `ul.log` | `b` states: done (`--ok`), `.is-run` (`--acc`), `.is-queued` (`--mute`), `.is-fail` (`--bad`). |
| Banner | `.banner` | Warning notice. Border `--warn`, fill `--soft`. |
| Empty state | `.empty` | Dashed border, bold title line plus one sentence. |
| Loading | `.skeleton` | 12px `--line` bar, 1.2s opacity pulse, no animation with reduced motion. |
| Field error | `.field-error` | 11.5px `--bad` text directly under the field. |
| Chapter list | `.chlist` > `a` (+ `.is-active`) | Name truncates with ellipsis, state in mono on the right. |
| Timeline | `.timeline` + `.tl-mark.from-left \| .from-right` | See section 6. |
| Script text | `.script` | 15px, line-height 1.7, `mark` for highlighted phrases. |
| Fact | `.fact` > text + `.url` + `.rel` | URL in mono and `--acc`. |

Interaction states: hover on `.btn` darkens the border; hover on `.tab` goes to `--fg`; keyboard focus shows a 2px `--acc` outline with 1px offset on buttons, fields and tabs. Selected table row: `tr.is-selected` with `--soft` fill. Disabled controls: 50% opacity, no hover.

## 5. No overflow (hard rules)

Nothing may leave its frame at any window width from 1100px up, in either theme. This was a defect in an earlier draft. Obey all of these:

1. Every grid and flex child can shrink: `min-width: 0`. Grid columns use `minmax(0, …)`.
2. Every `<table>` sits inside `.table-scroll` and has `table-layout: fixed` plus a `<colgroup>` with explicit column widths (percent or px, one column may be unsized).
3. Long text wraps (`overflow-wrap: anywhere`, the default for `td`) or truncates with the `.ell` class **and** a `title` attribute with the full text. Ids, dates and durations use `.nowrap` and get a column wide enough for them.
4. A column that holds a button must be at least `button width + 20px`. The Advice action column is 104px for a 75px button.
5. Absolutely positioned labels (timeline markers) are anchored to an edge and grow inward. Never center a label on a point near the edge.
6. The only allowed horizontal scroll is inside `.table-scroll` that wraps `.tbl-min` (the Database table, min width 960px).
7. Long titles, names, URLs and Russian text must be tested. Pseudo-long strings (60+ characters without spaces) must wrap or truncate, never overflow.

Run `node check-layout.js` (section 8) after every change to layout or content templates.

## 6. Screens

All screens render inside `.main` as `.screen` with the page head first. Sample values below are examples. Field names map to the API and Prisma entities in `apps/api`.

### 6.1 Research (`reference/screens/research.html`)

Purpose: add a reference channel and watch it become ready.

- Page head: title "Research", sub line, action "Refresh views".
- URL bar: input (channel URL), primary button "Add channel".
- Grid `.grid-research` (1.6fr / 1fr):
  - Left: panel "Channels" (meta "4 channels · 1 running · 1 paused"). Table columns 44% / 17% / 39%: Channel (name bold + secondary line), State (pill), Progress (progress bar + percent). First row selected. Secondary line examples: "417 long-form · synced 2 days ago", "396 of 638 videos analyzed", "YouTube quota reached. Resumes tomorrow 09:00".
  - Right stack: Jobs (BullMQ job log, 3 lines), Library stats for the selected channel (2×2: videos, median views, average length, chapters per video), AuthorStyle for the selected channel (Opening, Rhythm, Structure, Tone).
- States: Ready (ok pill, ok bar), Analyzing (acc pill, acc bar), Paused (warn pill, warn bar, reason in the secondary line), Failed (bad pill, reason in secondary line, row action "Retry"). Clicking a row selects it and updates the right column. Adding a URL with a bad format shows an inline error under the input in `--bad`.
- Empty: `.empty` "No channels yet" / "Paste a YouTube channel URL above to start."

### 6.2 Advice (`advice.html`)

Purpose: get three topics from the library, or send a custom request.

- Page head: title, sub, segmented control "Advice | Custom request". Both modes share this screen: the grid shows the Advice table and the Custom request panel together in the reference. The segmented control focuses one of them on narrow content; keep both visible at ≥1100px.
- Toolbar: selects "Period", "Genre" (multi), checkbox "Skip topics already in My Videos", primary "Get 3 topics".
- Left panel "Suggested topics" (meta "from library · no web search"). Table columns: `34px / 84px / 30% / 26% / 22% / 104px` = #, Type (pill "Rework" in acc or "Analogue" neutral), Topic (bold title + one explaining line), Source (e.g. "1.9M-view video" + channel and length; or "Structure match 91%" + channel), Riddle (chip), action button "Make plan". Exactly three rows: one Rework, two Analogue. Row 1 selected and its button primary.
- Right panel "Custom request": textarea, optional reference URL input, checkbox "Use my database for this request" (off by default), checkbox "Research the whole channel of the reference video into the database" (on when a URL is present), primary "Send". The database stays unused unless the first checkbox is on.
- States: loading shows three skeleton rows (`--line` blocks, no animation beyond a 1.2s opacity pulse); error shows a `.banner` above the table with the reason and a "Try again" button.

### 6.3 Plan (`plan.html`)

Purpose: review and refine the plan with sub-topics, timing, hooks and the mandatory riddle.

- Page head: "Plan · {topic}", sub "Target 52:00 · mandatory riddle planted at 1:20 and answered at 47:40." Action: primary "Send to research".
- Timeline panel: segments with `flex-grow` equal to chapter length in minutes, so widths are proportional. Alternating `--soft` and `--line` fills. Two markers: riddle planted (anchored left, `from-left`, positioned by percent of total length) and riddle answered (anchored right, `from-right`, positioned by `100 − percent`).
- Chapters panel: table `70px / 70px / 36% / rest`: Start, Length, Chapter (bold), Hooks (chips; riddle chips use `.chip-riddle`).
- Refine bar at the bottom: input + "Refine". Refine has no usage limit. Submitting replaces the table with a loading state, then the new plan.
- States: plan generating (skeleton rows), plan failed (banner + "Try again").

### 6.4 Fact research (`facts.html`)

Purpose: web research for each sub-chapter after plan approval. Facts only with URL, with connections between facts.

- Page head: action "Refine", primary "Send to writer".
- Grid `.grid-facts` (220px / 1fr): left chapter list with per-chapter state (done, run, queued); right panel "Facts · chapter N" (meta lists sources used) with table `34px / 42% / 28% / rest`: #, Fact, Source (mono URL), Connections (chips like "supports 2", "contrasts 4").
- A fact without a URL must not be shown. Failed search for a chapter shows `.empty` "No sourced facts found" with a "Search again" button.

### 6.5 Writer (`writer.html`)

Purpose: write the script chapter by chapter.

- Page head: "Writer · chapter 3 of 6". Actions "Next chapter", primary "Export Markdown".
- Grid `.grid-writer` (212px / 1fr / 280px): chapter list (done, writing, todo); center stack with script panel (meta shows whether tone from subtitles is on) and a refine bar; right panel "Facts · chapter N" with `.fact` items.
- Script text is Russian or English according to the project. Highlighted phrases use `mark`.
- "Next chapter" writes the next chapter using summaries of the earlier ones. After the last chapter the primary button becomes "Send to My Videos".

### 6.6 Subtitles (`subtitles.html`)

Purpose: fetch subtitles for one video and get a tone analysis for Writer.

- URL bar with "Check video".
- Grid `.grid-subs` (1.2fr / 1fr): left "Check result" (key-value: Title, Channel with partial-library note, In database as pill, Length), a `.banner` for the "not in database" scenario, and two actions "Add video and analyze" (primary) and "Research whole channel". Right "Transcript analysis": Pace, Address, Humor, Phrases (chips), action "Use in Writer".
- Scenarios: found in database (pill ok, no banner), not found (warn pill + banner), partial channel (channel line notes the count).

### 6.7 Database (`database.html`)

Purpose: read-only view of the data as stored.

- Toolbar: table select, filter input (220px), right side: row count in mono, "Copy cell", primary "Copy table".
- One flush panel with the data table inside `.table-scroll`, `table.tbl.tbl-min` (min width 960px). Columns: video_id 88, channel 156, title (rest), published 108, length 72, views 100 (right), chapters 96 (right), genre 100, status 100.
- Selected cell/row is highlighted with `tr.is-selected`. Copy cell copies the selected cell text. Copy table copies tab-separated rows with a header line.
- Must stay usable with thousands of rows: use virtual scrolling (Angular CDK `cdk-virtual-scroll` is allowed for behavior only; keep the markup and classes). Table header stays visible while scrolling.
- Footer line under the table: loaded range left, selected cell reference in mono right.

### 6.8 My Videos (`videos.html`)

Purpose: library of finished scripts, used so Advice does not repeat topics.

- Page head: action "Export Markdown" (exports the selected script).
- Grid `.grid-videos` (1.7fr / 1fr): left table `44% / 17% / 12% / 27%`: Title (+ secondary line "Finished date · language"), Project, Length, Status (pills: finished or draft, plus indexed or indexing). Right panel "Topic memory" (meta "pgvector"): Indexed count, Used by, Closest pair with similarity.

## 7. Content rules

- English UI labels only. Sentence case. No emoji. No exclamation marks.
- Button text states the action: "Add channel", "Get 3 topics", "Send to research", "Export Markdown".
- Placeholders in inputs are examples, not instructions to type ("Refine the plan: shorten chapter 3, add a counter-example…").
- Numbers: thousands separated by commas, durations as `m:ss` or `h:mm:ss`, dates as `YYYY-MM-DD`.

## 8. Acceptance checklist

1. `tokens.css` and `components.css` are used unchanged (additions allowed, edits to existing rules are not).
2. All 8 screens match the reference at 1100, 1280 and 1600 px wide, in light and dark.
3. `node check-layout.js` prints `ALL CLEAR` (needs `npm i -D playwright`). It loads `reference/index.html`; point `url` at the running app and map the tab selectors to run the same check on the real UI. The same check can be run by hand: paste `overflow-check.js` into DevTools and call `window.__checkOverflow()` on each screen. An empty list means pass.
4. Keyboard: all tabs and buttons are reachable with Tab and show a focus ring.
5. No literal colors, no shadows, no radius other than `--r`.
6. Long-content test: put a 60-character unbroken string into a channel name, a topic title, a fact, and a chapter name. Re-run the check. It must still pass.

## 9. Not designed here

Jump palette (⌘K), project selector menu, settings (API keys for YouTube, LLM and search), confirm dialogs, toasts. Build them from the same components: `.panel` for surfaces, `.btn` for actions, `.banner` for notices.
