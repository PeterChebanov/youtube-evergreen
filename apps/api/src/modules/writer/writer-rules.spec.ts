import { DomainError } from '../../common/domain-error';
import { assertCanWriteChapter, nextWritableChapter } from './chapter-gate';
import { buildScriptMarkdown } from './script-markdown';

describe('chapter gate', () => {
  it('opens chapters strictly in order', () => {
    expect(nextWritableChapter(4, new Set())).toBe(1);
    expect(nextWritableChapter(4, new Set([1, 2]))).toBe(3);
    expect(nextWritableChapter(2, new Set([1, 2]))).toBeNull();
  });

  it('allows writing the next chapter after the previous ones are approved', () => {
    expect(() => assertCanWriteChapter(3, 5, new Set([1, 2]))).not.toThrow();
  });

  it('refuses to skip ahead, rewrite an approved chapter or leave the plan', () => {
    for (const [order, approved] of [[3, [1]], [1, [1]], [6, [1, 2, 3, 4, 5]], [0, []]] as const) {
      expect(() => assertCanWriteChapter(order, 5, new Set(approved))).toThrow(DomainError);
    }
  });
});

describe('buildScriptMarkdown', () => {
  it('renders the title, riddle and every chapter with its start time', () => {
    const md = buildScriptMarkdown({
      title: 'The last day of Pripyat',
      targetDurationMin: 52,
      riddle: 'Why did nobody warn them?',
      chapters: [
        { order: 1, title: 'Cold open', startMin: 0, text: 'Imagine...' },
        { order: 2, title: 'The night', startMin: 6.5, text: null },
      ],
    });
    expect(md).toBe(
      '# The last day of Pripyat\n\nTarget length: 52 min · Riddle: Why did nobody warn them?\n\n' +
        '## 1. Cold open (0:00)\n\nImagine...\n\n## 2. The night (6:30)\n\n_Not written yet._\n',
    );
  });
});
