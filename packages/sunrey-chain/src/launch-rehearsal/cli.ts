/**
 * sunrey-launch CLI.
 *
 * Commands work in simulation. None of them launch production mainnet.
 */

import { FAILURE_SCENARIOS, type FailureScenario } from './types.ts';
import {
  injectNamedFailure,
  recoverNamedFailure,
  runLaunchRehearsal,
  type LaunchRehearsalSession,
} from './engine.ts';

export type LaunchCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

function isFailureScenario(value: string): value is FailureScenario {
  return (FAILURE_SCENARIOS as readonly string[]).includes(value);
}

let cached: LaunchRehearsalSession | null = null;

export function resetLaunchCliCache(): void {
  cached = null;
}

function session(root = process.cwd()): LaunchRehearsalSession {
  cached ??= runLaunchRehearsal(root);
  return cached;
}

export function runLaunchCommand(argv: readonly string[], root = process.cwd()): LaunchCliResult {
  const [command = 'help', arg = ''] = argv;
  if (command === 'rehearse') {
    resetLaunchCliCache();
    const ran = session(root);
    return {
      ok: ran.report.productionAuthorized === false && ran.report.liveFlagsRemainDisabled,
      command: 'rehearse',
      payload: jsonSafe({
        rehearsalId: ran.report.rehearsalId,
        networkId: ran.report.rehearsalGenesis.networkId,
        chainId: ran.report.rehearsalGenesis.chainId,
        genesisHash: ran.report.rehearsalGenesis.genesisHash,
        classification: ran.report.classification,
        productionAuthorized: false,
        banner: ran.report.explorer.banner,
      }),
    };
  }
  if (command === 'status') {
    const ran = session(root);
    return { ok: true, command: 'status', payload: jsonSafe(ran.room) };
  }
  if (command === 'verify') {
    const ran = session(root);
    return {
      ok: ran.genesis.verification.ok && ran.release.ok && ran.report.firstBlock.healthyValidatorAgreement,
      command: 'verify',
      payload: jsonSafe({
        release: ran.release,
        genesis: ran.genesis.verification,
        firstBlock: ran.report.firstBlock,
        liveFlagsRemainDisabled: ran.report.liveFlagsRemainDisabled,
      }),
    };
  }
  if (command === 'inject-failure') {
    if (!isFailureScenario(arg)) {
      return { ok: false, command: 'inject-failure', payload: { error: 'unknown scenario', scenarios: FAILURE_SCENARIOS } };
    }
    const ran = session(root);
    return { ok: true, command: 'inject-failure', payload: jsonSafe(injectNamedFailure(ran, arg)) };
  }
  if (command === 'recover') {
    if (!isFailureScenario(arg)) {
      return { ok: false, command: 'recover', payload: { error: 'unknown scenario', scenarios: FAILURE_SCENARIOS } };
    }
    const ran = session(root);
    return { ok: true, command: 'recover', payload: jsonSafe(recoverNamedFailure(ran, arg)) };
  }
  if (command === 'report') {
    return { ok: true, command: 'report', payload: jsonSafe(session(root).report) };
  }
  if (command === 'findings') {
    return { ok: true, command: 'findings', payload: jsonSafe(session(root).findings) };
  }
  if (command === 'activation-plan') {
    const plan = session(root).plan;
    return { ok: plan.executes === false, command: 'activation-plan', payload: jsonSafe(plan) };
  }
  return {
    ok: true,
    command: 'help',
    payload: {
      usage:
        'sunrey-launch <rehearse|status|verify|inject-failure|recover|report|findings|activation-plan>',
      launchesProduction: false,
      banner: 'MAINNET REHEARSAL',
    },
  };
}
