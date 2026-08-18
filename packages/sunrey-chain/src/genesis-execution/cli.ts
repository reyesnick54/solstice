/**
 * sunrey-launch production commands.
 *
 * CI uses rehearsal flags and isolated rehearsal inputs only.
 * None of these commands launch real production mainnet.
 */

import { assertNoPrivateKeyMaterial } from '../../../security/src/crypto-leakage.ts';
import { verifyLaunchEvents } from './events.ts';
import {
  productionModeRefusesFixtures,
  runAuthorizedGenesisExecution,
  runIsolatedGenesisExecutionRehearsal,
} from './engine.ts';
import { resetPermitRegistry } from './permit.ts';
import { buildLaunchExecutionReport } from './report.ts';
import { runAdversarialCase } from './adversarial.ts';

export type ProductionLaunchCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'plan',
  'verify',
  'authorization',
  'permit',
  'readiness',
  'control-room',
  'execute',
  'first-block',
  'report',
  'rehearse',
  'help',
] as const;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

let cached = null as ReturnType<typeof runIsolatedGenesisExecutionRehearsal> | null;

export function resetProductionLaunchCliCache(): void {
  cached = null;
  resetPermitRegistry();
}

function session(root = process.cwd()) {
  cached ??= runIsolatedGenesisExecutionRehearsal(root);
  return cached;
}

export function runProductionLaunchCommand(argv: readonly string[], root = process.cwd()): ProductionLaunchCliResult {
  const [command = 'help', arg = ''] = argv;
  if (command === 'help' || !(COMMANDS as readonly string[]).includes(command)) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage:
          'sunrey-launch production <plan|verify|authorization|permit|readiness|control-room|execute|first-block|report>',
        rehearsalOnlyInCi: true,
        realProductionExecutionPerformed: false,
        mainnetEnabled: false,
      },
    };
  }

  if (command === 'rehearse' || command === 'execute') {
    resetProductionLaunchCliCache();
    const ran = session(root);
    const payload = jsonSafe({
      sessionId: ran.sessionId,
      state: ran.state,
      mode: ran.mode,
      planHash: ran.plan.planHash,
      genesisHash: ran.genesis?.genesisHash ?? null,
      firstBlockVerified: ran.firstBlock?.verified === true,
      supplyAuditOk: ran.supplyAudit?.ok === true,
      capabilityActivationUnchanged: ran.capabilityMatrixUnchanged,
      realProductionExecutionPerformed: false,
      mainnetEnabled: false,
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.state === 'INITIAL_CHAIN_VERIFIED', command, payload };
  }

  const ran = session(root);
  if (command === 'plan') {
    const payload = jsonSafe({
      plan: ran.plan,
      planHash: ran.plan.planHash,
      usableForProduction: false,
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: true, command, payload };
  }
  if (command === 'verify') {
    const payload = jsonSafe({
      planHash: ran.plan.planHash,
      eventsVerified: verifyLaunchEvents(ran.events),
      firstBlockVerified: ran.firstBlock?.verified === true,
      supplyAuditOk: ran.supplyAudit?.ok === true,
      productionFixturesRejected: productionModeRefusesFixtures(root),
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.state === 'INITIAL_CHAIN_VERIFIED', command, payload };
  }
  if (command === 'authorization') {
    const payload = jsonSafe({
      authorization: ran.authorization,
      roles: ran.authorization?.authorizations.map((row) => row.role) ?? [],
      occupiedByAi: false,
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.authorization?.complete === true, command, payload };
  }
  if (command === 'permit') {
    const payload = jsonSafe({
      permit: ran.permit,
      singleUse: true,
      consumed: ran.permit?.consumed === true,
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.permit !== null, command, payload };
  }
  if (command === 'readiness') {
    const payload = jsonSafe({
      validators: ran.validators,
      services: ran.services,
      observability: ran.observability,
      backup: ran.backup,
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.validators.every((row) => row.ready), command, payload };
  }
  if (command === 'control-room') {
    const payload = jsonSafe({ controlRoom: ran.controlRoom });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.controlRoom.liveFlagsRemainDisabled, command, payload };
  }
  if (command === 'first-block') {
    const payload = jsonSafe({
      firstBlock: ran.firstBlock,
      verified: ran.firstBlock?.verified === true,
    });
    assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
    return { ok: ran.firstBlock?.verified === true, command, payload };
  }
  if (arg === 'adversarial') {
    const payload = jsonSafe({ adversarial: runAdversarialCase('ai-authorization', root).incident });
    return { ok: true, command: 'report', payload };
  }
  const report = buildLaunchExecutionReport(ran);
  const payload = jsonSafe({ report });
  assertNoPrivateKeyMaterial(payload, 'genesis-execution-cli');
  return { ok: report.realProductionExecutionPerformed === false, command: 'report', payload };
}
