import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureContribution, FIXTURE_SUBJECT } from './fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from './fingerprint.ts';
import { HumanContributionRegistry } from './registry.ts';
import { InMemoryHumanContributionRegistryStore } from './store.ts';
import type { ContributionClass } from './taxonomy.ts';
import type { HumanContributionRegistryRecord } from './types.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function line(record: HumanContributionRegistryRecord): string {
  return [
    record.contributionClass,
    `status=${record.status}`,
    `fingerprint=${record.fingerprint.slice(0, 12)}…`,
    `measurement=${record.event.measurement.quantity.toString()} ${record.measurementUnit}`,
    `jurisdiction=${record.jurisdiction}`,
    `verifiedMeasurement=${record.verifiedMeasurement ? record.verifiedMeasurement.quantity.toString() : 'null'}`,
    `sunReyQuantity=${String(record.sunReyQuantity)}`,
    `valuationAmount=${String(record.valuationAmount)}`,
  ].join(' | ');
}

export function runHumanContributionRegistryDemo(): {
  readonly verified: number;
  readonly supersededExample: string;
  readonly valuationTotals: null;
  readonly sunReyTotals: null;
} {
  const store = new InMemoryHumanContributionRegistryStore();
  const registry = new HumanContributionRegistry(store);

  const classes: readonly ContributionClass[] = [
    'INFORMATION_RIGHT_CONTRIBUTION',
    'CREATIVE_PRODUCTION',
    'RESEARCH_PARTICIPATION',
    'PROFESSIONAL_EXPERTISE',
    'COMMUNITY_CONTRIBUTION',
  ];

  console.log('SunRey Human Economic Contribution Registry (CHUNK-106)');
  console.log(`subjectRef=${FIXTURE_SUBJECT}`);
  console.log('');

  const submitted = classes.map((contributionClass, index) =>
    unwrap(
      registry.submit({
        ...fixtureContribution(contributionClass, `demo-reg-${contributionClass}`),
        measurementQuantity: BigInt(index + 1),
      }),
    ),
  );

  for (const record of submitted) {
    if (record.sourceClass !== 'USER_DECLARED' && record.sourceClass !== 'DERIVED' && record.sourceClass !== 'MODEL_INFERENCE') {
      unwrap(
        registry.verify({
          contributionId: record.contributionId,
          verificationTimestamp: asUtcInstant('2026-08-19T12:15:00.000Z'),
          verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
        }),
      );
    }
  }

  console.log('Verified and submitted records');
  for (const record of registry.query({})) {
    console.log(line(record));
  }

  const research = submitted.find((record) => record.contributionClass === 'RESEARCH_PARTICIPATION');
  if (!research) {
    throw new Error('research contribution missing');
  }
  const successor = unwrap(
    registry.supersede(research.contributionId, {
      ...fixtureContribution('RESEARCH_PARTICIPATION', 'demo-reg-research-correction'),
      createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
      measurementQuantity: 9n,
    }),
  );
  unwrap(
    registry.verify({
      contributionId: successor.contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T13:05:00.000Z'),
    }),
  );

  console.log('');
  console.log('Queries');
  console.log(`by subject: ${registry.query({ subjectRef: FIXTURE_SUBJECT }).length}`);
  console.log(`by class RESEARCH_PARTICIPATION: ${registry.query({ contributionClass: 'RESEARCH_PARTICIPATION' }).length}`);
  console.log(`verified only: ${registry.query({ verifiedOnly: true }).length}`);
  console.log(`jurisdiction GB: ${registry.query({ jurisdiction: 'GB' }).length}`);

  const audit = registry.audit();
  console.log('');
  console.log('Audit summary');
  console.log(
    `submitted=${audit.submitted} verified=${audit.verified} rejected=${audit.rejected} superseded=${audit.superseded} corrected=${audit.corrected}`,
  );
  console.log(`duplicateAttempts=${audit.duplicateAttempts} correctionCount=${audit.correctionCount}`);
  console.log(`classes=${audit.countsByContributionClass.map((row) => `${row.contributionClass}:${row.count}`).join(',')}`);
  console.log(`jurisdictions=${audit.countsByJurisdiction.map((row) => `${row.jurisdiction}:${row.count}`).join(',')}`);
  console.log(`policyVersions=${audit.verificationPolicyVersions.length}`);
  console.log(`valuationTotals=${String(audit.valuationTotals)} sunReyTotals=${String(audit.sunReyTotals)}`);

  console.log('');
  console.log('Supersession example');
  const prior = registry.getRecord(research.contributionId);
  console.log(`prior ${research.contributionId} status=${prior?.status} supersededBy=${prior?.supersededBy}`);
  console.log(`successor ${successor.contributionId} supersedes=${successor.supersedes} status=${registry.get(successor.contributionId)?.status}`);

  registry.persist();
  registry.clearProjections();
  registry.rebuildProjections();
  const rebuilt = new HumanContributionRegistry(store);
  rebuilt.loadFromStore();
  console.log(`rebuild verified=${rebuilt.query({ verifiedOnly: true }).length}`);

  return {
    verified: audit.verified,
    supersededExample: successor.contributionId,
    valuationTotals: null,
    sunReyTotals: null,
  };
}

runHumanContributionRegistryDemo();
