import { z } from 'zod';

/** Legacy DB value; editorial policy is always global (see narrative-geography-global.md). */
export const caseGeographySchema = z.enum(['global']).default('global');

/** Tokens that must not appear in narration unless explicitly tied to a sourced rare exception fact. */
export const RF_NARRATIVE_FORBIDDEN_MARKERS = [
  'госуслуг',
  'сбербанк',
  'сбер ',
  ' руб',
  'рубл',
  'российск',
  ' рф',
  'москв',
] as const;
