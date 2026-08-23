import { Money } from '../../../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../../../personal-economic-graph/src/snapshot.ts';
import type { CompiledEconomicMandate, SerializedMoney } from '../../mandate/types.ts';
import { constraintAmount, liquidForCurrency } from '../feasibility.ts';
import { DETECTOR_TO_CATEGORY } from './taxonomy.ts';
import { estimatedAnnualEffect } from './impact.ts';
import { productsFor, rateFor } from './products.ts';
import type {
  DetectorFinding,
  LedgerLiquidPosition,
  OpportunityDiscoveryContext,
  OpportunityDiscoveryInput,
} from './types.ts';

const IDLE_THRESHOLD = 50_000n;
const SURPLUS_THRESHOLD = 20_000n;
const CONCENTRATION_BPS = 4000;
const CURRENCY_CONCENTRATION_BPS = 8000;
const DRIFT_BPS = 500;
const DEFAULT_RESERVE = 800_000n;

function moneyOf(amount: SerializedMoney): Money {
  return Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
}

function zeroFees(): DetectorFinding['fees'] {
  return Object.freeze([]);
}

function productField(productId: string | undefined): { readonly productId: string } | Record<string, never> {
  return productId ? { productId } : {};
}

export function liquidPositions(
  snapshot: PersonalEconomicSnapshot,
  context: OpportunityDiscoveryContext,
  currency: string,
): { readonly liquid: Money; readonly refs: readonly string[] } {
  if (context.ledgerPositions && context.ledgerPositions.length > 0) {
    const rows = context.ledgerPositions.filter((item) => item.currency === currency && !item.frozen);
    let total = Money.zero(currency);
    const refs: string[] = [];
    for (const row of rows) {
      total = total.plus(Money.fromMinorUnitsString(row.minorUnits, row.currency));
      refs.push(row.accountRef);
    }
    return { liquid: total, refs: Object.freeze(refs) };
  }
  return {
    liquid: liquidForCurrency(snapshot, currency),
    refs: Object.freeze(
      snapshot.liquidAssetsByCurrency
        .filter((item) => item.amount.currency === currency)
        .flatMap((item) => item.sourceRefs),
    ),
  };
}

export function reserveFloor(
  mandate: CompiledEconomicMandate | undefined,
  snapshot: PersonalEconomicSnapshot,
  currency: string,
): Money {
  if (mandate) {
    const floor =
      constraintAmount(mandate, 'MINIMUM_CASH_RESERVE') ??
      constraintAmount(mandate, 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR');
    if (floor && floor.currency === currency) {
      return floor;
    }
    const emergency = mandate.goals.find((goal) => goal.kind === 'BUILD_EMERGENCY_RESERVE' && goal.target);
    if (emergency?.target && emergency.target.currency === currency) {
      return moneyOf(emergency.target);
    }
  }
  const pegReserve = snapshot.goals.find((goal) => goal.goalKind === 'EMERGENCY_RESERVE');
  if (pegReserve && pegReserve.target.currency === currency) {
    return moneyOf(pegReserve.target);
  }
  const outflow = snapshot.monthlyCashFlow.find((item) => item.currency === currency);
  if (outflow) {
    const monthly = moneyOf(outflow.recurringOutflows.amount);
    if (monthly.isPositive()) {
      return Money.fromMinorUnits(monthly.minorUnits * 3n, currency);
    }
  }
  return Money.fromMinorUnits(DEFAULT_RESERVE, currency);
}

function accountOfClass(
  positions: readonly LedgerLiquidPosition[] | undefined,
  snapshot: PersonalEconomicSnapshot,
  pattern: RegExp,
): string | undefined {
  const fromLedger = positions?.find((item) => pattern.test(`${item.accountRef} ${item.accountClass ?? ''}`));
  if (fromLedger) {
    return fromLedger.accountRef;
  }
  const fromPeg = snapshot.liquidAssetsByCurrency.flatMap((item) => item.sourceRefs).find((ref) => pattern.test(ref));
  return fromPeg;
}

function monthlySurplus(snapshot: PersonalEconomicSnapshot, currency: string): Money {
  const flow = snapshot.monthlyCashFlow.find((item) => item.currency === currency);
  if (!flow) {
    return Money.zero(currency);
  }
  return moneyOf(flow.netFlow.amount);
}

function monthsUntil(now: string, targetDate: string | null): number | undefined {
  if (!targetDate) {
    return undefined;
  }
  const start = Date.parse(now);
  const end = Date.parse(targetDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined;
  }
  return Math.max(1, Math.ceil((end - start) / (30 * 24 * 60 * 60 * 1000)));
}

export function runOpportunityDetectors(input: OpportunityDiscoveryInput): readonly DetectorFinding[] {
  const findings: DetectorFinding[] = [];
  const currency = input.mandate?.currency ?? input.snapshot.liquidAssetsByCurrency[0]?.amount.currency ?? 'USD';
  const { liquid, refs } = liquidPositions(input.snapshot, input.context, currency);
  const floor = reserveFloor(input.mandate, input.snapshot, currency);
  const surplus = monthlySurplus(input.snapshot, currency);
  const catalog = input.context.products;
  const checking = accountOfClass(input.context.ledgerPositions, input.snapshot, /checking|DEMAND_DEPOSIT/i);
  const savings = accountOfClass(input.context.ledgerPositions, input.snapshot, /savings|SAVINGS_DEPOSIT/i);
  const investmentCashAccount = accountOfClass(
    input.context.ledgerPositions,
    input.snapshot,
    /invest|broker|SECURITIES/i,
  );

  const idle = liquid.cmp(floor) > 0 ? liquid.minus(floor) : Money.zero(currency);
  const cashProduct = productsFor('CASH_OPTIMIZATION', catalog)[0] ?? productsFor('EMERGENCY_RESERVE', catalog)[0];
  if (idle.minorUnits >= IDLE_THRESHOLD && cashProduct) {
    const rate = rateFor(currency, input.context.rateCatalog);
    const range = rate ? estimatedAnnualEffect(idle, rate) : undefined;
    findings.push({
      detector: 'EXCESS_IDLE_CASH',
      title: 'Put idle cash to work',
      summary: 'Liquid balances sit above the reserve floor in existing eligible accounts.',
      source: input.context.ledgerPositions?.length ? 'LEDGER_POSITION' : 'PEG',
      currency,
      ...(range?.high ? { estimatedImpact: range.high } : {}),
      ...(range ? { impactRange: range } : {}),
      riskLevel: 'LOW',
      liquidityImpact: 'NEUTRAL',
      timeHorizon: 'NEAR_TERM',
      fees: zeroFees(),
      dependencies: Object.freeze(['existing_eligible_accounts']),
      goalIds: Object.freeze(
        [
          ...(input.mandate?.goals.filter((g) => g.kind === 'MAINTAIN_TARGET_LIQUIDITY').map((g) => g.goalId) ?? []),
          ...input.snapshot.goals.filter((g) => g.goalKind === 'TARGET_LIQUIDITY').map((g) => g.nodeId),
        ],
      ),
      evidence: {
        factRefs: refs,
        detector: 'EXCESS_IDLE_CASH',
        snapshotId: input.snapshot.snapshotId,
        notes: Object.freeze([
          `liquid=${liquid.toJSON().minorUnits}`,
          `reserveFloor=${floor.toJSON().minorUnits}`,
          `idle=${idle.toJSON().minorUnits}`,
        ]),
      },
      productId: cashProduct.productId,
      confidence: 80,
      urgency: 40,
      assumptions: Object.freeze([
        'Reserve floor is taken from the mandate, PEG emergency goal, or three months of known outflows.',
        'Catalog rate is a simulation reference, not a promised cash-flow outcome.',
        checking && savings
          ? `Existing accounts ${checking} and ${savings} can receive an internal transfer after confirmation.`
          : 'An eligible interest-bearing product must remain available before any transfer is proposed.',
      ]),
      ...(rate ? { rateSource: rate } : {}),
      impactKind: rate ? 'ESTIMATED_RANGE' : 'NON_QUANTIFIED_BENEFIT',
      fingerprintAnchor: `${currency}:${checking ?? 'any'}`,
    });
  }

  if (liquid.cmp(floor) < 0) {
    const gap = floor.minus(liquid);
    findings.push({
      detector: 'INSUFFICIENT_RESERVE',
      title: 'Build your emergency reserve',
      summary: 'Current liquid balances are below the reserve target used for planning.',
      source: input.mandate ? 'MANDATE_GOAL' : 'PEG',
      currency,
      estimatedImpact: gap.toJSON(),
      impactRange: { low: gap.toJSON(), high: gap.toJSON() },
      riskLevel: 'LOW',
      liquidityImpact: 'INCREASES',
      timeHorizon: 'IMMEDIATE',
      fees: zeroFees(),
      dependencies: Object.freeze([]),
      goalIds: Object.freeze(
        [
          ...(input.mandate?.goals.filter((g) => g.kind === 'BUILD_EMERGENCY_RESERVE').map((g) => g.goalId) ?? []),
          ...input.snapshot.goals.filter((g) => g.goalKind === 'EMERGENCY_RESERVE').map((g) => g.nodeId),
        ],
      ),
      evidence: {
        factRefs: refs,
        detector: 'INSUFFICIENT_RESERVE',
        snapshotId: input.snapshot.snapshotId,
        notes: Object.freeze([`gap=${gap.toJSON().minorUnits}`]),
      },
      ...productField(productsFor('EMERGENCY_RESERVE', catalog)[0]?.productId),
      confidence: 90,
      urgency: 95,
      assumptions: Object.freeze([
        'Reserve progress uses current liquid facts. Future surplus is not guaranteed.',
        'Achievement of the reserve target is not promised.',
      ]),
      impactKind: 'KNOWN_FINANCIAL_EFFECT',
      fingerprintAnchor: `${currency}:reserve`,
    });
  }

  if (surplus.minorUnits >= SURPLUS_THRESHOLD) {
    findings.push({
      detector: 'RECURRING_SURPLUS',
      title: 'Recurring surplus detected',
      summary: 'Known inflows exceed known outflows in the current monthly window.',
      source: 'PEG',
      currency,
      estimatedImpact: surplus.toJSON(),
      impactRange: { low: surplus.toJSON(), high: surplus.toJSON() },
      riskLevel: 'LOW',
      liquidityImpact: 'INCREASES',
      timeHorizon: 'NEAR_TERM',
      fees: zeroFees(),
      dependencies: Object.freeze([]),
      goalIds: Object.freeze(
        input.mandate?.goals.filter((g) => g.kind === 'INCREASE_MONTHLY_SURPLUS').map((g) => g.goalId) ?? [],
      ),
      evidence: {
        factRefs: Object.freeze(input.snapshot.monthlyCashFlow.flatMap((item) => item.netFlow.sourceRefs)),
        detector: 'RECURRING_SURPLUS',
        snapshotId: input.snapshot.snapshotId,
        notes: Object.freeze([`net=${surplus.toJSON().minorUnits}`]),
      },
      ...productField(productsFor('RECURRING_SAVING', catalog)[0]?.productId),
      confidence: 70,
      urgency: 35,
      assumptions: Object.freeze([
        'Surplus is derived from PEG cash-flow facts for the current month.',
        'Future months may differ. This is not income until settled.',
      ]),
      impactKind: 'KNOWN_FINANCIAL_EFFECT',
      fingerprintAnchor: `${currency}:surplus`,
    });
  }

  const goals = [
    ...(input.mandate?.goals
      .filter((goal) => goal.target)
      .map((goal) => ({
        id: goal.goalId as string,
        label: goal.label,
        target: goal.target!,
        date: goal.timeHorizon?.date ?? null,
        baseline: goal.baseline,
      })) ?? []),
    ...input.snapshot.goals.map((goal) => ({
      id: goal.nodeId,
      label: goal.label,
      target: goal.target,
      date: goal.targetDate,
      baseline: undefined,
    })),
  ];
  for (const goal of goals) {
    if (goal.target.currency !== currency) {
      continue;
    }
    const target = moneyOf(goal.target);
    const funded = goal.baseline ? moneyOf(goal.baseline) : liquid.cmp(target) < 0 ? liquid : target;
    if (funded.cmp(target) >= 0) {
      continue;
    }
    const gap = target.minus(funded);
    const months = monthsUntil(input.context.now, goal.date);
    const monthlyRequired = months ? Money.fromMinorUnits((gap.minorUnits + BigInt(months) - 1n) / BigInt(months), currency) : gap;
    findings.push({
      detector: 'GOAL_FUNDING_GAP',
      title: `You're behind on ${goal.label}`,
      summary: 'Current funding is below the stated goal target. Achievement is not promised.',
      source: input.mandate ? 'MANDATE_GOAL' : 'PEG',
      currency,
      estimatedImpact: gap.toJSON(),
      impactRange: { low: gap.toJSON(), high: gap.toJSON() },
      riskLevel: 'LOW',
      liquidityImpact: 'DECREASES',
      timeHorizon: months && months <= 3 ? 'NEAR_TERM' : 'MEDIUM_TERM',
      fees: zeroFees(),
      dependencies: Object.freeze([]),
      goalIds: Object.freeze([goal.id]),
      evidence: {
        factRefs: Object.freeze([goal.id, ...refs]),
        detector: 'GOAL_FUNDING_GAP',
        snapshotId: input.snapshot.snapshotId,
        notes: Object.freeze([
          `gap=${gap.toJSON().minorUnits}`,
          months ? `monthsRemaining=${String(months)}` : 'noTargetDate',
          `monthlyRequired=${monthlyRequired.toJSON().minorUnits}`,
        ]),
      },
      ...productField(productsFor('GOAL_FUNDING', catalog)[0]?.productId),
      confidence: months ? 75 : 55,
      urgency: months && months <= 3 ? 85 : 60,
      assumptions: Object.freeze([
        'Monthly required contribution is gap divided by remaining months, rounded up.',
        'Goal achievement is not promised.',
      ]),
      impactKind: 'KNOWN_FINANCIAL_EFFECT',
      fingerprintAnchor: `${currency}:${goal.id}`,
    });
  }

  const holdings = input.context.portfolio?.holdings ?? [];
  const totalHoldings = holdings.reduce((sum, item) => {
    if (item.amount.currency !== currency) {
      return sum;
    }
    return sum + BigInt(item.amount.minorUnits);
  }, 0n);
  if (totalHoldings > 0n) {
    let largest = holdings[0];
    let largestBps = 0;
    for (const holding of holdings) {
      if (holding.amount.currency !== currency) {
        continue;
      }
      const bps = holding.weightBps ?? Number((BigInt(holding.amount.minorUnits) * 10000n) / totalHoldings);
      if (bps > largestBps) {
        largest = holding;
        largestBps = bps;
      }
    }
    if (largest && largestBps >= CONCENTRATION_BPS && productsFor(DETECTOR_TO_CATEGORY.PORTFOLIO_CONCENTRATION, catalog)[0]) {
      findings.push({
        detector: 'PORTFOLIO_CONCENTRATION',
        title: 'Your portfolio is concentrated',
        summary: `${largest.label} is a large share of known holdings. This is not a trade instruction.`,
        source: 'PORTFOLIO_FACTS',
        currency,
        riskLevel: 'MODERATE',
        liquidityImpact: 'UNKNOWN',
        timeHorizon: 'MEDIUM_TERM',
        fees: zeroFees(),
        dependencies: Object.freeze(['paper_investment_review_only']),
        goalIds: Object.freeze([]),
        evidence: {
          factRefs: Object.freeze(holdings.map((item) => item.holdingId)),
          detector: 'PORTFOLIO_CONCENTRATION',
          notes: Object.freeze([`largest=${largest.holdingId}`, `weightBps=${String(largestBps)}`]),
        },
        ...productField(productsFor('DIVERSIFICATION', catalog)[0]?.productId),
        confidence: 65,
        urgency: 50,
        assumptions: Object.freeze([
          'Concentration uses provided holding amounts only.',
          'Investment execution is not implemented. Review is proposal-only.',
        ]),
        impactKind: 'NON_QUANTIFIED_BENEFIT',
        fingerprintAnchor: `${currency}:${largest.holdingId}`,
      });
    }

    const targets = input.context.portfolio?.targetWeightsBps;
    if (targets) {
      for (const holding of holdings) {
        const current = holding.weightBps ?? Number((BigInt(holding.amount.minorUnits) * 10000n) / totalHoldings);
        const target = targets[holding.holdingId];
        if (target === undefined) {
          continue;
        }
        const drift = Math.abs(current - target);
        if (drift >= DRIFT_BPS) {
          findings.push({
            detector: 'PORTFOLIO_DRIFT',
            title: 'Portfolio allocation has drifted',
            summary: `${holding.label} differs from the stated target weight. Rebalance is not automatic.`,
            source: 'PORTFOLIO_FACTS',
            currency,
            riskLevel: 'MODERATE',
            liquidityImpact: 'NEUTRAL',
            timeHorizon: 'MEDIUM_TERM',
            fees: zeroFees(),
            dependencies: Object.freeze(['paper_investment_review_only']),
            goalIds: Object.freeze([]),
            evidence: {
              factRefs: Object.freeze([holding.holdingId]),
              detector: 'PORTFOLIO_DRIFT',
              notes: Object.freeze([`currentBps=${String(current)}`, `targetBps=${String(target)}`]),
            },
            ...productField(productsFor('PORTFOLIO_REBALANCE', catalog)[0]?.productId),
            confidence: 60,
            urgency: 45,
            assumptions: Object.freeze(['Drift uses stated target weights. No market path is invented.']),
            impactKind: 'NON_QUANTIFIED_BENEFIT',
            fingerprintAnchor: `${currency}:drift:${holding.holdingId}`,
          });
        }
      }
    }
  }

  const investmentCash =
    input.context.portfolio?.investmentCash ??
    (investmentCashAccount && input.context.ledgerPositions
      ? {
          minorUnits:
            input.context.ledgerPositions.find((item) => item.accountRef === investmentCashAccount)?.minorUnits ?? '0',
          currency,
        }
      : undefined);
  if (investmentCash && BigInt(investmentCash.minorUnits) >= IDLE_THRESHOLD) {
    findings.push({
      detector: 'UNINVESTED_INVESTMENT_CASH',
      title: 'Uninvested investment-account cash',
      summary: 'Cash sits in an investment-class account. Paper review is available; live execution is not.',
      source: 'PORTFOLIO_FACTS',
      currency,
      estimatedImpact: investmentCash,
      riskLevel: 'UNCERTAIN_MARKET',
      liquidityImpact: 'DECREASES',
      timeHorizon: 'UNSPECIFIED',
      fees: zeroFees(),
      dependencies: Object.freeze(['investment_execution_not_implemented']),
      goalIds: Object.freeze(
        input.mandate?.goals.filter((g) => g.kind === 'INVEST_ELIGIBLE_LONG_TERM_SURPLUS_LATER').map((g) => g.goalId) ?? [],
      ),
      evidence: {
        factRefs: Object.freeze(investmentCashAccount ? [investmentCashAccount] : []),
        detector: 'UNINVESTED_INVESTMENT_CASH',
        notes: Object.freeze([`cash=${investmentCash.minorUnits}`]),
      },
      ...productField(productsFor('INVESTMENT_ALLOCATION', catalog)[0]?.productId),
      confidence: 50,
      urgency: 30,
      assumptions: Object.freeze([
        'Investment execution remains unimplemented.',
        'No market outcome is promised.',
      ]),
      impactKind: 'SCENARIO_RANGE',
      fingerprintAnchor: `${currency}:invest-cash`,
    });
  }

  const byCurrency = new Map<string, bigint>();
  if (input.context.ledgerPositions?.length) {
    for (const row of input.context.ledgerPositions) {
      byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0n) + BigInt(row.minorUnits));
    }
  } else {
    for (const item of input.snapshot.liquidAssetsByCurrency) {
      byCurrency.set(item.amount.currency, (byCurrency.get(item.amount.currency) ?? 0n) + BigInt(item.amount.minorUnits));
    }
  }
  const currencyTotal = [...byCurrency.values()].reduce((sum, value) => sum + value, 0n);
  if (byCurrency.size >= 2 && currencyTotal > 0n) {
    let dominant: [string, bigint] = ['USD', 0n];
    for (const entry of byCurrency) {
      if (entry[1] > dominant[1]) {
        dominant = entry;
      }
    }
    const bps = Number((dominant[1] * 10000n) / currencyTotal);
    if (bps >= CURRENCY_CONCENTRATION_BPS && productsFor('CURRENCY_OPTIMIZATION', catalog)[0]) {
      findings.push({
        detector: 'CURRENCY_CONCENTRATION',
        title: 'Currency concentration',
        summary: `Most liquid balances are in ${dominant[0]}. FX review does not compute a client rate.`,
        source: 'LEDGER_POSITION',
        currency: dominant[0],
        riskLevel: 'MODERATE',
        liquidityImpact: 'NEUTRAL',
        timeHorizon: 'NEAR_TERM',
        fees: zeroFees(),
        dependencies: Object.freeze(['server_owned_fx_quote']),
        goalIds: Object.freeze([]),
        evidence: {
          factRefs: Object.freeze([...byCurrency.keys()]),
          detector: 'CURRENCY_CONCENTRATION',
          notes: Object.freeze([`dominant=${dominant[0]}`, `weightBps=${String(bps)}`]),
        },
        ...productField(productsFor('CURRENCY_OPTIMIZATION', catalog)[0]?.productId),
        confidence: 70,
        urgency: 40,
        assumptions: Object.freeze(['FX quotes are server-owned. The client must not compute a rate.']),
        impactKind: 'NON_QUANTIFIED_BENEFIT',
        fingerprintAnchor: dominant[0],
      });
    }
  }

  for (const fee of input.snapshot.knownRecurringObligations.filter((item) => /fee/i.test(item.label))) {
    const comparison = input.context.feeComparisons?.find((item) => item.obligationRef === fee.nodeId);
    if (!comparison?.alternative) {
      continue;
    }
    const current = moneyOf(comparison.current);
    const alternative = moneyOf(comparison.alternative);
    if (alternative.cmp(current) >= 0) {
      continue;
    }
    const saving = current.minus(alternative);
    findings.push({
      detector: 'HIGH_FEES',
      title: `Review fee ${fee.label}`,
      summary: 'A catalog alternative is cheaper than a known recurring fee. Comparison data is required.',
      source: 'PRODUCT_CATALOG',
      currency: fee.estimatedAmount.currency,
      estimatedImpact: saving.toJSON(),
      impactRange: { low: saving.toJSON(), high: saving.toJSON() },
      riskLevel: 'LOW',
      liquidityImpact: 'INCREASES',
      timeHorizon: 'NEAR_TERM',
      fees: Object.freeze([
        { code: 'CURRENT_FEE', amount: comparison.current, description: fee.label },
        { code: 'ALTERNATIVE_FEE', amount: comparison.alternative, description: comparison.alternativeLabel ?? 'alternative' },
      ]),
      dependencies: Object.freeze(['fee_comparison_catalog']),
      goalIds: Object.freeze(
        input.mandate?.goals.filter((g) => g.kind === 'REDUCE_UNNECESSARY_FEES').map((g) => g.goalId) ?? [],
      ),
      evidence: {
        factRefs: Object.freeze([fee.nodeId]),
        detector: 'HIGH_FEES',
        notes: Object.freeze([`saving=${saving.toJSON().minorUnits}`]),
      },
      ...productField(productsFor('EXPENSE_OPTIMIZATION', catalog)[0]?.productId),
      confidence: 55,
      urgency: 35,
      assumptions: Object.freeze(['Fee comparison uses supplied catalog rows only. Avoided cost is not income.']),
      impactKind: 'KNOWN_FINANCIAL_EFFECT',
      fingerprintAnchor: fee.nodeId,
    });
  }

  const keepAllLiquid = input.mandate?.hardConstraints.some((item) => item.kind === 'KEEP_ALL_LIQUID') ?? false;
  const nearObligation = input.snapshot.knownRecurringObligations.find((item) =>
    /rent|loan|insurance/i.test(`${item.kind} ${item.label}`),
  );
  if (keepAllLiquid && investmentCash && BigInt(investmentCash.minorUnits) > 0n) {
    findings.push({
      detector: 'MISMATCHED_LIQUIDITY',
      title: 'Liquidity preference conflicts with invested cash',
      summary: 'The mandate asks to keep funds liquid while investment-class cash is present.',
      source: 'MANDATE_GOAL',
      currency,
      estimatedImpact: investmentCash,
      riskLevel: 'MODERATE',
      liquidityImpact: 'INCREASES',
      timeHorizon: 'IMMEDIATE',
      fees: zeroFees(),
      dependencies: Object.freeze([]),
      goalIds: Object.freeze(
        input.mandate?.goals.filter((g) => g.kind === 'MAINTAIN_TARGET_LIQUIDITY').map((g) => g.goalId) ?? [],
      ),
      evidence: {
        factRefs: Object.freeze(['KEEP_ALL_LIQUID']),
        detector: 'MISMATCHED_LIQUIDITY',
        notes: Object.freeze(['mandate_keep_all_liquid']),
      },
      ...productField(productsFor('CASH_OPTIMIZATION', catalog)[0]?.productId),
      confidence: 80,
      urgency: 70,
      assumptions: Object.freeze(['Hard mandate constraints cannot be overridden by preferences.']),
      impactKind: 'NON_QUANTIFIED_BENEFIT',
      fingerprintAnchor: `${currency}:keep-liquid`,
    });
  } else if (nearObligation && liquid.cmp(moneyOf(nearObligation.estimatedAmount)) < 0) {
    findings.push({
      detector: 'MISMATCHED_LIQUIDITY',
      title: 'Near-term obligation exceeds liquid cash',
      summary: 'A known essential outflow is larger than current liquid balances.',
      source: 'PEG',
      currency: nearObligation.estimatedAmount.currency,
      estimatedImpact: moneyOf(nearObligation.estimatedAmount).minus(liquid).toJSON(),
      riskLevel: 'MODERATE',
      liquidityImpact: 'INCREASES',
      timeHorizon: 'IMMEDIATE',
      fees: zeroFees(),
      dependencies: Object.freeze([]),
      goalIds: Object.freeze([]),
      evidence: {
        factRefs: Object.freeze([nearObligation.nodeId]),
        detector: 'MISMATCHED_LIQUIDITY',
        notes: Object.freeze([`obligation=${nearObligation.estimatedAmount.minorUnits}`]),
      },
      ...productField(productsFor('CASH_OPTIMIZATION', catalog)[0]?.productId),
      confidence: 85,
      urgency: 90,
      assumptions: Object.freeze(['Essential obligations stay funded. This is not a payment instruction.']),
      impactKind: 'KNOWN_FINANCIAL_EFFECT',
      fingerprintAnchor: `${nearObligation.estimatedAmount.currency}:${nearObligation.nodeId}`,
    });
  }

  return Object.freeze(findings);
}
