/**
 * sunrey-ops pregenesis commands.
 *
 * create | deploy-rehearsal | qualify | health | inject-failure |
 * recover | burn-in | report | verify
 */

import { FAILURE_SCENARIOS, type PregenesisFailureScenario } from './types.ts';
import { rejectFakeElapsedDurationClaim } from './burn-in.ts';
import { createPregenesisNetwork, deployPregenesisRehearsal } from './network.ts';
import { healthFromReport, qualifyPregenesisNetwork, type PregenesisSession } from './qualify.ts';
import { summarizePregenesisReport, verifyPregenesisReport } from './report.ts';

export type PregenesisCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)));
}

function isFailureScenario(value: string): value is PregenesisFailureScenario {
  return (FAILURE_SCENARIOS as readonly string[]).includes(value);
}

let cached: PregenesisSession | null = null;

export function resetPregenesisCliCache(): void {
  cached = null;
}

function session(root = process.cwd()): PregenesisSession {
  cached ??= qualifyPregenesisNetwork({ root, profile: 'bounded' });
  return cached;
}

export function pregenesisUsage(): string {
  return [
    'sunrey-ops pregenesis create',
    'sunrey-ops pregenesis deploy-rehearsal',
    'sunrey-ops pregenesis qualify',
    'sunrey-ops pregenesis health',
    'sunrey-ops pregenesis inject-failure <SCENARIO>',
    'sunrey-ops pregenesis recover <SCENARIO>',
    'sunrey-ops pregenesis burn-in',
    'sunrey-ops pregenesis report',
    'sunrey-ops pregenesis verify',
  ].join('\n');
}

export function runPregenesisCommand(argv: readonly string[], root = process.cwd()): PregenesisCliResult {
  const [command = 'help', arg = ''] = argv;
  if (command === 'help' || command === '--help') {
    return { ok: true, command: 'help', payload: { usage: pregenesisUsage() } };
  }
  if (command === 'create') {
    const created = createPregenesisNetwork();
    return {
      ok: true,
      command: 'create',
      payload: jsonSafe({
        networkId: created.definition.networkId,
        chainId: created.definition.chainId,
        addressHrp: created.definition.addressHrp,
        genesisHash: created.definition.genesisHash,
        mainnetEnabled: false,
        usableAsProductionAuthorization: false,
      }),
    };
  }
  if (command === 'deploy-rehearsal') {
    const deployed = deployPregenesisRehearsal();
    return {
      ok: deployed.deployed && !deployed.productionCredentialsUsed,
      command: 'deploy-rehearsal',
      payload: jsonSafe({
        deployed: true,
        networkId: deployed.network.definition.networkId,
        infraEnvironment: deployed.infraEnvironment,
        productionCredentialsUsed: false,
        mainnetEnabled: false,
      }),
    };
  }
  if (command === 'qualify') {
    resetPregenesisCliCache();
    const ran = session(root);
    return {
      ok: ran.report.mainnetEnabled === false && ran.report.liveFlagsRemainDisabled,
      command: 'qualify',
      payload: jsonSafe({
        classification: ran.report.classification,
        networkId: ran.report.network.networkId,
        chainId: ran.report.network.chainId,
        mainnetRcId: ran.report.bindings.mainnetRcId,
        candidateV2Id: ran.report.bindings.candidateV2Id,
        findings: ran.report.findings.length,
        mainnetEnabled: false,
      }),
    };
  }
  if (command === 'health') {
    const ran = session(root);
    return { ok: true, command: 'health', payload: jsonSafe(healthFromReport(ran.report)) };
  }
  if (command === 'inject-failure') {
    if (!isFailureScenario(arg)) {
      return { ok: false, command: 'inject-failure', payload: { error: 'unknown scenario', usage: FAILURE_SCENARIOS } };
    }
    const ran = session(root);
    const match = ran.report.failures.find((row) => row.scenario === arg);
    return { ok: Boolean(match?.injected), command: 'inject-failure', payload: jsonSafe(match ?? { scenario: arg, injected: false }) };
  }
  if (command === 'recover') {
    if (!isFailureScenario(arg)) {
      return { ok: false, command: 'recover', payload: { error: 'unknown scenario', usage: FAILURE_SCENARIOS } };
    }
    const ran = session(root);
    const match = ran.report.failures.find((row) => row.scenario === arg);
    return { ok: Boolean(match?.recovered), command: 'recover', payload: jsonSafe(match ?? { scenario: arg, recovered: false }) };
  }
  if (command === 'burn-in') {
    if (arg === '--claim-duration') {
      try {
        rejectFakeElapsedDurationClaim({ claimedMs: argv[2] ?? '86400000' });
        return { ok: false, command: 'burn-in', payload: { error: 'fake elapsed-duration claim was not rejected' } };
      } catch (error) {
        return {
          ok: true,
          command: 'burn-in',
          payload: { rejected: true, reason: error instanceof Error ? error.message : String(error) },
        };
      }
    }
    const ran = session(root);
    return { ok: ran.report.burnIn.durationClaimedWithoutExecution === false, command: 'burn-in', payload: jsonSafe(ran.report.burnIn) };
  }
  if (command === 'report') {
    const ran = session(root);
    return { ok: true, command: 'report', payload: jsonSafe(summarizePregenesisReport(ran.report)) };
  }
  if (command === 'verify') {
    const ran = session(root);
    const verified = verifyPregenesisReport(ran.report);
    return { ok: verified.ok && ran.report.mainnetEnabled === false, command: 'verify', payload: jsonSafe(verified) };
  }
  return { ok: false, command, payload: { error: 'unknown command', usage: pregenesisUsage() } };
}
