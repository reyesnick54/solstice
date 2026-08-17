/**
 * MainnetValidatorCandidateManifest and concentration checks.
 *
 * Simulated production-candidate keys are distinct from testnet keys.
 * Organizational independence is not claimed without evidence.
 */

import {
  createEd25519SignatureProvider,
  SUITE_SUNREY_ED25519_V1,
  type KeyPurpose,
} from '../../../security/src/index.ts';
import { encodeString, encodeU32, encodeU64, sha256Bytes, sha256Hex } from '../validators/canonical.ts';
import { assertFixtureEnvironment, FIXTURE_KEY_MARKER } from '../testnet/security.ts';
import { sevenValidatorFixture } from '../testnet/validators.ts';
import type {
  HsmEvidenceClass,
  MainnetValidatorCandidate,
  MainnetValidatorCandidateManifest,
  ValidatorConcentrationReport,
} from './types.ts';

export const VALIDATOR_CANDIDATE_DOMAIN = 'SUNREY_PRODUCTION_CANDIDATE_VALSET_V1' as const;
export const PRODUCTION_CANDIDATE_VALIDATOR_COUNT = 7 as const;
export const PRODUCTION_CANDIDATE_EQUAL_POWER = 1n;
export const PRODUCTION_CANDIDATE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type ProductionCandidateLabel = (typeof PRODUCTION_CANDIDATE_LABELS)[number];

const ROLE_LABEL = {
  consensus: 'CONSENSUS',
  p2p: 'P2P',
  governance: 'GOVERNANCE',
} as const;

export function candidateKeyLabel(
  validator: ProductionCandidateLabel,
  role: keyof typeof ROLE_LABEL,
): string {
  return `SUNREY_PRODUCTION_CANDIDATE_1_FIXTURE_VALIDATOR_${validator}_${ROLE_LABEL[role]}_${FIXTURE_KEY_MARKER}_v1`;
}

function publicKeyFromLabel(
  validator: ProductionCandidateLabel,
  role: keyof typeof ROLE_LABEL,
  purpose: KeyPurpose,
): string {
  assertFixtureEnvironment();
  const provider = createEd25519SignatureProvider();
  const label = candidateKeyLabel(validator, role);
  const seed = sha256Bytes(Buffer.from(label, 'utf8'));
  const derived = provider.fromSeed(
    seed.toString('hex'),
    purpose,
    SUITE_SUNREY_ED25519_V1,
    `production-candidate-fixture:${validator}:${role}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return derived.value.publicKey.publicKeyHex;
}

export function contributionHash(candidate: Omit<MainnetValidatorCandidate, 'ceremonyContributionHash'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(VALIDATOR_CANDIDATE_DOMAIN),
      encodeString(candidate.validatorId),
      encodeString(candidate.consensusPublicKeyHex),
      encodeString(candidate.p2pPublicKeyHex),
      encodeString(candidate.governancePublicKeyHex),
    ]),
  );
}

export function sevenProductionCandidateValidators(): readonly MainnetValidatorCandidate[] {
  return Object.freeze(
    PRODUCTION_CANDIDATE_LABELS.map((label, index) => {
      const base = {
        validatorId: `val_production_candidate_1_${label.toLowerCase()}`,
        operatorEntityReference: `operator.production-candidate.1.${label.toLowerCase()}`,
        consensusPublicKeyHex: publicKeyFromLabel(label, 'consensus', 'VALIDATOR_CONSENSUS_SIGNING'),
        p2pPublicKeyHex: publicKeyFromLabel(label, 'p2p', 'P2P_IDENTITY'),
        governancePublicKeyHex: publicKeyFromLabel(label, 'governance', 'GOVERNANCE_SIGNING'),
        cryptoSuite: SUITE_SUNREY_ED25519_V1,
        hsmAttestationReference: null,
        hsmEvidenceClass: 'SIMULATION_HSM' as HsmEvidenceClass,
        failureDomain: `sim-domain-${String((index % 3) + 1)}`,
        votingPower: PRODUCTION_CANDIDATE_EQUAL_POWER,
        approvalState: 'PROVIDED_UNVERIFIED' as const,
      };
      return Object.freeze({
        ...base,
        ceremonyContributionHash: contributionHash(base),
      });
    }),
  );
}

export function evaluateConcentration(
  validators: readonly MainnetValidatorCandidate[],
): ValidatorConcentrationReport {
  const warnings: string[] = [];
  const domainWarnings: string[] = [];
  const operatorWarnings: string[] = [];
  const total = validators.reduce((sum, row) => sum + row.votingPower, 0n);
  const byOperator = new Map<string, bigint>();
  const byDomain = new Map<string, bigint>();
  for (const row of validators) {
    byOperator.set(row.operatorEntityReference, (byOperator.get(row.operatorEntityReference) ?? 0n) + row.votingPower);
    byDomain.set(row.failureDomain, (byDomain.get(row.failureDomain) ?? 0n) + row.votingPower);
  }
  for (const [operator, power] of byOperator) {
    if (total > 0n && power * 3n > total) {
      operatorWarnings.push(`${operator} holds more than one-third of voting power`);
    }
  }
  for (const [domain, power] of byDomain) {
    if (total > 0n && power * 3n > total) {
      domainWarnings.push(`${domain} holds more than one-third of voting power`);
    }
  }
  if (byOperator.size < validators.length) {
    operatorWarnings.push('operator references are not unique; independence is not evidenced');
  }
  if (byDomain.size < 3) {
    domainWarnings.push('fewer than three failure domains; concentration risk remains');
  }
  warnings.push('organizational independence is not claimed; operator entities are simulation references only');
  return Object.freeze({
    votingPowerWarnings: Object.freeze(warnings),
    failureDomainWarnings: Object.freeze(domainWarnings),
    operatorWarnings: Object.freeze(operatorWarnings),
    organizationalIndependenceClaimed: false,
  });
}

export function validatorCandidateManifest(
  validators: readonly MainnetValidatorCandidate[] = sevenProductionCandidateValidators(),
): MainnetValidatorCandidateManifest {
  return Object.freeze({
    schemaVersion: 1,
    validators: Object.freeze([...validators]),
    concentration: evaluateConcentration(validators),
  });
}

export function encodeValidatorSet(validators: readonly MainnetValidatorCandidate[]): Buffer {
  const ordered = [...validators].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  const parts = [encodeString(VALIDATOR_CANDIDATE_DOMAIN), encodeU32(ordered.length)];
  for (const row of ordered) {
    parts.push(
      encodeString(row.validatorId),
      encodeString(row.operatorEntityReference),
      encodeString(row.consensusPublicKeyHex),
      encodeString(row.p2pPublicKeyHex),
      encodeString(row.governancePublicKeyHex),
      encodeString(row.cryptoSuite),
      encodeU64(row.votingPower),
      encodeString(row.ceremonyContributionHash),
    );
  }
  return Buffer.concat(parts);
}

export function validatorSetHash(validators: readonly MainnetValidatorCandidate[]): string {
  return sha256Hex(encodeValidatorSet(validators));
}

export function rejectTestnetKeys(validators: readonly MainnetValidatorCandidate[]): void {
  const testnet = sevenValidatorFixture();
  const testnetKeys = new Set(
    testnet.flatMap((row) => [row.consensusPublicKeyHex, row.p2pPublicKeyHex, row.governancePublicKeyHex]),
  );
  for (const row of validators) {
    if (
      testnetKeys.has(row.consensusPublicKeyHex) ||
      testnetKeys.has(row.p2pPublicKeyHex) ||
      testnetKeys.has(row.governancePublicKeyHex)
    ) {
      throw new TypeError('testnet key cannot become a production candidate key');
    }
  }
}

export function rejectSimulationHsmAsReal(validators: readonly MainnetValidatorCandidate[]): void {
  for (const row of validators) {
    if (row.hsmEvidenceClass === 'SIMULATION_HSM' && row.approvalState === 'HUMAN_VERIFIED') {
      throw new TypeError('simulation HSM cannot satisfy a real HSM requirement');
    }
  }
}

export function simulationHsmSatisfiesRealProvider(
  validators: readonly MainnetValidatorCandidate[],
): boolean {
  return validators.some((row) => row.hsmEvidenceClass === 'REAL_PROVIDER_HSM');
}
