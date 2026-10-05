// API responses for the layout check. Every list carries at least one 60+ character
// string without spaces (DESIGN_SPEC 8.6: channel name, topic title, fact, chapter name).
export const LONG = 'Unbroken_string_without_any_spaces_to_test_wrapping_and_truncation_0123456789';

const now = Date.now();
const iso = (daysFromNow, hour = 9) => {
  const d = new Date(now + daysFromNow * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const project = {
  id: 'p1',
  title: `Why small towns empty out faster than planned ${LONG}`,
  entryType: 'advice',
  status: 'writing',
  language: 'ru',
  targetDurationMin: 52,
  genreId: null,
  authorOverlayChannelId: null,
  toneReferenceVideoIds: ['v3'],
  useDatabase: false,
  topic: 'Small towns',
  searchProviders: ['tavily', 'brave'],
  llmModelOverrides: {},
};

const job = (status, stage, progress, extra = {}) => ({ id: `j-${status}`, status, stage, progress, error: null, pausedUntil: null, ...extra });

const channels = [
  { id: 'c1', youtubeChannelId: 'UC1', channelName: LONG, youtubeUrl: 'https://www.youtube.com/channel/UC1', researchStatus: 'ready', analysisError: null, lastResearchedAt: iso(-2), videoCount: 417, analyzedCount: 417, job: job('done', 'done', 100) },
  { id: 'c2', youtubeChannelId: 'UC2', channelName: 'Варламов', youtubeUrl: 'https://www.youtube.com/channel/UC2', researchStatus: 'analyzing', analysisError: null, lastResearchedAt: null, videoCount: 638, analyzedCount: 396, job: job('running', 'analyze', 62) },
  { id: 'c3', youtubeChannelId: 'UC3', channelName: 'Минаев Live', youtubeUrl: 'https://www.youtube.com/channel/UC3', researchStatus: 'collecting', analysisError: null, lastResearchedAt: null, videoCount: 120, analyzedCount: 0, job: job('paused_quota', 'collect', 35, { pausedUntil: iso(1), error: 'quota' }) },
  { id: 'c4', youtubeChannelId: 'UC4', channelName: 'Утопия Шоу', youtubeUrl: 'https://www.youtube.com/channel/UC4', researchStatus: 'analysis_failed', analysisError: 'LLM provider timed out', lastResearchedAt: null, videoCount: 236, analyzedCount: 180, job: job('failed', 'analyze', 70, { error: `LLM provider timed out after 3 retries ${LONG}` }) },
];

const channelDetail = (id) => ({
  id,
  channelName: channels.find((c) => c.id === id)?.channelName ?? LONG,
  stats: { videoCount: 417, medianViews: 1_200_000, averageDurationSec: 3120, chaptersPerVideo: 8 },
  authorStyles: [
    { id: 'a1', technique: 'Opening', description: 'Concrete scene, contradiction named before 2:00', order: 1 },
    { id: 'a2', technique: 'Rhythm', description: `An open question returns every 8–10 minutes ${LONG}`, order: 2 },
    { id: 'a3', technique: LONG, description: 'Dry, second person, short sentences', order: 3 },
  ],
});

const genres = [
  { id: 'g1', name: 'Urbanism', focus: 'How cities are planned and who pays', status: 'approved', promptModule: '', retentionBestPractices: null, topAuthors: [{ channelName: 'Варламов' }], videoCount: 120 },
  { id: 'g2', name: 'Economics', focus: 'Money behind everyday things', status: 'approved', promptModule: '', retentionBestPractices: null, topAuthors: null, videoCount: 88 },
  { id: 'g3', name: LONG, focus: LONG, status: 'new', promptModule: '', retentionBestPractices: null, topAuthors: [{ channelName: LONG }], videoCount: 3 },
];

const source = (title, views, channelName = 'Утопия Шоу') => ({ videoId: 'v1', title, channelName, views, durationSec: 3240, publishedAt: '2021-03-01T00:00:00.000Z', velocityPerDay: 900, relativeSuccess: 3.1 });
const draftChapters = [{ title: 'One', subIdeas: [] }, { title: 'Two', subIdeas: [] }, { title: 'Three', subIdeas: [] }];

const advice = {
  runId: 'r1',
  warnings: ['Topic 3 is close to a script in My Videos (similarity 0.81).'],
  topics: [
    { type: 'rework', title: `Why small towns empty out faster than planned ${LONG}`, topic: 'towns', rationale: 'Rebuilds a top evergreen with a new angle and fresh data.', sourceVideoIds: ['v1'], draftChapters, riddle: 'Where did the people go?', sources: [source('Почему пустеют города', 1_900_000)] },
    { type: 'analog', title: 'The hidden cost of cheap flights', topic: 'flights', rationale: 'Everyday object, the system behind it, who pays.', sourceVideoIds: ['v2'], draftChapters, riddle: LONG, sources: [source('Цена дешёвого билета', 2_430_000, LONG)] },
    { type: 'analog', title: 'Who actually owns your apartment building', topic: 'housing', rationale: 'Personal story, hidden owner, counter-case, twist.', sourceVideoIds: ['v3'], draftChapters, riddle: 'Whose name is on the deed?', sources: [source('Кому принадлежит дом', 988_100, 'Варламов'), source('x', 1, 'y')] },
  ],
};

const chapterTitles = ['Cold open', 'The promise of the quiet town', LONG, 'The town that bucked the trend', 'What the planners missed', 'Answer to the riddle, and what is next'];
const lengths = [3.5, 7.5, 11.5, 10.5, 10, 9];
let start = 0;
const planChapters = chapterTitles.map((title, i) => {
  const c = { order: i + 1, title, description: i === 2 ? LONG : `What chapter ${i + 1} sets up`, lengthMin: lengths[i], startMin: start, subpoints: [], hooks: i === 3 ? [LONG] : ['Open loop', 'Data reveal'], techniques: [], ending: '', bridge: '' };
  start += lengths[i];
  return c;
});
const plan = [
  { version: 2, feedback: 'shorter chapter 3', createdAt: iso(-1), content: { targetDurationMin: 52, riddle: { question: 'Where did the people go?', plantMin: 1.3, answerMin: 47.7 }, chapters: planChapters, dbDataUsed: ['find_videos'] } },
  { version: 1, feedback: null, createdAt: iso(-2), content: { targetDurationMin: 52, riddle: { question: 'Where did the people go?', plantMin: 1.3, answerMin: 47.7 }, chapters: planChapters, dbDataUsed: [] } },
];

const facts = {
  jobId: 'f1',
  status: 'done',
  chapters: planChapters.map((c) => ({ order: c.order, title: c.title, state: c.order === 5 ? 'run' : c.order === 6 ? 'queued' : 'done', factCount: 4 })),
  facts: [1, 2, 3].flatMap((order) => [
    { id: `${order}a`, planChapterOrder: order, iteration: 1, text: 'Local budget depends on headcount, not on who lives there.', sourceUrl: 'https://example.org/budget-rules', sourceTitle: 'Budget rules', relations: [{ factId: `${order}b`, kind: 'supports' }] },
    { id: `${order}b`, planChapterOrder: order, iteration: 1, text: `Registered population grew while real residents left. ${LONG}`, sourceUrl: `https://example.org/${LONG}/census-report-2024`, sourceTitle: null, relations: [{ factId: `${order}a`, kind: 'explains' }, { factId: `${order}c`, kind: 'contrasts' }] },
    { id: `${order}c`, planChapterOrder: order, iteration: 1, text: 'A resident thread describes closing shops and unchanged official figures.', sourceUrl: 'https://reddit.com/r/example/thread', sourceTitle: 'Thread found on Reddit', relations: [{ factId: `${order}b`, kind: 'anecdote' }] },
  ]),
};

const ru = 'В три часа дня на главной улице нет ни одной машины. Не потому что сегодня выходной, а потому что здесь уже пятый год почти никто не живёт.';
const script = {
  toneFromSubtitles: true,
  canFinalize: false,
  chapters: planChapters.map((c) => ({
    chapterOrder: c.order,
    title: c.title,
    version: c.order <= 3 ? 1 : 0,
    text: c.order <= 3 ? `${ru}\n\n${ru} ${LONG}` : '',
    summary: c.order <= 2 ? 'summary' : null,
    status: c.order <= 2 ? 'approved' : c.order === 3 ? 'draft' : 'todo',
  })),
};

const subtitleCheck = {
  scenario: 'not_in_db_channel_exists',
  youtubeVideoId: 'abc',
  youtubeTitle: `Почему закрываются заводы ${LONG}`,
  dbTitle: null,
  youtubeChannelId: 'UC9',
  channelName: LONG,
  channelInDb: true,
  channelStatus: 'partial',
  channelVideoCount: 212,
  durationSec: 3252,
  videoId: 'v9',
  transcriptStatus: 'done',
  transcriptAnalysis: { tone: 'Dry', pace: '148 words/min, pauses before reveals', address: 'Second person', humor: `Dry asides ${LONG}`, delivery: '', narrativeStructure: '', retentionTechniques: [], phrases: ['And here is the catch', LONG] },
};

const dbColumns = [
  ['id', 'text'], ['channel_id', 'text'], ['youtube_video_id', 'text'], ['title', 'text'], ['url', 'text'], ['published_at', 'timestamp without time zone'],
  ['views_at_research', 'integer'], ['duration_sec', 'integer'], ['description', 'text'], ['chapters_status', 'text'], ['transcript', 'text'], ['transcript_status', 'text'],
].map(([name, type]) => ({ name, type }));
const dbRow = (i) => ({
  id: `v_${String(i).padStart(5, '0')}`,
  channel_id: 'c1',
  youtube_video_id: `yt${i}`,
  title: i === 2 ? LONG : `Почему закрываются заводы ${i}`,
  url: `https://www.youtube.com/watch?v=yt${i}`,
  published_at: '2023-04-11 00:00:00',
  views_at_research: String(1_912_400 - i * 13),
  duration_sec: '3252',
  description: LONG,
  chapters_status: 'available',
  transcript: null,
  transcript_status: 'none',
});

const myVideos = [
  { id: 'm1', projectId: 'p0', title: `Why small towns empty out ${LONG}`, language: 'ru', durationMin: 52, topic: 'towns', finishedAt: iso(-6), genre: null, project: { title: LONG } },
  { id: 'm2', projectId: 'p2', title: 'The hidden cost of cheap flights', language: 'en', durationMin: 49, topic: 'flights', finishedAt: iso(-50), genre: null, project: { title: 'Money' } },
];

const style = { id: 's1', version: 3, voice: 'Calm and precise', themes: 'Hidden systems', techniques: [{ name: 'Cold open', description: LONG }], retentionRules: 'Question every 8 minutes', createdAt: iso(-10) };

/** Returns [status, body] for an API request, or null when unknown. */
export function respond(method, pathname, searchParams) {
  const m = (re) => pathname.match(re);
  if (pathname === '/ops/status') return [200, { api: 'ok', queues: { running: 1, queued: 1 }, youtubeQuota: { used: 6420, limit: 10000 }, llmSpendTodayUsd: 0.84, videoCount: 14382, styleUpdateSuggested: true }];
  if (pathname === '/ops/search-options') {
    return [200, [
      { id: 'tavily', label: 'Tavily', configured: true },
      { id: 'brave', label: 'Brave', configured: true },
      { id: 'perplexity_search', label: 'Perplexity Search', configured: false },
      { id: 'reddit', label: 'Reddit', configured: false },
    ]];
  }
  if (pathname === '/ops/llm-catalog') {
    const vendors = [
      { id: 'openai', label: 'GPT', modelRef: 'openai:gpt-4.1-mini', configured: true },
      { id: 'anthropic', label: 'Claude', modelRef: null, configured: false },
      { id: 'gemini', label: 'Gemini', modelRef: null, configured: false },
      { id: 'xai', label: 'Grok', modelRef: null, configured: false },
      { id: 'perplexity', label: 'Perplexity', modelRef: null, configured: false },
    ];
    const stages = [
      { id: 'planning', label: 'Plan', hint: 'Outline', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
      { id: 'plan_shallow_queries', label: 'Plan shallow search', hint: 'Queries', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
      { id: 'fact_research_queries', label: 'Fact search queries', hint: 'Queries', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
      { id: 'fact_extract', label: 'Fact extraction', hint: 'Facts', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
      { id: 'writer', label: 'Writer chapter', hint: 'Draft', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
      { id: 'writer_refine', label: 'Writer refine', hint: 'Refine', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
      { id: 'chapter_summary', label: 'Chapter summary', hint: 'Summary', projectScoped: true, defaultVendor: 'openai', defaultModel: 'openai:gpt-4.1-mini' },
    ];
    return [200, { vendors, stages }];
  }
  if (pathname === '/projects' && method === 'GET') return [200, [project, { ...project, id: 'p2', title: 'The quiet cost of free delivery', status: 'planning' }]];
  if (m(/^\/projects\/p1$/)) return [200, project];
  if (pathname === '/library/channels') return [200, channels];
  if (m(/^\/library\/channels\/(\w+)$/)) return [200, channelDetail(m(/^\/library\/channels\/(\w+)$/)[1])];
  if (pathname === '/genres') return [200, genres];
  if (pathname === '/advice' && method === 'POST') return [201, advice];
  if (m(/^\/projects\/\w+\/plan$/)) return [200, plan];
  if (m(/^\/projects\/\w+\/facts$/)) return [200, facts];
  if (m(/^\/projects\/\w+\/script$/)) return [200, script];
  if (pathname === '/subtitles/check') return [201, subtitleCheck];
  if (pathname === '/database/tables') return [200, ['videos', 'channels', 'video_analyses'].map((name) => ({ name, approxRows: 14382 }))];
  if (m(/^\/database\/tables\/\w+$/)) {
    const offset = Number(searchParams.get('offset') ?? 0);
    const limit = Number(searchParams.get('limit') ?? 100);
    const total = 14382;
    const rows = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, k) => dbRow(offset + k + 1));
    return [200, { table: 'videos', columns: dbColumns, rows, total }];
  }
  if (pathname === '/my-videos') return [200, myVideos];
  if (pathname === '/my-videos/memory') return [200, { indexed: 2, total: 2, closestPair: { a: { id: 'm1', title: LONG }, b: { id: 'm2', title: 'The hidden cost of cheap flights' }, similarity: 0.62 } }];
  if (pathname === '/style') return [200, style];
  return null;
}
