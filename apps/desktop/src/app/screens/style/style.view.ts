export type Technique = { name: string; description: string };

/** One technique per line: "Name — description" (an en dash, hyphen or colon also works). */
export function parseTechniques(text: string): Technique[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)\s*(?:—|–|-|:)\s+(.+)$/);
      return m ? { name: m[1].trim(), description: m[2].trim() } : { name: line, description: line };
    });
}

export const formatTechniques = (list: Technique[]) => list.map((t) => `${t.name} — ${t.description}`).join('\n');
