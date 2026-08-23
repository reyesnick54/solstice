import { asUtcInstant } from '../../../../domain/src/time.ts';
import type { PersonalEconomicSnapshot } from '../../../../personal-economic-graph/src/snapshot.ts';
import type { EconomicSnapshotId, EconomicGraphId } from '../../../../personal-economic-graph/src/ids.ts';
import type { OpportunityDiscoveryContext } from './types.ts';

export function snapshotFromLedgerPositions(
  subjectId: string,
  context: OpportunityDiscoveryContext,
): PersonalEconomicSnapshot {
  const byCurrency = new Map<string, { minor: bigint; refs: string[] }>();
  for (const row of context.ledgerPositions ?? []) {
    const current = byCurrency.get(row.currency) ?? { minor: 0n, refs: [] };
    current.minor += BigInt(row.minorUnits);
    current.refs.push(row.accountRef);
    byCurrency.set(row.currency, current);
  }
  return {
    snapshotId: `peg_s_ledger_${subjectId}` as EconomicSnapshotId,
    graphId: `peg_g_ledger_${subjectId}` as EconomicGraphId,
    subjectId,
    generatedAt: context.now,
    liquidAssetsByCurrency: Object.freeze(
      [...byCurrency.entries()].map(([currency, value]) =>
        Object.freeze({
          amount: { minorUnits: value.minor.toString(), currency },
          sourceRefs: Object.freeze(value.refs),
          confidence: 'DERIVED' as const,
        }),
      ),
    ),
    income: Object.freeze([]),
    knownRecurringObligations: Object.freeze([]),
    debt: Object.freeze([]),
    investments: Object.freeze([]),
    monthlyCashFlow: Object.freeze([]),
    goals: Object.freeze([]),
    economicOpportunities: Object.freeze([]),
    valuationContext: null,
    crossCurrencyTotal: null,
    authoritativeBalance: false,
    ledgerWins: true,
  };
}

export function emptySnapshot(subjectId: string, now: string): PersonalEconomicSnapshot {
  return snapshotFromLedgerPositions(subjectId, {
    now: asUtcInstant(now),
    jurisdiction: 'US',
    kycState: 'UNVERIFIED',
    customerRestricted: false,
    riskProfile: 'UNKNOWN',
    suitabilityMaxRisk: 'MODERATE',
    products: Object.freeze([]),
    policy: { queryControlFact: () => ({ factId: 'none', capability: 'none', permitted: false, evaluable: false, reason: 'none' }) },
    preferences: {
      subjectId,
      excludedCategories: Object.freeze([]),
      liquidityPreference: 'NEUTRAL',
      maxRiskLevel: 'MODERATE',
      goalPriorities: Object.freeze([]),
      updatedAt: asUtcInstant(now),
      cannotOverrideSuitability: true,
    },
    previous: Object.freeze([]),
  });
}
