/**
 * Bind existing chunk evidence without fabricating missing artifacts.
 */

import { coverageCounts } from '../assurance/coverage.ts';
import { CAPACITY_LABEL, RESULT_CLASS } from '../perf/types.ts';
import { fixtureGenesisHash } from '../testnet/genesis.ts';
import { PQC_LIBRARY_SELECTION } from '../../../security/src/index.ts';
import { generatedSourceDigest } from '../supply-chain/inventory.ts';

/** Documented Chunk 57 facts. sunrey-chain must not import packages/sunrey-range. */
const RANGE_SCHEMA_VERSION = 1;
const RANGE_INVARIANT_COUNT = 11;
import { RELEASE_AUTHORITY_ID } from '../supply-chain/release.ts';
import type {
  ExternalSecurityReviewSlot,
  FormalAssuranceSlot,
  LegalRegulatorySlot,
  TestnetReleaseCandidateSlot,
} from './types.ts';

export function consumeFormalAssurance(): FormalAssuranceSlot {
  return Object.freeze({
    modelVersions: Object.freeze([]),
    bounds: null,
    properties: Object.freeze([]),
    counterexamples: Object.freeze([]),
    reportDigest: null,
    status: 'NOT_PROVIDED',
    substituteForImplementationReview: false,
    notes: 'Chunk 61 formal assurance is not on this tree. Formal assurance is not a substitute for implementation or security review.',
  });
}

export function consumeExternalSecurityReview(): ExternalSecurityReviewSlot {
  return Object.freeze({
    reviewOrganization: null,
    reviewReference: null,
    scope: 'NOT_PERFORMED',
    reportHash: null,
    openCriticalFindings: null,
    openHighFindings: null,
    retestEvidence: null,
    status: 'NOT_PROVIDED',
    notes: 'Chunk 62 external review evidence is absent. Do not invent an audit report. Missing security report cannot appear verified.',
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
} {
  return Object.freeze({
    generatedSourceDigest: generatedSourceDigest(root),
    releaseAuthorityId: RELEASE_AUTHORITY_ID,
    productionSigningKey: null,
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
  return Object.freeze({
    rcId: null,
    sourceCommit: null,
    qualificationReport: null,
    knownLimitations: Object.freeze([
      'Chunk 63 testnet RC qualification is not implemented on this tree',
      'Public testnet genesis is engineering evidence, not RC sign-off',
    ]),
    enduranceState: 'NOT_PROVIDED',
    upgradeRehearsal: 'NOT_PROVIDED',
    disasterRecoveryResult: 'NOT_PROVIDED',
    testnetGenesisHash: fixtureGenesisHash(),
    status: 'NOT_PROVIDED',
    notes: 'Testnet-1 genesis hash is bound as an engineering reference only. It is not a production RC and cannot become production genesis.',
  });
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
