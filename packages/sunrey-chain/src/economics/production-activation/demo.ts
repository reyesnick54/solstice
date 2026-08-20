/**
 * Evaluate the actual current repository against the production
 * economic activation firewall. Does not activate production.
 */

import { evaluateProductionEconomicActivation, summarizeMissingEvidence } from './firewall.ts';
import { currentRepositorySnapshot } from './fixtures.ts';
import { formatReadinessReport, buildProductionEconomicActivationReadinessReport } from './report.ts';

export function runProductionEconomicActivationFirewallDemo(): void {
  const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  const report = buildProductionEconomicActivationReadinessReport(decision);
  console.log(formatReadinessReport(report));
  console.log('blockerCodes=');
  for (const code of summarizeMissingEvidence(decision)) {
    console.log(`  ${code}`);
  }
}

runProductionEconomicActivationFirewallDemo();
