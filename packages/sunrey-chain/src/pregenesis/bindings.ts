/**
 * Bind exact Chunk 84 Mainnet RC and Chunk 81 Candidate V2.
 * Consume Chunk 82 provider coverage and Chunk 83 security blockers.
 * Feed engineering evidence into Chunk 65 readiness.
 */

import { FIRST_MAINNET_RC_ID } from '../release-candidate/mainnet/types.ts';
import { freezeProductionNetworkCandidateV2 } from '../release-candidate/mainnet/freeze.ts';
import { snapshotProviderAcceptance, reportHsmState } from '../release-candidate/mainnet/providers.ts';
import { snapshotAuditRemediation } from '../release-candidate/mainnet/audit.ts';
import { CANDIDATE_V2_ID } from '../mainnet/candidate-v2/identity.ts';
import { commitCanonical } from '../hash.ts';
import { applyEngineeringVerification, freezeEvidence } from '../mainnet/evidence.ts';
import type { ReadinessEvidenceRecord } from '../mainnet/types.ts';
import { PREGENESIS_DOMAIN } from './identity.ts';
import {
  FAILURE_SCENARIOS,
  OPERATIONAL_INVARIANTS,
  RUNBOOK_PROCEDURES,
  type PregenesisQualificationPlan,
  type ProviderCoverageLane,
} from './types.ts';

export type PregenesisBindings = {
  readonly mainnetRcId: typeof FIRST_MAINNET_RC_ID;
  readonly mainnetRcHash: string;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly mainnetEnabled: false;
};

export function bindQualificationArtifacts(_root = process.cwd()): PregenesisBindings {
  const freeze = freezeProductionNetworkCandidateV2();
  const candidateRootHash = commitCanonical({
    domain: PREGENESIS_DOMAIN,
    label: 'candidate-v2-root-binding',
    candidateId: CANDIDATE_V2_ID,
    freezeRoot: freeze.rootHash,
    genesisCandidateHash: freeze.genesisCandidateHash,
  });
  const rcHash = commitCanonical({
    domain: PREGENESIS_DOMAIN,
    label: 'mainnet-rc-binding',
    rcId: FIRST_MAINNET_RC_ID,
    candidateV2FreezeHash: freeze.rootHash,
    candidateRoot: candidateRootHash,
    mainnetEnabled: false,
  });
  return Object.freeze({
    mainnetRcId: FIRST_MAINNET_RC_ID,
    mainnetRcHash: rcHash,
    candidateV2Id: CANDIDATE_V2_ID,
    candidateV2RootHash: candidateRootHash,
    mainnetEnabled: false,
  });
}

export function rejectWrongMainnetRc(bindings: PregenesisBindings, presentedId: string, presentedHash: string): void {
  if (presentedId !== bindings.mainnetRcId || presentedHash !== bindings.mainnetRcHash) {
    throw new TypeError('wrong RC rejected');
  }
}

export function rejectWrongCandidateV2(bindings: PregenesisBindings, presentedId: string, presentedHash: string): void {
  if (presentedHash !== bindings.candidateV2RootHash) {
    throw new TypeError('wrong Candidate V2 rejected');
  }
  if (presentedId !== bindings.candidateV2Id && presentedId !== CANDIDATE_V2_ID) {
    throw new TypeError('wrong Candidate V2 rejected');
  }
}

export function providerCoverage(): readonly {
  readonly providerId: string;
  readonly lane: ProviderCoverageLane;
  readonly notes: string;
}[] {
  const matrix = snapshotProviderAcceptance();
  const hsm = reportHsmState();
  const rows = matrix.rows.map((row) => {
    let lane: ProviderCoverageLane = 'LOCAL_SIMULATED';
    if (row.providerId.includes('sandbox') || row.domain === 'EXCHANGE' || row.domain === 'REGULATED') {
      lane = 'SANDBOX_TESTED';
    }
    if (row.state === 'EXTERNALLY_EVIDENCED' || row.state === 'HUMAN_ACCEPTED' || row.productionEligible) {
      lane = 'EXTERNAL_PROVIDER_TESTED';
    }
    if (row.state === 'UNCONFIGURED') {
      lane = 'LOCAL_SIMULATED';
    }
    return Object.freeze({
      providerId: row.providerId,
      lane,
      notes: row.notes,
    });
  });
  return Object.freeze([
    ...rows,
    Object.freeze({
      providerId: 'hsm.contract-shape',
      lane: 'LOCAL_SIMULATED' as const,
      notes: `${hsm.notes} Real production hardware evidence remains Chunk 82.`,
    }),
  ]);
}

export function securityReviewIntegration(): {
  readonly chunk: 'CHUNK-83';
  readonly openBlockers: readonly string[];
  readonly openBlockersRemainVisible: true;
  readonly claimsExternalAuditPassed: false;
} {
  const snapshot = snapshotAuditRemediation();
  return Object.freeze({
    chunk: 'CHUNK-83',
    openBlockers: Object.freeze([...snapshot.criticalBlockers, ...snapshot.highFindings, ...snapshot.openFindings]),
    openBlockersRemainVisible: true,
    claimsExternalAuditPassed: false,
  });
}

export function createPregenesisQualificationPlan(
  bindings: PregenesisBindings = bindQualificationArtifacts(),
): PregenesisQualificationPlan {
  return Object.freeze({
    schemaVersion: 1,
    planId: 'plan_pregenesis_shadow_1',
    mainnetRcId: bindings.mainnetRcId,
    mainnetRcHash: bindings.mainnetRcHash,
    candidateV2Id: bindings.candidateV2Id,
    candidateV2RootHash: bindings.candidateV2RootHash,
    healthWindowPolicy: 'BLOCK_EPOCH_COUNT',
    requiredInvariants: OPERATIONAL_INVARIANTS,
    failureScenarios: FAILURE_SCENARIOS,
    runbooks: RUNBOOK_PROCEDURES,
    mainnetEnabled: false,
  });
}

export function pregenesisReadinessRecords(evidenceHash: string): readonly ReadinessEvidenceRecord[] {
  const engineering = applyEngineeringVerification(
    freezeEvidence({
      requirementId: 'REQ-PREGENESIS-001',
      dimension: 'INFRASTRUCTURE',
      description: 'Pre-genesis shadow-network engineering qualification',
      scope: 'SUNREY_CHAIN',
      evidenceType: 'ENGINEERING_ARTIFACT',
      source: 'packages/sunrey-chain/src/pregenesis',
      authorizedVerifierRole: 'ENGINEERING',
      expirationOrReviewDateUtc: null,
      notes: 'Chunk 87 feeds engineering evidence only. External/human requirements remain separate. Does not authorize mainnet.',
      externalEvidence: false,
      chunkReference: 'CHUNK-87',
      verificationStatus: 'NOT_PROVIDED',
      evidenceHash,
      evidenceReference: 'packages/sunrey-chain/src/pregenesis',
    }),
    'ENGINEERING_VERIFIED',
  );
  const human = freezeEvidence({
    requirementId: 'REQ-PREGENESIS-002',
    dimension: 'HUMAN_AUTHORIZATION',
    description: 'Human authorization that pre-genesis qualification may inform production activation',
    scope: 'ALL',
    evidenceType: 'HUMAN_AUTHORIZATION',
    source: 'human-pregenesis-authorization-slot',
    authorizedVerifierRole: 'HUMAN_AUTHORITY',
    expirationOrReviewDateUtc: null,
    notes: 'Engineering qualification is not legal or operator certification. Human authorization remains NOT_PROVIDED.',
    externalEvidence: true,
    chunkReference: 'CHUNK-87',
    verificationStatus: 'NOT_PROVIDED',
    evidenceHash: null,
    evidenceReference: null,
  });
  return Object.freeze([engineering, human]);
}

export function artifactParityRecords(candidateRootHash: string): readonly {
  readonly artifact: string;
  readonly productionDigest: string;
  readonly shadowDigest: string;
  readonly environmentSpecific: true;
  readonly notes: string;
}[] {
  return Object.freeze([
    Object.freeze({
      artifact: 'mainnet-rc-application',
      productionDigest: candidateRootHash,
      shadowDigest: commitCanonical({ domain: PREGENESIS_DOMAIN, artifact: 'shadow-runtime', candidateRootHash }),
      environmentSpecific: true,
      notes: 'Same Mainnet RC application artifacts; environment-specific configuration only.',
    }),
    Object.freeze({
      artifact: 'identity-and-genesis',
      productionDigest: 'production-or-candidate-identity',
      shadowDigest: 'pregenesis-shadow-identity',
      environmentSpecific: true,
      notes: 'Network ID, chain ID, keys, genesis, and HRP are isolated.',
    }),
  ]);
}
