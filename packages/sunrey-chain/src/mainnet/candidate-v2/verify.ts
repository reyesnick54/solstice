/**
 * Candidate V2 verification, drift detection, and negative gates.
 */

import { recordHumanAuthorization } from '../authorization.ts';
import { rejectUnapprovedAllocation, emptyAllocationManifest } from '../allocation.ts';
import { consumeExternalSecurityReview } from '../consumers.ts';
import { FIRST_ECONOMIC_RC_ID } from '../../release-candidate/economic/types.ts';
import { FIXTURE_KEY_MARKER } from '../../testnet/security.ts';
import { parseContainerReference } from '../../infra/services.ts';
import { SUNREY_TESTNET_1_CHAIN_ID, SUNREY_TESTNET_1_NETWORK_ID } from '../../testnet/identity.ts';
import {
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_NETWORK_ID,
} from '../../economic-rehearsal/identity.ts';
import { PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from '../identity.ts';
import { commitCanonical } from '../../hash.ts';
import {
  CANDIDATE_V2_ADDRESS_HRP,
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_ID,
  CANDIDATE_V2_NETWORK_ID,
  assertCandidateV2Identity,
} from './identity.ts';
import type {
  ConfigurationDriftState,
  ObservedDeploymentDescriptor,
  ProductionNetworkCandidateV2,
  ProductionNetworkVerificationCheck,
  ProductionNetworkVerificationReport,
} from './types.ts';
import { createProductionNetworkCandidateV2 } from './assemble.ts';

function check(id: string, ok: boolean, detail: string): ProductionNetworkVerificationCheck {
  return Object.freeze({ id, ok, detail });
}

export function rejectFixtureValidatorKey(keyLabel: string): never {
  if (keyLabel.includes(FIXTURE_KEY_MARKER) || keyLabel.toLowerCase().includes('fixture')) {
    throw new TypeError('fixture validator key rejected for production eligibility');
  }
  throw new TypeError('unverified validator key rejected for production eligibility');
}

export function rejectRehearsalGenesis(networkId: string, chainId: string): void {
  if (networkId === ECONOMIC_REHEARSAL_NETWORK_ID || chainId === ECONOMIC_REHEARSAL_CHAIN_ID) {
    throw new TypeError('rehearsal genesis rejected for production candidate v2');
  }
}

export function rejectTestnetNetworkId(networkId: string): void {
  if (networkId === SUNREY_TESTNET_1_NETWORK_ID || networkId.startsWith('net_sunrey_testnet_')) {
    throw new TypeError(`testnet network ID rejected: ${networkId}`);
  }
}

export function rejectWrongChainId(chainId: string): void {
  if (chainId !== CANDIDATE_V2_CHAIN_ID) {
    throw new TypeError(`wrong chain ID rejected: ${chainId}`);
  }
}

export function rejectFloatingContainer(name: string, tag: string, digest?: string | null): void {
  const parsed = parseContainerReference({ name, tag, digest: digest ?? null });
  if (!parsed.ok) {
    throw new TypeError(`floating container rejected: ${name}:${tag}`);
  }
}

export function rejectUnverifiedHsm(state: string): void {
  if (state !== 'EXTERNAL_HSM_VERIFIED') {
    throw new TypeError('unverified HSM cannot satisfy production');
  }
}

export function rejectInventedTicker(ticker: string): void {
  if (ticker !== 'NOT_ASSIGNED') {
    throw new TypeError(`invented ticker rejected: ${ticker}`);
  }
}

export function rejectUnapprovedAllocationQuantity(quantity: bigint): void {
  if (quantity !== 0n) {
    rejectUnapprovedAllocation({
      ...emptyAllocationManifest(),
      lines: [
        {
          asset: 'SUNREY_COIN',
          recipientAccount: 'acct.unapproved',
          quantityMinorUnits: quantity,
          purposeCategory: 'UNALLOCATED',
          authorizationEvidence: null,
        },
      ],
      totalByAsset: { SUNREY_COIN: quantity, MOONREY_COIN: 0n },
    });
  }
}

export function rejectWrongEconomicRc(rcId: string): void {
  if (rcId !== FIRST_ECONOMIC_RC_ID) {
    throw new TypeError(`wrong economic RC rejected: ${rcId}`);
  }
}

export function rejectTamperedStressReport(expectedHash: string, observedHash: string): void {
  if (expectedHash !== observedHash) {
    throw new TypeError('tampered stress report rejected');
  }
}

export function rejectTamperedGovernancePackage(expectedHash: string, observedHash: string): void {
  if (expectedHash !== observedHash) {
    throw new TypeError('tampered governance package rejected');
  }
}

export function rejectAiProductionAuthorization(): never {
  const record = recordHumanAuthorization({
    actorKind: 'AI',
    actorId: 'ai.production.authorizer',
    role: 'PROTOCOL_AUTHORITY',
    statement: 'AI cannot authorize production',
    signedAtUtc: '2026-01-01T00:00:00.000Z',
    signatureHex: 'aa'.repeat(32),
  });
  throw new TypeError(record.rejectionReason ?? 'AI production authorization rejected');
}

export function detectConfigurationDrift(
  candidate: ProductionNetworkCandidateV2,
  observed?: ObservedDeploymentDescriptor,
): ConfigurationDriftState {
  if (!observed) {
    return 'EVIDENCE_UNAVAILABLE';
  }
  const expected = {
    networkId: candidate.configuration.networkId,
    chainId: candidate.configuration.chainId,
    releaseArtifactHash: candidate.manifest.releaseArtifactHash,
    hsmState: candidate.infrastructure.hsmState,
    economicRcHash: candidate.economic.economicRcHash,
  };
  if (observed.networkId && observed.networkId !== expected.networkId) {
    return 'UNAUTHORIZED_DRIFT';
  }
  if (observed.chainId && observed.chainId !== expected.chainId) {
    return 'UNAUTHORIZED_DRIFT';
  }
  if (observed.releaseArtifactHash && observed.releaseArtifactHash !== expected.releaseArtifactHash) {
    return 'UNAUTHORIZED_DRIFT';
  }
  if (observed.hsmState && observed.hsmState !== expected.hsmState && observed.hsmState !== 'SIMULATION_HSM') {
    return 'UNAUTHORIZED_DRIFT';
  }
  if (observed.economicRcHash && observed.economicRcHash !== expected.economicRcHash) {
    return 'UNAUTHORIZED_DRIFT';
  }
  if (observed.serviceArtifacts) {
    for (const service of candidate.services.services) {
      const seen = observed.serviceArtifacts[service.role];
      if (seen && seen !== service.artifactDigest) {
        return 'UNAUTHORIZED_DRIFT';
      }
      if (seen && !seen.startsWith('sha256:')) {
        return 'UNAUTHORIZED_DRIFT';
      }
    }
  }
  if (observed.validatorIds && observed.validatorIds.join('|') !== candidate.validators.map((row) => row.validatorId).join('|')) {
    return 'UNAUTHORIZED_DRIFT';
  }
  if (
    observed.networkId === undefined &&
    observed.chainId === undefined &&
    observed.releaseArtifactHash === undefined &&
    observed.economicRcHash === undefined
  ) {
    return 'EVIDENCE_UNAVAILABLE';
  }
  if (observed.authorizedVariance === true || observed.hsmState === 'SIMULATION_HSM') {
    return 'AUTHORIZED_VARIANCE';
  }
  return 'MATCH';
}

export function candidateDigestInvalidated(
  original: ProductionNetworkCandidateV2,
  mutated: ProductionNetworkCandidateV2,
): boolean {
  return original.candidateRootHash !== mutated.candidateRootHash;
}

export function verifyProductionNetworkCandidateV2(
  candidate?: ProductionNetworkCandidateV2,
  root = process.cwd(),
): ProductionNetworkVerificationReport {
  const actual = candidate ?? createProductionNetworkCandidateV2(root);
  const checks: ProductionNetworkVerificationCheck[] = [];
  try {
    assertCandidateV2Identity(actual.configuration.networkId, actual.configuration.chainId);
    checks.push(check('IDENTITY', true, `${actual.configuration.networkId}/${actual.configuration.chainId}`));
  } catch (error) {
    checks.push(check('IDENTITY', false, error instanceof Error ? error.message : 'identity failed'));
  }
  checks.push(check('CANDIDATE_ID', actual.candidateId === CANDIDATE_V2_ID, actual.candidateId));
  checks.push(check('HRP', actual.configuration.productionAddressHrp === CANDIDATE_V2_ADDRESS_HRP, actual.configuration.productionAddressHrp));
  checks.push(check('STATUS', actual.status === 'CANDIDATE' && actual.mainnetEnabled === false, 'CANDIDATE mainnetEnabled=false'));
  checks.push(check('PRODUCTION_AUTHORIZED', actual.productionAuthorized === false, 'productionAuthorized=false'));
  checks.push(check('TICKER', actual.economic.tickerStatus === 'NOT_ASSIGNED', actual.economic.tickerStatus));
  checks.push(check('ALLOCATION', actual.genesisInput.sunreyGenesisSupply === '0' && actual.genesisInput.moonreyGenesisSupply === '0', 'zero allocation'));
  checks.push(check('GENESIS_NOT_FINAL', actual.genesisInput.finalized === false && actual.genesisInput.activated === false, 'inputs only'));
  checks.push(check('ECONOMIC_RC', actual.economic.economicRcId === FIRST_ECONOMIC_RC_ID, actual.economic.economicRcId));
  checks.push(check('FIXTURE_KEYS', actual.validators.every((row) => row.fixtureKey && row.productionEligible === false), 'fixture keys are not production-eligible'));
  checks.push(check('HSM', actual.infrastructure.hsmState === 'SIMULATION_HSM', actual.infrastructure.hsmState));
  checks.push(check('SERVICES_IMMUTABLE', actual.services.services.every((row) => row.artifactDigest.startsWith('sha256:') && row.floatingTag === false), 'immutable digests'));
  checks.push(check('NO_INHERITANCE', actual.capabilityInheritance === false && actual.capabilities.every((row) => !row.genesis_enabled && !row.runtime_enabled), 'capabilities independently gated'));
  checks.push(check('V1_DISTINCT', actual.configuration.networkId !== PRODUCTION_CANDIDATE_NETWORK_ID && actual.configuration.chainId !== PRODUCTION_CANDIDATE_CHAIN_ID, 'v2 != v1'));
  checks.push(check('REHEARSAL_DISTINCT', actual.configuration.networkId !== ECONOMIC_REHEARSAL_NETWORK_ID && actual.configuration.chainId !== ECONOMIC_REHEARSAL_CHAIN_ID, 'v2 != rehearsal'));
  checks.push(check('CHAIN_ID', actual.configuration.chainId === CANDIDATE_V2_CHAIN_ID, actual.configuration.chainId));
  const recomputed = commitCanonical({
    domain: 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2',
    label: 'root',
    value: {
      configurationDigest: actual.configurationDigest,
      networkManifestDigest: actual.networkManifestDigest,
      protocolBundleDigest: actual.protocolBundleDigest,
      economicBundleDigest: actual.economicBundleDigest,
      security: actual.security.combinedHash,
      infrastructure: actual.infrastructure.combinedHash,
      storage: actual.storage.combinedHash,
      topology: actual.topology.combinedHash,
      services: actual.services.combinedHash,
      evidence: actual.evidence.combinedHash,
      validators: actual.validators.map((row) => row.validatorId),
    },
  });
  checks.push(check('ROOT_HASH', recomputed === actual.candidateRootHash, actual.candidateRootHash));
  const audit = consumeExternalSecurityReview();
  checks.push(check('EXTERNAL_AUDIT', audit.status === 'NOT_PROVIDED', 'missing external audit remains missing'));
  const externalGaps = Object.freeze([
    'independent security audit NOT_PROVIDED',
    'commercial HSM NOT_PROVIDED',
    'legal counsel NOT_PROVIDED',
    'regulatory approval NOT_PROVIDED',
    'licensing NOT_PROVIDED',
    'partner agreements NOT_PROVIDED',
    'human production authorization NOT_PROVIDED',
    'real root-of-trust ceremony NOT_PROVIDED',
  ]);
  return Object.freeze({
    schemaVersion: 1,
    candidateId: actual.candidateId,
    rootHash: actual.candidateRootHash,
    sourceCommit: actual.manifest.sourceCommit,
    protocol: actual.protocol.combinedHash,
    economicRc: actual.economic.economicRcId,
    topology: actual.topology.combinedHash,
    securityState: actual.security.combinedHash,
    hsmState: 'SIMULATION_HSM',
    pqcState: 'NOT_SELECTED_FOR_PRODUCTION',
    storage: actual.storage.combinedHash,
    infrastructure: actual.infrastructure.combinedHash,
    economicState: actual.economic.combinedHash,
    readiness: actual.manifest.readinessEvidenceHash,
    externalGaps,
    checks: Object.freeze(checks),
    ok: checks.every((row) => row.ok),
    productionAuthorized: false,
  });
}
