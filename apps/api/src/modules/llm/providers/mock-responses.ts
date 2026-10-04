import type { PromptName } from '../prompt-names';

type Input = Record<string, any>;

const pick = <T>(items: T[], seed: string): T => {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return items[h % items.length];
};

const firstSentence = (text: string) => (text.match(/[^.!?]{20,}[.!?]/)?.[0] ?? text.slice(0, 160)).trim();

/** Deterministic, schema-valid replies used when LLM_PROVIDER=mock. */
export const MOCK_RESPONSES: Record<PromptName, (input: Input) => unknown> = {
  video_basic: ({ genres = [], videos = [] }) => ({
    items: videos.map((v: Input) => ({
      videoId: v.videoId,
      topic: v.title,
      subtopic: v.chapters?.[0] ?? undefined,
      genre: genres.length ? pick(genres, v.title) : 'Science & how things work',
      contentType: /news|новост|breaking/i.test(v.title) ? 'news' : 'evergreen',
      format: v.chapters?.length ? 'chaptered documentary' : 'documentary',
      titleType: v.title.includes('?') ? 'question' : 'statement',
      hook: `What nobody tells you about ${v.title}`,
    })),
  }),
  video_structure: ({ title, chapters = [] }) => ({
    chapters: (chapters.length ? chapters : ['Cold open', 'The setup', 'The turn', 'The answer']).map(
      (c: Input | string, i: number) => ({
        title: typeof c === 'string' ? c : c.title,
        startTimestamp: typeof c === 'string' ? `${i * 12}:00` : c.startTimestamp,
        subsections: [
          { title: `${title}: question`, description: 'Raises the question of the chapter' },
          { title: `${title}: evidence`, description: 'Brings the key fact' },
        ],
      }),
    ),
  }),
  author_style: ({ videos = [] }) => {
    const ids = videos.map((v: Input) => v.id).slice(0, 3);
    return {
      techniques: [
        { technique: 'Cold open with a paradox', description: 'Starts from a contradiction and promises to resolve it.', exampleVideoIds: ids },
        { technique: 'Personal stake', description: 'Ties every chapter to a person the viewer can follow.', exampleVideoIds: ids.slice(0, 1) },
        { technique: 'Delayed reveal', description: 'Holds the main answer until the final third.', exampleVideoIds: [] },
      ],
    };
  },
  genre_practices: ({ genre, focus }) => ({
    retentionBestPractices: `In ${genre}: lead with a concrete scene, keep one open question per chapter, pay off the riddle late. Focus: ${focus}.`,
    promptModule: `Lean towards ${focus}. This is a tilt, not a limit: any strong story with surprising facts fits.`,
  }),
  channel_style: ({ authorStyles = [] }) => ({
    voice: 'Calm narrator who talks to one viewer, curious rather than preachy.',
    themes: 'Stories behind familiar things, told as a narrative with shocking turns.',
    techniques: authorStyles.slice(0, 5).map((s: Input) => ({
      name: s.technique,
      description: s.description,
      fromAuthorStyleIds: [s.id],
    })),
    retentionRules: 'Plant the riddle in the first minutes, answer it in the final third, end every chapter on a bridge.',
  }),
  transcript_analysis: () => ({
    tone: 'warm, ironic',
    pace: 'measured with fast bursts at reveals',
    address: 'speaks to the viewer as "you"',
    humor: 'dry asides',
    delivery: 'short sentences, rhetorical questions',
    narrativeStructure: 'cold open, context, escalation, reveal, reflection',
    retentionTechniques: ['open loop at minute one', 'callback to the opening'],
    phrases: ['But here is the strange part', 'Remember this, it matters later'],
  }),
  advice: ({ candidates = [] }) => {
    const ids: string[] = candidates.map((c: Input) => c.id);
    const title = (i: number) => candidates[i % candidates.length]?.title ?? 'Untitled';
    const topic = (type: 'rework' | 'analog', i: number) => ({
      type,
      title: type === 'rework' ? `${title(i)}: the full story` : `What ${title(i)} did not tell you`,
      topic: title(i),
      genre: candidates[i % candidates.length]?.genre ?? undefined,
      rationale: `Built on "${title(i)}", which outperforms its channel median.`,
      sourceVideoIds: [ids[i % ids.length]],
      draftChapters: ['Cold open', 'How it started', 'The turning point', 'What it means'].map((t) => ({
        title: t,
        subIdeas: [`${t} — key fact`],
      })),
      riddle: `Why did ${title(i)} end the way it did?`,
    });
    return { topics: [topic('rework', 0), topic('analog', 1), topic('analog', 2)] };
  },
  planning: ({ project = {}, feedback }) => {
    const subject = project.topic ?? project.title ?? 'the story';
    const titles = ['Cold open', 'The world before', 'The first crack', 'Escalation', 'The answer'];
    return {
      riddle: { question: `What really decided the fate of ${subject}?`, plantMin: 1, answerMin: 45 },
      chapters: titles.map((t, i) => ({
        title: feedback && i === 1 ? `${t} (revised)` : t,
        description: `${t} of ${subject}.`,
        lengthMin: i === 0 ? 4 : 12,
        subpoints: [`${t}: scene`, `${t}: fact`],
        hooks: [`Question that opens ${t.toLowerCase()}`],
        techniques: ['open loop'],
        ending: `Leaves the viewer asking what comes after ${t.toLowerCase()}`,
        bridge: 'But that was only the beginning.',
      })),
    };
  },
  research_queries: ({ chapter, topic }) => ({
    queries: [`${topic ?? ''} ${chapter?.title ?? ''}`.trim(), `${chapter?.title ?? topic} history facts`],
  }),
  fact_extract: ({ sources = [] }) => ({
    facts: sources.slice(0, 4).map((s: Input, i: number) => ({
      text: firstSentence(s.text || s.title || s.url),
      sourceUrl: s.url,
      sourceTitle: s.title,
      relations: i > 0 ? [{ toIndex: i - 1, kind: 'supports' }] : [],
    })),
  }),
  writer: ({ chapter = {}, facts = [], previouslyTold = [] }) => ({
    chapterText: [
      `${chapter.title}.`,
      previouslyTold.length ? `We already know ${previouslyTold.at(-1)}` : 'Imagine you are standing at the very start of this story.',
      chapter.description,
      ...facts.slice(0, 3).map((f: Input) => `${f.text}`),
      chapter.bridge || 'And this is where things get stranger.',
    ]
      .filter(Boolean)
      .join('\n\n'),
  }),
  writer_refine: ({ currentText = '', feedback }) => ({
    chapterText: `${currentText}\n\n${feedback ? `Revised for: ${feedback}.` : ''}`.trim(),
  }),
  chapter_summary: ({ text = '' }) => ({ summary: String(text).replace(/\s+/g, ' ').slice(0, 240) || 'empty chapter' }),
};
