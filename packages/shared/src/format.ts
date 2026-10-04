export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimZero(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimZero(n / 1_000)}K`;
  return String(Math.round(n));
}

function trimZero(v: number): string {
  return v.toFixed(1).replace(/\.0$/, '');
}

export function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

export function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}
