import type { IdentityCapability } from '../../../identity/src/capability.ts';
import type {
  ActivityClass,
  BindingReasonCode,
  CapabilityResolutionState,
  ObjectiveClass,
  ProductClass,
} from './taxonomy.ts';
import type { BindingFailure, CapabilityBindingContext, WorkOrderScope } from './types.ts';

const ACTIVITY_CAPABILITY: Readonly<Record<ActivityClass, readonly IdentityCapability[]>> = {
  RESEARCH: ['VIEW_GROWTH_PLAN', 'VIEW_ECONOMIC_GRAPH'],
  DATA_ACCESS: ['VIEW_ECONOMIC_GRAPH', 'CONSENT_VIEW_OWN'],
  TOOL_USE: ['AGENT_USE', 'OPERATE_GROWTH_ORCHESTRATOR'],
  FINANCIAL_PROPOSAL: ['INVESTMENT_PROPOSE', 'OPERATE_GROWTH_ORCHESTRATOR'],
  EXECUTION_PREP: ['INVESTMENT_PROPOSE'],
};

const PRODUCT_CAPABILITY: Readonly<Record<ProductClass, readonly IdentityCapability[]>> = {
  CASH: ['VIEW_ACCOUNT'],
  EQUITIES: ['INVESTMENT_PROPOSE'],
  ETF: ['INVESTMENT_PROPOSE'],
  BONDS: ['INVESTMENT_PROPOSE'],
  CRYPTO: ['EXCHANGE_OPERATE_REQUEST'],
  DERIVATIVES: ['INVESTMENT_PROPOSE'],
  FX: ['FX_QUOTE_REQUEST'],
};

const OBJECTIVE_CAPABILITY: Readonly<Record<ObjectiveClass, readonly IdentityCapability[]>> = {
  RESEARCH: ['VIEW_GROWTH_PLAN'],
  ANALYSIS: ['VIEW_ECONOMIC_GRAPH'],
  FINANCIAL_PROPOSAL: ['INVESTMENT_PROPOSE'],
  EXECUTION_PREP: ['INVESTMENT_PROPOSE'],
};

function resolveCapabilityState(
  required: readonly IdentityCapability[],
  granted: readonly IdentityCapability[],
  explicitStates: Readonly<Record<string, CapabilityResolutionState>>,
): CapabilityResolutionState {
  for (const capability of required) {
    const explicit = explicitStates[capability];
    if (explicit && explicit !== 'ENABLED') {
      return explicit;
    }
    if (!granted.includes(capability)) {
      return explicit ?? 'UNKNOWN';
    }
  }
  return 'ENABLED';
}

export function capabilityPermittedScope(context: CapabilityBindingContext): {
  readonly activityClasses: readonly ActivityClass[];
  readonly productClasses: readonly ProductClass[];
  readonly objectiveClasses: readonly ObjectiveClass[];
  readonly failures: readonly BindingFailure[];
} {
  const failures: BindingFailure[] = [];
  const activityClasses: ActivityClass[] = [];
  const productClasses: ProductClass[] = [];
  const objectiveClasses: ObjectiveClass[] = [];

  for (const activity of Object.keys(ACTIVITY_CAPABILITY) as ActivityClass[]) {
    const required = ACTIVITY_CAPABILITY[activity];
    const state = resolveCapabilityState(required, context.grantedCapabilities, context.capabilityStates);
    if (state === 'ENABLED') {
      activityClasses.push(activity);
      continue;
    }
    const code = capabilityFailureCode(state);
    failures.push({ code, message: `activity ${activity} blocked by capability state ${state}` });
  }

  for (const product of Object.keys(PRODUCT_CAPABILITY) as ProductClass[]) {
    const required = PRODUCT_CAPABILITY[product];
    const state = resolveCapabilityState(required, context.grantedCapabilities, context.capabilityStates);
    if (state === 'ENABLED') {
      productClasses.push(product);
      continue;
    }
    failures.push({ code: capabilityFailureCode(state), message: `product ${product} blocked by capability state ${state}` });
  }

  for (const objective of Object.keys(OBJECTIVE_CAPABILITY) as ObjectiveClass[]) {
    const required = OBJECTIVE_CAPABILITY[objective];
    const state = resolveCapabilityState(required, context.grantedCapabilities, context.capabilityStates);
    if (state === 'ENABLED') {
      objectiveClasses.push(objective);
    }
  }

  return Object.freeze({
    activityClasses: Object.freeze(activityClasses),
    productClasses: Object.freeze(productClasses),
    objectiveClasses: Object.freeze(objectiveClasses),
    failures: Object.freeze(failures),
  });
}

function capabilityFailureCode(state: CapabilityResolutionState): BindingReasonCode {
  switch (state) {
    case 'DISABLED':
      return 'CAPABILITY_DISABLED';
    case 'RESTRICTED':
      return 'CAPABILITY_RESTRICTED';
    case 'REVIEW_REQUIRED':
      return 'CAPABILITY_REVIEW_REQUIRED';
    case 'EXPIRED':
      return 'CAPABILITY_DISABLED';
    default:
      return 'CAPABILITY_UNKNOWN';
  }
}

export function validateCapabilityForScope(
  context: CapabilityBindingContext,
  scope: WorkOrderScope,
): BindingFailure | null {
  const permitted = capabilityPermittedScope(context);
  for (const activity of scope.activityClasses) {
    if (!permitted.activityClasses.includes(activity)) {
      const failure = permitted.failures.find((item) => item.message.includes(activity));
      return failure ?? { code: 'CAPABILITY_UNKNOWN', message: `activity ${activity} is not enabled` };
    }
  }
  for (const product of scope.productClasses) {
    if (!permitted.productClasses.includes(product)) {
      return { code: 'PRODUCT_CLASS_NOT_PERMITTED', message: `product class ${product} is not enabled` };
    }
  }
  for (const objective of scope.objectiveClasses) {
    if (!permitted.objectiveClasses.includes(objective)) {
      return { code: 'OBJECTIVE_CLASS_NOT_PERMITTED', message: `objective class ${objective} is not enabled` };
    }
  }
  return null;
}

export function platformPermittedScope(): {
  readonly activityClasses: readonly ActivityClass[];
  readonly productClasses: readonly ProductClass[];
  readonly objectiveClasses: readonly ObjectiveClass[];
} {
  return Object.freeze({
    activityClasses: Object.freeze(['RESEARCH', 'DATA_ACCESS', 'TOOL_USE', 'FINANCIAL_PROPOSAL'] as ActivityClass[]),
    productClasses: Object.freeze(['CASH', 'EQUITIES', 'ETF', 'BONDS'] as ProductClass[]),
    objectiveClasses: Object.freeze(['RESEARCH', 'ANALYSIS', 'FINANCIAL_PROPOSAL'] as ObjectiveClass[]),
  });
}
