/**
 * Canonical hashing for launch plans, permits, events, and reports.
 */

import { encodeBool, encodeString, encodeU32, encodeU64, sha256Hex } from '../validators/canonical.ts';
import type { LaunchEvent, ProductionLaunchPlan } from './types.ts';

export const LAUNCH_PLAN_DOMAIN = 'SUNREY_PRODUCTION_LAUNCH_PLAN_V1' as const;
export const LAUNCH_PERMIT_DOMAIN = 'SUNREY_LAUNCH_EXECUTION_PERMIT_V1' as const;
export const LAUNCH_EVENT_DOMAIN = 'SUNREY_LAUNCH_EVENT_V1' as const;
export const LAUNCH_REPORT_DOMAIN = 'SUNREY_LAUNCH_EXECUTION_REPORT_V1' as const;
export const LAUNCH_EVENT_GENESIS_PRIOR = 'GENESIS' as const;
export const FIXED_LAUNCH_UTC = '2026-01-01T00:00:00.000Z' as const;

export function digestText(...parts: readonly string[]): string {
  return sha256Hex(Buffer.concat(parts.map((part) => encodeString(part))));
}

export function launchPlanHashOf(plan: Omit<ProductionLaunchPlan, 'planHash'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(LAUNCH_PLAN_DOMAIN),
      encodeString(plan.planId),
      encodeU32(plan.planVersion),
      encodeString(plan.mode),
      encodeString(plan.mainnetRcId),
      encodeString(plan.mainnetRcHash),
      encodeString(plan.candidateV2Id),
      encodeString(plan.candidateV2Hash),
      encodeString(plan.environmentPlan.planHash),
      encodeString(plan.genesisManifestHash),
      encodeString(plan.genesisHash),
      encodeString(plan.genesisAuthorizationPackageHash),
      encodeString(plan.ceremonyTranscriptHash),
      encodeString(plan.providerReadinessHash),
      encodeString(plan.auditSecurityStateHash),
      encodeString(plan.preGenesisQualification.reportHash),
      encodeString(plan.allocationManifestHash),
      encodeString(plan.networkId),
      encodeString(plan.chainId),
      encodeString(plan.addressHrp),
      encodeString(plan.validatorSetHash),
      encodeString(plan.genesisTimePolicy.procedureId),
      encodeString(plan.genesisTimePolicy.state),
      encodeU64(plan.genesisTimePolicy.selectedUnixMs ?? 0n),
      encodeString(plan.tickerStatus),
      encodeBool(plan.usableForProduction),
      encodeBool(false),
      encodeBool(false),
    ]),
  );
}

export function permitHashOf(input: {
  readonly permitId: string;
  readonly launchPlanHash: string;
  readonly genesisHash: string;
  readonly rcHash: string;
  readonly candidateV2Hash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly authorizationSetHash: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string;
  readonly executionNonce: string;
}): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(LAUNCH_PERMIT_DOMAIN),
      encodeString(input.permitId),
      encodeString(input.launchPlanHash),
      encodeString(input.genesisHash),
      encodeString(input.rcHash),
      encodeString(input.candidateV2Hash),
      encodeString(input.networkId),
      encodeString(input.chainId),
      encodeString(input.authorizationSetHash),
      encodeString(input.validFromUtc),
      encodeString(input.validUntilUtc),
      encodeString(input.executionNonce),
      encodeBool(true),
    ]),
  );
}

export function launchEventHashOf(input: Omit<LaunchEvent, 'eventHash'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(LAUNCH_EVENT_DOMAIN),
      encodeU32(input.sequence),
      encodeString(input.actor),
      encodeString(input.actorKind),
      encodeString(input.eventClass),
      encodeString(input.inputHash),
      encodeString(input.result),
      encodeString(input.evidenceHash),
      encodeString(input.previousEventHash),
      encodeString(input.occurredAtUtc),
    ]),
  );
}

export function eventsTipHash(events: readonly LaunchEvent[]): string {
  if (events.length === 0) {
    return LAUNCH_EVENT_GENESIS_PRIOR;
  }
  return events[events.length - 1]!.eventHash;
}
