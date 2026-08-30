/**
 * ACCESS-17 — Agent AccessIntent → domain AccessFabricIntent mapping.
 *
 * Consumed by ProposalGate in packages/sunrey-agent. Agents remain proposal-only.
 */

import type { AccessIntent } from '../../agent/src/access-fabric/types.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { accessRegistryIntentIdFor, capacityRefFor } from './registry-ids.ts';
import type { ProposeAccessIntentInput } from './registry-types.ts';

function agentCategoryToDomainCategory(
  category: AccessIntent['category'],
): ProposeAccessIntentInput['category'] {
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

/**
 * Maps a validated agent AccessIntent into the ACCESS-01 domain registry input.
 */
export function agentAccessIntentToDomainInput(input: {
  readonly intent: AccessIntent;
  readonly proposedAt?: ReturnType<typeof asUtcInstant>;
}): ProposeAccessIntentInput {
  const proposedAt = input.proposedAt ?? input.intent.createdAt;
  const location = input.intent.geography.city ?? input.intent.geography.region ?? 'global';
  const notAfter =
    input.intent.window.endAt ??
    (input.intent.window.durationDays
      ? asUtcInstant(new Date(Date.parse(proposedAt) + input.intent.window.durationDays * 86_400_000).toISOString())
      : asUtcInstant('2026-12-31T00:00:00.000Z'));

  return Object.freeze({
    id: accessRegistryIntentIdFor(input.intent.intentId.replace(/^axi_/, '')),
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
