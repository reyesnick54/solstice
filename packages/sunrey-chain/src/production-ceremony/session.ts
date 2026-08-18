/**
 * Production genesis ceremony session: participants, contributions,
 * attestations, signer challenges, genesis, approvals, and transcript.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SUITE_SUNREY_ED25519_V1 } from '../../../security/src/index.ts';
import { DurableSignerSafety } from '../validators/signer.ts';
import type { SignerSafetyState } from '../validators/types.ts';
import { encodeString, sha256Hex } from '../validators/canonical.ts';
import type { ArtifactBinding, ProviderAcceptanceBinding, AuditBinding } from './bindings.ts';
import { consumeCandidateV2, consumeMainnetRc } from './bindings.ts';
import {
  buildProductionGenesisManifest,
  defaultModuleRegistry,
  encodeProductionGenesis,
  productionGenesisHashOf,
  rehearsalZeroAllocation,
} from './genesis.ts';
import { createSimulationAttestation, rejectTamperedAttestation, simulationHsmCapabilities } from './hsm.ts';
import {
  PURPOSE_TO_CANONICAL,
  rejectDuplicateHighRiskKeys,
  rejectFixtureTestnetRehearsalKeys,
  signSimulationChallenge,
  verifySimulationChallenge,
} from './keys.ts';
import {
  assertHumanApproval,
  assertMultiPersonControl,
  canonicalAuthorityDossiers,
  defaultDressRehearsalParticipants,
  rejectGenericInfrastructureCredential,
} from './participants.ts';
import { assertPlanImmutability, rejectWrongCandidateV2, rejectWrongMainnetRc } from './plan.ts';
import { appendTranscriptEntry, emptyTranscript, finalizeTranscript, verifyTranscript } from './transcript.ts';
import {
  dressRehearsalKeyLabel,
  evaluateValidatorAcceptance,
  rejectFixtureGenesisEligible,
  sevenDressRehearsalDossiers,
  validatorSetHashFromDossiers,
} from './validators.ts';
import type {
  OfflineCeremonyPackage,
  ProductionCeremonyParticipant,
  ProductionCeremonyRole,
  ProductionGenesisAuthorizationPackage,
  ProductionGenesisCeremonyPlan,
  ProductionGenesisCeremonySession,
  ProductionGenesisContribution,
  ProductionHsmAttestation,
  ProductionReadinessSnapshot,
  ProductionValidatorAcceptance,
  ProductionValidatorDossier,
} from './types.ts';

const CHALLENGE_DOMAIN = 'SUNREY_PRODUCTION_CEREMONY_SIGNER_CHALLENGE_V1';
const FIXED_UTC = '2026-01-01T00:00:00.000Z';

function keysHash(values: readonly string[]): string {
  return sha256Hex(Buffer.concat([encodeString('sunrey.ceremony.keys.v1'), ...values.map((row) => encodeString(row))]));
}

export function initialSignerSafety(validatorId: string, chainId: string): SignerSafetyState {
  return Object.freeze({
    validatorId,
    chainId,
    lastSignedHeight: 0n,
    lastSignedRound: 0n,
    lastSignedStep: 'PROPOSAL',
    canonicalSignBytesHash: '',
    signatureReference: 'UNINITIALIZED_CHALLENGE_ONLY',
    updatedAt: FIXED_UTC,
  });
}

export function proveAntiDoubleSignReady(validatorId: string, chainId: string): SignerSafetyState {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-pgc-signer-'));
  const store = new DurableSignerSafety(join(dir, 'signer-safety.json'));
  const state = initialSignerSafety(validatorId, chainId);
  store.persist(state);
  const loaded = store.load();
  if (!loaded || loaded.validatorId !== validatorId || loaded.chainId !== chainId) {
    throw new TypeError('anti-double-sign state initialization failed');
  }
  return state;
}

export function backupRecoveryEvidence(signerProvider: string): {
  readonly required: true;
  readonly exportedPrivateKey: false;
  readonly evidence: string;
} {
  return Object.freeze({
    required: true,
    exportedPrivateKey: false,
    evidence: `${signerProvider} backup/recovery evidence is a provider-side handle reference. Private keys are not exported into application code.`,
  });
}

export function exportOfflinePackage(session: ProductionGenesisCeremonySession): OfflineCeremonyPackage {
  return Object.freeze({
    packageId: `offline:${session.sessionId}`,
    publicData: Object.freeze(session.contributions.map((row) => row.publicKeyHex)),
    hashes: Object.freeze([
      session.plan.mainnetRcHash,
      session.plan.candidateV2RootHash,
      session.transcript.transcriptHash,
      session.genesis?.genesisHash ?? '',
    ]),
    signingRequests: Object.freeze(['SIGNING_REQUEST:genesis-hash-acknowledgment']),
    publicSignatures: Object.freeze([]),
    attestations: Object.freeze(session.attestations.map((row) => row.attestationHash)),
    approvedMetadata: Object.freeze([session.plan.planId, session.plan.environmentClass]),
    containsSecretKeyMaterial: false,
  });
}

export function createReadinessSnapshot(input: {
  readonly provider: ProviderAcceptanceBinding;
  readonly audit: AuditBinding;
}): ProductionReadinessSnapshot {
  return Object.freeze({
    capturedAtUtc: FIXED_UTC,
    engineeringReadiness: 'ENGINEERING_VERIFIED_FOR_CEREMONY_ARCHITECTURE',
    providerReadiness: input.provider.acceptanceStatus,
    auditState: input.audit.notes,
    hsmState: 'SIMULATION_HSM_LABELED',
    legalRegulatoryState: 'NOT_PROVIDED',
    licenseState: 'MISSING',
    partnerDependencies: 'NOT_PROVIDED',
    humanAuthorization: input.provider.productionEligible ? 'INCOMPLETE' : 'INCOMPLETE',
    immutable: true,
  });
}

export class ProductionCeremonySessionController {
  #session: ProductionGenesisCeremonySession;
  readonly #candidateV2: ArtifactBinding;
  readonly #mainnetRc: ArtifactBinding;

  constructor(plan: ProductionGenesisCeremonyPlan, candidateV2: ArtifactBinding, mainnetRc: ArtifactBinding) {
    if (plan.environmentClass === 'PRODUCTION') {
      rejectWrongCandidateV2(plan, candidateV2.hash ?? '');
      rejectWrongMainnetRc(plan, mainnetRc.hash ?? '');
    }
    if (plan.environmentClass === 'DRESS_REHEARSAL') {
      rejectWrongCandidateV2(plan, candidateV2.hash ?? '');
      rejectWrongMainnetRc(plan, mainnetRc.hash ?? '');
    }
    this.#candidateV2 = candidateV2;
    this.#mainnetRc = mainnetRc;
    this.#session = Object.freeze({
      sessionId: `sess_${plan.planId}_${plan.planVersion}`,
      plan,
      participants: Object.freeze([]),
      dossiers: Object.freeze([]),
      acceptances: Object.freeze([]),
      contributions: Object.freeze([]),
      attestations: Object.freeze([]),
      authorities: canonicalAuthorityDossiers(),
      transcript: emptyTranscript(`sess_${plan.planId}_${plan.planVersion}`),
      genesis: null,
      authorization: null,
      signerSafety: Object.freeze([]),
      realProductionKeysCreated: false,
      mainnetEnabled: false,
    });
    this.#append('PLAN_BOUND', 'SYSTEM', 'SYSTEM', {
      artifactHashes: [plan.mainnetRcHash, plan.candidateV2RootHash],
    });
  }

  snapshot(): ProductionGenesisCeremonySession {
    return this.#session;
  }

  register(participant: ProductionCeremonyParticipant): void {
    rejectGenericInfrastructureCredential(participant.participantId);
    this.#session = Object.freeze({
      ...this.#session,
      participants: Object.freeze([...this.#session.participants, participant]),
    });
    this.#append('PARTICIPANT_REGISTERED', participant.role, participant.actorKind, {
      publicContribution: participant.publicIdentityHash,
    });
  }

  recordDossiers(dossiers: readonly ProductionValidatorDossier[]): void {
    rejectFixtureTestnetRehearsalKeys(
      dossiers.flatMap((row) => [
        { publicKeyHex: row.consensusPublicKeyDescriptor },
        { publicKeyHex: row.p2pPublicKey },
        { publicKeyHex: row.governanceKey },
      ]),
      { allowDressRehearsalLabels: this.#session.plan.environmentClass === 'DRESS_REHEARSAL' },
    );
    rejectDuplicateHighRiskKeys(
      dossiers.flatMap((row) => [
        { purpose: 'VALIDATOR_CONSENSUS' as const, publicKeyHex: row.consensusPublicKeyDescriptor },
        { purpose: 'VALIDATOR_GOVERNANCE' as const, publicKeyHex: row.governanceKey },
      ]),
    );
    const acceptances = dossiers.map((row) => {
      const acceptance = evaluateValidatorAcceptance(row, {
        requireRealHsm: this.#session.plan.environmentClass === 'PRODUCTION',
        humanAccepted: this.#session.plan.environmentClass === 'DRESS_REHEARSAL',
      });
      rejectFixtureGenesisEligible(acceptance, row.fixtureClass);
      return acceptance;
    });
    this.#session = Object.freeze({
      ...this.#session,
      dossiers: Object.freeze([...dossiers]),
      acceptances: Object.freeze(acceptances),
    });
    this.#append('VALIDATOR_DOSSIER_RECORDED', 'OPERATIONS_AUTHORITY', 'HUMAN', {
      artifactHashes: [validatorSetHashFromDossiers(dossiers)],
    });
  }

  checkProvider(): ReturnType<typeof simulationHsmCapabilities> {
    const capabilities = simulationHsmCapabilities();
    this.#append('PROVIDER_CHECKED', 'SECURITY_AUTHORITY', 'HUMAN', {
      artifactHashes: [sha256Hex(Buffer.from(capabilities.providerId))],
    });
    return capabilities;
  }

  contributeDressRehearsalKeys(): readonly ProductionGenesisContribution[] {
    const contributions: ProductionGenesisContribution[] = [];
    const attestations: ProductionHsmAttestation[] = [];
    for (const [index, dossier] of this.#session.dossiers.entries()) {
      const label = ['A', 'B', 'C', 'D', 'E', 'F', 'G'][index] as 'A';
      const contributed: ProductionGenesisContribution = Object.freeze({
        contributionId: `contrib-${dossier.validatorId}`,
        validatorId: dossier.validatorId,
        participantId: `human-operator-${label.toLowerCase()}`,
        purpose: 'VALIDATOR_CONSENSUS',
        publicKeyHex: dossier.consensusPublicKeyDescriptor,
        publicKeyFingerprint: sha256Hex(Buffer.from(dossier.consensusPublicKeyDescriptor, 'hex')),
        algorithm: 'Ed25519',
        providerId: dossier.signerProvider,
        keyHandle: `handle-${dossier.validatorId}-consensus`,
        environment: 'REHEARSAL',
        attestationHash: null,
      });
      const attestation = createSimulationAttestation({
        publicKeyHex: dossier.consensusPublicKeyDescriptor,
        purpose: 'VALIDATOR_CONSENSUS',
        keyHandle: contributed.keyHandle,
        humanWitness: 'human-security-1',
      });
      rejectTamperedAttestation(attestation);
      contributions.push(Object.freeze({ ...contributed, attestationHash: attestation.attestationHash }));
      attestations.push(attestation);
      this.#append('PUBLIC_CONTRIBUTION', 'VALIDATOR_OPERATOR', 'HUMAN', {
        publicContribution: contributed.publicKeyHex,
      });
      this.#append('HSM_ATTESTATION', 'SECURITY_AUTHORITY', 'HUMAN', {
        attestation: attestation.attestationHash,
      });
    }
    this.#session = Object.freeze({
      ...this.#session,
      contributions: Object.freeze(contributions),
      attestations: Object.freeze(attestations),
    });
    return this.#session.contributions;
  }

  challengeSigners(): void {
    const safety: SignerSafetyState[] = [];
    for (const [index, dossier] of this.#session.dossiers.entries()) {
      const label = ['A', 'B', 'C', 'D', 'E', 'F', 'G'][index]!;
      const message = Buffer.concat([
        encodeString(CHALLENGE_DOMAIN),
        encodeString(dossier.validatorId),
        encodeString(this.#session.plan.chainId),
        encodeString('NOT_A_PRODUCTION_BLOCK'),
      ]);
      const signed = signSimulationChallenge(
        dressRehearsalKeyLabel(label as 'A', 'consensus'),
        PURPOSE_TO_CANONICAL.VALIDATOR_CONSENSUS,
        `pgc-rehearsal-${label}-consensus`,
        message,
      );
      if (signed.publicKeyHex !== dossier.consensusPublicKeyDescriptor) {
        throw new TypeError('signer public key mismatch');
      }
      if (!verifySimulationChallenge(signed.publicKeyHex, message, signed.signatureHex)) {
        throw new TypeError('signer challenge verify failed');
      }
      safety.push(proveAntiDoubleSignReady(dossier.validatorId, this.#session.plan.chainId));
      this.#append('SIGNER_CHALLENGE', 'VALIDATOR_OPERATOR', 'HUMAN', {
        artifactHashes: [sha256Hex(message)],
      });
    }
    this.#session = Object.freeze({ ...this.#session, signerSafety: Object.freeze(safety) });
  }

  generateGenesis(): { readonly genesisHash: string; readonly canonicalBytesHex: string } {
    const dossiers = this.#session.dossiers;
    const validatorSetHash = validatorSetHashFromDossiers(dossiers);
    const validatorKeysHash = keysHash(dossiers.map((row) => row.consensusPublicKeyDescriptor));
    const governanceKeysHash = keysHash(dossiers.map((row) => row.governanceKey));
    const input = {
      plan: this.#session.plan,
      validatorSetHash,
      validatorKeysHash,
      governanceKeysHash,
      allocation: rehearsalZeroAllocation(),
      genesisTimePolicy: this.#session.plan.genesisTimePolicy,
      moduleRegistry: defaultModuleRegistry(),
    };
    const genesisHash = productionGenesisHashOf(input);
    const canonicalBytesHex = encodeProductionGenesis(input).toString('hex');
    this.#session = Object.freeze({
      ...this.#session,
      genesis: Object.freeze({
        manifest: buildProductionGenesisManifest(input),
        canonicalBytesHex,
        genesisHash,
      }),
    });
    this.#append('GENESIS_GENERATED', 'GENESIS_AUTHORITY', 'HUMAN', { artifactHashes: [genesisHash] });
    return { genesisHash, canonicalBytesHex };
  }

  verifyGenesisHash(expected: string): void {
    if (!this.#session.genesis || this.#session.genesis.genesisHash !== expected) {
      throw new TypeError('genesis hash verification failed');
    }
    this.#append('HASH_VERIFIED', 'PROTOCOL_AUTHORITY', 'HUMAN', { artifactHashes: [expected] });
  }

  approve(participant: ProductionCeremonyParticipant): void {
    assertHumanApproval(participant.actorKind, participant.role);
    rejectGenericInfrastructureCredential(participant.participantId);
    this.#append('HUMAN_APPROVAL', participant.role, participant.actorKind, {
      approval: `${participant.participantId}:${participant.role}`,
    });
  }

  rejectAiApproval(participant: ProductionCeremonyParticipant): void {
    try {
      assertHumanApproval(participant.actorKind, participant.role);
    } catch (error) {
      this.#append('APPROVAL_REJECTED', participant.role, participant.actorKind, {
        approval: error instanceof Error ? error.message : 'rejected',
      });
      throw error;
    }
  }

  sealAuthorization(snapshot: ProductionReadinessSnapshot): ProductionGenesisAuthorizationPackage {
    const approvals = this.#session.transcript.entries
      .filter((row) => row.action === 'HUMAN_APPROVAL' && row.approval)
      .map((row) => row.approval!);
    const roles = approvals
      .map((row) => row.split(':')[1] as ProductionCeremonyRole)
      .filter(Boolean);
    assertMultiPersonControl(roles);
    if (!this.#session.genesis) {
      throw new TypeError('genesis must exist before authorization');
    }
    this.#append('AUTHORIZATION_PACKAGE_SEALED', 'GENESIS_AUTHORITY', 'HUMAN', {
      artifactHashes: [this.#session.genesis.genesisHash],
    });
    const finalized = finalizeTranscript(this.#session.transcript);
    const authorization: ProductionGenesisAuthorizationPackage = Object.freeze({
      schemaVersion: 1,
      genesisHash: this.#session.genesis.genesisHash,
      mainnetRcId: this.#session.plan.mainnetRcId,
      mainnetRcHash: this.#session.plan.mainnetRcHash,
      candidateV2Id: this.#session.plan.candidateV2Id,
      candidateV2RootHash: this.#session.plan.candidateV2RootHash,
      transcriptHash: finalized.transcriptHash,
      validatorSetHash: validatorSetHashFromDossiers(this.#session.dossiers),
      humanAuthorizationSet: Object.freeze(approvals),
      readinessSnapshot: snapshot,
      usableForProduction: false,
      realProductionKeysCreated: false,
      mainnetEnabled: false,
    });
    this.#session = Object.freeze({
      ...this.#session,
      transcript: finalized,
      authorization,
    });
    return authorization;
  }

  bindExactArtifacts(): void {
    assertPlanImmutability(this.#session.plan, {
      mainnetRcHash: this.#mainnetRc.hash ?? '',
      candidateV2RootHash: this.#candidateV2.hash ?? '',
    });
  }

  verifyTranscript(): boolean {
    return verifyTranscript(this.#session.transcript).ok;
  }

  #append(
    action: Parameters<typeof appendTranscriptEntry>[1]['action'],
    role: ProductionCeremonyRole | 'SYSTEM',
    actorKind: 'HUMAN' | 'AI' | 'SERVICE' | 'AUTOMATION' | 'SYSTEM',
    extra: {
      readonly publicContribution?: string;
      readonly artifactHashes?: readonly string[];
      readonly approval?: string;
      readonly attestation?: string;
    } = {},
  ): void {
    this.#session = Object.freeze({
      ...this.#session,
      transcript: appendTranscriptEntry(this.#session.transcript, {
        action,
        participantRole: role,
        actorKind,
        occurredAtUtc: FIXED_UTC,
        ...extra,
      }),
    });
  }
}

export function dressRehearsalBindings(root = process.cwd()): {
  readonly candidateV2: ArtifactBinding;
  readonly mainnetRc: ArtifactBinding;
} {
  return {
    candidateV2: consumeCandidateV2(root),
    mainnetRc: consumeMainnetRc(root),
  };
}

void sevenDressRehearsalDossiers;
void defaultDressRehearsalParticipants;
void SUITE_SUNREY_ED25519_V1;
