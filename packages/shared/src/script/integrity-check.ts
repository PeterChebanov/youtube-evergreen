import { RF_NARRATIVE_FORBIDDEN_MARKERS } from '../narrative/case-geography';
import { NARRATION_WORDS_PER_MINUTE, targetWordsForVideo } from '../video/target-duration';

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => normalize(p))
    .filter((p) => p.length >= 120);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type ScriptIntegrityIssue = { code: string; message: string };

export function checkScriptIntegrity(opts: { fullText: string; targetDurationMin: number }): ScriptIntegrityIssue[] {
  const issues: ScriptIntegrityIssue[] = [];
  const paras = paragraphs(opts.fullText);
  const seen = new Map<string, number>();
  for (const p of paras) {
    const n = (seen.get(p) ?? 0) + 1;
    seen.set(p, n);
    if (n === 2) {
      issues.push({
        code: 'duplicate_paragraph',
        message: 'A long paragraph appears twice in the script (possible chapter overlap or export bug).',
      });
      break;
    }
  }

  const words = countWords(opts.fullText);
  const band = targetWordsForVideo(opts.targetDurationMin, NARRATION_WORDS_PER_MINUTE);
  if (words < band.min * 0.85) {
    issues.push({
      code: 'short_script',
      message: `Spoken word count (~${words}) is well below target (~${band.target}) for ${opts.targetDurationMin} minutes.`,
    });
  }

  const lower = opts.fullText.toLowerCase();
  for (const marker of RF_NARRATIVE_FORBIDDEN_MARKERS) {
    if (lower.includes(marker)) {
      issues.push({
        code: 'rf_institution',
        message: `Narration contains "${marker.trim()}" — Russian/CIS institutions and currency are banned unless tied to a rare sourced exception.`,
      });
      break;
    }
  }

  const meta = [/следующей глав/i, /сжимаем время/i, /\*\*[^*]+\*\*/];
  for (const re of meta) {
    if (re.test(opts.fullText)) {
      issues.push({
        code: 'non_spoken_markup',
        message: 'Script contains director notes, markdown, or series meta — remove before recording.',
      });
      break;
    }
  }

  return issues;
}
