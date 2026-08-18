/**
 * Bind Chunk 81 Candidate V2, Chunk 84 Mainnet RC, Chunk 82 providers,
 * Chunk 83 audit, Chunk 85 ceremony, and Chunk 86/87 hashed artifacts.
 *
 * Production mode rejects fixture/testnet/shadow/rehearsal artifacts.
 * Provider checks require only chain-launch dependencies unless policy
 * explicitly requires inactive regulated providers.
 */

import { defaultActivationMatrix } from '../mainnet/capabilities.ts';
import type { ProductionCapabilityActivation } from '../mainnet/types.ts';
import {
  consumeAuditEvidence,
  consumeCandidateV2,
  consumeMainnetRc,
  consumeProviderAcceptance,
  type ArtifactBinding,
} from '../production-ceremony/bindings.ts';
import { digestText } from './hash.ts';
import { artifactLooksLikeFixture, rejectProductionFixtureArtifact } from './identity.ts';
import type { LaunchExecutionMode } from './types.ts';

export type ExecutionBinding = {
  readonly present: boolean;
  readonly hash: string | null;
  readonly id: string | null;
  readonly verified: boolean;
  readonly fixtureClass: boolean;
  readonly usableForProduction: boolean;
};

function toExecutionBinding(bound: ArtifactBinding): ExecutionBinding {
  return Object.freeze({
    present: bound.present,
    hash: bound.hash,
    id: bound.id,
    verified: bound.verified,
    fixtureClass: artifactLooksLikeFixture(bound.id) || artifactLooksLikeFixture(bound.source),
    usableForProduction: bound.usableForProduction,
  });
}

export function bindCandidateV2(root = process.cwd()): ExecutionBinding {
  return toExecutionBinding(consumeCandidateV2(root));
}

export function bindMainnetRc(root = process.cwd()): ExecutionBinding {
  return toExecutionBinding(consumeMainnetRc(root));
}

export function providerReadinessHash(root = process.cwd()): string {
  const provider = consumeProviderAcceptance(root);
  return digestText(
    'SUNREY_GEX_PROVIDER_V1',
    provider.providerId,
    provider.acceptanceStatus,
    provider.productionEligible ? '1' : '0',
  );
}

export function auditSecurityState(root = process.cwd()): {
  readonly hash: string;
  readonly criticalBlockers: boolean;
} {
  const audit = consumeAuditEvidence(root);
  return {
    hash: digestText(
      'SUNREY_GEX_AUDIT_V1',
      audit.chunk83Present ? '1' : '0',
      audit.externalReviewStatus,
      audit.openCritical.join(','),
      audit.openHigh.join(','),
    ),
    criticalBlockers: audit.openCritical.length > 0,
  };
}

export function chainLaunchProviderOk(root = process.cwd()): boolean {
  const provider = consumeProviderAcceptance(root);
  // Regulated providers that remain intentionally inactive at genesis
  // are not required unless production policy explicitly requires them.
  return provider.acceptanceStatus !== 'ACCEPTED' || provider.productionEligible === false;
}

export function snapshotCapabilityMatrix(): readonly ProductionCapabilityActivation[] {
  return defaultActivationMatrix();
}

export function capabilityMatrixUnchanged(
  before: readonly ProductionCapabilityActivation[],
  after: readonly ProductionCapabilityActivation[],
): boolean {
  if (before.length !== after.length) {
    return false;
  }
  return before.every((row, index) => {
    const other = after[index]!;
    return (
      row.capability === other.capability &&
      row.genesis_enabled === other.genesis_enabled &&
      row.runtime_enabled === other.runtime_enabled &&
      row.human_authorized === other.human_authorized
    );
  });
}

export function rejectProductionBindings(mode: LaunchExecutionMode, bindings: readonly ExecutionBinding[]): void {
  if (mode !== 'PRODUCTION') {
    return;
  }
  for (const binding of bindings) {
    if (!binding.present || binding.hash === null || binding.id === null || !binding.verified) {
      throw new TypeError('FIXTURE_REJECTED_FROM_PRODUCTION');
    }
    if (binding.fixtureClass || !binding.usableForProduction) {
      throw new TypeError('FIXTURE_REJECTED_FROM_PRODUCTION');
    }
    rejectProductionFixtureArtifact(binding.id, 'binding');
    rejectProductionFixtureArtifact(binding.hash, 'binding-hash');
  }
}
