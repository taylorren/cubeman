import type { Profession } from './types';
import { stickman } from './stickman';

export const professions: Record<string, Profession> = {
  stickman,
};

export * from './types';
