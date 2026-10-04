export const TABS = [
  { id: 'research', label: 'Research', key: 'r' },
  { id: 'advice', label: 'Advice', key: 'a' },
  { id: 'plan', label: 'Plan', key: 'p' },
  { id: 'facts', label: 'Facts', key: 'f' },
  { id: 'writer', label: 'Writer', key: 'w' },
  { id: 'subtitles', label: 'Subtitles', key: 's' },
  { id: 'database', label: 'Database', key: 'd' },
  { id: 'videos', label: 'My Videos', key: 'm' },
] as const;

/** Screens reachable from the jump palette but not shown as tabs. */
export const EXTRA_SCREENS = [{ id: 'style', label: 'Style and genres' }] as const;

export type ScreenId = (typeof TABS)[number]['id'] | (typeof EXTRA_SCREENS)[number]['id'];

const ALL_IDS: readonly string[] = [...TABS.map((t) => t.id), ...EXTRA_SCREENS.map((s) => s.id)];

export function screenFromHash(hash: string): ScreenId {
  const id = hash.replace(/^#\/?/, '');
  return (ALL_IDS.includes(id) ? id : 'research') as ScreenId;
}

const CHORD_MS = 1500;

/** "g" then a tab key jumps to that tab (DESIGN_SPEC 3). Returns the target, or null. */
export function createChordReader(now: () => number = Date.now) {
  let armedAt = -Infinity;
  return (key: string): ScreenId | null => {
    const k = key.toLowerCase();
    if (now() - armedAt <= CHORD_MS) {
      armedAt = -Infinity;
      const tab = TABS.find((t) => t.key === k);
      if (tab) return tab.id;
    }
    if (k === 'g') armedAt = now();
    return null;
  };
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
}
