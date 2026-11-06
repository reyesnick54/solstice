import { asUtcInstant } from '@solstice/domain';

import type { SotpSegment } from './engine.ts';

export const FIXTURE_VAL09_AS_OF = asUtcInstant('2026-11-01T00:00:00.000Z');

export function fixtureVal09Segments(): readonly SotpSegment[] {
  const cloud = Array.from({ length: 32 }, (_, i) => 18 + (i % 5) * 0.4);
  const legacy = Array.from({ length: 32 }, (_, i) => 9 + (i % 4) * 0.25);
  return Object.freeze([
    Object.freeze({
      segmentId: 'cloud',
      label: 'Cloud Services',
      valuePerShareSamples: Object.freeze(cloud),
    }),
    Object.freeze({
      segmentId: 'legacy',
      label: 'Legacy Software',
      valuePerShareSamples: Object.freeze(legacy),
    }),
  ]);
}
