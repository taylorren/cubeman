import type { Profession } from './types';
import { stickman } from './stickman';
import { dancer } from './dancer';

export const professions: Record<string, Profession> = {
  stickman,
  dancer,
};

export * from './types';
