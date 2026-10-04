import { expect, it } from 'vitest';
import { formatTechniques, parseTechniques } from './style.view';

it('reads one technique per line with a dash or colon separator', () => {
  expect(parseTechniques('Cold open — a concrete scene\n\n Rhythm: question every 8 minutes \nPlain line')).toEqual([
    { name: 'Cold open', description: 'a concrete scene' },
    { name: 'Rhythm', description: 'question every 8 minutes' },
    { name: 'Plain line', description: 'Plain line' },
  ]);
});

it('writes techniques back in the same form', () => {
  const list = [{ name: 'Cold open', description: 'a concrete scene' }];
  expect(parseTechniques(formatTechniques(list))).toEqual(list);
});
