import {
  ATTRIBUTION_AUTHORIZES_MOONREY,
  ATTRIBUTION_DOES_NOT_MINT,
  CAPACITY_IS_NOT_OUTPUT,
  DUPLICATE_FULL_ATTRIBUTION_ALLOWED,
  OUTPUT_IS_NOT_DELIVERY,
  PRODUCTION_ACTIVE,
  SAME_UNDERLYING_EVENT_CANNOT_RECEIVE_MULTIPLE_FULL_CREDITS,
} from '../../../sunrey-chain/src/productive/policy-governance/attribution/constitution.ts';
import {
  developmentAttributionPolicy,
  evaluateAttribution,
  relationship,
  subject,
} from '../../../sunrey-chain/src/productive/policy-governance/attribution/index.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'NO_DOUBLE_MOONREY_ATTRIBUTION',
  'NO_DIRECT_PROVIDER_MINT',
  'CHUNK_71_MONETARY_AUTHORITY',
  'PRODUCTION_NOT_ACTIVE',
] as const;

export const productiveAttackScenarios: readonly AttackScenario[] = [
  'PRODATT-MANUFACTURING-GOODS',
  'PRODATT-DELIVERY-LOGISTICS',
  'PRODATT-AI-COMPUTE',
  'PRODATT-CAPACITY-AS-OUTPUT',
  'PRODATT-RESERVE-AS-EXTRACTION',
  'PRODATT-AREA-AS-USAGE',
  'PRODATT-GROSS-TRAFFIC',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15760 + index,
    category: 'PRODUCTIVE_ECONOMY_ABUSE',
    subsystem: 'attribution',
    attack: scenarioId.toLowerCase().replace('prodatt-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'DUPLICATE_ATTRIBUTION_ZEROED',
  }),
);

export function runProductiveAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const pair = pairFor(scenario.scenarioId);
    const evaluation = evaluateAttribution({
      policy: developmentAttributionPolicy(),
      height: 100,
      subjects: pair.subjects,
      relationships: pair.relationships,
    });
    const noAdditive = evaluation.decisions.some((row) => row.decision === 'ZERO_DUPLICATE_ATTRIBUTION' || row.decision === 'REVIEW_REQUIRED' || row.decision === 'REJECTED' || row.share < 1_000_000n)
      || evaluation.rejected
      || evaluation.reviewRequired;
    const blocked =
      evaluation.authorizesIssuance === false &&
      ATTRIBUTION_DOES_NOT_MINT &&
      !ATTRIBUTION_AUTHORIZES_MOONREY &&
      !DUPLICATE_FULL_ATTRIBUTION_ALLOWED &&
      SAME_UNDERLYING_EVENT_CANNOT_RECEIVE_MULTIPLE_FULL_CREDITS &&
      CAPACITY_IS_NOT_OUTPUT &&
      OUTPUT_IS_NOT_DELIVERY &&
      PRODUCTION_ACTIVE === false &&
      noAdditive;
    return {
      blocked,
      safetyHeld: blocked,
      detail: `${scenario.scenarioId} issuance=${String(evaluation.authorizesIssuance)} rejected=${String(evaluation.rejected)} review=${String(evaluation.reviewRequired)}`,
    };
  });
}

function pairFor(id: string) {
  const eventId = 'pee.shared.1';
  if (id === 'PRODATT-DELIVERY-LOGISTICS') {
    return {
      subjects: [
        subject({ claimId: 'claim.goods.delivery', economicEventId: eventId, category: 'GOODS', eventClass: 'DELIVERY', controllerId: 'ctrl.goods' }),
        subject({ claimId: 'claim.logistics', economicEventId: eventId, category: 'LOGISTICS_TRANSPORTATION', eventClass: 'DELIVERY', controllerId: 'ctrl.freight' }),
      ],
      relationships: [relationship(eventId, eventId, 'SAME_UNDERLYING_EVENT')],
    };
  }
  if (id === 'PRODATT-AI-COMPUTE') {
    return {
      subjects: [
        subject({ claimId: 'claim.compute', economicEventId: eventId, category: 'COMPUTE', controllerId: 'ctrl.compute' }),
        subject({ claimId: 'claim.ai', economicEventId: eventId, category: 'AI_COMPUTE', controllerId: 'ctrl.compute' }),
      ],
      relationships: [relationship(eventId, eventId, 'SAME_UNDERLYING_EVENT')],
    };
  }
  if (id === 'PRODATT-CAPACITY-AS-OUTPUT') {
    return {
      subjects: [
        subject({ claimId: 'claim.capacity', economicEventId: eventId, category: 'MANUFACTURING', claimType: 'CAPACITY', eventClass: 'CAPACITY', controllerId: 'ctrl.factory' }),
        subject({ claimId: 'claim.output', economicEventId: eventId, category: 'MANUFACTURING', claimType: 'OUTPUT', controllerId: 'ctrl.factory' }),
      ],
      relationships: [relationship(eventId, eventId, 'SAME_UNDERLYING_EVENT')],
    };
  }
  return {
    subjects: [
      subject({ claimId: 'claim.mfg', economicEventId: eventId, category: 'MANUFACTURING', controllerId: 'ctrl.factory' }),
      subject({ claimId: 'claim.goods', economicEventId: eventId, category: 'GOODS', controllerId: 'ctrl.factory' }),
    ],
    relationships: [relationship(eventId, eventId, 'SAME_UNDERLYING_EVENT')],
  };
}
