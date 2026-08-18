import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { HumanInformationNetworkEngine } from './engine.ts';
import { formatInformationCli, runInformationCommand } from './cli.ts';

const NOW = asUtcInstant('2026-08-18T14:00:00.000Z');
const EXPIRES = asUtcInstant('2026-09-18T14:00:00.000Z');

export type HumanInformationNetworkDemoResult = {
  readonly syntheticData: true;
  readonly rawPersonalDataExported: false;
  readonly productionActivated: false;
  readonly humanWorthScore: false;
  readonly socialCredit: false;
  readonly consented: true;
  readonly cleanRoomAuthorized: true;
  readonly privacySafeResult: true;
  readonly compensated: true;
  readonly usageReceiptIssued: true;
  readonly onChainAnchored: true;
  readonly revoked: true;
  readonly historicalSettlementRetained: true;
  readonly cliStatus: string;
};

export function runHumanInformationNetworkDemo(): HumanInformationNetworkDemoResult {
  const engine = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
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
  unwrap(
    engine.registerOffer({
      subjectId: subject.subjectId,
      rightType: 'ONE_TIME_COMPUTATION',
      purposeClasses: ['AGGREGATED_RESEARCH'],
      requesterClasses: ['RESEARCH_INSTITUTION'],
      compensationRequired: true,
      validUntil: EXPIRES,
      privacyRequirements: ['NO_RAW_EXPORT', 'MIN_COHORT'],
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
  const raw = engine.exportRawPdv();
  if (raw.ok) {
    throw new Error('raw PDV export must remain unavailable');
  }
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
  unwrap(
    engine.recordUsage({
      rightId: approved.right.rightId,
      requesterId: 'req_research_lab',
      computationId: computation.computationId,
      outputClass: 'AGGREGATE_STATISTIC',
      settlementRef: compensation.settlementRef,
    }),
  );
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
  const activation = engine.productionActivation();
  const report = engine.report();
  const cli = runInformationCommand(engine, ['status']);
  if (activation.productionActivated !== false || report.rawPersonalDataExported !== false) {
    throw new Error('production or raw-export invariants failed');
  }
  if (engine.store.anchors.length === 0) {
    throw new Error('expected an on-chain evidence anchor');
  }
  if (revocation.historicalSettlementErased !== false) {
    throw new Error('historical settlement must be retained after revocation');
  }
  return Object.freeze({
    syntheticData: true,
    rawPersonalDataExported: false,
    productionActivated: false,
    humanWorthScore: false,
    socialCredit: false,
    consented: true,
    cleanRoomAuthorized: true,
    privacySafeResult: true,
    compensated: true,
    usageReceiptIssued: true,
    onChainAnchored: true,
    revoked: true,
    historicalSettlementRetained: true,
    cliStatus: formatInformationCli(cli),
  });
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

const isMain = process.argv[1]?.includes('network/demo.ts') === true;
if (isMain) {
  const result = runHumanInformationNetworkDemo();
  process.stdout.write(
    [
      'SunRey Human Information Network demo',
      `syntheticData=${result.syntheticData}`,
      `rawPersonalDataExported=${result.rawPersonalDataExported}`,
      `productionActivated=${result.productionActivated}`,
      `humanWorthScore=${result.humanWorthScore}`,
      `socialCredit=${result.socialCredit}`,
      `consented=${result.consented}`,
      `cleanRoomAuthorized=${result.cleanRoomAuthorized}`,
      `privacySafeResult=${result.privacySafeResult}`,
      `compensated=${result.compensated}`,
      `usageReceiptIssued=${result.usageReceiptIssued}`,
      `onChainAnchored=${result.onChainAnchored}`,
      `revoked=${result.revoked}`,
      `historicalSettlementRetained=${result.historicalSettlementRetained}`,
      '',
    ].join('\n'),
  );
}
