import type { TriggerSpecialistClass } from '../os07/research-monitor-contract.ts';
import type { MeshSpecialistRoleName } from './taxonomy.ts';

const CLASS_TO_ROLES: Readonly<Record<TriggerSpecialistClass, readonly MeshSpecialistRoleName[]>> = Object.freeze({
  TECHNICAL: Object.freeze(['OPPORTUNITY_RESEARCH', 'MICROSTRUCTURE']),
  FUNDAMENTAL: Object.freeze(['OPPORTUNITY_RESEARCH']),
  EARNINGS: Object.freeze(['OPPORTUNITY_RESEARCH']),
  MACRO: Object.freeze(['MACRO_FX', 'VOLATILITY']),
  NEWS: Object.freeze(['OPPORTUNITY_RESEARCH']),
  OPTIONS: Object.freeze(['VOLATILITY']),
  FLOW: Object.freeze(['MICROSTRUCTURE']),
  CRYPTO_ONCHAIN: Object.freeze(['OPPORTUNITY_RESEARCH', 'MICROSTRUCTURE']),
  ALTERNATIVE_DATA: Object.freeze(['OPPORTUNITY_RESEARCH', 'EVIDENCE_VERIFIER']),
  RISK: Object.freeze(['EVIDENCE_VERIFIER']),
  ADVERSARIAL_CRITIC: Object.freeze(['ADVERSARIAL_CRITIC']),
});

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
