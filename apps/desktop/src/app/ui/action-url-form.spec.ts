import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('ActionUrlForm layout', () => {
  it('uses action-url-btn so primary buttons are not flex-shrunk', () => {
    const path = resolve(dirname(fileURLToPath(import.meta.url)), 'action-url-form.ts');
    const src = readFileSync(path, 'utf8');
    expect(src).toContain('action-url-btn');
    expect(src).toContain('action-url-row');
  });
});

describe('action-url-form CSS', () => {
  it('locks button min-width in components.css', () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/components.css'), 'utf8');
    expect(css).toContain('.app .action-url-btn');
    expect(css).toContain('min-width: max-content');
  });
});
