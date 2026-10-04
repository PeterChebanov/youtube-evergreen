export type ResearchCostEstimateInput = {
  videoCount: number;
  estInputTokensPerVideo: number;
  estOutputTokensPerVideo: number;
  priceInputPer1M: number;
  priceOutputPer1M: number;
};

export type ResearchCostEstimate = {
  videoCount: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedUsd: number;
};

/** Rough cost for basic AI analysis of N videos (Research confirm dialog). */
export function estimateBasicAnalysisCost(
  input: ResearchCostEstimateInput,
): ResearchCostEstimate {
  const videoCount = Math.max(0, Math.floor(input.videoCount));
  const estimatedInputTokens = videoCount * input.estInputTokensPerVideo;
  const estimatedOutputTokens = videoCount * input.estOutputTokensPerVideo;
  const estimatedUsd =
    (estimatedInputTokens / 1_000_000) * input.priceInputPer1M +
    (estimatedOutputTokens / 1_000_000) * input.priceOutputPer1M;

  return {
    videoCount,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedUsd: Math.round(estimatedUsd * 10000) / 10000,
  };
}
