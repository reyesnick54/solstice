/**
 * Access Economy simulation demo.
 *
 * Runs the full 15-scenario qualification and prints the engineering
 * summary. Changes no production state and flips no LIVE_* flag.
 */

import { qualifyAccessEconomy, renderAccessQualification } from './qualification.ts';

export function runAccessEconomyDemo(): string {
  const report = qualifyAccessEconomy();
  const lines = [renderAccessQualification(report), ''];
  lines.push('remaining simulated dependencies:');
  for (const item of report.remainingSimulatedDependencies) {
    lines.push(`  - ${item}`);
  }
  lines.push('remaining real-world provider requirements:');
  for (const item of report.remainingRealWorldProviderRequirements) {
    lines.push(`  - ${item}`);
  }
  lines.push('remaining legal and regulatory gates:');
  for (const item of report.remainingLegalGates) {
    lines.push(`  - ${item}`);
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = runAccessEconomyDemo();
  console.log(output);
  if (output.includes('ACCESS_FABRIC_NOT_QUALIFIED')) {
    process.exitCode = 1;
  }
}
