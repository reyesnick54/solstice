import { HumanContributionRegistry } from './registry.ts';
import { fixtureContribution, FIXTURE_SUBJECT } from './fixtures.ts';
import {
  CONTRIBUTION_NOT_HUMAN_WORTH,
  MEASUREMENT_NOT_SUNREY,
  PEVE_NOT_CONTRIBUTION_VALUATION,
} from './taxonomy.ts';
import type { HumanContributionEvent } from './types.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function summarize(event: HumanContributionEvent): string {
  return [
    `${event.contributionClass}`,
    `id=${event.contributionId}`,
    `subject=${event.subjectRef}`,
    `source=${event.sourceClass}`,
    `quality=${event.verificationQuality}`,
    `status=${event.status}`,
    `eligibility=${event.eligibilityState}`,
    `measurement=${event.measurement.quantity.toString()} ${event.measurement.unit}`,
    `sunReyQuantity=${String(event.sunReyQuantity)}`,
    `issuanceEligible=${String(event.issuanceEligible)}`,
    `humanWorthScore=${String(event.humanWorthScore)}`,
    `peveScoreUsedAsValue=${String(event.peveScoreUsedAsValue)}`,
    `authorizesExecution=${String(event.authorityBoundary.authorizesFinancialExecution)}`,
    `consentRefs=${event.consentReferences.length}`,
    `rightsRefs=${event.rightsReferences.length}`,
    `usageReceipts=${event.usageReceiptReferences.length}`,
  ].join(' | ');
}

export function runHumanContributionOntologyDemo(): {
  readonly events: readonly HumanContributionEvent[];
  readonly peveIsNotContributionValuation: true;
  readonly measurementIsNotSunReyQuantity: true;
  readonly contributionIsNotHumanWorth: true;
  readonly valuationImplemented: false;
  readonly mintingImplemented: false;
} {
  const registry = new HumanContributionRegistry();

  const information = unwrap(
    registry.record({
      ...fixtureContribution('INFORMATION_RIGHT_CONTRIBUTION', 'demo-information'),
      measurementQuantity: 3n,
    }),
  );
  const creative = unwrap(
    registry.record({
      ...fixtureContribution('CREATIVE_PRODUCTION', 'demo-creative'),
      measurementQuantity: 2n,
      verificationQuality: 'ATTESTED',
    }),
  );
  const research = unwrap(
    registry.record({
      ...fixtureContribution('RESEARCH_PARTICIPATION', 'demo-research'),
      measurementQuantity: 4n,
      verificationQuality: 'ATTESTED',
    }),
  );
  const professional = unwrap(
    registry.record({
      ...fixtureContribution('PROFESSIONAL_EXPERTISE', 'demo-professional'),
      measurementQuantity: 6n,
      verificationQuality: 'ATTESTED',
      status: 'SUBMITTED',
    }),
  );
  const community = unwrap(
    registry.record({
      ...fixtureContribution('COMMUNITY_CONTRIBUTION', 'demo-community'),
      measurementQuantity: 5n,
      verificationQuality: 'ATTESTED',
    }),
  );

  const events = [information, creative, research, professional, community];

  console.log('SunRey Human Economic Contribution Ontology (CHUNK-104)');
  console.log(`subjectRef=${FIXTURE_SUBJECT}`);
  console.log('');
  for (const event of events) {
    console.log(summarize(event));
    const execution = registry.authorizeExecution(event);
    const mint = registry.authorizeMint(event);
    console.log(`  provenance=${event.sourceClass}/${event.verificationQuality}`);
    console.log(`  execution=${execution.reason} authorized=${String(execution.authorized)}`);
    console.log(`  mint=${mint.reason} sunReyQuantity=${String(mint.sunReyQuantity)}`);
  }
  console.log('');
  console.log(`PEVE != contribution valuation: ${PEVE_NOT_CONTRIBUTION_VALUATION}`);
  console.log(`contribution measurement != SunRey Coin quantity: ${MEASUREMENT_NOT_SUNREY}`);
  console.log(`human economic contribution != human worth: ${CONTRIBUTION_NOT_HUMAN_WORTH}`);

  return {
    events,
    peveIsNotContributionValuation: true,
    measurementIsNotSunReyQuantity: true,
    contributionIsNotHumanWorth: true,
    valuationImplemented: false,
    mintingImplemented: false,
  };
}

runHumanContributionOntologyDemo();
