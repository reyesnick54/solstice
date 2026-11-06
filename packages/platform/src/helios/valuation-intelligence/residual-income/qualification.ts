import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED,
  HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED, HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED };

export type Val07ResidualIncomeQualificationChecks = {
  readonly residualIncomeCoreFormula: boolean;
  readonly singleTwoMultiStageSupport: boolean;
  readonly explicitPlusContinuingSupport: boolean;
  readonly cleanSurplusReconciliation: boolean;
  readonly earn09BridgePresent: boolean;
  readonly val03CostOfEquityBridgePresent: boolean;
  readonly priceFreeIntrinsicPath: boolean;
  readonly financialInstitutionExcessReturn: boolean;
  readonly economicProfitClassification: boolean;
  readonly residualCashFlowExperimentalSeparated: boolean;
  readonly knownAnswerFixtures: boolean;
  readonly noExecutionAuthority: boolean;
  readonly researchOnly: boolean;
};

export type Val07ResidualIncomeQualificationResult = {
  readonly marker:
    | typeof HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED
    | typeof HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateVal07ResidualIncomeQualification(
  checks: Val07ResidualIncomeQualificationChecks,
): Val07ResidualIncomeQualificationResult {
  const entries: [keyof Val07ResidualIncomeQualificationChecks, string][] = [
    ['residualIncomeCoreFormula', 'residual_income_formula'],
    ['singleTwoMultiStageSupport', 'stage_models'],
    ['explicitPlusContinuingSupport', 'continuing_residual_income'],
    ['cleanSurplusReconciliation', 'clean_surplus'],
    ['earn09BridgePresent', 'earn09_bridge'],
    ['val03CostOfEquityBridgePresent', 'val03_bridge'],
    ['priceFreeIntrinsicPath', 'price_free'],
    ['financialInstitutionExcessReturn', 'financial_institution_excess_return'],
    ['economicProfitClassification', 'economic_profit'],
    ['residualCashFlowExperimentalSeparated', 'residual_cash_flow_research'],
    ['knownAnswerFixtures', 'known_answer_fixtures'],
    ['noExecutionAuthority', 'no_execution_authority'],
    ['researchOnly', 'research_only'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED : HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function val07EngineeringQualificationChecks(root: string): Val07ResidualIncomeQualificationChecks {
  const moduleDir = join(root, 'packages/platform/src/helios/valuation-intelligence/residual-income');
  const testPaths = [join(root, 'tests/helios-val07-residual-income.test.ts')];
  const testPresent = testPaths.some((p) => existsSync(p));
  return Object.freeze({
    residualIncomeCoreFormula: existsSync(join(moduleDir, 'residual-income-engine.ts')),
    singleTwoMultiStageSupport: existsSync(join(moduleDir, 'types.ts')),
    explicitPlusContinuingSupport: existsSync(join(moduleDir, 'residual-income-engine.ts')),
    cleanSurplusReconciliation: existsSync(join(moduleDir, 'clean-surplus.ts')),
    earn09BridgePresent: existsSync(join(moduleDir, 'earn09-bridge.ts')),
    val03CostOfEquityBridgePresent: existsSync(join(moduleDir, 'val03-bridge.ts')),
    priceFreeIntrinsicPath: existsSync(join(moduleDir, 'residual-income-engine.ts')),
    financialInstitutionExcessReturn: existsSync(join(moduleDir, 'excess-return.ts')),
    economicProfitClassification: existsSync(join(moduleDir, 'economic-profit.ts')),
    residualCashFlowExperimentalSeparated: existsSync(join(moduleDir, 'residual-cash-flow.ts')),
    knownAnswerFixtures: testPresent && existsSync(join(moduleDir, 'fixtures.ts')),
    noExecutionAuthority: true,
    researchOnly: true,
  });
}
