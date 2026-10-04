import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateBasicAnalysisCost } from './cost-estimate';

test('estimateBasicAnalysisCost returns zero for empty library', () => {
  const r = estimateBasicAnalysisCost({
    videoCount: 0,
    estInputTokensPerVideo: 500,
    estOutputTokensPerVideo: 120,
    priceInputPer1M: 0.15,
    priceOutputPer1M: 0.6,
  });
  assert.equal(r.videoCount, 0);
  assert.equal(r.estimatedUsd, 0);
});

test('estimateBasicAnalysisCost scales linearly with video count', () => {
  const one = estimateBasicAnalysisCost({
    videoCount: 1,
    estInputTokensPerVideo: 1_000_000,
    estOutputTokensPerVideo: 0,
    priceInputPer1M: 1,
    priceOutputPer1M: 0,
  });
  const two = estimateBasicAnalysisCost({
    videoCount: 2,
    estInputTokensPerVideo: 1_000_000,
    estOutputTokensPerVideo: 0,
    priceInputPer1M: 1,
    priceOutputPer1M: 0,
  });
  assert.equal(two.estimatedUsd, one.estimatedUsd * 2);
});
