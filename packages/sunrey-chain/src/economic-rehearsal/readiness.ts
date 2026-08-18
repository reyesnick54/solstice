/**
 * Feed Chunk 80 engineering evidence into Chunk 65 readiness.
 *
 * External legal, regulatory, licensing, audit, HSM, ceremony, and
 * partner slots remain incomplete. Software cannot mark them HUMAN_VERIFIED.
 */

import { generateActivationPlan, activationPlanDoesNotEnableLiveFlags } from '../mainnet/activation-plan.ts';
import { defaultDimensionCatalog } from '../mainnet/dimensions.ts';
import { applyEngineeringVerification } from '../mainnet/evidence.ts';
import { assembleReadinessRegistry } from '../mainnet/registry.ts';
import type { ActivationPlan, MainnetReadinessRegistry } from '../mainnet/types.ts';
import type { RehearsalFinding } from '../launch-rehearsal/types.ts';

const ENGINEERING_DIMENSIONS = new Set([
  'PROTOCOL',
  'CONSENSUS',
  'FORMAL_ASSURANCE',
  'SECURITY_TESTING',
  'CRYPTOGRAPHY',
  'PQC',
  'SUPPLY_CHAIN',
  'RELEASE',
  'VALIDATOR_OPERATIONS',
  'VALIDATOR_ECONOMICS',
  'GENESIS',
  'OBSERVABILITY',
  'DISASTER_RECOVERY',
  'STORAGE',
  'PERFORMANCE',
  'EXCHANGE',
  'INFRASTRUCTURE',
  'DUAL_ECONOMY_MODELING',
]);

export function reevaluateReadinessAfterEconomicRehearsal(): MainnetReadinessRegistry {
  const records = defaultDimensionCatalog().map((row) => {
    if (
      row.externalEvidence ||
      row.dimension === 'LEGAL' ||
      row.dimension === 'REGULATORY' ||
      row.dimension === 'LICENSING' ||
      row.dimension === 'HUMAN_AUTHORIZATION' ||
      row.dimension === 'EXTERNAL_SECURITY_REVIEW' ||
      row.dimension === 'ROOT_OF_TRUST' ||
      row.dimension === 'PARTNER_DEPENDENCIES'
    ) {
      return row;
    }
    if (ENGINEERING_DIMENSIONS.has(row.dimension)) {
      try {
        return applyEngineeringVerification(row, 'ENGINEERING_VERIFIED');
      } catch {
        return row;
      }
    }
    return row;
  });
  return assembleReadinessRegistry({ records });
}

export function updateActivationPlanFromEconomicRehearsal(
  findings: readonly RehearsalFinding[],
): ActivationPlan {
  const base = generateActivationPlan(defaultDimensionCatalog());
  const extra = findings
    .filter((row) => row.verificationState !== 'VERIFIED')
    .map((row, index) =>
      Object.freeze({
        order: base.steps.length + index + 1,
        id: `economic-rehearsal-${row.findingId.toLowerCase()}`,
        title: `Address economic rehearsal finding ${row.findingId}`,
        status: 'PLANNED' as const,
        executesInfrastructure: false as const,
        notes: `${row.description} Owner ${row.owner}. Plan only; not executed.`,
      }),
    );
  const plan = Object.freeze({
    ...base,
    steps: Object.freeze([...base.steps, ...extra]),
    incompleteEvidence: Object.freeze([
      ...base.incompleteEvidence,
      ...findings.filter((row) => row.verificationState === 'ACCEPTED_LIMITATION').map((row) => row.findingId),
    ]),
  });
  if (!activationPlanDoesNotEnableLiveFlags(plan)) {
    throw new TypeError('activation plan must not enable LIVE_* flags');
  }
  return plan;
}
