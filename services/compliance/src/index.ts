/**
 * Compliance service facade. Canonical screening, AML, fraud, velocity,
 * and case types live in packages/kernel/src/compliance. This service
 * does not invent a second compliance model, Kernel, or policy engine.
 */
export {
  ComplianceFabric,
  createSimulationProviders,
  evaluateAmlProfile,
  evaluateFraud,
  openComplianceCase,
  decideCase,
  type ComplianceFacts,
  type ScreeningResult,
  type ComplianceCase,
  type HumanDecision,
} from '../../../packages/kernel/src/compliance/index.ts';
export * as complianceProductionCandidate from '../../../packages/kernel/src/compliance/production-candidate/index.ts';
