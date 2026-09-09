import type { Profession } from './types';
import { stickman } from './stickman';
import { dancer } from './dancer';
import { musician } from './musician';
import { chef } from './chef';

export const professions: Record<string, Profession> = {
  stickman,
  dancer,
  musician,
  chef,
};

export * from './types';
