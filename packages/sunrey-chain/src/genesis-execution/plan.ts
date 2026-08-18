/**
 * ProductionLaunchPlan construction and verification.
 *
 * Binds the exact Mainnet RC, Candidate V2, environment plan, genesis
 * package, ceremony, provider, audit, pre-genesis qualification,
 * allocation, human-authorization policy, network, and chain.
 * Any material change produces a new plan hash.
 */

import { allocationManifestHash } from '../mainnet/allocation.ts';
import { rehearsalZeroAllocation } from '../production-ceremony/genesis.ts';
import type { GenesisTimePolicy } from '../production-ceremony/types.ts';
import { launchPlanHashOf, digestText } from './hash.ts';
import {
  EXECUTION_REHEARSAL_ADDRESS_HRP,
  EXECUTION_REHEARSAL_CANDIDATE_V2_ID,
  EXECUTION_REHEARSAL_CHAIN_ID,
  EXECUTION_REHEARSAL_ID,
  EXECUTION_REHEARSAL_MAINNET_RC_ID,
  EXECUTION_REHEARSAL_NETWORK_ID,
  assertExecutionRehearsalIdentity,
  rejectProductionFixtureArtifact,
} from './identity.ts';
import type {
  PreGenesisQualificationReport,
  ProductionEnvironmentPlan,
  ProductionLaunchPlan,
} from './types.ts';
import { REQUIRED_LAUNCH_HUMAN_ROLES } from './types.ts';

export function environmentPlanHashOf(plan: Omit<ProductionEnvironmentPlan, 'planHash'>): string {
  return digestText(
    'SUNREY_PRODUCTION_ENVIRONMENT_PLAN_V1',
    plan.planId,
    plan.source,
    plan.networkId,
    plan.chainId,
    plan.topologyDigest,
    plan.providerBindingHash,
    plan.observedDeploymentHash,
    plan.allowedVarianceCodes.join(','),
    plan.fixtureClass ? '1' : '0',
  );
}

export function preGenesisQualificationHashOf(
  report: Omit<PreGenesisQualificationReport, 'reportHash'>,
): string {
  return digestText(
    'SUNREY_PRE_GENESIS_QUALIFICATION_V1',
    report.reportId,
    report.source,
    report.qualificationState,
    report.genesisHashBound,
    report.candidateV2HashBound,
    report.mainnetRcHashBound,
    report.ceremonyTranscriptHashBound,
    report.fixtureClass ? '1' : '0',
  );
}

export function isolatedRehearsalEnvironmentPlan(input: {
  readonly networkId: string;
  readonly chainId: string;
  readonly providerBindingHash: string;
}): ProductionEnvironmentPlan {
  const base = {
    schemaVersion: 1 as const,
    planId: `${EXECUTION_REHEARSAL_ID}.environment`,
    source: 'REHEARSAL_ISOLATED' as const,
    networkId: input.networkId,
    chainId: input.chainId,
    topologyDigest: digestText('SUNREY_GEX_TOPOLOGY_V1', input.networkId, 'seven-validator'),
    providerBindingHash: input.providerBindingHash,
    observedDeploymentHash: digestText('SUNREY_GEX_OBSERVED_V1', input.networkId, input.chainId),
    allowedVarianceCodes: Object.freeze(['CLOCK_SKEW_MS<=500', 'DISK_HEADROOM_PCT>=10']) as readonly string[],
    fixtureClass: true,
    usableForProduction: false,
  };
  return Object.freeze({ ...base, planHash: environmentPlanHashOf(base) });
}

export function isolatedRehearsalPregenesis(input: {
  readonly genesisHash: string;
  readonly candidateV2Hash: string;
  readonly mainnetRcHash: string;
  readonly ceremonyTranscriptHash: string;
}): PreGenesisQualificationReport {
  const base = {
    schemaVersion: 1 as const,
    reportId: `${EXECUTION_REHEARSAL_ID}.pregenesis`,
    source: 'REHEARSAL_ISOLATED' as const,
    qualificationState: 'QUALIFIED_REHEARSAL' as const,
    genesisHashBound: input.genesisHash,
    candidateV2HashBound: input.candidateV2Hash,
    mainnetRcHashBound: input.mainnetRcHash,
    ceremonyTranscriptHashBound: input.ceremonyTranscriptHash,
    fixtureClass: true,
    usableForProduction: false,
  };
  return Object.freeze({ ...base, reportHash: preGenesisQualificationHashOf(base) });
}

export function rehearsalGenesisTimePolicy(): GenesisTimePolicy {
  return Object.freeze({
    procedureId: 'sunrey.genesis-time.authorized-execution.rehearsal.v1',
    state: 'AUTHORIZED',
    selectedUnixMs: 1_767_225_600_000n,
    selectedUtc: '2026-01-01T00:00:00.000Z',
    usesDeveloperLocalClock: false,
    notes: 'Chunk 85 authorized genesis-time policy consumed exactly. Rehearsal fixture only.',
  });
}

export function createRehearsalLaunchPlan(input: {
  readonly mainnetRcHash: string;
  readonly candidateV2Hash: string;
  readonly genesisHash: string;
  readonly genesisManifestHash: string;
  readonly genesisAuthorizationPackageHash: string;
  readonly ceremonyTranscriptHash: string;
  readonly providerReadinessHash: string;
  readonly auditSecurityStateHash: string;
  readonly validatorSetHash: string;
}): ProductionLaunchPlan {
  assertExecutionRehearsalIdentity(
    EXECUTION_REHEARSAL_NETWORK_ID,
    EXECUTION_REHEARSAL_CHAIN_ID,
    EXECUTION_REHEARSAL_ADDRESS_HRP,
  );
  const allocation = rehearsalZeroAllocation();
  const environmentPlan = isolatedRehearsalEnvironmentPlan({
    networkId: EXECUTION_REHEARSAL_NETWORK_ID,
    chainId: EXECUTION_REHEARSAL_CHAIN_ID,
    providerBindingHash: input.providerReadinessHash,
  });
  const preGenesisQualification = isolatedRehearsalPregenesis({
    genesisHash: input.genesisHash,
    candidateV2Hash: input.candidateV2Hash,
    mainnetRcHash: input.mainnetRcHash,
    ceremonyTranscriptHash: input.ceremonyTranscriptHash,
  });
  const draft: Omit<ProductionLaunchPlan, 'planHash'> = {
    schemaVersion: 1,
    planId: `${EXECUTION_REHEARSAL_ID}.plan`,
    planVersion: 1,
    mode: 'REHEARSAL',
    mainnetRcId: EXECUTION_REHEARSAL_MAINNET_RC_ID,
    mainnetRcHash: input.mainnetRcHash,
    candidateV2Id: EXECUTION_REHEARSAL_CANDIDATE_V2_ID,
    candidateV2Hash: input.candidateV2Hash,
    environmentPlan,
    genesisManifestHash: input.genesisManifestHash,
    genesisHash: input.genesisHash,
    genesisAuthorizationPackageHash: input.genesisAuthorizationPackageHash,
    ceremonyTranscriptHash: input.ceremonyTranscriptHash,
    providerReadinessHash: input.providerReadinessHash,
    auditSecurityStateHash: input.auditSecurityStateHash,
    preGenesisQualification,
    allocationManifestHash: allocationManifestHash(allocation),
    allocation,
    requiredHumanRoles: REQUIRED_LAUNCH_HUMAN_ROLES,
    requiredApprovals: REQUIRED_LAUNCH_HUMAN_ROLES.length,
    genesisTimePolicy: rehearsalGenesisTimePolicy(),
    networkId: EXECUTION_REHEARSAL_NETWORK_ID,
    chainId: EXECUTION_REHEARSAL_CHAIN_ID,
    addressHrp: EXECUTION_REHEARSAL_ADDRESS_HRP,
    validatorSetHash: input.validatorSetHash,
    tickerStatus: 'NOT_ASSIGNED',
    usableForProduction: false,
    realProductionExecutionPerformed: false,
    mainnetEnabled: false,
  };
  return Object.freeze({ ...draft, planHash: launchPlanHashOf(draft) });
}

export function verifyLaunchPlan(plan: ProductionLaunchPlan): { readonly ok: boolean; readonly reason: string | null } {
  if (plan.mode === 'REHEARSAL') {
    try {
      assertExecutionRehearsalIdentity(plan.networkId, plan.chainId, plan.addressHrp);
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
    if (plan.usableForProduction || plan.mainnetEnabled) {
      return { ok: false, reason: 'rehearsal plan cannot be production-usable' };
    }
  } else {
    try {
      rejectProductionFixtureArtifact(plan.networkId, 'network');
      rejectProductionFixtureArtifact(plan.chainId, 'chain');
      rejectProductionFixtureArtifact(plan.mainnetRcId, 'mainnet-rc');
      rejectProductionFixtureArtifact(plan.candidateV2Id, 'candidate-v2');
      rejectProductionFixtureArtifact(plan.genesisHash, 'genesis');
      if (plan.environmentPlan.fixtureClass || plan.preGenesisQualification.fixtureClass) {
        throw new TypeError('fixture environment or pre-genesis artifacts rejected from production');
      }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }
  if (plan.preGenesisQualification.genesisHashBound !== plan.genesisHash) {
    return { ok: false, reason: 'pre-genesis qualification does not bind this genesis hash' };
  }
  if (plan.preGenesisQualification.candidateV2HashBound !== plan.candidateV2Hash) {
    return { ok: false, reason: 'pre-genesis qualification does not bind this Candidate V2 hash' };
  }
  if (plan.preGenesisQualification.mainnetRcHashBound !== plan.mainnetRcHash) {
    return { ok: false, reason: 'pre-genesis qualification does not bind this Mainnet RC hash' };
  }
  if (plan.genesisTimePolicy.state !== 'AUTHORIZED' || plan.genesisTimePolicy.selectedUnixMs === null) {
    return { ok: false, reason: 'execution must bind an authorized genesis-time value' };
  }
  if (plan.genesisTimePolicy.usesDeveloperLocalClock) {
    return { ok: false, reason: 'developer local clock is forbidden' };
  }
  if (plan.tickerStatus !== 'NOT_ASSIGNED') {
    return { ok: false, reason: 'TICKER_INVENTION_FORBIDDEN' };
  }
  if (launchPlanHashOf(plan) !== plan.planHash) {
    return { ok: false, reason: 'plan hash mismatch' };
  }
  return { ok: true, reason: null };
}

export function configurationDriftDetected(
  environment: ProductionEnvironmentPlan,
  observedDeploymentHash: string,
): boolean {
  if (environment.observedDeploymentHash === observedDeploymentHash) {
    return false;
  }
  return !environment.allowedVarianceCodes.includes(`OBSERVED_HASH=${observedDeploymentHash}`);
}
