import { expect, it } from 'vitest';
import type { MyVideoItem, ProjectDto } from '../../core/api.types';
import { scriptRows } from './videos.view';

const video = { id: 'm1', projectId: 'p0', title: 'Small towns', language: 'ru', durationMin: 52, topic: 'towns', finishedAt: '2026-09-28T10:00:00.000Z', genre: null, project: null } as MyVideoItem;
const project = (id: string, status: ProjectDto['status']) => ({ id, title: `Project ${id}`, status, language: 'en', topic: null }) as unknown as ProjectDto;

it('lists finished scripts first, then projects still in progress as drafts', () => {
  const rows = scriptRows([video], [project('p1', 'writing'), project('p2', 'done'), project('p3', 'plan_approved')]);
  expect(rows.map((r) => [r.key, r.finished, r.sub])).toEqual([
    ['m1', true, 'Finished 2026-09-28 · RU'],
    ['p1', false, 'Draft · writing · EN'],
    ['p3', false, 'Draft · researching facts · EN'],
  ]);
  expect(rows[0]).toMatchObject({ length: '52:00', project: 'towns' });
});
