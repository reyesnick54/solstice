import { lintConstitution } from './constitution.ts';
import { lintEventFabric } from './event-guards.ts';
import { lintComplianceBoundary } from './compliance-guards.ts';
import { lintSecurityBoundary } from './security-guards.ts';
import { lintCardBoundary } from './card-guards.ts';
import { lintRailBoundary } from './rail-guards.ts';
import { lintEconomicGraphBoundary } from './economic-graph-guards.ts';
import { lintGrowthBoundary } from './growth-guards.ts';
import { lintInvestmentBoundary } from './investments-guards.ts';
import { lintRegulatoryTwinBoundary } from './regulatory-twin-guards.ts';
import { lintPersonalDataVaultBoundary } from './personal-data-vault-guards.ts';
import { lintConsentBoundary } from './consent-guards.ts';
import { lintTree, formatFindings } from './linter.ts';

const root = process.cwd();
const findings = [
  ...lintTree(root),
  ...lintConstitution(root),
  ...lintEventFabric(root),
  ...lintSecurityBoundary(root),
  ...lintComplianceBoundary(root),
  ...lintCardBoundary(root),
  ...lintRailBoundary(root),
  ...lintEconomicGraphBoundary(root),
  ...lintGrowthBoundary(root),
  ...lintInvestmentBoundary(root),
  ...lintRegulatoryTwinBoundary(root),
  ...lintPersonalDataVaultBoundary(root),
  ...lintConsentBoundary(root),
];
if (findings.length > 0) {
  console.error(formatFindings(findings));
  console.error(`architectural-linter: ${findings.length} violation(s)`);
  process.exit(1);
}
console.log('architectural-linter: ok');
