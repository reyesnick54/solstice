/**
 * ACCESS-18 — HIN-side adapter for access participation evidence.
 *
 * Emits settled SR balance signals only. Personal data never crosses this port.
 */

import type { Result } from '../../../../domain/src/result.ts';
import { ok } from '../../../../domain/src/result.ts';

export type AccessParticipationRecorderPort = {
  readonly recordSettledBalanceObservation: (input: {
    readonly subjectRef: string;
    readonly observedAt: string;
    readonly balanceMinor: bigint;
    readonly settlementRef: string;
    readonly replayKey: string;
  }) => Result<{ readonly recorded: true }, { readonly code: string; readonly message: string }>;
};

export type HinAccessIntegrationAdapterOptions = {
  readonly participation: AccessParticipationRecorderPort;
};

export class HinAccessIntegrationAdapter {
  private readonly participation: AccessParticipationRecorderPort;

  constructor(options: HinAccessIntegrationAdapterOptions) {
    this.participation = options.participation;
  }

  recordCompensationBalance(input: {
    readonly subjectRef: string;
    readonly observedAt: string;
    readonly balanceMinor: bigint;
    readonly settlementRef: string;
    readonly replayKey: string;
  }): Result<{ readonly recorded: true; readonly dataUsedForAccessWeighting: false }, { readonly code: string; readonly message: string }> {
    const recorded = this.participation.recordSettledBalanceObservation({
      subjectRef: input.subjectRef,
      observedAt: input.observedAt,
      balanceMinor: input.balanceMinor,
      settlementRef: input.settlementRef,
      replayKey: input.replayKey,
    });
    if (!recorded.ok) {
      return recorded;
    }
    return ok({ recorded: true, dataUsedForAccessWeighting: false });
  }
}

export function createHinAccessIntegrationAdapter(
  options: HinAccessIntegrationAdapterOptions,
): HinAccessIntegrationAdapter {
  return new HinAccessIntegrationAdapter(options);
}

export const HIN_ACCESS_INTEGRATION_BOUNDARY = Object.freeze({
  chunk: 'ACCESS-18',
  dependencyDirection: 'information-market -> access participation recorder port',
  personalDataCrossesBoundary: false,
  consentEqualsMint: false,
  cleanRoomEqualsMint: false,
  onlySettledSrAffectsTwab: true,
});
