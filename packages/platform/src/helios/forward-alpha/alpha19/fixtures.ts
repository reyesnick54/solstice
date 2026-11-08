import { asUtcInstant } from '@solstice/domain';

import { alpha03ChronologicalFixtureStream } from '../alpha03/fixtures.ts';

import { sealOutcomeMaturitySchedule } from './schedule.ts';
import type { OutcomeMaturitySchedule, OutcomeSealedDecisionBinding } from './types.ts';

export function alpha19ScheduleFixture(): OutcomeMaturitySchedule {
  const campaignStartsAt = asUtcInstant('2026-04-01T14:00:00.000Z');
  const sealed = sealOutcomeMaturitySchedule({
    scheduleId: 'sched_alpha19_fixture',
    campaignId: 'camp_alpha19_fixture',
    campaignStartsAt,
    sealedAt: asUtcInstant('2026-04-01T13:55:00.000Z'),
    requiredHorizonIds: ['5m', '1h'],
  });
  if (!sealed.ok) {
    throw new Error(sealed.error.message);
  }
  return sealed.value;
}

export function alpha19DecisionBindingFixture(): OutcomeSealedDecisionBinding {
  return Object.freeze({
    decisionId: 'pdec_alpha19_fixture',
    campaignId: 'camp_alpha19_fixture',
    decisionTime: asUtcInstant('2026-04-01T14:15:00.000Z'),
    instrumentId: 'helios:equity:AAPL:USD',
    referenceMidMinor: '1000100',
    sealedContentHash: 'fixture_seal_hash_alpha19',
    immutableAfterSeal: true as const,
  });
}

export function alpha19ObservationStream() {
  return alpha03ChronologicalFixtureStream();
}
