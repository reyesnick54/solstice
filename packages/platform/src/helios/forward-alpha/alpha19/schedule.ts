import type { UtcInstant } from '@solstice/domain';
import { err, ok, type Result } from '@solstice/domain';

import { HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA } from './taxonomy.ts';
import { assertKnownHorizonId } from './horizons.ts';
import type { CanonicalOutcomeHorizonId } from './taxonomy.ts';
import type { OutcomeMaturityEngineFailure, OutcomeMaturitySchedule } from './types.ts';

export function sealOutcomeMaturitySchedule(input: {
  readonly scheduleId: string;
  readonly campaignId: string;
  readonly campaignStartsAt: UtcInstant;
  readonly sealedAt: UtcInstant;
  readonly requiredHorizonIds: readonly string[];
}): Result<OutcomeMaturitySchedule, OutcomeMaturityEngineFailure> {
  if (Date.parse(input.sealedAt) > Date.parse(input.campaignStartsAt)) {
    return err({
      code: 'SCHEDULE_NOT_BEFORE_CAMPAIGN',
      message: 'OutcomeMaturitySchedule must be sealed before campaign start',
    });
  }
  const unique = new Set<string>();
  const resolved: CanonicalOutcomeHorizonId[] = [];
  for (const raw of input.requiredHorizonIds) {
    const gate = assertKnownHorizonId(raw);
    if (!gate.ok) {
      return err({ code: 'UNKNOWN_HORIZON', message: `unknown horizon ${raw}` });
    }
    if (unique.has(gate.id)) {
      continue;
    }
    unique.add(gate.id);
    resolved.push(gate.id);
  }
  if (resolved.length === 0) {
    return err({ code: 'UNKNOWN_HORIZON', message: 'schedule requires at least one horizon' });
  }
  return ok(
    Object.freeze({
      schema: HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
      scheduleId: input.scheduleId,
      campaignId: input.campaignId,
      declaredBeforeCampaignStart: true as const,
      campaignStartsAt: input.campaignStartsAt,
      sealedAt: input.sealedAt,
      requiredHorizonIds: Object.freeze([...resolved].sort()),
      grantsExecutionAuthority: false as const,
    }),
  );
}
