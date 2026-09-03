import type { Pool } from 'pg';

import {
  loadHumanEconomicState,
  persistHumanEconomicState,
  releaseActiveFingerprint,
  reserveActiveFingerprint,
  reserveMonetizationKey,
  reserveObservationReplayKey,
  reserveProofBoundClaimFingerprint,
  reserveVerifiedFingerprint,
  withHumanEconomicReservation,
  type HumanEconomicStateSnapshot,
  type ReservationResult,
} from '../../../packages/persistence/src/human-economic-contribution/pg-store.ts';

export type HumanEconomicPersistencePort = {
  load(): Promise<HumanEconomicStateSnapshot | null>;
  persist(snapshot: HumanEconomicStateSnapshot): Promise<void>;
  reserveActiveFingerprint(fingerprint: string, contributionId: string): Promise<ReservationResult>;
  releaseActiveFingerprint(fingerprint: string): Promise<void>;
  reserveVerifiedFingerprint(fingerprint: string, contributionId: string): Promise<ReservationResult>;
  reserveObservationReplayKey(replayKey: string, observationId: string): Promise<ReservationResult>;
  reserveMonetizationKey(monetizationKey: string, claimId: string): Promise<ReservationResult>;
  reserveProofBoundClaimFingerprint(
    fingerprint: string,
    economicClaimId: string,
    bodyCanonical: string,
  ): Promise<ReservationResult>;
};

export function createHumanEconomicPersistencePort(pool: Pool): HumanEconomicPersistencePort {
  return {
    load: () => loadHumanEconomicState(pool),
    persist: (snapshot) => persistHumanEconomicState(pool, snapshot),
    reserveActiveFingerprint: (fingerprint, contributionId) =>
      withHumanEconomicReservation(pool, (client) => reserveActiveFingerprint(client, fingerprint, contributionId)),
    releaseActiveFingerprint: (fingerprint) =>
      withHumanEconomicReservation(pool, (client) => releaseActiveFingerprint(client, fingerprint)),
    reserveVerifiedFingerprint: (fingerprint, contributionId) =>
      withHumanEconomicReservation(pool, (client) => reserveVerifiedFingerprint(client, fingerprint, contributionId)),
    reserveObservationReplayKey: (replayKey, observationId) =>
      withHumanEconomicReservation(pool, (client) => reserveObservationReplayKey(client, replayKey, observationId)),
    reserveMonetizationKey: (monetizationKey, claimId) =>
      withHumanEconomicReservation(pool, (client) => reserveMonetizationKey(client, monetizationKey, claimId)),
    reserveProofBoundClaimFingerprint: (fingerprint, economicClaimId, bodyCanonical) =>
      withHumanEconomicReservation(pool, (client) =>
        reserveProofBoundClaimFingerprint(client, fingerprint, economicClaimId, bodyCanonical),
      ),
  };
}

export type { HumanEconomicStateSnapshot, ReservationResult };
