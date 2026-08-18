/**
 * Bind existing chunk evidence without fabricating missing artifacts.
 */

import { coverageCounts } from '../assurance/coverage.ts';
import { CAPACITY_LABEL, RESULT_CLASS } from '../perf/types.ts';
import { fixtureGenesisHash } from '../testnet/genesis.ts';
import { PQC_LIBRARY_SELECTION } from '../../../security/src/index.ts';
import { generatedSourceDigest } from '../supply-chain/inventory.ts';
import { FORMAL_MODEL_IDS } from '../formal/types.ts';
import { loadFormalModelRegistry } from '../formal/registry.ts';
import { FIRST_RC_ID } from '../release-candidate/types.ts';
import { consumeEconomicRc as consumeEconomicRcEvidence } from '../release-candidate/economic/readiness.ts';
import { collectReadinessArtifactDigests } from '../infra/artifacts.ts';
import { CANDIDATE_V2_ID } from './candidate-v2/identity.ts';

/** Documented Chunk 57 facts. sunrey-chain must not import packages/sunrey-range. */
const RANGE_SCHEMA_VERSION = 1;
const RANGE_INVARIANT_COUNT = 11;
import { RELEASE_AUTHORITY_ID } from '../supply-chain/release.ts';
import type {
  EconomicReleaseCandidateSlot,
  ExternalSecurityReviewSlot,
  FormalAssuranceSlot,
  LegalRegulatorySlot,
  TestnetReleaseCandidateSlot,
} from './types.ts';

export function consumeFormalAssurance(): FormalAssuranceSlot {
  const registry = loadFormalModelRegistry();
  const digests = collectReadinessArtifactDigests();
  return Object.freeze({
    modelVersions: Object.freeze(registry.models.map((row) => `${row.modelId}@${row.modelVersion}`)),
    bounds: 'stated per-model bounds in FormalModelRegistry',
    properties: Object.freeze(registry.models.flatMap((row) => [...row.properties])),
    counterexamples: Object.freeze([]),
    reportDigest: digests.formalReportDigest,
    status: 'ENGINEERING_VERIFIED',
    substituteForImplementationReview: false,
    notes: 'Chunk 61 formal models are model-checked within stated bounds. Independent auditor review remains EXTERNAL_VERIFICATION_REQUIRED. Formal assurance is not a substitute for implementation or security review.',
  });
}

export function consumeExternalSecurityReview(): ExternalSecurityReviewSlot {
  const digests = collectReadinessArtifactDigests();
  return Object.freeze({
    reviewOrganization: null,
    reviewReference: `chunk-62-engineering-prep:${digests.auditBundleDigest}`,
    scope: 'NOT_PERFORMED',
    reportHash: null,
    openCriticalFindings: null,
    openHighFindings: null,
    retestEvidence: null,
    status: 'NOT_PROVIDED',
    notes: `Chunk 62 engineering preparation bundle digest ${digests.auditBundleDigest} exists. It does not claim an independent audit occurred or passed. Missing security report cannot appear verified.`,
  });
}

export function consumeFuzzAndAdversarial(): {
  readonly assuranceImplemented: number;
  readonly assurancePartial: number;
  readonly rangeSchema: number;
  readonly invariantCount: number;
  readonly notes: string;
} {
  const counts = coverageCounts();
  return Object.freeze({
    assuranceImplemented: counts.implemented,
    assurancePartial: counts.partial,
    rangeSchema: RANGE_SCHEMA_VERSION,
    invariantCount: RANGE_INVARIANT_COUNT,
    notes: 'Chunks 56 and 57 record engineering regression status. This is not an independent audit.',
  });
}

export function consumePerformance(): {
  readonly resultClass: typeof RESULT_CLASS;
  readonly capacityLabel: typeof CAPACITY_LABEL;
  readonly contractualPromise: false;
} {
  return Object.freeze({
    resultClass: RESULT_CLASS,
    capacityLabel: CAPACITY_LABEL,
    contractualPromise: false,
  });
}

export function consumeSupplyChain(root = process.cwd()): {
  readonly generatedSourceDigest: string;
  readonly releaseAuthorityId: typeof RELEASE_AUTHORITY_ID;
  readonly productionSigningKey: null;
  readonly sbomDigest: string;
  readonly provenanceDigest: string;
} {
  const digests = collectReadinessArtifactDigests(root);
  return Object.freeze({
    generatedSourceDigest: generatedSourceDigest(root),
    releaseAuthorityId: RELEASE_AUTHORITY_ID,
    productionSigningKey: null,
    sbomDigest: digests.sbomDigest,
    provenanceDigest: digests.releaseProvenanceDigest,
  });
}

export function consumePqc(): {
  readonly productionStatus: string;
  readonly provider: string;
  readonly certifiedHsm: false;
  readonly mainnetActivation: false;
} {
  return Object.freeze({
    productionStatus: PQC_LIBRARY_SELECTION.productionStatus,
    provider: PQC_LIBRARY_SELECTION.selectedProvider.providerId,
    certifiedHsm: false,
    mainnetActivation: false,
  });
}

export function consumeTestnetRc(): TestnetReleaseCandidateSlot {
  const digests = collectReadinessArtifactDigests();
  return Object.freeze({
    rcId: FIRST_RC_ID,
    sourceCommit: 'linked-from-chunk-63',
    qualificationReport: digests.rcQualificationDigest,
    knownLimitations: Object.freeze([
      'Chunk 63 Testnet RC is TESTNET only and does not imply mainnet readiness',
      'Tickers remain NOT_ASSIGNED',
      'Extended endurance and external DR contracts remain incomplete',
    ]),
    enduranceState: 'PROVIDED_UNVERIFIED',
    upgradeRehearsal: 'ENGINEERING_VERIFIED',
    disasterRecoveryResult: 'ENGINEERING_VERIFIED',
    testnetGenesisHash: fixtureGenesisHash(),
    status: 'ENGINEERING_VERIFIED',
    notes: `RC qualification digest ${digests.rcQualificationDigest}. Testnet-1 genesis hash is bound as an engineering reference only. It is not a production RC and cannot become production genesis.`,
  });
}

export function consumeEconomicRc(): EconomicReleaseCandidateSlot {
  return consumeEconomicRcEvidence();
}

export function consumeLegalRegulatory(): LegalRegulatorySlot {
  return Object.freeze({
    counselOpinionReference: null,
    licenseOrRegistration: null,
    regulatoryApprovalReference: null,
    regulatedPartnerAgreement: null,
    jurisdictionOperatingApproval: null,
    confirmedByCounsel: false,
    status: 'NOT_PROVIDED',
    notes: 'Unknown/unconfirmed. Repository legal positions remain RESEARCH_REQUIRED. Do not mark CONFIRMED_BY_COUNSEL.',
  });
}

export function consumeFormalModelIds(): readonly string[] {
  return FORMAL_MODEL_IDS;
}

export function consumeCandidateV2(): {
  readonly candidateId: typeof CANDIDATE_V2_ID;
  readonly status: 'CANDIDATE';
  readonly mainnetEnabled: false;
  readonly productionAuthorized: false;
  readonly notes: string;
} {
  return Object.freeze({
    candidateId: CANDIDATE_V2_ID,
    status: 'CANDIDATE',
    mainnetEnabled: false,
    productionAuthorized: false,
    notes: 'Chunk 81 candidate binds Chunks 65–80. External legal, audit, HSM, and human-authorization evidence remain NOT_PROVIDED. This is not mainnet authorization.',
  });
}
