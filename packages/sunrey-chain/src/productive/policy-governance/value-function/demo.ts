import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../../types.ts';
import {
  PRODUCTIVE_VALUE_FUNCTION_CAN_MINT,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
  PRODUCTIVE_VALUE_UNIT_IS_MOONREY,
  PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT,
  PRODUCTION_VALUE_POLICY_ACTIVE,
} from './constitution.ts';
import { categoryPlan, factorDefinition } from './factors.ts';
import { developmentValueFunctionPolicy } from './policy.ts';
import { PRODUCTIVE_VALUE_UNIT } from './types.ts';

const DEMO_CATEGORIES = [
  'ENERGY',
  'AI_COMPUTE',
  'MANUFACTURING',
  'LOGISTICS_TRANSPORTATION',
  'WATER',
] as const satisfies readonly ProductiveCategory[];

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`;
}

export function formatCategoryFactorPolicy(category: ProductiveCategory): string {
  const plan = categoryPlan(category);
  const header = [
    pad('Factor', 32),
    pad('Eligibility', 12),
    pad('Min', 10),
    pad('Max', 10),
    pad('Neutral', 10),
    'Missing input',
  ].join('  ');
  const rows = plan.eligible.map((factorType) => {
    const definition = factorDefinition(factorType);
    const eligibility = plan.required.includes(factorType) ? 'REQUIRED' : 'ELIGIBLE';
    return [
      pad(factorType, 32),
      pad(eligibility, 12),
      pad(definition.minimum.toString(), 10),
      pad(definition.maximum.toString(), 10),
      pad(definition.neutralValue.toString(), 10),
      definition.missingInputBehavior,
    ].join('  ');
  });
  const disabled = plan.disabled.length === 0 ? '(none)' : plan.disabled.join(', ');
  return [
    `Category ${category}`,
    header,
    ...rows,
    `Disabled: ${disabled}`,
    `Eligible claim types: ${plan.claims.join(', ')}`,
    `Eligible realization states: ${plan.realization.join(', ')}`,
  ].join('\n');
}

export function runMoonreyProductiveValuePolicyDemo(): string {
  const policy = developmentValueFunctionPolicy();
  const lines = [
    'Governed MoonRey Productive Value Function — policy constitution (Chunk 123)',
    '',
    `Policy ${policy.policyId} v${String(policy.policyVersion)} state=${policy.state}`,
    `Parameter class: ${policy.parameterClass}`,
    `Attribution required: ${String(policy.attributionRequired)}`,
    `Covered categories: ${PRODUCTIVE_CATEGORIES.join(', ')}`,
    `ProductiveValueUnit: ${PRODUCTIVE_VALUE_UNIT.unitId}`,
    `notPhysicalUnit=${String(PRODUCTIVE_VALUE_UNIT.notPhysicalUnit)} notFiatValue=${String(PRODUCTIVE_VALUE_UNIT.notFiatValue)} notMoonReyQuantity=${String(PRODUCTIVE_VALUE_UNIT.notMoonReyQuantity)}`,
    '',
    ...DEMO_CATEGORIES.flatMap((category) => [formatCategoryFactorPolicy(category), '']),
    `PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED=${String(PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED)}`,
    `PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT=${String(PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT)}`,
    `PRODUCTIVE_VALUE_UNIT_IS_MOONREY=${String(PRODUCTIVE_VALUE_UNIT_IS_MOONREY)}`,
    `PRODUCTIVE_VALUE_FUNCTION_CAN_MINT=${String(PRODUCTIVE_VALUE_FUNCTION_CAN_MINT)}`,
    `PRODUCTION_ACTIVE=${String(PRODUCTION_VALUE_POLICY_ACTIVE)}`,
  ];
  return lines.join('\n');
}

const invoked = process.argv[1]?.includes('value-function/demo');
if (invoked) {
  console.log(runMoonreyProductiveValuePolicyDemo());
}
