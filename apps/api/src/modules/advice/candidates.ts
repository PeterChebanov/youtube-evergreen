import { cosineSimilarity, maxSimilarity } from '../../common/vector';
import { lifetimeVelocity, relativeSuccess, snapshotVelocity } from './metrics';

export type CandidateInput = {
  videoId: string;
  channelId: string;
  views: number;
  publishedAt: Date;
  snapshots: Array<{ researchedAt: Date; views: number }>;
  embedding: number[] | null;
};

export type RankedCandidate = CandidateInput & {
  velocityPerDay: number;
  relativeSuccess: number;
  score: number;
};

export type RankingContext = {
  now: Date;
  channelMedians: ReadonlyMap<string, number>;
  myVideoEmbeddings: ReadonlyArray<readonly number[]>;
  recentLibraryEmbeddings: ReadonlyArray<readonly number[]>;
  themeEmbedding?: readonly number[] | null;
  limit: number;
};

/** Above this cosine similarity a candidate repeats a video we already made. */
export const DUPLICATE_SIMILARITY = 0.85;
/** Above this similarity the topic has been covered recently in the niche. */
const RECENT_SIMILARITY = 0.8;
const RECENT_PENALTY = 0.5;

/**
 * Ranks library videos as Advice sources: success relative to the channel,
 * damped by velocity, minus topics we already made or that were just covered,
 * weighted towards the optional theme (REQUIREMENTS 2.3–2.7).
 */
export function rankCandidates(inputs: CandidateInput[], ctx: RankingContext): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  for (const c of inputs) {
    if (c.embedding && maxSimilarity(c.embedding, ctx.myVideoEmbeddings) >= DUPLICATE_SIMILARITY) continue;
    const velocityPerDay = snapshotVelocity(c.snapshots) ?? lifetimeVelocity(c.views, c.publishedAt, ctx.now);
    const rel = relativeSuccess(c.views, ctx.channelMedians.get(c.channelId) ?? 0);
    let score = rel * Math.log10(10 + velocityPerDay);
    if (c.embedding && maxSimilarity(c.embedding, ctx.recentLibraryEmbeddings) >= RECENT_SIMILARITY) score *= RECENT_PENALTY;
    if (ctx.themeEmbedding && c.embedding) score *= 0.25 + Math.max(0, cosineSimilarity(c.embedding, ctx.themeEmbedding));
    ranked.push({ ...c, velocityPerDay: Math.round(velocityPerDay), relativeSuccess: Math.round(rel * 100) / 100, score });
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, ctx.limit);
}
