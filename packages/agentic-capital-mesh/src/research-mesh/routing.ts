import type { HeliosSpecialistRole, OpportunityKind } from './types.ts';

const BASE_RESEARCH: readonly HeliosSpecialistRole[] = Object.freeze([
  'OPPORTUNITY_RESEARCH',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
  'META_ALLOCATOR',
]);

const RELATIVE_VALUE: readonly HeliosSpecialistRole[] = Object.freeze([
  'OPPORTUNITY_RESEARCH',
  'STAT_ARB_RELATIVE_VALUE',
  'VOLATILITY',
  'MICROSTRUCTURE',
  'EXECUTION_RESEARCH',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
  'META_ALLOCATOR',
]);

const MACRO: readonly HeliosSpecialistRole[] = Object.freeze([
  'OPPORTUNITY_RESEARCH',
  'MACRO_FX',
  'VOLATILITY',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
  'META_ALLOCATOR',
]);

const DIRECTIONAL: readonly HeliosSpecialistRole[] = Object.freeze([
  'OPPORTUNITY_RESEARCH',
  'MACRO_FX',
  'VOLATILITY',
  'MICROSTRUCTURE',
  'EXECUTION_RESEARCH',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
  'META_ALLOCATOR',
]);

const CASH_YIELD: readonly HeliosSpecialistRole[] = Object.freeze([
  'OPPORTUNITY_RESEARCH',
  'MACRO_FX',
  'EVIDENCE_VERIFIER',
  'ADVERSARIAL_CRITIC',
  'META_ALLOCATOR',
]);

export function routeSpecialistTasks(opportunityKind: OpportunityKind): readonly HeliosSpecialistRole[] {
  switch (opportunityKind) {
    case 'CASH_YIELD':
      return CASH_YIELD;
    case 'RELATIVE_VALUE':
      return RELATIVE_VALUE;
    case 'MACRO_HEDGE':
      return MACRO;
    case 'DIRECTIONAL_EQUITY':
      return DIRECTIONAL;
    case 'GENERIC':
    default:
      return BASE_RESEARCH;
  }
}

export function shouldInvokeRole(
  role: HeliosSpecialistRole,
  opportunityKind: OpportunityKind,
): boolean {
  return routeSpecialistTasks(opportunityKind).includes(role);
}

export function unusedRolesForOpportunity(opportunityKind: OpportunityKind): readonly HeliosSpecialistRole[] {
  const routed = new Set(routeSpecialistTasks(opportunityKind));
  const all: HeliosSpecialistRole[] = [
    'OPPORTUNITY_RESEARCH',
    'MACRO_FX',
    'STAT_ARB_RELATIVE_VALUE',
    'VOLATILITY',
    'MICROSTRUCTURE',
    'EXECUTION_RESEARCH',
    'EVIDENCE_VERIFIER',
    'ADVERSARIAL_CRITIC',
    'META_ALLOCATOR',
  ];
  return Object.freeze(all.filter((role) => !routed.has(role)));
}
