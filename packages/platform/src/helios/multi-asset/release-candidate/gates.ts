/**
 * HELIOS Multi-Asset Expansion M28 — release gate evaluation.
 */

import {
  ENVIRONMENT,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import { generateM05M08CoverageReport } from '../data-coverage/m05-m08-report.ts';
import type { M28ForwardPaperQualificationResult } from './forward-paper-scenarios.ts';
import type { M28GateStatus, M28ReleaseGateId } from './taxonomy.ts';

export type M28ReleaseGate = {
  readonly gateId: M28ReleaseGateId;
  readonly status: M28GateStatus;
  readonly detail: string;
};

export type M28ReleaseGateEvaluation = {
  readonly gates: readonly M28ReleaseGate[];
  readonly mandatoryEngineeringPassed: boolean;
  readonly blockers: readonly string[];
};

const MANDATORY_ENGINEERING_GATES: readonly M28ReleaseGateId[] = Object.freeze([
  'ARCHITECTURE',
  'TYPECHECK',
  'TEST_SUITE',
  'DATABASE_MIGRATIONS',
  'PERSISTENCE',
  'RESTART_SAFETY',
  'CUSTOMER_ISOLATION',
  'SECURITY',
  'PRODUCTION_SAFETY_FLAGS',
  'PORTFOLIO_RISK',
  'RECONCILIATION',
  'GROW_CONTRACT',
  'RESILIENCE',
  'LIVE_FINANCIAL_AUTHORIZATION',
]);

export function evaluateM28ReleaseGates(input: {
  readonly architecturePass: boolean;
  readonly typecheckPass: boolean;
  readonly testSuitePass: boolean;
  readonly databaseMigrationsPass: boolean;
  readonly persistencePass: boolean;
  readonly restartSafetyPass: boolean;
  readonly customerIsolationPass: boolean;
  readonly securityPass: boolean;
  readonly portfolioRiskPass: boolean;
  readonly reconciliationPass: boolean;
  readonly growContractPass: boolean;
  readonly resiliencePass: boolean;
  readonly forwardPaper: M28ForwardPaperQualificationResult;
  readonly nowUtc: string;
}): M28ReleaseGateEvaluation {
  const coverage = generateM05M08CoverageReport(input.nowUtc);
  const marketDataPartial = coverage.summary.partialCount > 0 || coverage.summary.missingCount > 0;
  const marketDataStatus: M28GateStatus =
    coverage.summary.missingCount > 0 ? 'BLOCKED' : marketDataPartial ? 'PARTIAL' : 'PASS';

  const strategiesPartial = true;
  const strategiesStatus: M28GateStatus = strategiesPartial ? 'PARTIAL' : 'PASS';

  const executionLifecycleStatus: M28GateStatus = 'PARTIAL';
  const forwardPaperStatus: M28GateStatus = input.forwardPaper.qualified
    ? 'PASS'
    : input.forwardPaper.passedCount > 0
      ? 'PARTIAL'
      : 'BLOCKED';

  const liveFinancialOff =
    ENVIRONMENT === 'simulation' &&
    LIVE_TRADING_ENABLED === false &&
    LIVE_CONNECTIVITY_ENABLED === false &&
    LIVE_INVESTMENT_EXECUTION === false;

  const gates: M28ReleaseGate[] = [
    gate('ARCHITECTURE', input.architecturePass ? 'PASS' : 'FAIL', 'HELIOS boundary and constitution checks'),
    gate('TYPECHECK', input.typecheckPass ? 'PASS' : 'FAIL', 'TypeScript compile check'),
    gate('TEST_SUITE', input.testSuitePass ? 'PASS' : 'FAIL', 'Repository HELIOS multi-asset test suite'),
    gate('DATABASE_MIGRATIONS', input.databaseMigrationsPass ? 'PASS' : 'FAIL', 'Migration quality and heads'),
    gate('PERSISTENCE', input.persistencePass ? 'PASS' : 'FAIL', 'Persistence integration posture'),
    gate('RESTART_SAFETY', input.restartSafetyPass ? 'PASS' : 'FAIL', 'H15/H06 restart recovery'),
    gate('CUSTOMER_ISOLATION', input.customerIsolationPass ? 'PASS' : 'FAIL', 'Customer isolation invariants'),
    gate('SECURITY', input.securityPass ? 'PASS' : 'FAIL', 'Production safety and secret posture'),
    gate('PRODUCTION_SAFETY_FLAGS', liveFinancialOff ? 'PASS' : 'FAIL', 'Simulation flags enforced'),
    gate(
      'MARKET_DATA',
      marketDataStatus,
      `qualified=${coverage.summary.qualifiedCount} partial=${coverage.summary.partialCount} missing=${coverage.summary.missingCount}`,
    ),
    gate(
      'STRATEGIES',
      strategiesStatus,
      'M09–M12 Strategy Lab qualified; paper runtime dispatch partial (H14-only)',
    ),
    gate('PORTFOLIO_RISK', input.portfolioRiskPass ? 'PASS' : 'FAIL', 'M17–M20 portfolio risk controls'),
    gate(
      'EXECUTION_LIFECYCLE',
      executionLifecycleStatus,
      'H21–H25 execution lifecycle qualified in simulation; live provider binding blocked',
    ),
    gate('RECONCILIATION', input.reconciliationPass ? 'PASS' : 'FAIL', 'H25 outcome attribution and reconciliation'),
    gate('GROW_CONTRACT', input.growContractPass ? 'PASS' : 'FAIL', 'H26/H27 Grow product contract'),
    gate('RESILIENCE', input.resiliencePass ? 'PASS' : 'FAIL', 'H31 adversarial resilience FAST_CI'),
    gate(
      'FORWARD_PAPER',
      forwardPaperStatus,
      `${input.forwardPaper.passedCount}/${input.forwardPaper.scenarios.length} scenarios passed`,
    ),
    gate('EXTERNAL_PROVIDER_GATES', 'CLOSED', 'Live provider certification and credentials pending'),
    gate('LEGAL_REGULATORY_GATES', 'CLOSED', 'Counsel-confirmed corridors not activated'),
    gate('LIVE_FINANCIAL_AUTHORIZATION', liveFinancialOff ? 'OFF' : 'FAIL', 'Must remain OFF for paper RC'),
  ];

  const blockers: string[] = [];
  for (const g of gates) {
    if (MANDATORY_ENGINEERING_GATES.includes(g.gateId) && g.status !== 'PASS' && g.status !== 'OFF') {
      blockers.push(`${g.gateId}:${g.status}`);
    }
  }

  return Object.freeze({
    gates: Object.freeze(gates),
    mandatoryEngineeringPassed: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

function gate(gateId: M28ReleaseGateId, status: M28GateStatus, detail: string): M28ReleaseGate {
  return Object.freeze({ gateId, status, detail });
}
