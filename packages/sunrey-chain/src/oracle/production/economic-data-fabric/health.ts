/**
 * Operational family health. Health is never a MoonRey factor.
 */

import type { FamilyHealthSnapshot, ProviderFamilyId } from './types.ts';
import { PROVIDER_FAMILY_IDS } from './types.ts';

export type FamilyHealthInput = {
  readonly familyId: ProviderFamilyId;
  readonly sourcesRegistered?: number;
  readonly sourcesSandboxAdmissible?: number;
  readonly sourcesSuspended?: number;
  readonly schemaFailures?: number;
  readonly staleObservations?: number;
  readonly totalObservations?: number;
  readonly authFailures?: number;
  readonly authAttempts?: number;
  readonly normalizationFailures?: number;
  readonly certificationExpiryCount?: number;
  readonly circuitOpenCount?: number;
};

function rateBps(failures: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.floor((failures * 10_000) / total);
}

export function familyHealth(input: FamilyHealthInput): FamilyHealthSnapshot {
  return Object.freeze({
    familyId: input.familyId,
    sourcesRegistered: input.sourcesRegistered ?? 0,
    sourcesSandboxAdmissible: input.sourcesSandboxAdmissible ?? 0,
    sourcesSuspended: input.sourcesSuspended ?? 0,
    schemaFailures: input.schemaFailures ?? 0,
    staleRateBps: rateBps(input.staleObservations ?? 0, input.totalObservations ?? 0),
    authFailureRateBps: rateBps(input.authFailures ?? 0, input.authAttempts ?? 0),
    normalizationFailures: input.normalizationFailures ?? 0,
    certificationExpiryCount: input.certificationExpiryCount ?? 0,
    circuitOpenCount: input.circuitOpenCount ?? 0,
    moonreyFactor: false,
  });
}

export function aggregateFamilyHealth(
  inputs: readonly FamilyHealthInput[],
): readonly FamilyHealthSnapshot[] {
  const byId = new Map(inputs.map((row) => [row.familyId, row]));
  return PROVIDER_FAMILY_IDS.map((familyId) => familyHealth(byId.get(familyId) ?? { familyId }));
}

export function healthIsNotMoonReyFactor(snapshots: readonly FamilyHealthSnapshot[]): boolean {
  return snapshots.every((row) => row.moonreyFactor === false);
}
