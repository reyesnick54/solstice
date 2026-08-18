/**
 * Bind Chunk 81 Candidate V2, Chunk 84 Mainnet RC, Chunk 82 provider
 * acceptance, and Chunk 83 audit remediation without inventing missing
 * artifacts or labeling providers beyond actual acceptance.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID, productionCandidateCryptoPolicy } from '../mainnet/crypto-policy.ts';
import { allocationManifestHash, emptyAllocationManifest } from '../mainnet/allocation.ts';
import {
  genesisCandidateHashOf,
  defaultGenesisCandidateInput,
} from '../mainnet/genesis-candidate.ts';
import { validatorSetHash, sevenProductionCandidateValidators } from '../mainnet/validators.ts';
import { consumeExternalSecurityReview, consumeLegalRegulatory } from '../mainnet/consumers.ts';
import { FIRST_RC_ID } from '../release-candidate/types.ts';
import { ECONOMIC_RC_ID } from '../economic-rehearsal/identity.ts';
import { buildReadinessReport } from '../audit/readiness.ts';
import { KNOWN_SECURITY_LIMITATIONS } from '../audit/limitations.ts';
import { encodeString, sha256Hex } from '../validators/canonical.ts';
import {
  EXPECTED_CANDIDATE_V2_ID,
  EXPECTED_MAINNET_RC_ID,
  REHEARSAL_CANDIDATE_V2_ID,
  REHEARSAL_MAINNET_RC_ID,
} from './identity.ts';

export type ArtifactBinding = {
  readonly id: string;
  readonly hash: string | null;
  readonly present: boolean;
  readonly source: string;
  readonly verified: boolean;
  readonly usableForProduction: boolean;
  readonly notes: string;
};

export type ProviderAcceptanceBinding = {
  readonly providerId: string;
  readonly acceptanceStatus: 'NOT_PRESENT' | 'ENGINEERING_ONLY' | 'ACCEPTED' | 'PRODUCTION_ELIGIBLE';
  readonly productionEligible: false;
  readonly notes: string;
};

export type AuditBinding = {
  readonly chunk83Present: boolean;
  readonly externalReviewStatus: string;
  readonly claimsExternalAudit: false;
  readonly openCritical: readonly string[];
  readonly openHigh: readonly string[];
  readonly notes: string;
};

const CANDIDATE_V2_PATHS = [
  'packages/sunrey-chain/src/mainnet/candidate-v2/index.ts',
  'packages/sunrey-chain/src/production-candidate/index.ts',
  'packages/sunrey-chain/src/candidate-v2/index.ts',
  'packages/sunrey-chain/src/network-candidate-v2/index.ts',
] as const;

const MAINNET_RC_PATHS = [
  'packages/sunrey-chain/src/mainnet-rc/index.ts',
  'packages/sunrey-chain/src/release-candidate/mainnet/index.ts',
] as const;

const PROVIDER_PATHS = [
  'packages/sunrey-chain/src/provider-acceptance/index.ts',
  'packages/sunrey-chain/src/providers/acceptance.ts',
] as const;

const AUDIT_REMEDIATION_PATHS = [
  'packages/sunrey-chain/src/audit-remediation/index.ts',
  'packages/sunrey-chain/src/audit/remediation.ts',
] as const;

function firstExisting(root: string, paths: readonly string[]): string | null {
  for (const relative of paths) {
    if (existsSync(join(root, relative))) {
      return relative;
    }
  }
  return null;
}

function optionalHashFile(root: string, relative: string): string | null {
  const path = join(root, relative);
  if (!existsSync(path)) {
    return null;
  }
  const text = readFileSync(path, 'utf8').trim();
  return text.length > 0 ? text : null;
}

export function cryptoPolicyHash(): string {
  return sha256Hex(Buffer.concat([encodeString('sunrey.cryptopolicy.hash.v1'), encodeString(PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID)]));
}

export function economicBundleHash(): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('sunrey.economic.bundle.hash.v1'),
      encodeString(ECONOMIC_RC_ID),
      encodeString(productionCandidateCryptoPolicy().policyId),
    ]),
  );
}

export function predecessorCandidateHash(): string {
  return genesisCandidateHashOf(defaultGenesisCandidateInput());
}

export function predecessorValidatorSetHash(): string {
  return validatorSetHash(sevenProductionCandidateValidators());
}

export function productionAllocationHash(): string {
  return allocationManifestHash(emptyAllocationManifest());
}

export function consumeCandidateV2(root = process.cwd()): ArtifactBinding {
  const modulePath = firstExisting(root, CANDIDATE_V2_PATHS);
  const hashFile = optionalHashFile(root, 'packages/sunrey-chain/fixtures/candidate-v2/root-hash.txt');
  if (!modulePath && !hashFile) {
    return Object.freeze({
      id: EXPECTED_CANDIDATE_V2_ID,
      hash: null,
      present: false,
      source: 'CHUNK_81_NOT_ON_MAIN',
      verified: false,
      usableForProduction: false,
      notes:
        'Chunk 81 Production Network Candidate V2 is not present on this tree. Ceremony architecture binds the exact root hash when that artifact exists. Changing topology, validator set, network identity, or economic policy invalidates the candidate binding.',
    });
  }
  return Object.freeze({
    id: EXPECTED_CANDIDATE_V2_ID,
    hash: hashFile,
    present: true,
    source: modulePath ?? 'fixtures/candidate-v2/root-hash.txt',
    verified: hashFile !== null,
    usableForProduction: false,
    notes: 'Candidate V2 module located. Production eligibility remains subject to ceremony evaluation.',
  });
}

export function consumeMainnetRc(root = process.cwd()): ArtifactBinding {
  const modulePath = firstExisting(root, MAINNET_RC_PATHS);
  const hashFile = optionalHashFile(root, 'packages/sunrey-chain/fixtures/mainnet-rc/root-hash.txt');
  if (!modulePath && !hashFile) {
    return Object.freeze({
      id: EXPECTED_MAINNET_RC_ID,
      hash: null,
      present: false,
      source: 'CHUNK_84_NOT_ON_MAIN',
      verified: false,
      usableForProduction: false,
      notes:
        'Chunk 84 Mainnet RC is not present on this tree. Ceremony accepts one exact RC hash when that artifact exists. Release authority is verified independently from genesis authorization. Testnet RC ' +
        FIRST_RC_ID +
        ' is not a production RC.',
    });
  }
  return Object.freeze({
    id: EXPECTED_MAINNET_RC_ID,
    hash: hashFile,
    present: true,
    source: modulePath ?? 'fixtures/mainnet-rc/root-hash.txt',
    verified: hashFile !== null,
    usableForProduction: false,
    notes: 'Mainnet RC module located. Release authority does not equal genesis authority.',
  });
}

export function consumeProviderAcceptance(root = process.cwd()): ProviderAcceptanceBinding {
  const modulePath = firstExisting(root, PROVIDER_PATHS);
  if (!modulePath) {
    return Object.freeze({
      providerId: 'UNCONFIGURED',
      acceptanceStatus: 'NOT_PRESENT',
      productionEligible: false,
      notes:
        'Chunk 82 provider acceptance is not present on this tree. Ceremony cannot label a provider production eligible beyond actual acceptance status.',
    });
  }
  return Object.freeze({
    providerId: 'chunk-82-module',
    acceptanceStatus: 'ENGINEERING_ONLY',
    productionEligible: false,
    notes: `Provider acceptance module ${modulePath} exists. Production eligibility is not claimed.`,
  });
}

export function consumeAuditEvidence(root = process.cwd()): AuditBinding {
  const remediation = firstExisting(root, AUDIT_REMEDIATION_PATHS);
  try {
    const review = consumeExternalSecurityReview();
    const report = buildReadinessReport();
    const openCritical = KNOWN_SECURITY_LIMITATIONS.filter(
      (row) => row.status === 'OPEN' && row.riskClassification === 'CRITICAL',
    ).map((row) => row.limitation_id);
    const openHigh = KNOWN_SECURITY_LIMITATIONS.filter(
      (row) => row.status === 'OPEN' && row.riskClassification === 'HIGH',
    ).map((row) => row.limitation_id);
    return Object.freeze({
      chunk83Present: remediation !== null,
      externalReviewStatus: review.status,
      claimsExternalAudit: false,
      openCritical: Object.freeze(openCritical),
      openHigh: Object.freeze(openHigh),
      notes:
        `${review.notes} Chunk 62 readiness category ${report.category}. Open HIGH/CRITICAL limitations remain visible. ${
          remediation ? `Chunk 83 module ${remediation}.` : 'Chunk 83 audit remediation is not present on this tree.'
        }`,
    });
  } catch (error) {
    const openHigh = KNOWN_SECURITY_LIMITATIONS.filter(
      (row) => row.status === 'OPEN' && row.riskClassification === 'HIGH',
    ).map((row) => row.limitation_id);
    return Object.freeze({
      chunk83Present: remediation !== null,
      externalReviewStatus: 'NOT_PROVIDED',
      claimsExternalAudit: false,
      openCritical: Object.freeze([]),
      openHigh: Object.freeze(openHigh),
      notes: `Chunk 62/83 audit evidence could not be fully loaded (${error instanceof Error ? error.message : 'unknown'}). Open security limitations remain visible. External review is not claimed.`,
    });
  }
}

export function consumeLegalLicense(): {
  readonly legal: ReturnType<typeof consumeLegalRegulatory>;
  readonly licenseMissing: true;
  readonly legalMissing: true;
} {
  return Object.freeze({
    legal: consumeLegalRegulatory(),
    licenseMissing: true,
    legalMissing: true,
  });
}

export function rehearsalCandidateV2Binding(rootHash: string): ArtifactBinding {
  return Object.freeze({
    id: REHEARSAL_CANDIDATE_V2_ID,
    hash: rootHash,
    present: true,
    source: 'DRESS_REHEARSAL',
    verified: true,
    usableForProduction: false,
    notes: 'Dress-rehearsal Candidate V2 stand-in. Unusable as a real production candidate binding.',
  });
}

export function rehearsalMainnetRcBinding(rootHash: string): ArtifactBinding {
  return Object.freeze({
    id: REHEARSAL_MAINNET_RC_ID,
    hash: rootHash,
    present: true,
    source: 'DRESS_REHEARSAL',
    verified: true,
    usableForProduction: false,
    notes: 'Dress-rehearsal Mainnet RC stand-in. Release authority here does not authorize production genesis.',
  });
}

export function verifyReleaseAuthorityIndependently(rc: ArtifactBinding): boolean {
  return rc.verified && rc.hash !== null && rc.id !== FIRST_RC_ID;
}
