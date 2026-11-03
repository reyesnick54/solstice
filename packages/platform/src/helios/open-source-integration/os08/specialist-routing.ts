import type { TriggerSpecialistClass } from '../os07/research-monitor-contract.ts';
import type { MeshSpecialistRoleName } from './taxonomy.ts';

const CLASS_TO_ROLES = {
  TECHNICAL: ['OPPORTUNITY_RESEARCH', 'MICROSTRUCTURE'],
  FUNDAMENTAL: ['OPPORTUNITY_RESEARCH'],
  EARNINGS: ['OPPORTUNITY_RESEARCH'],
  MACRO: ['MACRO_FX', 'VOLATILITY'],
  NEWS: ['OPPORTUNITY_RESEARCH'],
  OPTIONS: ['VOLATILITY'],
  FLOW: ['MICROSTRUCTURE'],
  CRYPTO_ONCHAIN: ['OPPORTUNITY_RESEARCH', 'MICROSTRUCTURE'],
  ALTERNATIVE_DATA: ['OPPORTUNITY_RESEARCH', 'EVIDENCE_VERIFIER'],
  RISK: ['EVIDENCE_VERIFIER'],
  ADVERSARIAL_CRITIC: ['ADVERSARIAL_CRITIC'],
} as const satisfies Readonly<Record<TriggerSpecialistClass, readonly MeshSpecialistRoleName[]>>;

/** Roles that must never run from monitor triggers (no execution research path). */
const FORBIDDEN_FROM_TRIGGER: ReadonlySet<string> = new Set([
  'EXECUTION_RESEARCH',
  'META_ALLOCATOR',
]);

export function routeTriggerSpecialistClasses(
  requested: readonly TriggerSpecialistClass[],
): readonly MeshSpecialistRoleName[] {
  const roles = new Set<MeshSpecialistRoleName>();
  for (const cls of requested.length > 0 ? requested : (['FUNDAMENTAL'] as const)) {
    for (const role of CLASS_TO_ROLES[cls]) {
      if (!FORBIDDEN_FROM_TRIGGER.has(role)) {
        roles.add(role);
      }
    }
  }
  if (!roles.has('EVIDENCE_VERIFIER')) {
    roles.add('EVIDENCE_VERIFIER');
  }
  if (!roles.has('ADVERSARIAL_CRITIC')) {
    roles.add('ADVERSARIAL_CRITIC');
  }
  return Object.freeze([...roles]);
}

export function meshRolesPermittedForTrigger(): readonly MeshSpecialistRoleName[] {
  return Object.freeze(
    (['OPPORTUNITY_RESEARCH', 'MACRO_FX', 'STAT_ARB_RELATIVE_VALUE', 'VOLATILITY', 'MICROSTRUCTURE', 'EVIDENCE_VERIFIER', 'ADVERSARIAL_CRITIC'] as const).filter(
      (role) => !FORBIDDEN_FROM_TRIGGER.has(role),
    ),
  );
}
