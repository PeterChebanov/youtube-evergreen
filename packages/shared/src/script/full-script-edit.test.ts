import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatFullScript, parseFullScript } from './full-script-edit';

describe('full script edit', () => {
  it('round-trips chapter sections', () => {
    const raw = formatFullScript([
      { order: 1, title: 'Hook', text: 'Line one.' },
      { order: 2, title: 'Body', text: 'Line two.\n\nLine three.' },
    ]);
    const parsed = parseFullScript(raw);
    assert.equal(parsed.get(1), 'Line one.');
    assert.equal(parsed.get(2), 'Line two.\n\nLine three.');
  });
});
