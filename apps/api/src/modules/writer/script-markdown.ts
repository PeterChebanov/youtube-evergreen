import { formatDuration } from '@youtube-ai-tool/shared';

export type ScriptForExport = {
  title: string;
  targetDurationMin: number;
  riddle: string;
  chapters: Array<{ order: number; title: string; startMin: number; text: string | null }>;
};

export function buildScriptMarkdown(s: ScriptForExport): string {
  const parts = [`# ${s.title}`, `Target length: ${s.targetDurationMin} min · Riddle: ${s.riddle}`];
  for (const c of s.chapters) {
    parts.push(`## ${c.order}. ${c.title} (${formatDuration(Math.round(c.startMin * 60))})`);
    parts.push(c.text?.trim() || '_Not written yet._');
  }
  return `${parts.join('\n\n')}\n`;
}
