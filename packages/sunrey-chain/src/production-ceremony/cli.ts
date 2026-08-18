/**
 * sunrey-ceremony production commands.
 *
 * Simulation / dress rehearsal only. Never prints private key material.
 * Does not launch mainnet.
 */

import { assertNoPrivateKeyMaterial } from '../../../security/src/crypto-leakage.ts';
import {
  consumeAuditEvidence,
  consumeCandidateV2,
  consumeMainnetRc,
  consumeProviderAcceptance,
  cryptoPolicyHash,
  economicBundleHash,
  productionAllocationHash,
} from './bindings.ts';
import { runProductionGenesisCeremonyDressRehearsal } from './dress-rehearsal.ts';
import { evaluateCurrentProductionState } from './eligibility.ts';
import { createProductionCeremonyPlan } from './plan.ts';
import { defaultDressRehearsalParticipants } from './participants.ts';
import { simulationHsmCapabilities } from './hsm.ts';
import { sevenDressRehearsalDossiers, validatorSetHashFromDossiers } from './validators.ts';
import { verifyTranscript } from './transcript.ts';

export type ProductionCeremonyCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'plan',
  'validators',
  'participants',
  'provider-check',
  'contribute',
  'attest',
  'genesis',
  'verify',
  'transcript',
  'authorization-dossier',
  'rehearse',
  'help',
] as const;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

export function runProductionCeremonyCommand(argv: readonly string[], root = process.cwd()): ProductionCeremonyCliResult {
  const [command = 'help'] = argv;
  if (command === 'help' || !(COMMANDS as readonly string[]).includes(command)) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage:
          'sunrey-ceremony production <plan|validators|participants|provider-check|contribute|attest|genesis|verify|transcript|authorization-dossier|rehearse>',
        simulation: true,
        realProductionKeysCreated: false,
        mainnetEnabled: false,
      },
    };
  }

  if (command === 'plan') {
    const state = evaluateCurrentProductionState(root);
    const dossiers = sevenDressRehearsalDossiers();
    const plan = createProductionCeremonyPlan({
      mainnetRcHash: state.mainnetRc.hash ?? 'ABSENT',
      candidateV2RootHash: state.candidateV2.hash ?? 'ABSENT',
      economicBundleHash: economicBundleHash(),
      cryptoPolicyHash: cryptoPolicyHash(),
      validatorCandidateSetHash: validatorSetHashFromDossiers(dossiers),
      networkId: 'net_sunrey_production_candidate_1',
      chainId: 'chn_sunrey_production_candidate_1',
      addressHrp: 'srprd',
      allocationManifestHash: productionAllocationHash(),
    });
    const payload = jsonSafe({
      plan,
      candidateV2: state.candidateV2,
      mainnetRc: state.mainnetRc,
      eligibility: state.eligibility,
      realProductionKeysCreated: false,
      mainnetEnabled: false,
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }

  if (command === 'validators') {
    const payload = jsonSafe({
      dossiers: sevenDressRehearsalDossiers(),
      fixtureClass: true,
      genesisEligible: false,
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }

  if (command === 'participants') {
    const payload = jsonSafe({ participants: defaultDressRehearsalParticipants() });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }

  if (command === 'provider-check') {
    const payload = jsonSafe({
      hsm: simulationHsmCapabilities(),
      providerAcceptance: consumeProviderAcceptance(root),
      candidateV2: consumeCandidateV2(root),
      mainnetRc: consumeMainnetRc(root),
      audit: consumeAuditEvidence(root),
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }

  const rehearsal = runProductionGenesisCeremonyDressRehearsal(root);
  if (command === 'contribute') {
    const payload = jsonSafe({ contributions: rehearsal.session.contributions });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }
  if (command === 'attest') {
    const payload = jsonSafe({ attestations: rehearsal.session.attestations });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }
  if (command === 'genesis') {
    const payload = jsonSafe({
      genesisHash: rehearsal.genesisHash,
      manifest: rehearsal.session.genesis?.manifest,
      jsonIsNotConsensus: true,
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }
  if (command === 'verify') {
    const verified = verifyTranscript(rehearsal.session.transcript);
    const payload = jsonSafe({
      transcript: verified,
      mainnetRcVerified: rehearsal.report.mainnetRcVerified,
      candidateV2Verified: rehearsal.report.candidateV2Verified,
      genesisHash: rehearsal.genesisHash,
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: verified.ok, command, payload };
  }
  if (command === 'transcript') {
    const payload = jsonSafe({
      transcriptHash: rehearsal.session.transcript.transcriptHash,
      entries: rehearsal.session.transcript.entries.length,
      verified: rehearsal.transcriptVerified,
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }
  if (command === 'authorization-dossier') {
    const payload = jsonSafe({
      dossier: rehearsal.dossier,
      executesLaunch: false,
    });
    assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
    return { ok: true, command, payload };
  }

  const payload = jsonSafe({
    rehearsalId: rehearsal.rehearsalId,
    genesisHash: rehearsal.genesisHash,
    transcriptVerified: rehearsal.transcriptVerified,
    eligibility: rehearsal.report.eligibility,
    blockers: rehearsal.report.externalBlockers.map((row) => row.code),
    usableForProduction: false,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
  });
  assertNoPrivateKeyMaterial(payload, 'production-ceremony-cli');
  return { ok: rehearsal.transcriptVerified && rehearsal.usableForProduction === false, command, payload };
}
