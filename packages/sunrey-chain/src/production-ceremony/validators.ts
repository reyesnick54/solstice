/**
 * ProductionValidatorDossier, evidence, and acceptance.
 *
 * Fixture validators can never become GENESIS_ELIGIBLE.
 * Organizational independence is not claimed.
 */

import { SUITE_SUNREY_ED25519_V1, type KeyPurpose } from '../../../security/src/index.ts';
import { FIXTURE_KEY_MARKER } from '../testnet/security.ts';
import { encodeString, encodeU32, encodeU64, sha256Hex } from '../validators/canonical.ts';
import {
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_NETWORK_ID,
} from './identity.ts';
import { PURPOSE_TO_CANONICAL, deriveSimulationPublicKey, fingerprintOf } from './keys.ts';
import type {
  ProductionValidatorAcceptance,
  ProductionValidatorDossier,
  ProductionValidatorEvidenceRef,
  ValidatorAcceptanceState,
  ValidatorEvidenceKind,
} from './types.ts';
import { VALIDATOR_EVIDENCE_KINDS } from './types.ts';

export const CEREMONY_VALIDATOR_DOMAIN = 'SUNREY_PRODUCTION_CEREMONY_VALSET_V1' as const;
export const CEREMONY_VALIDATOR_COUNT = 7 as const;
export const CEREMONY_VALIDATOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type CeremonyValidatorLabel = (typeof CEREMONY_VALIDATOR_LABELS)[number];

const ROLE_PURPOSE = {
  consensus: 'VALIDATOR_CONSENSUS',
  p2p: 'VALIDATOR_P2P',
  governance: 'VALIDATOR_GOVERNANCE',
} as const;

export function dressRehearsalKeyLabel(
  validator: CeremonyValidatorLabel,
  role: keyof typeof ROLE_PURPOSE,
): string {
  return `SUNREY_PRODUCTION_GENESIS_CEREMONY_REHEARSAL_1_FIXTURE_VALIDATOR_${validator}_${role.toUpperCase()}_${FIXTURE_KEY_MARKER}_v1`;
}

function emptyEvidence(): readonly ProductionValidatorEvidenceRef[] {
  return Object.freeze(
    VALIDATOR_EVIDENCE_KINDS.map((kind) =>
      Object.freeze({
        kind,
        reference: null,
        hash: null,
        state: 'ABSENT' as const,
        notes: kind === 'OTHER_GOVERNED_REQUIREMENT' ? 'No additional governed requirement recorded.' : 'Evidence not provided.',
      }),
    ),
  );
}

export function configuredEvidence(overrides: Partial<Record<ValidatorEvidenceKind, ProductionValidatorEvidenceRef>> = {}): readonly ProductionValidatorEvidenceRef[] {
  return Object.freeze(
    VALIDATOR_EVIDENCE_KINDS.map((kind) => overrides[kind] ?? emptyEvidence().find((row) => row.kind === kind)!),
  );
}

export function evidenceComplete(evidence: readonly ProductionValidatorEvidenceRef[]): boolean {
  const required: readonly ValidatorEvidenceKind[] = [
    'OPERATOR_IDENTITY',
    'INFRASTRUCTURE_READINESS',
    'SECURITY_CONTROLS',
    'SIGNER_READINESS',
    'HSM_ATTESTATION',
    'OPERATIONS_RUNBOOK_ACKNOWLEDGEMENT',
    'GOVERNANCE_AGREEMENT',
    'INCIDENT_CONTACT',
  ];
  return required.every((kind) => evidence.some((row) => row.kind === kind && row.state === 'VERIFIED'));
}

export function sevenDressRehearsalDossiers(): readonly ProductionValidatorDossier[] {
  return Object.freeze(
    CEREMONY_VALIDATOR_LABELS.map((label, index) => {
      const consensus = deriveSimulationPublicKey(
        dressRehearsalKeyLabel(label, 'consensus'),
        PURPOSE_TO_CANONICAL.VALIDATOR_CONSENSUS,
        `pgc-rehearsal-${label}-consensus`,
      );
      const p2p = deriveSimulationPublicKey(
        dressRehearsalKeyLabel(label, 'p2p'),
        PURPOSE_TO_CANONICAL.VALIDATOR_P2P,
        `pgc-rehearsal-${label}-p2p`,
      );
      const governance = deriveSimulationPublicKey(
        dressRehearsalKeyLabel(label, 'governance'),
        PURPOSE_TO_CANONICAL.VALIDATOR_GOVERNANCE,
        `pgc-rehearsal-${label}-governance`,
      );
      return Object.freeze({
        validatorId: `val_pgc_rehearsal_1_${label.toLowerCase()}`,
        legalOperatorReference: `operator.pgc.rehearsal.1.${label.toLowerCase()}`,
        operatorEvidenceState: 'PROVIDED',
        consensusPublicKeyDescriptor: consensus,
        p2pPublicKey: p2p,
        governanceKey: governance,
        signerProvider: 'sunrey-ceremony-hsm-simulator',
        hsmEvidenceClass: 'SIMULATION_HSM',
        hsmEvidenceReference: `sim-attest:${label}`,
        bondConfiguration: 'UNCONFIGURED',
        failureDomain: `fd_pgc_rehearsal_${['alpha', 'bravo', 'charlie'][index % 3]}`,
        infrastructureProvider: 'simulation-provider',
        networkEndpoints: Object.freeze([`pgc-rehearsal-${label.toLowerCase()}.invalid:26656`]),
        incidentContactReference: `incident.pgc.rehearsal.${label.toLowerCase()}`,
        ceremonyContributionState: 'PENDING',
        fixtureClass: true,
        evidence: emptyEvidence(),
        organizationalIndependenceClaimed: false,
      });
    }),
  );
}

export function validatorSetHashFromDossiers(dossiers: readonly ProductionValidatorDossier[]): string {
  const ordered = [...dossiers].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  const parts = [encodeString(CEREMONY_VALIDATOR_DOMAIN), encodeU32(ordered.length)];
  for (const row of ordered) {
    parts.push(
      encodeString(row.validatorId),
      encodeString(row.legalOperatorReference ?? ''),
      encodeString(row.consensusPublicKeyDescriptor),
      encodeString(row.p2pPublicKey),
      encodeString(row.governanceKey),
      encodeString(SUITE_SUNREY_ED25519_V1),
      encodeU64(1n),
      encodeString(row.failureDomain),
      encodeString(row.bondConfiguration),
    );
  }
  return sha256Hex(Buffer.concat(parts));
}

export function evaluateValidatorAcceptance(
  dossier: ProductionValidatorDossier,
  options: { readonly requireRealHsm?: boolean; readonly humanAccepted?: boolean } = {},
): ProductionValidatorAcceptance {
  if (dossier.fixtureClass && options.humanAccepted) {
    return Object.freeze({
      validatorId: dossier.validatorId,
      state: 'HUMAN_ACCEPTED',
      configuredEvidenceComplete: evidenceComplete(dossier.evidence),
      rejectionReason: 'fixture validators can never become GENESIS_ELIGIBLE',
    });
  }
  if (dossier.fixtureClass) {
    const state: ValidatorAcceptanceState = evidenceComplete(dossier.evidence)
      ? 'TECHNICALLY_VERIFIED'
      : 'CANDIDATE';
    return Object.freeze({
      validatorId: dossier.validatorId,
      state,
      configuredEvidenceComplete: evidenceComplete(dossier.evidence),
      rejectionReason: 'fixture validators can never become GENESIS_ELIGIBLE',
    });
  }
  if (options.requireRealHsm && dossier.hsmEvidenceClass !== 'REAL_PROVIDER_HSM') {
    return Object.freeze({
      validatorId: dossier.validatorId,
      state: 'EXTERNAL_EVIDENCE_REQUIRED',
      configuredEvidenceComplete: false,
      rejectionReason: 'simulation HSM cannot satisfy a real HSM requirement',
    });
  }
  if (!evidenceComplete(dossier.evidence)) {
    return Object.freeze({
      validatorId: dossier.validatorId,
      state: 'EXTERNAL_EVIDENCE_REQUIRED',
      configuredEvidenceComplete: false,
      rejectionReason: 'configured operator evidence is incomplete',
    });
  }
  if (!options.humanAccepted) {
    return Object.freeze({
      validatorId: dossier.validatorId,
      state: 'TECHNICALLY_VERIFIED',
      configuredEvidenceComplete: true,
      rejectionReason: null,
    });
  }
  return Object.freeze({
    validatorId: dossier.validatorId,
    state: 'GENESIS_ELIGIBLE',
    configuredEvidenceComplete: true,
    rejectionReason: null,
  });
}

export function rejectFixtureGenesisEligible(acceptance: ProductionValidatorAcceptance, fixtureClass: boolean): void {
  if (fixtureClass && acceptance.state === 'GENESIS_ELIGIBLE') {
    throw new TypeError('fixture validator rejected from GENESIS_ELIGIBLE');
  }
}

export function rehearsalValidatorConsistencyPayload(dossiers: readonly ProductionValidatorDossier[]): {
  readonly networkId: typeof DRESS_REHEARSAL_NETWORK_ID;
  readonly chainId: typeof DRESS_REHEARSAL_CHAIN_ID;
  readonly validatorSetHash: string;
  readonly fingerprints: readonly string[];
} {
  return Object.freeze({
    networkId: DRESS_REHEARSAL_NETWORK_ID,
    chainId: DRESS_REHEARSAL_CHAIN_ID,
    validatorSetHash: validatorSetHashFromDossiers(dossiers),
    fingerprints: Object.freeze(
      dossiers.flatMap((row) => [
        fingerprintOf(row.consensusPublicKeyDescriptor),
        fingerprintOf(row.p2pPublicKey),
        fingerprintOf(row.governanceKey),
      ]),
    ),
  });
}

export function purposeForRole(role: keyof typeof ROLE_PURPOSE): KeyPurpose {
  return PURPOSE_TO_CANONICAL[ROLE_PURPOSE[role]];
}
