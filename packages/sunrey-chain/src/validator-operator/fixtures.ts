/**
 * Isolated seven-validator rehearsal fixtures.
 *
 * Operator A and operator B are independent controllers. Validator IDs
 * do not imply organizational independence: two of operator A's
 * validators share a controller with a third id under the same org.
 */

import { fingerprintOf } from './hash.ts';

/** Canonical Chunk 81 identity; imported as a literal to avoid mashed graphs. */
export const CANDIDATE_V2_ID = 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_2' as const;

/** Chunk 85 dossier is consumed by reference, not re-authored. */
export const CHUNK_85_DOSSIER_VALIDATOR_ID = 'val_pgc_rehearsal_1_a' as const;
import {
  CANONICAL_STATUS_MAP,
  DEFAULT_QUORUM_POLICY,
  VALIDATOR_OPERATOR_NOW_UTC,
  type OperatorPrincipal,
  type ValidatorFleet,
  type ValidatorFleetHealth,
  type ValidatorNodeRecord,
  type ValidatorOperator,
  type ValidatorOperatorOrganization,
  type ValidatorOperatorProfile,
  type ValidatorSignerRecord,
} from './types.ts';

export const REHEARSAL_FLEET_ID = 'fleet_rehearsal_7' as const;
export const OPERATOR_A_ID = 'op_alpha' as const;
export const OPERATOR_B_ID = 'op_beta' as const;
export const ORG_A_ID = 'org_alpha' as const;
export const ORG_B_ID = 'org_beta' as const;

export const REHEARSAL_VALIDATOR_IDS = [
  'val_op_a',
  'val_op_b',
  'val_op_c',
  'val_op_d',
  'val_op_e',
  'val_op_f',
  'val_op_g',
] as const;

export const OPERATOR_A_VALIDATORS = ['val_op_a', 'val_op_b', 'val_op_c', 'val_op_d'] as const;
export const OPERATOR_B_VALIDATORS = ['val_op_e', 'val_op_f', 'val_op_g'] as const;

const REGIONS = ['eu-west', 'eu-west', 'us-east', 'us-east', 'ap-south', 'ap-south', 'eu-central'] as const;
const DOMAINS = ['fd-1', 'fd-2', 'fd-1', 'fd-3', 'fd-2', 'fd-3', 'fd-1'] as const;
const CLOUDS = ['cloud-a', 'cloud-a', 'cloud-b', 'cloud-b', 'cloud-c', 'cloud-c', 'cloud-a'] as const;
const HSM = ['hsm-sim-a', 'hsm-sim-a', 'hsm-sim-b', 'hsm-sim-b', 'hsm-sim-c', 'hsm-sim-a', 'hsm-sim-c'] as const;

export function fixtureOrganizations(): readonly ValidatorOperatorOrganization[] {
  return Object.freeze([
    Object.freeze({
      organizationId: ORG_A_ID,
      legalName: 'Alpha Validator Operations',
      controllerReference: 'controller_alpha',
      independenceClaimed: false,
    }),
    Object.freeze({
      organizationId: ORG_B_ID,
      legalName: 'Beta Validator Operations',
      controllerReference: 'controller_beta',
      independenceClaimed: false,
    }),
  ]);
}

export function fixtureProfiles(): readonly ValidatorOperatorProfile[] {
  return Object.freeze([
    Object.freeze({
      profileId: 'profile_alpha',
      operatorId: OPERATOR_A_ID,
      publicDescriptor: 'Alpha rehearsal operator',
      infrastructureEvidenceRef: 'ev_infra_alpha',
      signerEvidenceRef: 'ev_signer_alpha',
      securityEvidenceRef: 'ev_sec_alpha',
      privatePersonalDetailsExposed: false,
    }),
    Object.freeze({
      profileId: 'profile_beta',
      operatorId: OPERATOR_B_ID,
      publicDescriptor: 'Beta rehearsal operator',
      infrastructureEvidenceRef: 'ev_infra_beta',
      signerEvidenceRef: 'ev_signer_beta',
      securityEvidenceRef: 'ev_sec_beta',
      privatePersonalDetailsExposed: false,
    }),
  ]);
}

function contact(id: string, role: string, reference: string) {
  return Object.freeze({
    contactId: id,
    role,
    channel: 'PAGER_REF' as const,
    reference,
  });
}

export function fixtureOperators(): readonly ValidatorOperator[] {
  return Object.freeze([
    Object.freeze({
      operatorId: OPERATOR_A_ID,
      organizationId: ORG_A_ID,
      authorizedContacts: [contact('c_alpha_ops', 'ops', 'pager://alpha-ops')],
      operationalRegion: 'eu-west',
      providerReferences: ['cloud-a', 'hsm-sim-a'],
      securityEvidenceReferences: ['ev_sec_alpha'],
      incidentContacts: [contact('c_alpha_ir', 'incident', 'pager://alpha-ir')],
      acceptanceStatus: 'FIXTURE_REHEARSAL_ONLY',
      profileId: 'profile_alpha',
      fixture: true,
    }),
    Object.freeze({
      operatorId: OPERATOR_B_ID,
      organizationId: ORG_B_ID,
      authorizedContacts: [contact('c_beta_ops', 'ops', 'pager://beta-ops')],
      operationalRegion: 'ap-south',
      providerReferences: ['cloud-c', 'hsm-sim-c'],
      securityEvidenceReferences: ['ev_sec_beta'],
      incidentContacts: [contact('c_beta_ir', 'incident', 'pager://beta-ir')],
      acceptanceStatus: 'FIXTURE_REHEARSAL_ONLY',
      profileId: 'profile_beta',
      fixture: true,
    }),
  ]);
}

export function operatorForValidator(validatorId: string): string {
  return (OPERATOR_A_VALIDATORS as readonly string[]).includes(validatorId) ? OPERATOR_A_ID : OPERATOR_B_ID;
}

export function fixtureNodes(): readonly ValidatorNodeRecord[] {
  const validators = REHEARSAL_VALIDATOR_IDS.map((validatorId, index) =>
    Object.freeze({
      nodeId: `node_${validatorId}`,
      validatorId,
      operatorId: operatorForValidator(validatorId),
      kind: 'VALIDATOR' as const,
      operationalState: 'ACTIVE' as const,
      canonicalStatus: CANONICAL_STATUS_MAP.ACTIVE,
      region: REGIONS[index]!,
      failureDomain: DOMAINS[index]!,
      cloudProvider: CLOUDS[index]!,
      softwareRelease: 'sunrey-node/1.0.0',
      protocolVersion: '1',
      artifactDigest: fingerprintOf('sunrey-node/1.0.0'),
      canSign: true,
    }),
  );
  const sentries = REHEARSAL_VALIDATOR_IDS.flatMap((validatorId, index) => [
    Object.freeze({
      nodeId: `sentry_${validatorId}_1`,
      validatorId,
      operatorId: operatorForValidator(validatorId),
      kind: 'SENTRY' as const,
      operationalState: 'ACTIVE' as const,
      canonicalStatus: null,
      region: REGIONS[index]!,
      failureDomain: DOMAINS[index]!,
      cloudProvider: CLOUDS[index]!,
      softwareRelease: 'sunrey-node/1.0.0',
      protocolVersion: '1',
      artifactDigest: fingerprintOf('sunrey-node/1.0.0'),
      canSign: false,
    }),
    Object.freeze({
      nodeId: `sentry_${validatorId}_2`,
      validatorId,
      operatorId: operatorForValidator(validatorId),
      kind: 'SENTRY' as const,
      operationalState: 'ACTIVE' as const,
      canonicalStatus: null,
      region: REGIONS[index]!,
      failureDomain: `${DOMAINS[index]!}-alt`,
      cloudProvider: CLOUDS[index]!,
      softwareRelease: 'sunrey-node/1.0.0',
      protocolVersion: '1',
      artifactDigest: fingerprintOf('sunrey-node/1.0.0'),
      canSign: false,
    }),
  ]);
  return Object.freeze([...validators, ...sentries]);
}

export function fixtureSigners(): readonly ValidatorSignerRecord[] {
  return Object.freeze(
    REHEARSAL_VALIDATOR_IDS.map((validatorId, index) =>
      Object.freeze({
        signerId: `signer_${validatorId}`,
        validatorId,
        operatorId: operatorForValidator(validatorId),
        keyPurpose: 'CONSENSUS_VOTING' as const,
        publicKeyFingerprint: fingerprintOf(`consensus:${validatorId}`),
        provider: HSM[index]!,
        hsmKmsState: 'SIMULATION' as const,
        algorithm: 'sunrey-ed25519-v1',
        rotationState: 'CURRENT' as const,
        fencingState: 'ACTIVE' as const,
        antiDoubleSignState: 'READY' as const,
        watermarkHeight: 100n,
        privateKeyPresent: false,
      }),
    ),
  );
}

export function emptyFleetHealth(fleetId: string, totalVotingPower: bigint): ValidatorFleetHealth {
  return Object.freeze({
    fleetId,
    healthyNodes: 7,
    degradedNodes: 0,
    offlineNodes: 0,
    signerConflicts: 0,
    quorumSafe: true,
    remainingVotingPower: totalVotingPower,
    totalVotingPower,
    samples: [],
  });
}

export function fixtureFleet(): ValidatorFleet {
  return Object.freeze({
    fleetId: REHEARSAL_FLEET_ID,
    operatorId: OPERATOR_A_ID,
    validators: [...REHEARSAL_VALIDATOR_IDS],
    sentries: REHEARSAL_VALIDATOR_IDS.flatMap((id) => [`sentry_${id}_1`, `sentry_${id}_2`]),
    signers: REHEARSAL_VALIDATOR_IDS.map((id) => `signer_${id}`),
    regions: [...new Set(REGIONS)],
    failureDomains: [...new Set(DOMAINS)],
    cloudProviders: [...new Set(CLOUDS)],
    softwareRelease: 'sunrey-node/1.0.0',
    protocolVersion: '1',
    health: emptyFleetHealth(REHEARSAL_FLEET_ID, 7n),
  });
}

export function fixturePrincipal(
  operatorId: typeof OPERATOR_A_ID | typeof OPERATOR_B_ID,
  role: OperatorPrincipal['role'] = 'OPERATOR_ADMIN',
  kind: OperatorPrincipal['kind'] = 'HUMAN',
): OperatorPrincipal {
  return Object.freeze({
    actorId: `${operatorId}_${role.toLowerCase()}`,
    operatorId,
    role,
    kind,
    tokenId: `tok_${operatorId}_${role.toLowerCase()}`,
    workloadId: kind === 'WORKLOAD' ? `wl_${operatorId}` : null,
  });
}

export function rehearsalCandidateV2Id(): typeof CANDIDATE_V2_ID {
  return CANDIDATE_V2_ID;
}

export function rehearsalDossierValidatorId(): string {
  return CHUNK_85_DOSSIER_VALIDATOR_ID;
}

export function rehearsalNowUtc(): string {
  return VALIDATOR_OPERATOR_NOW_UTC;
}

export function rehearsalQuorumPolicy() {
  return DEFAULT_QUORUM_POLICY;
}
