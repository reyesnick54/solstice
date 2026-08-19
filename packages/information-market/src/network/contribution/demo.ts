import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { HumanInformationNetworkEngine } from '../engine.ts';
import { createHinContributionAdapter } from './adapter.ts';
import { HIN_CONTRIBUTION_BOUNDARY, INFORMATION_RIGHT_CONTRIBUTION } from './contract.ts';
import { createInMemoryDataAssetProjection } from './projection.ts';
import { createInProcessHumanContributionRegistry } from './registry.ts';

const NOW = asUtcInstant('2026-08-19T07:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-19T07:00:00.000Z');

export type HumanInformationContributionDemoResult = {
  readonly subjectRegistered: true;
  readonly descriptorCreated: true;
  readonly requestSubmitted: true;
  readonly explicitConsent: true;
  readonly permissionIssued: true;
  readonly computationApproved: true;
  readonly usageOccurred: true;
  readonly usageReceiptIssued: true;
  readonly contributionClass: typeof INFORMATION_RIGHT_CONTRIBUTION;
  readonly contributionVerified: true;
  readonly canonicalRegistryEntry: true;
  readonly laterRevocationPreservedHistoricalRecord: true;
  readonly futureUseBlocked: true;
  readonly RAW_PERSONAL_DATA_ON_REGISTRY: false;
  readonly AUTOMATIC_SUNREY_MINT: false;
  readonly productionActivated: false;
  readonly hinBoundary: typeof HIN_CONTRIBUTION_BOUNDARY;
};

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function runHumanInformationContributionDemo(): HumanInformationContributionDemoResult {
  const engine = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
  const adapter = createHinContributionAdapter({
    engine,
    registry: createInProcessHumanContributionRegistry(),
    dataAssetProjection: createInMemoryDataAssetProjection(),
  });

  const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-user-ada' }));
  const descriptor = unwrap(
    engine.registerDescriptor({
      subjectId: subject.subjectId,
      category: 'FINANCIAL_ACTIVITY_METADATA',
      schema: 'activity-metadata-v1',
      sourceClass: 'PERSONAL_DATA_VAULT',
      freshness: 'P30D',
      sensitivityClass: 'SENSITIVE',
      permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION', 'AGGREGATED_ANALYTICS'],
    }),
  );
  unwrap(
    engine.registerRequester({
      requesterId: 'req_research_lab',
      organization: 'Synthetic Research Lab',
      requesterClass: 'RESEARCH_INSTITUTION',
      jurisdiction: 'GB',
      applicationId: 'app_synthetic',
    }),
  );
  const computation = unwrap(
    engine.registerApprovedComputation({
      codeVersion: 'cohort-mean-v1',
      queryDefinition: 'AGGREGATE_MEAN_ACTIVITY_BAND',
      artifactDigest: 'sha256:synthetic-artifact',
      allowedOutputClasses: ['AGGREGATE_STATISTIC', 'PRIVACY_SAFE_SCORE'],
    }),
  );
  const request = unwrap(
    engine.submitInformationRequest({
      requesterId: 'req_research_lab',
      requestedRight: 'ONE_TIME_COMPUTATION',
      purpose: 'AGGREGATED_RESEARCH',
      computationId: computation.computationId,
      duration: 'P30D',
      compensationAsset: 'APPROVED_FIAT',
      compensationMinor: 2500n,
      jurisdiction: 'GB',
    }),
  );
  unwrap(
    engine.previewInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
    }),
  );
  const approved = unwrap(
    engine.approveInformationConsent({
      requestId: request.requestId,
      subjectId: subject.subjectId,
      descriptorId: descriptor.descriptorId,
      processingClass: 'CLEAN_ROOM_COMPUTATION',
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
    }),
  );
  unwrap(engine.evaluateInformationEligibility({ requestId: request.requestId, rightId: approved.right.rightId }));
  const job = unwrap(
    engine.submitCleanRoomComputation({
      requesterId: 'req_research_lab',
      purpose: 'AGGREGATED_RESEARCH',
      rightId: approved.right.rightId,
      approvedComputationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      expiresAt: EXPIRES,
      jurisdiction: 'GB',
      presentedConsentHash: approved.grant.consentHash,
      cohortSize: 12,
      outputRowCount: 1,
    }),
  );
  unwrap(
    engine.getCleanRoomResult({
      computationRequestId: job.computationRequestId,
      privacySafeValue: 'activity_band=moderate',
      cohortSize: 12,
    }),
  );
  const compensation = unwrap(
    engine.authorizeCompensation({
      subjectId: subject.subjectId,
      requesterId: 'req_research_lab',
      asset: 'APPROVED_FIAT',
      amountMinor: 2500n,
    }),
  );
  const receipt = unwrap(
    engine.recordUsage({
      rightId: approved.right.rightId,
      requesterId: 'req_research_lab',
      computationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: compensation.settlementRef,
    }),
  );
  const ownership = adapter.attemptOwnershipContribution({ descriptorId: descriptor.descriptorId });
  if (ownership.ok) {
    throw new Error('ownership must not become a contribution');
  }
  const consentOnly = adapter.attemptConsentContribution({ grantId: approved.grant.grantId });
  if (consentOnly.ok) {
    throw new Error('consent alone must not become a contribution');
  }
  const recorded = unwrap(adapter.submitRealizedUse({ receiptId: receipt.receiptId }));
  const mint = unwrap(adapter.inspectCompensation(compensation.settlementRef));
  if (mint.automaticSunReyMint !== false || compensation.mintRequested !== false) {
    throw new Error('HIN compensation must not mint SunRey');
  }
  const revocation = unwrap(engine.revokeInformationConsent({ grantId: approved.grant.grantId }));
  const blocked = engine.submitCleanRoomComputation({
    requesterId: 'req_research_lab',
    purpose: 'AGGREGATED_RESEARCH',
    rightId: approved.right.rightId,
    approvedComputationId: computation.computationId,
    outputClass: 'AGGREGATE_STATISTIC',
    expiresAt: EXPIRES,
    jurisdiction: 'GB',
    cohortSize: 12,
  });
  if (blocked.ok) {
    throw new Error('revoked right must not authorize future use');
  }
  const historical = adapter.registry.getById(recorded.contributionId);
  if (!historical || historical.historicalRecordImmutable !== true) {
    throw new Error('later revocation must preserve the historical contribution record');
  }
  if (revocation.historicalSettlementErased !== false) {
    throw new Error('historical settlement must be retained');
  }
  if (historical.rawPersonalDataOnRegistry !== false || recorded.evidence.rawPersonalData !== false) {
    throw new Error('raw personal data must not appear on the registry');
  }
  return Object.freeze({
    subjectRegistered: true,
    descriptorCreated: true,
    requestSubmitted: true,
    explicitConsent: true,
    permissionIssued: true,
    computationApproved: true,
    usageOccurred: true,
    usageReceiptIssued: true,
    contributionClass: INFORMATION_RIGHT_CONTRIBUTION,
    contributionVerified: true,
    canonicalRegistryEntry: true,
    laterRevocationPreservedHistoricalRecord: true,
    futureUseBlocked: true,
    RAW_PERSONAL_DATA_ON_REGISTRY: false,
    AUTOMATIC_SUNREY_MINT: false,
    productionActivated: false,
    hinBoundary: HIN_CONTRIBUTION_BOUNDARY,
  });
}

const isMain = process.argv[1]?.includes('contribution/demo.ts') === true;
if (isMain) {
  const result = runHumanInformationContributionDemo();
  process.stdout.write(
    [
      'SunRey Human Information → Human Contribution Registry demo',
      'subject registered → descriptor → request → explicit consent → permission/right',
      '→ approved computation → usage → usage receipt → contribution evidence',
      '→ contribution verification → canonical registry entry',
      `contributionClass=${result.contributionClass}`,
      `contributionVerified=${result.contributionVerified}`,
      `canonicalRegistryEntry=${result.canonicalRegistryEntry}`,
      `laterRevocationPreservedHistoricalRecord=${result.laterRevocationPreservedHistoricalRecord}`,
      `futureUseBlocked=${result.futureUseBlocked}`,
      `RAW_PERSONAL_DATA_ON_REGISTRY=${result.RAW_PERSONAL_DATA_ON_REGISTRY}`,
      `AUTOMATIC_SUNREY_MINT=${result.AUTOMATIC_SUNREY_MINT}`,
      `productionActivated=${result.productionActivated}`,
      `boundary.hin=${result.hinBoundary.hinOwns}`,
      `boundary.registry=${result.hinBoundary.registryOwns}`,
      `boundary.peve=${result.hinBoundary.peveOwns}`,
      `boundary.chunk71=${result.hinBoundary.chunk71Owns}`,
      '',
    ].join('\n'),
  );
}
