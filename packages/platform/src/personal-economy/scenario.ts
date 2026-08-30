import type { UtcInstant } from '../../../domain/src/time.ts';
import { deterministicScenarioId, type PersonalEconomyScenarioId } from './ids.ts';
import type { PersonalEconomyConstraints } from './constraints.ts';
import type { PersonalEconomySnapshot } from './snapshot.ts';
import { PERSONAL_ECONOMY_SCENARIO_KINDS, SIMULATION_DISCLAIMER, type PersonalEconomyScenarioKind } from './taxonomy.ts';

export type PersonalEconomyScenarioInput = {
  readonly kind: PersonalEconomyScenarioKind;
  readonly amountMinorUnits?: string;
  readonly currency?: string;
  readonly tokenQuantity?: string;
  readonly holdMonths?: number;
  readonly travelTrips?: number;
  readonly marketShockBps?: number;
  readonly tokenShockBps?: number;
};

export type PersonalEconomyScenarioOutcome = {
  readonly scenarioId: PersonalEconomyScenarioId;
  readonly kind: PersonalEconomyScenarioKind;
  readonly subjectId: string;
  readonly generatedAt: UtcInstant;
  readonly label: string;
  readonly baselineLiquidityMinorUnits: string;
  readonly projectedLiquidityMinorUnits: string;
  readonly projectedInvestmentMinorUnits: string;
  readonly projectedSunReyMinorUnits: string;
  readonly projectedMoonReyMinorUnits: string;
  readonly projectedAccessCoverageUnits: number;
  readonly notes: readonly string[];
  readonly guaranteedOutcome: false;
  readonly simulationOnly: true;
  readonly disclaimer: typeof SIMULATION_DISCLAIMER;
};

function minor(value: string | undefined, fallback = '0'): bigint {
  const raw = value ?? fallback;
  return /^\d+$/.test(raw) ? BigInt(raw) : 0n;
}

function cashMinor(snapshot: PersonalEconomySnapshot, currency: string): bigint {
  return snapshot.cash
    .filter((row) => row.currency === currency)
    .reduce((acc, row) => acc + minor(row.minorUnits), 0n);
}

function investmentMinor(snapshot: PersonalEconomySnapshot, currency: string): bigint {
  return snapshot.investments
    .filter((row) => row.estimatedValue.currency === currency)
    .reduce((acc, row) => acc + minor(row.estimatedValue.minorUnits), 0n);
}

function applyShock(value: bigint, shockBps: number | undefined): bigint {
  if (!shockBps) {
    return value;
  }
  const factor = 10000n - BigInt(Math.max(-9900, Math.min(9900, shockBps)));
  return (value * factor) / 10000n;
}

export function simulatePersonalEconomyScenario(input: {
  readonly snapshot: PersonalEconomySnapshot;
  readonly constraints: PersonalEconomyConstraints;
  readonly scenario: PersonalEconomyScenarioInput;
  readonly at: UtcInstant;
}): PersonalEconomyScenarioOutcome {
  const currency = input.scenario.currency ?? input.constraints.minimumEmergencyCash?.currency ?? 'USD';
  const baselineCash = cashMinor(input.snapshot, currency);
  const baselineInvest = investmentMinor(input.snapshot, currency);
  let projectedCash = baselineCash;
  let projectedInvest = baselineInvest;
  let projectedSr = minor(input.snapshot.sunReyHoldings?.quantityMinorUnits);
  let projectedMr = minor(input.snapshot.moonReyHoldings?.quantityMinorUnits);
  let accessCoverage = input.snapshot.accessEntitlements.reduce((acc, row) => acc + row.remainingUnits, 0);
  const notes: string[] = [SIMULATION_DISCLAIMER];

  switch (input.scenario.kind) {
    case 'FIAT_INVESTMENT': {
      const amount = minor(input.scenario.amountMinorUnits);
      projectedCash = baselineCash >= amount ? baselineCash - amount : 0n;
      projectedInvest = baselineInvest + amount;
      notes.push(`Simulated moving ${amount.toString()} ${currency} from cash to investments.`);
      break;
    }
    case 'SR_ACQUISITION': {
      const qty = minor(input.scenario.tokenQuantity, '100');
      const cost = qty * 100n;
      projectedCash = baselineCash >= cost ? baselineCash - cost : baselineCash;
      projectedSr += qty;
      accessCoverage += Number(qty / 10n);
      notes.push('SunRey acquisition tied to portfolio constraints and access utility, not price speculation.');
      break;
    }
    case 'MR_ACQUISITION': {
      const qty = minor(input.scenario.tokenQuantity, '100');
      const cost = qty * 80n;
      projectedCash = baselineCash >= cost ? baselineCash - cost : baselineCash;
      projectedMr += qty;
      notes.push('MoonRey acquisition reflects productive-network participation goals, not pump behavior.');
      break;
    }
    case 'HOLD_TOKENS': {
      const months = input.scenario.holdMonths ?? 6;
      projectedSr = applyShock(projectedSr, -(months * 50));
      projectedMr = applyShock(projectedMr, -(months * 40));
      notes.push(`Holding tokens for ${months} months may reduce liquidity flexibility; no return is promised.`);
      break;
    }
    case 'ACCESS_TRAVEL_DEMAND': {
      const trips = input.scenario.travelTrips ?? 2;
      accessCoverage = Math.max(0, accessCoverage - trips);
      const topUp = BigInt(trips) * 150000n;
      projectedCash = baselineCash >= topUp ? baselineCash - topUp : 0n;
      notes.push(`Two major trips may require premium access top-up of about ${topUp.toString()} minor units.`);
      break;
    }
    case 'PRODUCTIVE_GPU_CONTRIBUTION': {
      projectedMr += 5n;
      notes.push('Spare GPU capacity contribution is a productive opportunity simulation only.');
      break;
    }
    case 'TOKEN_PRICE_SHOCK': {
      const shock = input.scenario.tokenShockBps ?? -5000;
      projectedSr = applyShock(projectedSr, shock);
      projectedMr = applyShock(projectedMr, shock);
      notes.push(`Token price shock ${shock} bps applied to holdings; losses are possible.`);
      break;
    }
    case 'MARKET_SHOCK': {
      const shock = input.scenario.marketShockBps ?? -2000;
      projectedInvest = applyShock(projectedInvest, shock);
      notes.push(`Market shock ${shock} bps applied to investments; principal loss is possible.`);
      break;
    }
    default: {
      const _exhaustive: never = input.scenario.kind;
      throw new Error(`unsupported scenario ${_exhaustive}`);
    }
  }

  const labels: Record<PersonalEconomyScenarioKind, string> = {
    FIAT_INVESTMENT: 'What if I invest additional fiat?',
    SR_ACQUISITION: 'What if I buy SunRey Coin?',
    MR_ACQUISITION: 'What if I buy MoonRey Coin?',
    HOLD_TOKENS: 'What if I keep my tokens?',
    ACCESS_TRAVEL_DEMAND: 'What if I want major trips next year?',
    PRODUCTIVE_GPU_CONTRIBUTION: 'What if I contribute spare GPU capacity?',
    TOKEN_PRICE_SHOCK: 'What if token prices fall sharply?',
    MARKET_SHOCK: 'What if markets fall?',
  };

  return Object.freeze({
    scenarioId: deterministicScenarioId(input.snapshot.subjectId, input.scenario.kind, input.at),
    kind: input.scenario.kind,
    subjectId: input.snapshot.subjectId,
    generatedAt: input.at,
    label: labels[input.scenario.kind],
    baselineLiquidityMinorUnits: baselineCash.toString(),
    projectedLiquidityMinorUnits: projectedCash.toString(),
    projectedInvestmentMinorUnits: projectedInvest.toString(),
    projectedSunReyMinorUnits: projectedSr.toString(),
    projectedMoonReyMinorUnits: projectedMr.toString(),
    projectedAccessCoverageUnits: accessCoverage,
    notes: Object.freeze(notes),
    guaranteedOutcome: false,
    simulationOnly: true,
    disclaimer: SIMULATION_DISCLAIMER,
  });
}

export function parseScenarioKind(value: unknown): PersonalEconomyScenarioKind | null {
  return typeof value === 'string' && (PERSONAL_ECONOMY_SCENARIO_KINDS as readonly string[]).includes(value)
    ? (value as PersonalEconomyScenarioKind)
    : null;
}

export function scenarioFromNaturalLanguage(text: string): PersonalEconomyScenarioInput | null {
  const lower = text.toLowerCase();
  if (lower.includes('invest') && lower.includes('$')) {
    const match = lower.match(/\$([\d,]+)/);
    const dollars = match?.[1]?.replace(/,/g, '') ?? '5000';
    return { kind: 'FIAT_INVESTMENT', amountMinorUnits: (BigInt(dollars) * 100n).toString(), currency: 'USD' };
  }
  if (lower.includes('100 sr') || lower.includes('buy 100 sunrey')) {
    return { kind: 'SR_ACQUISITION', tokenQuantity: '100' };
  }
  if (lower.includes('100 mr') || lower.includes('buy 100 moonrey')) {
    return { kind: 'MR_ACQUISITION', tokenQuantity: '100' };
  }
  if (lower.includes('six months') || lower.includes('6 months')) {
    return { kind: 'HOLD_TOKENS', holdMonths: 6 };
  }
  if (lower.includes('two major trips') || lower.includes('two vacations') || lower.includes('2 trips')) {
    return { kind: 'ACCESS_TRAVEL_DEMAND', travelTrips: 2 };
  }
  if (lower.includes('gpu')) {
    return { kind: 'PRODUCTIVE_GPU_CONTRIBUTION' };
  }
  if (lower.includes('token') && lower.includes('50%')) {
    return { kind: 'TOKEN_PRICE_SHOCK', tokenShockBps: -5000 };
  }
  if (lower.includes('market') && lower.includes('20%')) {
    return { kind: 'MARKET_SHOCK', marketShockBps: -2000 };
  }
  return null;
}
