import { asUtcInstant } from '../../domain/src/time.ts';
import {
  createSimulationValuationPolicy,
  engineWith,
  factorRequest,
  referenceFor,
  VALUATION_NOW,
  verifyFixture,
} from './valuation/index.ts';

function printFlags(): void {
  console.log('VALUATION_ENGINE_ENGINEERING_IMPLEMENTED=true');
  console.log('SUNREY_QUANTITY_CALCULATED=false');
  console.log('PEVE_USED=false');
  console.log('HUMAN_WORTH_SCORE=false');
  console.log('PRODUCTION_ACTIVE=false');
}

export function runHumanContributionValuationDemo(): {
  readonly valued: string;
  readonly review: string;
  readonly valuationEngineEngineeringImplemented: true;
  readonly sunReyQuantityCalculated: false;
  readonly peveUsed: false;
  readonly humanWorthScore: false;
  readonly productionActive: false;
} {
  const professional = verifyFixture('PROFESSIONAL_EXPERTISE', 'demo-valuation-pro', 6n);
  const engine = engineWith([
    referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'demo-valuation-pro', 5_000n),
    referenceFor('MARKET_REFERENCE', 'demo-valuation-conflict-a', 2_200n),
    referenceFor('MARKET_REFERENCE', 'demo-valuation-conflict-b', 2_800n),
  ]);

  const valued = engine.evaluate({
    contribution: professional,
    policy: createSimulationValuationPolicy(),
    valuationTimestamp: VALUATION_NOW,
    requestedFactors: [factorRequest('demo-quality', 9_000n, 'QUALITY')],
  });

  console.log('verified professional contribution');
  console.log(`  contributionId=${professional.contributionId}`);
  console.log(`  class=${professional.contributionClass}`);
  console.log(`  measurement=${professional.verifiedMeasurement?.quantity.toString() ?? '0'} ${professional.measurementUnit}`);
  console.log('active policy');
  console.log(`  policyId=${valued.valuationPolicyId}`);
  console.log(`  policyVersion=${valued.valuationPolicyVersion}`);
  console.log(`  method=${valued.valuationMethod ?? 'none'}`);
  console.log('reference schedule');
  for (const reference of valued.explanation.referenceValuesUsed) {
    console.log(`  ${reference.referenceId} ${reference.sourceClass}=${reference.value.toString()}`);
  }
  console.log('factor calculation');
  console.log(`  baseReferenceValue=${valued.baseReferenceValue?.toString() ?? 'null'}`);
  for (const adjustment of valued.adjustments) {
    console.log(
      `  ${adjustment.factor.factorType} ${adjustment.factor.inputRef} ${adjustment.before.toString()} -> ${adjustment.after.toString()} (${adjustment.factor.policyRuleRef})`,
    );
  }
  console.log(`final reference settlement value=${valued.finalReferenceValue?.toString() ?? 'null'} ${valued.referenceDenomination}`);
  console.log('explanation receipt');
  console.log(`  why=${valued.explanation.methodSelectedReason}`);
  console.log(`  evidence=${valued.explanation.evidenceUsed.join(',')}`);
  console.log(`  rounding=${valued.explanation.roundingRule ?? 'none'}`);
  console.log(`  cap=${valued.explanation.capApplied ? `${valued.explanation.capApplied.kind}:${valued.explanation.capApplied.limit.toString()}` : 'none'}`);
  console.log(`  policyVersion=${valued.explanation.policyVersion}`);
  console.log(`  state=${valued.state}`);
  console.log(`  digest=${valued.valuationDigest}`);
  console.log(`  isSunReyQuantity=${String(valued.invariants.isSunReyQuantity)}`);
  console.log(`  createsMintAuthority=${String(valued.invariants.createsMintAuthority)}`);
  console.log(`  createsExecutionAuthority=${String(valued.invariants.createsExecutionAuthority)}`);

  const market = verifyFixture('ECONOMIC_PARTICIPATION', 'demo-valuation-conflict', 2n);
  const review = engine.evaluate({
    contribution: market,
    policy: createSimulationValuationPolicy(),
    valuationTimestamp: asUtcInstant('2026-08-19T12:30:00.000Z'),
  });
  console.log('conflict review');
  console.log(`  state=${review.state}`);
  console.log(`  reasonCodes=${review.reasonCodes.join(',')}`);
  console.log(`  finalReferenceValue=${review.finalReferenceValue === null ? 'null' : review.finalReferenceValue.toString()}`);
  console.log(`  why=${review.explanation.methodSelectedReason}`);

  printFlags();

  return {
    valued: valued.finalReferenceValue?.toString() ?? 'null',
    review: review.state,
    valuationEngineEngineeringImplemented: true,
    sunReyQuantityCalculated: false,
    peveUsed: false,
    humanWorthScore: false,
    productionActive: false,
  };
}

if (import.meta.filename === process.argv[1] || process.argv[1]?.endsWith('valuation-demo.ts')) {
  runHumanContributionValuationDemo();
}
