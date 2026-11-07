/**
 * MD02 clock discipline — simulation/CI uses software wall clock, not hardware precision.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ClockDisciplineState, ClockOffsetObservation, ClockUncertainty } from './types.ts';
import type { ClockDisciplineStateKind, ClockSyncSource, TimestampPrecision } from './taxonomy.ts';

export function ciSoftwareClockDiscipline(observedAt: UtcInstant): ClockDisciplineState {
  const offset: ClockOffsetObservation = Object.freeze({
    observedAt,
    clockOffsetNs: 0n,
    referenceSource: 'SOFTWARE_WALL_CLOCK',
  });
  const uncertainty: ClockUncertainty = Object.freeze({
    clockUncertaintyNs: 5_000_000n,
    measuredAt: observedAt,
  });
  return Object.freeze({
    state: 'DEGRADED',
    syncSource: 'SOFTWARE_WALL_CLOCK',
    offset,
    uncertainty,
    hardwareTimestampingClaimed: false,
  });
}

export function clockDisciplineFromInfrastructure(input: {
  readonly observedAt: UtcInstant;
  readonly state: ClockDisciplineStateKind;
  readonly syncSource: ClockSyncSource;
  readonly clockOffsetNs: bigint;
  readonly clockUncertaintyNs: bigint;
  readonly hardwareTimestampingAvailable: boolean;
}): ClockDisciplineState {
  if (input.hardwareTimestampingAvailable && input.syncSource === 'HARDWARE_TIMESTAMP') {
    return Object.freeze({
      state: input.state,
      syncSource: 'HARDWARE_TIMESTAMP',
      offset: Object.freeze({
        observedAt: input.observedAt,
        clockOffsetNs: input.clockOffsetNs,
        referenceSource: 'HARDWARE_TIMESTAMP',
      }),
      uncertainty: Object.freeze({
        clockUncertaintyNs: input.clockUncertaintyNs,
        measuredAt: input.observedAt,
      }),
      hardwareTimestampingClaimed: true,
    });
  }
  return Object.freeze({
    state: input.syncSource === 'PTP' || input.syncSource === 'NTP' ? input.state : 'DEGRADED',
    syncSource: input.syncSource === 'HARDWARE_TIMESTAMP' ? 'NTP' : input.syncSource,
    offset: Object.freeze({
      observedAt: input.observedAt,
      clockOffsetNs: input.clockOffsetNs,
      referenceSource: input.syncSource === 'HARDWARE_TIMESTAMP' ? 'NTP' : input.syncSource,
    }),
    uncertainty: Object.freeze({
      clockUncertaintyNs: input.clockUncertaintyNs,
      measuredAt: input.observedAt,
    }),
    hardwareTimestampingClaimed: false,
  });
}

export function defaultReceiveTimestampPrecision(clock: ClockDisciplineState): TimestampPrecision {
  if (clock.hardwareTimestampingClaimed && clock.syncSource === 'HARDWARE_TIMESTAMP') {
    return 'NANOSECOND';
  }
  if (clock.syncSource === 'PTP') {
    return 'MICROSECOND';
  }
  if (clock.syncSource === 'NTP') {
    return 'MILLISECOND';
  }
  return 'MILLISECOND';
}
