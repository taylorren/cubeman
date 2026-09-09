import type { Profession } from './types';
import { stickman } from './stickman';
import { dancer } from './dancer';
import { musician } from './musician';

export const professions: Record<string, Profession> = {
  stickman,
  dancer,
  musician,
};

export * from './types';
