import { asUtcInstant } from '@solstice/domain';
import type { RegimeTaggedOutcome } from './regime-slices.ts';
import type { ChronologicalEarningsObservation } from './chronology.ts';
import type { EarningsCalendarEvent, EarningsIssuerProfile } from './types.ts';

const BASE = Date.parse('2024-01-15T21:00:00.000Z');

export const FIXTURE_ISSUER: EarningsIssuerProfile = Object.freeze({
  issuerId: 'issuer_acme',
  sector: 'TECH',
  marketCapTier: 'LARGE',
  analystCoverageScore: 82,
  liquidityScore: 78,
  volatilityBps: 1_800,
});

export function buildFixtureEarningsUniverse(eventCount = 48): {
  readonly calendar: readonly EarningsCalendarEvent[];
  readonly chronology: readonly ChronologicalEarningsObservation[];
  readonly labeledOutcomes: readonly RegimeTaggedOutcome[];
} {
  const calendar: EarningsCalendarEvent[] = [];
  const chronology: ChronologicalEarningsObservation[] = [];
  const labeled: RegimeTaggedOutcome[] = [];

  for (let i = 0; i < eventCount; i += 1) {
    const scheduledMs = BASE + i * 14 * 86_400_000;
    const scheduledAt = asUtcInstant(new Date(scheduledMs).toISOString());
    const reportMs = scheduledMs + 86_400_000;
    const knowableAt = asUtcInstant(new Date(reportMs).toISOString());
    const decisionMs = scheduledMs - 86_400_000;
    const decisionAt = asUtcInstant(new Date(decisionMs).toISOString());
    const eventId = `earn_evt_${i}`;

    calendar.push(
      Object.freeze({
        eventId,
        issuerId: `issuer_${i % 8}`,
        fiscalPeriod: `2024-Q${(i % 4) + 1}`,
        scheduledAt,
        reportKnowableAt: knowableAt,
      }),
    );

    const issuerId = `issuer_${i % 8}`;
    chronology.push(
      Object.freeze({
        eventId,
        issuerId,
        scheduledAt,
        decisionAt,
        knowableAt,
      }),
    );

    const consensus = 100n + BigInt(i % 7);
    const actual = consensus + BigInt(i % 3 === 0 ? 2 : -1);
    labeled.push(
      Object.freeze({
        epsActualMinor: actual,
        revenueActualMinor: 1_000_000n + BigInt(i * 1_000),
        epsConsensusMinor: consensus,
        revenueConsensusMinor: 1_000_000n + BigInt(i * 950),
        beatObserved: actual >= consensus,
        residualReturnBps: (i % 5) - 2,
        fundamentalsSignalBps: 40 + (i % 10),
        transcriptToneBps: 5_100 + (i % 20) * 10,
        optionsImpliedBps: 180 + (i % 15),
        seasonalEpsMinor: consensus - 1n,
        lastQuarterEpsMinor: consensus,
        issuer: FIXTURE_ISSUER,
        marketRegime: i % 2 === 0 ? 'BULL' : 'BEAR',
        preMajorRegime: i < eventCount / 2,
      }),
    );
  }

  return Object.freeze({
    calendar: Object.freeze(calendar),
    chronology: Object.freeze(chronology),
    labeledOutcomes: Object.freeze(labeled),
  });
}
