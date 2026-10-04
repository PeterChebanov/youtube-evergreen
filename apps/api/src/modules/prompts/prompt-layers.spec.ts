import { buildLayers, OVERLAY_GUARD, renderLayers } from './prompt-layers';

const style = {
  voice: 'calm narrator',
  themes: 'stories behind familiar things',
  techniques: [{ name: 'Open loop', description: 'ask early, answer late' }],
  retentionRules: 'riddle in minute one',
};

const tone = {
  tone: 'warm',
  pace: 'measured',
  address: 'you',
  humor: 'dry',
  delivery: 'short',
  narrativeStructure: 'arc',
  retentionTechniques: [],
  phrases: ['here is the strange part'],
};

describe('writer prompt layers', () => {
  const prompt = renderLayers(
    buildLayers({
      base: ['WRITER BASE'],
      retentionBase: 'RETENTION BASE',
      channelStyle: style,
      genreModule: 'GENRE MODULE',
      overlay: { channelName: 'Utopia Show', techniques: [{ technique: 'Witness voice', description: 'quotes eyewitnesses' }] },
      toneReferences: [tone],
      dbPriority: 'DB PRIORITY',
    }),
  );

  it('stacks base, retention, channel voice, genre, overlay, tone and database in that order', () => {
    const order = ['WRITER BASE', 'RETENTION BASE', 'calm narrator', 'GENRE MODULE', 'Witness voice', 'here is the strange part', 'DB PRIORITY'];
    const positions = order.map((s) => prompt.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('merges channel retention rules into the retention base', () => {
    expect(prompt.indexOf('riddle in minute one')).toBeLessThan(prompt.indexOf('calm narrator'));
  });

  it('marks the single-author overlay as a supplement that never overrides the base', () => {
    expect(prompt).toContain(OVERLAY_GUARD);
    expect(prompt.indexOf(OVERLAY_GUARD)).toBeLessThan(prompt.indexOf('Witness voice'));
  });
});

describe('optional layers', () => {
  it('leaves out layers that have no content', () => {
    const prompt = renderLayers(buildLayers({ base: ['PLANNING'], overlay: { channelName: 'X', techniques: [] } }));
    expect(prompt).toBe('## Task\n\nPLANNING');
  });
});
