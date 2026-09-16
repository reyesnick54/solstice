import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { WorkOrderScope } from '../helios/types.ts';
import type { ActivityClass, ObjectiveClass, ProductClass } from '../helios/taxonomy.ts';
import type { PermittedActionCategory, ResearchModelClass, ResearchToolClass } from './taxonomy.ts';
import type { EconomicWorkOrder } from './types.ts';

const ACTION_TO_ACTIVITY: Readonly<Record<PermittedActionCategory, readonly ActivityClass[]>> = {
  RESEARCH: Object.freeze(['RESEARCH', 'DATA_ACCESS']),
  OPPORTUNITY_DISCOVERY: Object.freeze(['RESEARCH', 'DATA_ACCESS']),
  PROPOSAL_GENERATION: Object.freeze(['FINANCIAL_PROPOSAL']),
  MONITORING: Object.freeze(['RESEARCH']),
  RECONCILIATION: Object.freeze(['DATA_ACCESS', 'RESEARCH']),
};

const ACTION_TO_OBJECTIVE: Readonly<Record<PermittedActionCategory, readonly ObjectiveClass[]>> = {
  RESEARCH: Object.freeze(['RESEARCH', 'ANALYSIS']),
  OPPORTUNITY_DISCOVERY: Object.freeze(['RESEARCH', 'ANALYSIS']),
  PROPOSAL_GENERATION: Object.freeze(['FINANCIAL_PROPOSAL']),
  MONITORING: Object.freeze(['RESEARCH']),
  RECONCILIATION: Object.freeze(['ANALYSIS']),
};

const TOOL_CLASS_TO_ID: Readonly<Record<ResearchToolClass, string>> = {
  MARKET_DATA_READ: 'tool_market_data',
  PEG_QUERY: 'tool_peg_query',
  OPPORTUNITY_SCAN: 'tool_opportunity_scan',
  SCENARIO_MODEL: 'tool_scenario_model',
  POLICY_LOOKUP: 'tool_policy_lookup',
};

const MODEL_CLASS_TO_ID: Readonly<Record<ResearchModelClass, string>> = {
  DETERMINISTIC: 'mdl_deterministic',
  STATISTICAL: 'mdl_statistical',
  SIMULATION: 'mdl_simulation',
  LLM_ASSISTED: 'mdl_s3m',
};

const DEFAULT_PRODUCT_CLASSES: readonly ProductClass[] = Object.freeze(['CASH', 'EQUITIES', 'ETF', 'BONDS']);

function unique<T extends string>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)]);
}

/**
 * Maps an H04 coordination envelope to the H05 authority-binding scope model.
 * HELIOS may only narrow; this projection never widens beyond the coordination input.
 */
export function scopeFromCoordinationWorkOrder(workOrder: EconomicWorkOrder): WorkOrderScope {
  const activityClasses: readonly ActivityClass[] = unique<ActivityClass>(
    workOrder.actionBoundary.permittedActionCategories.flatMap((category) => ACTION_TO_ACTIVITY[category]),
  );
  const objectiveClasses: readonly ObjectiveClass[] = unique<ObjectiveClass>(
    workOrder.actionBoundary.permittedActionCategories.flatMap((category) => ACTION_TO_OBJECTIVE[category]),
  );
  const toolIds: readonly string[] = Object.freeze(
    workOrder.researchBoundary.permittedToolClasses.map((toolClass) => TOOL_CLASS_TO_ID[toolClass]),
  );
  const modelIds: readonly string[] = Object.freeze(
    workOrder.researchBoundary.permittedModelClasses.map((modelClass) => MODEL_CLASS_TO_ID[modelClass]),
  );
  const accountIds: readonly string[] = workOrder.capitalBoundary.accountId
    ? Object.freeze([workOrder.capitalBoundary.accountId])
    : Object.freeze([]);
  const jurisdiction = workOrder.authorityReferences.jurisdiction
    ? asJurisdiction(workOrder.authorityReferences.jurisdiction)
    : asJurisdiction('US');
  const horizonDays: number | null =
    workOrder.objective.horizon?.kind === 'DURATION_DAYS'
      ? (workOrder.objective.horizon.days ?? null)
      : null;

  const scope: WorkOrderScope = {
    objectiveClasses,
    activityClasses,
    productClasses: DEFAULT_PRODUCT_CLASSES,
    capitalCeiling: {
      minorUnits: workOrder.capitalBoundary.maxCapitalEnvelope.minorUnits,
      currency: workOrder.capitalBoundary.maxCapitalEnvelope.currency,
    },
    accountIds,
    jurisdiction,
    horizonDays,
    toolIds,
    modelIds,
  };
  return Object.freeze(scope);
}
