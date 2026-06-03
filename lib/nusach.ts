export const NUSACH_OPTIONS = [
  'אשכנזי',
  'ספרדי ירושלמי',
  'מרוקאי',
  'תימני',
] as const;

export type Nusach = (typeof NUSACH_OPTIONS)[number];
