import { referencesDatabase } from './db-reference';

describe('referencesDatabase', () => {
  it.each([
    'Посмотри в базе, что было про Чернобыль',
    'возьми данные из БД',
    'use the database for examples',
    'check our library first',
    'как в ролике https://youtu.be/dQw4w9WgXcQ',
    'не повторяй мои ролики',
    'по данным ресерча',
  ])('detects an explicit reference: %s', (text) => {
    expect(referencesDatabase(text)).toBe(true);
  });

  it('detects a researched channel by name', () => {
    expect(referencesDatabase('сделай в стиле Варламова', ['Варламов'])).toBe(true);
  });

  it.each([
    'Расскажи историю падения СССР',
    'Why did the Titanic sink?',
    'базальт и вулканы',
    '',
  ])('leaves ordinary requests alone: %s', (text) => {
    expect(referencesDatabase(text, ['Ab'])).toBe(false);
  });
});
