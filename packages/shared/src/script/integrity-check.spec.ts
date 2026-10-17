import { describe, expect, it } from 'vitest';
import { checkScriptIntegrity } from './integrity-check';

describe('checkScriptIntegrity', () => {
  it('flags duplicate long paragraphs', () => {
    const block = 'A'.repeat(150);
    const issues = checkScriptIntegrity({
      fullText: `${block}\n\n${block}`,
      targetDurationMin: 52,
    });
    expect(issues.some((i) => i.code === 'duplicate_paragraph')).toBe(true);
  });

  it('flags RF institution markers in narration', () => {
    const issues = checkScriptIntegrity({
      fullText: 'Мошенник представился сотрудником Сбербанка и попросил код.',
      targetDurationMin: 52,
    });
    expect(issues.some((i) => i.code === 'rf_institution')).toBe(true);
  });
});
