import type { Profession } from './types';
import { stickman } from './stickman';
import { dancer } from './dancer';
import { musician } from './musician';
import { chef } from './chef';
import { painter } from './painter';
import { astronomer } from './astronomer';

export const professions: Record<string, Profession> = {
  stickman,
  dancer,
  musician,
  chef,
  painter,
  astronomer,
};

export * from './types';
