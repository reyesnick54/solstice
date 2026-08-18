/**
 * sunrey-ceremony CLI.
 *
 * Commands: plan, participants, provider-check, generate, contribute,
 * attest, approve, transcript, verify, rehearse.
 * Simulation / rehearsal only. Never prints private key material.
 */

import { assertNoPrivateKeyMaterial } from '../crypto-leakage.ts';
import { createCeremonySimulationHsm } from './provider.ts';
import { runFullCeremonyRehearsal } from './rehearsal.ts';
import { CeremonySession, createDefaultCeremonyPlan } from './session.ts';

export type CeremonyCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'plan',
  'participants',
  'provider-check',
  'generate',
  'contribute',
  'attest',
  'approve',
  'transcript',
  'verify',
  'rehearse',
  'help',
] as const;

export function runSunreyCeremony(argv: readonly string[]): CeremonyCliResult {
  const [command = 'help'] = argv;
  if (command === 'help' || !(COMMANDS as readonly string[]).includes(command)) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage: 'sunrey-ceremony <plan|participants|provider-check|generate|contribute|attest|approve|transcript|verify|rehearse>',
        simulation: true,
        productionKeysCreated: false,
      },
    };
  }

  if (command === 'rehearse' || command === 'verify' || command === 'transcript') {
    const rehearsal = runFullCeremonyRehearsal();
    if (!rehearsal.ok) {
      return { ok: false, command, payload: rehearsal.error };
    }
    const payload =
      command === 'transcript'
        ? { transcriptHash: rehearsal.value.transcriptHash, ceremonyId: rehearsal.value.ceremonyId }
        : command === 'verify'
          ? { verified: true, transcriptHash: rehearsal.value.transcriptHash }
          : rehearsal.value;
    assertNoPrivateKeyMaterial(payload, 'ceremony-cli');
    return { ok: true, command, payload };
  }

  const plan = createDefaultCeremonyPlan({ ceremonyId: 'cerm_cli_preview' });
  if (command === 'plan') {
    assertNoPrivateKeyMaterial(plan, 'ceremony-cli');
    return { ok: true, command, payload: plan };
  }

  const session = new CeremonySession(plan);
  const hsm = createCeremonySimulationHsm({ fixtureEnv: { SUNREY_FIXTURE_ENV: 'local' } });
  session.registerParticipant({
    participantId: 'coord-1',
    displayName: 'coordinator',
    role: 'CEREMONY_COORDINATOR',
    actorKind: 'HUMAN',
  });
  session.registerParticipant({
    participantId: 'sec-1',
    displayName: 'security',
    role: 'SECURITY_OFFICER',
    actorKind: 'HUMAN',
  });

  if (command === 'participants') {
    const payload = { roles: plan.participantRoles, registered: session.listParticipants() };
    assertNoPrivateKeyMaterial(payload, 'ceremony-cli');
    return { ok: true, command, payload };
  }
  if (command === 'provider-check') {
    const verified = session.verifyProvider(hsm);
    const payload = verified.ok
      ? { verified: true, capabilities: hsm.capabilities(), pq: hsm.assessPqCapability() }
      : verified.error;
    assertNoPrivateKeyMaterial(payload, 'ceremony-cli');
    return { ok: verified.ok, command, payload };
  }
  if (command === 'generate' || command === 'contribute' || command === 'attest' || command === 'approve') {
    session.verifyProvider(hsm);
    session.issueIdentityKey('sec-1');
    const generated = session.generateAuthorityKey({
      ownerParticipantId: 'sec-1',
      authority: command === 'generate' ? 'RECOVERY_AUTHORITY' : 'RELEASE_AUTHORITY',
    });
    if (!generated.ok) {
      return { ok: false, command, payload: generated.error };
    }
    if (command === 'contribute') {
      const contributed = session.contributePublicKeys({
        operatorParticipantId: 'sec-1',
        validatorId: null,
      });
      if (!contributed.ok) {
        return { ok: false, command, payload: contributed.error };
      }
      assertNoPrivateKeyMaterial(contributed.value, 'ceremony-cli');
      return { ok: true, command, payload: contributed.value };
    }
    if (command === 'attest') {
      const attested = session.attestKey(generated.value.keyId, 'sec-1');
      if (!attested.ok) {
        return { ok: false, command, payload: attested.error };
      }
      assertNoPrivateKeyMaterial(attested.value, 'ceremony-cli');
      return { ok: true, command, payload: attested.value };
    }
    if (command === 'approve') {
      const approved = session.approve({ actorParticipantId: 'sec-1', operation: 'CREATE_ROOT_GOVERNANCE_KEY' });
      if (!approved.ok) {
        return { ok: false, command, payload: approved.error };
      }
      assertNoPrivateKeyMaterial(approved.value, 'ceremony-cli');
      return { ok: true, command, payload: approved.value };
    }
    assertNoPrivateKeyMaterial(generated.value, 'ceremony-cli');
    return { ok: true, command, payload: generated.value };
  }

  return { ok: false, command, payload: { message: 'unknown command' } };
}

function main(): void {
  const result = runSunreyCeremony(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result.payload, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

const invoked = /(?:^|[\\/])packages[\\/]security[\\/]src[\\/]ceremony[\\/]cli\.ts$/.test(process.argv[1] ?? '');
if (invoked) {
  main();
}
