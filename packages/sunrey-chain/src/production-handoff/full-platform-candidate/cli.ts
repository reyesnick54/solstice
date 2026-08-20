/**
 * sunrey-ops production full-platform commands.
 *
 * Isolated / rehearsal only. Never prints private key material.
 * Does not launch mainnet or claim observed production.
 */

import { assertNoPrivateKeyMaterial } from '../../ops/logging.ts';
import { evaluateProductionEconomicActivation } from '../../economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from '../../economics/production-activation/fixtures.ts';
import { assembleCandidateBundle } from './bundle.ts';
import { currentRepositoryBundleInput } from './fixtures.ts';
import { qualifyFullPlatformCandidate } from './qualify.ts';
import { buildFullPlatformCandidateReport, formatFullPlatformReport } from './report.ts';
import type { BurnInProfile } from './types.ts';

export type FullPlatformCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const SUBCOMMANDS = ['rehearse', 'verify', 'report', 'help'] as const;

export function fullPlatformUsage(): string {
  return [
    'sunrey-ops production full-platform rehearse [--profile SMOKE|STANDARD|EXTENDED]',
    'sunrey-ops production full-platform verify',
    'sunrey-ops production full-platform report',
  ].join('\n');
}

export function runFullPlatformCommand(argv: readonly string[], root = process.cwd()): FullPlatformCliResult {
  process.env.SUNREY_FIXTURE_ENV ??= 'local';
  const [command = 'help'] = argv;
  if (command === 'help' || !(SUBCOMMANDS as readonly string[]).includes(command as (typeof SUBCOMMANDS)[number])) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage: fullPlatformUsage(),
        simulation: true,
        observedProduction: false,
        productionActive: false,
      },
    };
  }
  const profile = readProfile(argv);
  const assembled = currentRepositoryBundleInput(root, profile);
  const firewall = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  const bundle = assembleCandidateBundle(assembled.hashes);
  const decision = qualifyFullPlatformCandidate({
    hashes: assembled.hashes,
    burnIn: assembled.burnIn,
  });
  const report = buildFullPlatformCandidateReport({
    bundle,
    decision,
    burnIn: assembled.burnIn,
    firewallOverallState: firewall.overallState,
  });
  if (command === 'rehearse') {
    return ok('full-platform rehearse', {
      bundleHash: bundle.bundleHash,
      qualification: decision.bundleState,
      burnInCanonicalHash: assembled.burnIn.canonicalHash,
      productionActive: false,
    });
  }
  if (command === 'verify') {
    return ok('full-platform verify', {
      ok: decision.burnInPassed && decision.architectureIntegrity,
      bundleHash: decision.bundleHash,
      firewallDecisionHash: decision.firewallDecisionHash,
      productionActivated: false,
      liveFlagsEnabled: false,
    });
  }
  return ok('full-platform report', {
    text: formatFullPlatformReport(report),
    report,
  });
}

function readProfile(argv: readonly string[]): BurnInProfile {
  const flag = argv.find((row) => row.startsWith('--profile='));
  if (flag) {
    const value = flag.slice('--profile='.length);
    if (value === 'STANDARD' || value === 'EXTENDED' || value === 'SMOKE') {
      return value;
    }
  }
  const index = argv.indexOf('--profile');
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value === 'STANDARD' || value === 'EXTENDED' || value === 'SMOKE') {
    return value;
  }
  return 'SMOKE';
}

function ok(command: string, payload: unknown): FullPlatformCliResult {
  const safe = JSON.parse(
    JSON.stringify(payload, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
  assertNoPrivateKeyMaterial(safe);
  return { ok: true, command, payload: safe };
}
