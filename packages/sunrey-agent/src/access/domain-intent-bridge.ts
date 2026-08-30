/**
 * ACCESS-17 — Agent AccessIntent → domain AccessFabricIntent mapping at ProposalGate.
 */

import type { AccessIntent } from '../../../agent/src/access-fabric/types.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';

export type DomainAccessIntentRegistration = Readonly<{
  readonly id: string;
  readonly kind: 'REQUEST';
  readonly subjectRef: string;
  readonly capacityRef: string;
  readonly category:
    | 'VEHICLE_HOURS'
    | 'HOUSING_ROOM_NIGHTS'
    | 'FOOD'
    | 'EXPERIENCES'
    | 'ENERGY'
    | 'COMPUTE'
    | 'ROBOTICS'
    | 'MANUFACTURING'
    | 'GOODS'
    | 'SERVICES'
    | 'TRANSPORTATION'
    | 'TRAVEL';
  readonly bounds: readonly {
    readonly kind: 'TIME';
    readonly notBefore: ReturnType<typeof asUtcInstant>;
    readonly notAfter: ReturnType<typeof asUtcInstant>;
  }[];
  readonly purposeRef: string;
  readonly pegContextRef: string | null;
  readonly proposedAt: ReturnType<typeof asUtcInstant>;
}>;

function domainIntentIdFor(agentIntentId: string): string {
  return `ai_${agentIntentId.replace(/^axi_/, '')}`;
}

function capacityRefFor(seed: string): string {
  return `cap_${seed}`;
}

function agentCategoryToDomainCategory(
  category: AccessIntent['category'],
): DomainAccessIntentRegistration['category'] {
  switch (category) {
    case 'VEHICLE_RENTAL':
      return 'VEHICLE_HOURS';
    case 'RECURRING_FOOD_ACCESS':
      return 'FOOD';
    case 'LODGING':
      return 'HOUSING_ROOM_NIGHTS';
    case 'TRAVEL_EXPERIENCE':
    case 'EXPERIENCE_COMPOSITION':
      return 'EXPERIENCES';
    default:
      return 'EXPERIENCES';
  }
}

export function agentAccessIntentToDomainInput(input: {
  readonly intent: AccessIntent;
  readonly proposedAt?: ReturnType<typeof asUtcInstant>;
}): DomainAccessIntentRegistration {
  const proposedAt = input.proposedAt ?? input.intent.createdAt;
  const location = input.intent.geography.city ?? input.intent.geography.region ?? 'global';
  const notAfter =
    input.intent.window.endAt ??
    (input.intent.window.durationDays
      ? asUtcInstant(new Date(Date.parse(proposedAt) + input.intent.window.durationDays * 86_400_000).toISOString())
      : asUtcInstant('2026-12-31T00:00:00.000Z'));

  return Object.freeze({
    id: domainIntentIdFor(input.intent.intentId),
    kind: 'REQUEST',
    subjectRef: input.intent.subjectId,
    capacityRef: capacityRefFor(`${input.intent.category}-${location}`),
    category: agentCategoryToDomainCategory(input.intent.category),
    bounds: Object.freeze([
      {
        kind: 'TIME',
        notBefore: input.intent.window.startAt ?? proposedAt,
        notAfter,
      },
    ]),
    purposeRef: input.intent.purpose,
    pegContextRef: input.intent.pegContextRefs[0] ?? null,
    proposedAt,
  });
}
