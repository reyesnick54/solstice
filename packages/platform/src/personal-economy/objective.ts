import type { PersonalEconomyObjectiveVersion } from './ids.ts';
import type { PersonalEconomyConstraints } from './constraints.ts';
import type { PersonalEconomySnapshot } from './snapshot.ts';
import type { PersonalEconomyRiskProfile } from './taxonomy.ts';

/**
 * Versioned planning objective for ACCESS-20.
 * Maximizes financial utility + access sufficiency + liquidity resilience
 * minus risk, concentration, shortage, lockup, and policy violations.
 * Does not encode human worth or optimize solely for token holdings.
 */
export type PersonalEconomyObjective = {
  readonly version: PersonalEconomyObjectiveVersion;
  readonly versionNumber: number;
  readonly subjectId: string;
  readonly utilityScore: number;
  readonly accessSufficiencyScore: number;
  readonly liquidityResilienceScore: number;
  readonly investmentRiskPenalty: number;
  readonly tokenConcentrationPenalty: number;
  readonly liquidityShortfallPenalty: number;
  readonly accessShortagePenalty: number;
  readonly lockupPenalty: number;
  readonly policyViolationPenalty: number;
  readonly netObjectiveScore: number;
  readonly constraintsRespected: boolean;
  readonly violatedConstraints: readonly string[];
  readonly rationale: readonly string[];
  readonly optimizesHumanWorth: false;
  readonly guaranteedOutcome: false;
};

export type ObjectiveEvaluationInput = {
  readonly snapshot: PersonalEconomySnapshot;
  readonly constraints: PersonalEconomyConstraints;
  readonly riskProfile: PersonalEconomyRiskProfile;
  readonly versionNumber: number;
  readonly version: PersonalEconomyObjectiveVersion;
};

function minor(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) {
    return 0n;
  }
  return BigInt(value);
}

function sumCash(rows: readonly { readonly minorUnits: string; readonly currency: string }[], currency: string): bigint {
  return rows.filter((row) => row.currency === currency).reduce((acc, row) => acc + minor(row.minorUnits), 0n);
}

function sumInvestments(snapshot: PersonalEconomySnapshot, currency: string): bigint {
  return snapshot.investments
    .filter((row) => row.estimatedValue.currency === currency)
    .reduce((acc, row) => acc + minor(row.estimatedValue.minorUnits), 0n);
}

export function evaluatePersonalEconomyObjective(input: ObjectiveEvaluationInput): PersonalEconomyObjective {
  const currency = input.constraints.minimumEmergencyCash?.currency ?? 'USD';
  const cash = sumCash(input.snapshot.cash, currency);
  const liquidity = sumCash(input.snapshot.liquidity, currency);
  const investments = sumInvestments(input.snapshot, currency);
  const emergencyTarget = minor(input.constraints.minimumEmergencyCash?.minorUnits);
  const liquidityNeed = minor(input.constraints.liquidityNeedsMinorUnits?.minorUnits);

  const violated: string[] = [];
  if (emergencyTarget > 0n && liquidity < emergencyTarget) {
    violated.push('MINIMUM_EMERGENCY_CASH');
  }
  const srExposure = minor(input.snapshot.sunReyHoldings?.quantityMinorUnits);
  const mrExposure = minor(input.snapshot.moonReyHoldings?.quantityMinorUnits);
  const maxSr = minor(input.constraints.maximumSunReyExposureMinorUnits);
  const maxMr = minor(input.constraints.maximumMoonReyExposureMinorUnits);
  if (maxSr > 0n && srExposure > maxSr) {
    violated.push('MAXIMUM_SR_EXPOSURE');
  }
  if (maxMr > 0n && mrExposure > maxMr) {
    violated.push('MAXIMUM_MR_EXPOSURE');
  }

  const travelDemand = input.snapshot.plannedAccessDemand
    .filter((row) => row.category === 'TRAVEL' || row.category === 'HOSPITALITY')
    .reduce((acc, row) => acc + row.plannedUnits, 0);
  const travelEntitlement = input.snapshot.accessEntitlements
    .filter((row) => row.category === 'TRAVEL' || row.category === 'HOSPITALITY')
    .reduce((acc, row) => acc + row.remainingUnits, 0);
  const desiredTravel = input.constraints.desiredTravelAccessUnits ?? 0;
  const effectiveTravelCoverage = travelEntitlement + Number(srExposure / 10n);
  if (desiredTravel > 0 && effectiveTravelCoverage < desiredTravel) {
    violated.push('DESIRED_TRAVEL_ACCESS');
  }

  const utilityBase = Number(cash + investments) / 100;
  const utilityScore = Math.min(100, Math.round(utilityBase / 1000));
  const accessSufficiencyScore = Math.max(
    0,
    Math.min(100, Math.round((travelEntitlement / Math.max(desiredTravel, 1)) * 100)),
  );
  const liquidityResilienceScore = emergencyTarget === 0n
    ? Math.min(100, Math.round(Number(liquidity) / 1000))
    : Math.max(0, Math.min(100, Math.round(Number((liquidity * 100n) / emergencyTarget))));

  const riskMultiplier =
    input.riskProfile === 'CONSERVATIVE'
      ? 1.5
      : input.riskProfile === 'MODERATE'
        ? 1.2
        : input.riskProfile === 'BALANCED'
          ? 1.0
          : 0.8;
  const investmentRiskPenalty = Math.round((Number(investments) / 100000) * 10 * riskMultiplier);
  const tokenConcentrationPenalty = Math.round(Number(srExposure + mrExposure) / 100);
  const liquidityShortfallPenalty =
    emergencyTarget > liquidity ? Math.round(Number((emergencyTarget - liquidity) / 100n)) : 0;
  const accessShortagePenalty =
    desiredTravel > travelDemand ? Math.round((desiredTravel - travelDemand) * 5) : 0;
  const lockupPenalty = liquidityNeed > liquidity ? Math.round(Number((liquidityNeed - liquidity) / 100n)) : 0;
  const policyViolationPenalty = violated.length * 25;

  const netObjectiveScore = Math.max(
    0,
    utilityScore +
      accessSufficiencyScore +
      liquidityResilienceScore -
      investmentRiskPenalty -
      tokenConcentrationPenalty -
      liquidityShortfallPenalty -
      accessShortagePenalty -
      lockupPenalty -
      policyViolationPenalty,
  );

  const rationale = [
    `Liquidity ${liquidity.toString()} ${currency} against emergency target ${emergencyTarget.toString()}.`,
    `Investments ${investments.toString()} ${currency}; risk profile ${input.riskProfile}.`,
    `Access sufficiency covers ${travelEntitlement} units vs desired ${desiredTravel}.`,
    'Objective balances financial utility, access coverage, and resilience without optimizing human worth.',
    'Markets can lose value; scores are planning aids only.',
  ];

  return Object.freeze({
    version: input.version,
    versionNumber: input.versionNumber,
    subjectId: input.snapshot.subjectId,
    utilityScore,
    accessSufficiencyScore,
    liquidityResilienceScore,
    investmentRiskPenalty,
    tokenConcentrationPenalty,
    liquidityShortfallPenalty,
    accessShortagePenalty,
    lockupPenalty,
    policyViolationPenalty,
    netObjectiveScore,
    constraintsRespected: violated.length === 0,
    violatedConstraints: Object.freeze([...violated]),
    rationale: Object.freeze([...rationale]),
    optimizesHumanWorth: false,
    guaranteedOutcome: false,
  });
}
