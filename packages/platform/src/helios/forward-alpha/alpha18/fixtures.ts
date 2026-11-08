import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import type { ForwardEvidenceSource, ForwardObservationReceipt } from './types.ts';

const CAMPAIGN_START = asUtcInstant('2026-06-01T14:00:00.000Z');

export function fixtureForwardEvidenceSource(
  overrides: Partial<ForwardEvidenceSource> & Pick<ForwardEvidenceSource, 'sourceClass'>,
): ForwardEvidenceSource {
  return Object.freeze({
    sourceId: overrides.sourceId ?? 'src_alpha18_fixture',
    sourceClass: overrides.sourceClass,
    providerIdentity: overrides.providerIdentity ?? 'prov:readonly_live:fixture',
    providerQualification: overrides.providerQualification ?? 'SANDBOX_READONLY_LIVE_QUALIFIED',
    campaignId: overrides.campaignId ?? 'fwd_camp_alpha18',
    campaignStartedAt: overrides.campaignStartedAt ?? CAMPAIGN_START,
    delayedLivePolicy: overrides.delayedLivePolicy ?? null,
  });
}

export function fixtureForwardObservationReceipt(input: {
  readonly sourceClass: ForwardEvidenceSource['sourceClass'];
  readonly sunreyArrivalTime?: UtcInstant;
  readonly eventTimestamp?: UtcInstant;
  readonly knowableAt?: UtcInstant;
  readonly receiptId?: string;
  readonly delayedLivePolicy?: ForwardEvidenceSource['delayedLivePolicy'];
  readonly sequenceIntegrity?: ForwardObservationReceipt['sequenceIntegrity'];
  readonly marketDataQuality?: ForwardObservationReceipt['marketDataQuality'];
  readonly entitlementState?: ForwardObservationReceipt['entitlementState'];
}): ForwardObservationReceipt {
  const source = fixtureForwardEvidenceSource({
    sourceClass: input.sourceClass,
    delayedLivePolicy: input.delayedLivePolicy ?? null,
  });
  const eventTimestamp = input.eventTimestamp ?? asUtcInstant('2026-06-01T14:30:00.000Z');
  const knowableAt = input.knowableAt ?? asUtcInstant('2026-06-01T14:30:00.500Z');
  const sunreyArrivalTime = input.sunreyArrivalTime ?? asUtcInstant('2026-06-01T14:30:01.000Z');
  return Object.freeze({
    receiptId: input.receiptId ?? `rcpt_${input.sourceClass.toLowerCase()}`,
    source,
    providerIdentity: source.providerIdentity,
    providerQualification: source.providerQualification,
    sunreyArrivalTime,
    eventTimestamp,
    knowableAt,
    campaignStartedAt: source.campaignStartedAt,
    marketDataQuality: input.marketDataQuality ?? 'VALID',
    sequenceIntegrity: input.sequenceIntegrity ?? 'INTACT',
    entitlementState: input.entitlementState ?? 'USABLE',
    rawEvidenceReference: `evidence:alpha18:${input.receiptId ?? input.sourceClass}`,
  });
}

export const ALPHA18_FIXTURE_CAMPAIGN_START = CAMPAIGN_START;
