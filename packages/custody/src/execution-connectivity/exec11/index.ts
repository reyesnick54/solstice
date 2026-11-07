/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC11
 * Custody movement and financial-action isolation (canonical custody extension).
 */

export {
  HELIOS_EXEC11_SCHEMA,
  CUSTODY_MOVEMENT_AUTHORITIES,
  GROW_EXECUTION_AUTHORITIES,
  CUSTODY_OUTBOUND_AUTHORITIES,
  CUSTODY_RAIL_KINDS,
  AGENT_ALLOWED_WITHDRAWAL_ACTIONS,
  AGENT_FORBIDDEN_WITHDRAWAL_ACTIONS,
  WITHDRAWAL_REQUIREMENT_IDS,
  CUSTODY_MOVEMENT_DECISIONS,
  HELIOS_EXEC11_CUSTODY_ISOLATION_QUALIFIED,
  HELIOS_EXEC11_CUSTODY_ISOLATION_BLOCKED,
  type CustodyMovementAuthority,
  type CustodyRailKind,
  type AgentAllowedWithdrawalAction,
  type AgentForbiddenWithdrawalAction,
  type WithdrawalRequirementId,
  type CustodyMovementDecision,
} from './taxonomy.ts';

export type {
  CustodyMovementGrant,
  CustodyMovementRequest,
  CustodyMovementIsolationResult,
  WithdrawalRequirementStatus,
  WithdrawalAuthorityEnvelope,
  AgentWithdrawalBoundaryResult,
  DigitalAssetCustodyPath,
  SecuritiesCustodyPath,
  Exec11QualificationChecks,
} from './types.ts';

export {
  defaultGrowTradingAgentGrant,
  evaluateCustodyMovementIsolation,
  growAgentMayPrepareWithdrawalOnly,
  outboundAuthoritiesPresent,
  tradeGrantImpliesWithdraw,
} from './authority-isolation.ts';

export {
  evaluateWithdrawalAuthorityRequirements,
  withdrawalRequirementsComplete,
  type WithdrawalRequirementInput,
} from './withdrawal-requirements.ts';

export { authorizeAgentWithdrawalAction } from './agent-boundary.ts';

export {
  digitalAssetCustodyPath,
  securitiesCustodyPath,
  resolveCustodyRailPath,
  railUsesChainConfirmation,
} from './custody-rail.ts';

export { runExec11CustodyIsolationHarness } from './harness.ts';

export {
  evaluateExec11CustodyIsolationQualification,
  type Exec11CustodyIsolationQualification,
} from './qualification.ts';
