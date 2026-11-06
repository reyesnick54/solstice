import { asUtcInstant } from '@solstice/domain';

import type { ComparablePeerObservation } from './engine.ts';

export const FIXTURE_VAL08_AS_OF = asUtcInstant('2026-11-01T00:00:00.000Z');

export function fixtureVal08Peers(knowableAt: typeof FIXTURE_VAL08_AS_OF): readonly ComparablePeerObservation[] {
  return Object.freeze([
    Object.freeze({ peerId: 'peer_a', evToEbitda: 11.2, knowableAt }),
    Object.freeze({ peerId: 'peer_b', evToEbitda: 10.4, knowableAt }),
    Object.freeze({ peerId: 'peer_c', evToEbitda: 12.1, knowableAt }),
    Object.freeze({ peerId: 'peer_d', evToEbitda: 9.8, knowableAt }),
  ]);
}
