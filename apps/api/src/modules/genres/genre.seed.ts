/** Genre directions list; focus is a direction, not a boundary. */
export const GENRE_SEED: ReadonlyArray<{ name: string; focus: string; status: 'approved' | 'new' }> = [
  { name: 'Science & how things work', focus: 'Phenomena people never thought about; a familiar thing from an unexpected angle; shocking discoveries; the inner workings of what we only know from the outside', status: 'approved' },
  { name: 'Mysteries, legends & the unexplained', focus: 'Urban legends, hoaxes, eyewitness accounts, unexplained events; what can be explained and our hypotheses', status: 'approved' },
  { name: 'Historical figures', focus: 'The atmosphere and time a person lived in, what pressed on them, their circle, who they became and what their story teaches us', status: 'approved' },
  { name: 'Countries & cities', focus: 'How familiar things work for other people; unexpected contrasts; why it is done differently there', status: 'approved' },
  { name: 'Disasters & tragedies', focus: 'The chain of decisions and accidents behind a disaster; the minute before; the human factor and lessons. No relishing of victims', status: 'approved' },
  { name: 'True crime & unsolved cases', focus: 'Timeline, evidence, theories, false leads, resolution or its absence. Respect for victims, no gore', status: 'approved' },
  { name: 'Great scams & con artists', focus: 'How the scheme worked, why people believed, rise and fall, the psychology of deception', status: 'approved' },
  { name: 'Riddles of history & lost civilizations', focus: 'Artifacts, contradictions in sources, scholarly hypotheses, what is known for sure and what is not', status: 'approved' },
  { name: 'Rise & fall of companies and brands', focus: 'Founders, key decisions, fatal mistakes, unexpected twists', status: 'approved' },
  { name: 'Survival & expeditions', focus: 'Extreme conditions, decisions on the edge, human endurance, the cost of a mistake', status: 'approved' },
  { name: 'Psychology & famous experiments', focus: 'How the brain works, cognitive traps, experiments and their unexpected conclusions', status: 'approved' },
  { name: 'Secret projects & intelligence services', focus: 'Classified programmes, declassified documents, what was hidden and why. Not current politics', status: 'approved' },
  { name: 'Historical events & chains of cause', focus: 'How one event triggered others; the butterfly effect in history; how the world reached a turning point (e.g. the fall of the USSR)', status: 'new' },
  { name: 'Abandoned places & old towns', focus: 'How a place lived, why it emptied, what remains, the people and events tied to it', status: 'new' },
  { name: 'Closed worlds from the inside', focus: 'Systems ordinary people never enter: prisons, closed cities, professions, subcultures, communities; unwritten rules', status: 'new' },
  { name: 'Inventions & technology', focus: 'How an invention appeared, who was behind it, at what cost, how it changed the world; accidental discoveries', status: 'new' },
  { name: 'Money & economics', focus: 'How money really works, crises, bubbles, hyperinflation; simple explanations of complex mechanisms', status: 'new' },
  { name: 'Medicine, diseases & epidemics', focus: 'Great epidemics, medical breakthroughs and mistakes, strange diseases, how treatment changed', status: 'new' },
  { name: 'Art & culture: stories behind the works', focus: 'What stands behind famous paintings, films, songs and books; scandals, fates of the authors', status: 'new' },
  { name: 'How people lived in other eras', focus: 'Everyday life of the past: food, hygiene, work, fears, entertainment; contrast with today', status: 'new' },
  { name: 'Military history (not current wars)', focus: 'Key battles and operations of the past, commanders’ decisions, the role of chance, people’s fates', status: 'new' },
  { name: 'Space & natural phenomena', focus: 'Inexplicable and vast phenomena of nature and space, and how science explains them', status: 'new' },
];

export const defaultPromptModule = (focus: string) =>
  `Lean towards: ${focus}. This is a tilt, not a limit — any strong story with surprising facts fits.`;
