/**
 * Full simulated root-of-trust rehearsal.
 *
 * Seven validator identities, governance, release, genesis placeholder,
 * attestations, approvals, and independent transcript verification.
 * Simulation providers only. Does not create production private keys.
 */

import { SUITE_SUNREY_ED25519_V1, SUITE_SUNREY_MLDSA_65_V1 } from '../crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { createCeremonySimulationHsm } from './provider.ts';
import { createDefaultCeremonyPlan, CeremonySession } from './session.ts';
import type { PublicCeremonyReport, RootOfTrustAuthority } from './types.ts';

export const REHEARSAL_VALIDATOR_COUNT = 7 as const;

export type CeremonyRehearsalResult = {
  readonly ok: true;
  readonly ceremonyId: string;
  readonly state: 'REHEARSAL_COMPLETE';
  readonly validatorCount: number;
  readonly transcriptHash: string;
  readonly genesisCandidateHash: string;
  readonly report: PublicCeremonyReport;
  readonly pqHardwareReadiness: 'HARDWARE_PROVIDER_UNCONFIRMED' | 'SOFTWARE_PROVIDER_AVAILABLE' | 'HARDWARE_PROVIDER_CONFIRMED';
  readonly productionAuthorityActive: false;
};

export function runFullCeremonyRehearsal(
  options: { readonly ceremonyId?: string; readonly fixtureEnv?: NodeJS.ProcessEnv } = {},
): SecurityResult<CeremonyRehearsalResult> {
  const plan = createDefaultCeremonyPlan({
    ceremonyId: options.ceremonyId ?? 'cerm_rehearsal_chunk64',
    networkCandidate: 'net_sunrey_rehearsal_1',
    requiredApprovals: 2,
    networkProfile: 'DEVELOPMENT_SIMULATION',
  });
  const session = new CeremonySession(plan, { clock: () => '2026-08-17T00:00:00.000Z' });
  const hsm = createCeremonySimulationHsm({ fixtureEnv: options.fixtureEnv ?? { SUNREY_FIXTURE_ENV: 'test' } });

  const humans: Array<{ id: string; role: Parameters<CeremonySession['registerParticipant']>[0]['role'] }> = [
    { id: 'coord-1', role: 'CEREMONY_COORDINATOR' },
    { id: 'sec-1', role: 'SECURITY_OFFICER' },
    { id: 'sec-2', role: 'SECURITY_OFFICER' },
    { id: 'gov-1', role: 'GOVERNANCE_SIGNER' },
    { id: 'gov-2', role: 'GOVERNANCE_SIGNER' },
    { id: 'gov-3', role: 'GOVERNANCE_SIGNER' },
    { id: 'rel-1', role: 'RELEASE_SIGNER' },
    { id: 'wit-1', role: 'WITNESS' },
    { id: 'obs-1', role: 'INDEPENDENT_OBSERVER' },
  ];
  for (const human of humans) {
    const registered = session.registerParticipant({
      participantId: human.id,
      displayName: human.id,
      role: human.role,
      actorKind: 'HUMAN',
    });
    if (!registered.ok) {
      return registered;
    }
  }
  for (let index = 1; index <= REHEARSAL_VALIDATOR_COUNT; index += 1) {
    const registered = session.registerParticipant({
      participantId: `val-op-${String(index).padStart(2, '0')}`,
      displayName: `validator-operator-${index}`,
      role: 'VALIDATOR_OPERATOR',
      actorKind: 'HUMAN',
    });
    if (!registered.ok) {
      return registered;
    }
  }

  const participants = session.verifyParticipants();
  if (!participants.ok) {
    return participants;
  }
  const provider = session.verifyProvider(hsm);
  if (!provider.ok) {
    return provider;
  }
  for (const participant of session.listParticipants()) {
    const identity = session.issueIdentityKey(participant.participantId);
    if (!identity.ok) {
      return identity;
    }
  }

  const genesis = session.generateAuthorityKey({
    ownerParticipantId: 'gov-1',
    authority: 'GENESIS_AUTHORITY',
    keyId: 'genesis-root-1',
  });
  if (!genesis.ok) {
    return genesis;
  }
  for (const authority of [
    'PROTOCOL_GOVERNANCE_AUTHORITY',
    'SECURITY_GOVERNANCE_AUTHORITY',
    'RECOVERY_AUTHORITY',
  ] as const satisfies readonly RootOfTrustAuthority[]) {
    const generated = session.generateAuthorityKey({
      ownerParticipantId: authority === 'RECOVERY_AUTHORITY' ? 'sec-1' : 'gov-2',
      authority,
    });
    if (!generated.ok) {
      return generated;
    }
  }
  const release = session.generateAuthorityKey({
    ownerParticipantId: 'rel-1',
    authority: 'RELEASE_AUTHORITY',
    keyId: 'release-root-1',
  });
  if (!release.ok) {
    return release;
  }

  for (let index = 1; index <= REHEARSAL_VALIDATOR_COUNT; index += 1) {
    const owner = `val-op-${String(index).padStart(2, '0')}`;
    const consensus = session.generateAuthorityKey({
      ownerParticipantId: owner,
      authority: 'VALIDATOR_CONSENSUS_AUTHORITY',
      keyId: `val-${index}-consensus`,
    });
    const p2p = session.generateAuthorityKey({
      ownerParticipantId: owner,
      authority: 'VALIDATOR_P2P_IDENTITY',
      keyId: `val-${index}-p2p`,
    });
    const governance = session.generateAuthorityKey({
      ownerParticipantId: owner,
      authority: 'VALIDATOR_GOVERNANCE_AUTHORITY',
      keyId: `val-${index}-gov`,
    });
    if (!consensus.ok) {
      return consensus;
    }
    if (!p2p.ok) {
      return p2p;
    }
    if (!governance.ok) {
      return governance;
    }
    const contributed = session.contributePublicKeys({
      operatorParticipantId: owner,
      validatorId: `val_${String(index).padStart(2, '0')}`,
      consensusKeyId: consensus.value.keyId,
      p2pKeyId: p2p.value.keyId,
      governanceKeyId: governance.value.keyId,
    });
    if (!contributed.ok) {
      return contributed;
    }
  }

  const hybridGov = session.generateAuthorityKey({
    ownerParticipantId: 'gov-3',
    authority: 'PROTOCOL_GOVERNANCE_AUTHORITY',
    suiteId: SUITE_SUNREY_MLDSA_65_V1,
    keyId: 'gov-hybrid-software-pq',
  });
  if (!hybridGov.ok) {
    return hybridGov;
  }

  for (const key of session.listKeys()) {
    const attested = session.attestKey(key.keyId, 'sec-1');
    if (!attested.ok) {
      return attested;
    }
  }
  const attestations = session.verifyAttestations();
  if (!attestations.ok) {
    return attestations;
  }

  for (const operation of [
    'CREATE_ROOT_GOVERNANCE_KEY',
    'ACTIVATE_GENESIS_SIGNING_SESSION',
    'ROTATE_RELEASE_AUTHORITY',
    'APPROVE_RECOVERY_PROCEDURE',
  ]) {
    const first = session.approve({ actorParticipantId: 'sec-1', operation });
    const second = session.approve({ actorParticipantId: 'sec-2', operation });
    if (!first.ok) {
      return first;
    }
    if (!second.ok) {
      return second;
    }
  }

  const genesisCandidateHash = sha256Hex('sunrey-genesis-candidate-placeholder-chunk64');
  const bound = session.bindGenesisCandidate({
    actorParticipantId: 'gov-1',
    genesisCandidateHash,
    networkId: 'net_sunrey_rehearsal_1',
    chainId: 'chn_sunrey_rehearsal_1',
    protocolVersion: 'sunrey-protocol-0',
    validatorSetHash: sha256Hex('seven-validator-rehearsal-set'),
    assetAllocationManifestHash: sha256Hex('asset-allocation-placeholder'),
    cryptoPolicyHash: sha256Hex('crypto-policy-placeholder'),
    moduleHashes: [sha256Hex('module-system'), sha256Hex('module-evidence')],
  });
  if (!bound.ok) {
    return bound;
  }
  const releaseBound = session.bindReleaseAuthority(release.value.keyId);
  if (!releaseBound.ok) {
    return releaseBound;
  }

  const finalized = session.finalizeTranscript('wit-1');
  if (!finalized.ok) {
    return finalized;
  }
  const verified = session.verifyIndependently();
  if (!verified.ok) {
    return verified;
  }
  const complete = session.markRehearsalComplete();
  if (!complete.ok) {
    return complete;
  }
  const production = session.awaitExternalProductionEvent();
  if (production.ok) {
    return securityErr('PRODUCTION_CLAIM_FORBIDDEN', 'rehearsal must not claim a production event');
  }

  const fingerprints = new Set(session.listKeys().map((key) => key.fingerprint));
  if (fingerprints.size !== session.listKeys().length) {
    return securityErr('AUTHORITY_SEPARATION', 'rehearsal produced duplicate fingerprints');
  }
  const pq = hsm.assessPqCapability();
  if (pq.hardware !== 'HARDWARE_PROVIDER_UNCONFIRMED') {
    return securityErr('PRODUCTION_CLAIM_FORBIDDEN', 'rehearsal cannot claim hardware PQC');
    return securityErr('PRODUCTION_CLAIM_FORBIDDEN', 'rehearsal must not claim confirmed PQ hardware');
  }
  const report = session.publicReport();
  if (!finalized.value.transcriptHash) {
    return securityErr('CEREMONY_TRANSCRIPT_TAMPERED', 'missing transcript hash');
  }
  return securityOk({
    ok: true,
    ceremonyId: plan.ceremonyId,
    state: 'REHEARSAL_COMPLETE',
    validatorCount: REHEARSAL_VALIDATOR_COUNT,
    transcriptHash: finalized.value.transcriptHash,
    genesisCandidateHash,
    report,
    pqHardwareReadiness: 'HARDWARE_PROVIDER_UNCONFIRMED',
    productionAuthorityActive: false,
  });
}

export { SUITE_SUNREY_ED25519_V1 };
