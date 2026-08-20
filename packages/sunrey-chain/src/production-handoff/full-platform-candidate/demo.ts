/**
 * Evaluate the current repository as a full-platform production
 * candidate. Does not activate production.
 */

import { evaluateProductionEconomicActivation } from '../../economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from '../../economics/production-activation/fixtures.ts';
import { assembleCandidateBundle } from './bundle.ts';
import { currentRepositoryBundleInput } from './fixtures.ts';
import { qualifyFullPlatformCandidate } from './qualify.ts';
import { buildFullPlatformCandidateReport, formatFullPlatformReport } from './report.ts';

export function runFullPlatformCandidateDemo(root = process.cwd()): string {
  const assembled = currentRepositoryBundleInput(root, 'SMOKE');
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
  const text = formatFullPlatformReport(report);
  console.log(text);
  return text;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('demo.ts')) {
  runFullPlatformCandidateDemo();
}
