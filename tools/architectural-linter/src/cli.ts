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
import { lintCleanRoomBoundary } from './clean-room-guards.ts';
import { lintInformationMarketBoundary } from './information-market-guards.ts';
import { lintSunReyChainBoundary } from './sunrey-chain-guards.ts';
import { lintSunReyBlockchainArchitecture } from './sunrey-blockchain-architecture-guards.ts';
import { lintSunReyProtocol } from './sunrey-protocol-guards.ts';
import { lintProductionEconomicActivation } from './production-economic-activation-guards.ts';
import { lintProductionEconomicConstitution } from './production-economic-constitution-guards.ts';
import { lintCustodyBoundary } from './custody-guards.ts';
import { lintSurveillanceBoundary } from './surveillance-guards.ts';
import { lintEngineeringClosure } from './engineering-closure-guards.ts';
import { lintProductizationFreeze } from './productization-guards.ts';
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
  ...lintCleanRoomBoundary(root),
  ...lintInformationMarketBoundary(root),
  ...lintSunReyChainBoundary(root),
  ...lintSunReyBlockchainArchitecture(root),
  ...lintSunReyProtocol(root),
  ...lintProductionEconomicActivation(root),
  ...lintProductionEconomicConstitution(root),
  ...lintCustodyBoundary(root),
  ...lintSurveillanceBoundary(root),
  ...lintEngineeringClosure(root),
  ...lintProductizationFreeze(root),
];
if (findings.length > 0) {
  console.error(formatFindings(findings));
  console.error(`architectural-linter: ${findings.length} violation(s)`);
  process.exit(1);
}
console.log('architectural-linter: ok');
