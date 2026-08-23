/**
 * Read-only Consumer BFF adapter for HIN contributions and economic
 * value inputs. Orchestration only. Does not verify or mint.
 */

import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { subjectRefFor, type ContributionId } from '../../../../packages/human-economic-contribution/src/ids.ts';
import {
  HinEconomicValueEngine,
  type HinAggregateMetrics,
  type HinContributionRecord,
  type HinCustomerSummary,
} from '../../../../packages/human-economic-contribution/src/hin-value/index.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

export type HinPublicContribution = {
  readonly contributionId: string;
  readonly category: HinContributionRecord['category'];
  readonly verification: HinContributionRecord['verification'];
  readonly observedAt: string;
  readonly quantity: string;
  readonly unit: string;
  readonly economicValueInput: string | null;
  readonly issuancePromised: false;
  readonly containsRawPersonalData: false;
};

export type HinContributionSurface = {
  readonly list: (subjectSeed: string) => { readonly items: readonly HinPublicContribution[] };
  readonly get: (contributionId: string) => HinPublicContribution | { readonly error: 'NOT_FOUND' };
  readonly metrics: () => HinAggregateMetrics;
  readonly me: (subjectSeed: string) => HinCustomerSummary;
  readonly methodologies: () => ReturnType<HinEconomicValueEngine['publicMethodologies']>;
};

function publicRow(record: HinContributionRecord): HinPublicContribution {
  return Object.freeze({
    contributionId: record.contributionId,
    category: record.category,
    verification: record.verification,
    observedAt: record.observedAt,
    quantity: record.quantity.toString(),
    unit: record.unit,
    economicValueInput: record.economicValueInputId,
    issuancePromised: false,
    containsRawPersonalData: false,
  });
}

export function createHinContributionSurface(): HinContributionSurface {
  const engine = new HinEconomicValueEngine();
  const subject = subjectRefFor('cust_basic');
  const recorded = engine.submitFromAuthorizedSource(
    {
      subject,
      category: 'RESEARCH_CONTRIBUTION',
      sourceReference: 'research.sandbox.1',
      observedAt: NOW,
      createdAt: NOW,
      quantity: 1n,
      qualityBps: 8_000n,
      confidenceBps: 8_000n,
      purpose: 'AGGREGATED_RESEARCH',
      consentReference: 'consent.sandbox.1',
      jurisdiction: 'GB',
    },
    { kind: 'AUTHORIZED_SOURCE', actorId: 'hin.sandbox.source' },
  );
  if (recorded.ok) {
    engine.verify(recorded.value.contributionId, { kind: 'AUTHORIZED_VERIFIER', actorId: 'hin.sandbox.verifier' }, NOW);
    engine.computeValueInput(recorded.value.contributionId, NOW);
  }
  return Object.freeze({
    list(subjectSeed: string) {
      const rows = engine.list(subjectRefFor(subjectSeed));
      return Object.freeze({ items: rows.map(publicRow) });
    },
    get(contributionId: string) {
      const record = engine.get(contributionId as ContributionId);
      return record ? publicRow(record) : { error: 'NOT_FOUND' as const };
    },
    metrics() {
      return engine.metrics();
    },
    me(subjectSeed: string) {
      return engine.customerSummary(subjectRefFor(subjectSeed));
    },
    methodologies() {
      return engine.publicMethodologies();
    },
  });
}
