/**
 * Development and rehearsal fixtures for validator economics.
 *
 * These records are not production identities and do not configure a
 * production bond asset.
 */

import type { PublicKeyRef, ValidatorRecord, ValidatorStatus } from '../validators/types.ts';
import { CANONICAL_VALIDATOR_SUITE_ID, simulationBond } from '../validators/types.ts';

function key(role: PublicKeyRef['role'], label: string): PublicKeyRef {
  return Object.freeze({
    role,
    purpose: role === 'CONSENSUS_VOTING_KEY' ? 'VALIDATOR_CONSENSUS_SIGNING' : role,
    publicKeyHex: Buffer.from(`econ-${label}-${role}`).toString('hex').padEnd(64, '0').slice(0, 64),
    keyId: `key_econ_${label}_${role}`,
    suiteId: CANONICAL_VALIDATOR_SUITE_ID,
  });
}

export function fixtureValidatorRecord(input: {
  readonly label: string;
  readonly votingPower?: bigint;
  readonly status?: ValidatorStatus;
  readonly operatorId?: string;
}): ValidatorRecord {
  const id = input.label.toLowerCase();
  return Object.freeze({
    validatorId: `val_econ_${id}`,
    operatorActorId: input.operatorId ?? `actor.human.operator.${id}`,
    controllerKind: 'HUMAN',
    legalEntityRef: `le.econ.validator.${id}`,
    consensusPublicKey: key('CONSENSUS_VOTING_KEY', id),
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
    p2pNodeId: `node_econ_${id}`,
    p2pPublicKey: key('P2P_NODE_KEY', id),
    governancePublicKey: key('GOVERNANCE_KEY', id),
    recoveryKeyRef: key('RECOVERY_KEY', id),
    rewardAddress: null,
    bondDescriptor: simulationBond(1n),
    votingPower: input.votingPower ?? 1n,
    status: input.status ?? 'CANDIDATE',
    activationEpoch: 0n,
    exitEpoch: null,
    jurisdictionMetadata: 'development-fixture',
    protocolMetadata: 'chunk-72-fixture',
    createdHeight: 0n,
    updatedHeight: 0n,
    schemaVersion: 1,
    historicalConsensusKeys: Object.freeze([]),
  });
}

export function rehearsalValidatorRecords(): readonly ValidatorRecord[] {
  return Object.freeze(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((label) =>
      fixtureValidatorRecord({ label, status: 'CANDIDATE', votingPower: 1n }),
    ),
  );
}

export const HUMAN_GOVERNANCE_ACTOR = Object.freeze({
  actorId: 'gov_human_1',
  kind: 'HUMAN' as const,
  role: 'PROTOCOL_OPERATOR',
  governanceAuthorized: true,
});

export const AI_POLICY_ACTOR = Object.freeze({
  actorId: 'ai_prep',
  kind: 'AI' as const,
  role: 'AI_PREPARER',
  governanceAuthorized: false,
});
