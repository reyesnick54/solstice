import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  runAccess18HumanInformationToAccessDemo,
} from '../packages/information-market/src/network/access-integration/index.ts';
import { ACCESS_PARTICIPATION_INVARIANT_IDS } from '../packages/access-economy/src/participation/invariants.ts';
import { computeSrTwab } from '../packages/access-economy/src/participation/twab.ts';
import { AccessParticipationSnapshotService } from '../packages/access-economy/src/participation/snapshot.ts';
import {
  createHumanInformationAccessBridge,
  dataOpportunityIdFor,
} from '../packages/access-economy/src/hin-access/index.ts';
import { ok } from '../packages/domain/src/result.ts';
import { subjectRefFor } from '../packages/access-economy/src/ids.ts';
import type { AccessEpochId } from '../packages/access-economy/src/participation/types.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');
const EPOCH_START = asUtcInstant('2026-08-01T00:00:00.000Z');
const EPOCH_END = asUtcInstant('2026-08-31T23:59:59.000Z');

function createBridge(clock = new FrozenClock(NOW)) {
  return createHumanInformationAccessBridge({
    nowUtc: () => clock.now(),
    compensationSettlement: {
      transferExistingSunRey: () => ok({ settlementRef: 'xfer_test' }),
      creditFiat: () => ok({ settlementRef: 'fiat_test' }),
    },
  });
}

function fundAndOpen(bridge: ReturnType<typeof createBridge>, opportunityId = dataOpportunityIdFor('test')) {
  bridge.participation.registerEpoch({
    epochId: 'accepoch_test' as AccessEpochId,
    windowStart: EPOCH_START,
    windowEnd: EPOCH_END,
    closedAt: null,
  });
  bridge.participation.recordSettledBalanceObservation({
    subjectRef: subjectRefFor('cust_test'),
    observedAt: EPOCH_START,
    balanceMinor: 100n,
    sourceRef: 'opening',
    sourceKind: 'OPENING_BALANCE',
    replayKey: 'opening:cust_test',
  });
  const funded = bridge.fundOpportunity({
    opportunityId,
    requesterLabel: 'Test Requester',
    informationRequested: 'Preference survey',
    purpose: 'AGGREGATED_RESEARCH',
    permittedPurposeRef: 'purpose.test',
    compensationPath: 'EXISTING_SR_TRANSFER',
    compensationAmountMinor: 5n,
    compensationAsset: 'SUNREY_COIN',
    fundedAmountMinor: 250_000n,
    expiresAt: EPOCH_END,
    revocationRules: 'Revocation stops future use only.',
  });
  assert.equal(funded.ok, true);
  return opportunityId;
}

describe('ACCESS-18 deterministic automotive demo', () => {
  it('runs the vehicle preference research scenario', () => {
    const result = runAccess18HumanInformationToAccessDemo();
    assert.equal(result.requesterFundedSrMinor, 250_000n);
    assert.equal(result.participantCompensationSrMinor, 5n);
    assert.equal(result.compensationMinted, false);
    assert.equal(result.dataBonusApplied, false);
    assert.ok(result.nextEpochSrTwabMinor > 100n);
    assert.ok(result.nextEpochSrTwabMinor < 105n);
    assert.equal(result.NO_RAW_DATA_IN_ACCESS_FORMULA, true);
  });
});

describe('ACCESS-15 participation snapshot', () => {
  it('computes TWAB from settled SR balance history only', () => {
    const participation = new AccessParticipationSnapshotService();
    const subject = subjectRefFor('twab_subject');
    participation.registerEpoch({
      epochId: 'accepoch_twab' as AccessEpochId,
      windowStart: EPOCH_START,
      windowEnd: EPOCH_END,
      closedAt: null,
    });
    participation.recordSettledBalanceObservation({
      subjectRef: subject,
      observedAt: EPOCH_START,
      balanceMinor: 100n,
      sourceRef: 'open',
      sourceKind: 'OPENING_BALANCE',
      replayKey: 'open',
    });
    participation.recordSettledBalanceObservation({
      subjectRef: subject,
      observedAt: NOW,
      balanceMinor: 105n,
      sourceRef: 'xfer_1',
      sourceKind: 'SETTLED_TRANSFER',
      replayKey: 'xfer_1',
    });
    participation.closeEpoch('accepoch_twab' as AccessEpochId, asUtcInstant('2026-09-01T00:00:00.000Z'));
    const snapshot = participation.buildSnapshot({
      epochId: 'accepoch_twab' as AccessEpochId,
      subjectRef: subject,
      computedAt: NOW,
    });
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) return;
    assert.equal(snapshot.value.dataBonusApplied, false);
    assert.equal(snapshot.value.inputsRestrictedTo, 'SETTLED_SR_BALANCE_HISTORY_ONLY');
    assert.equal(snapshot.value.srTwabMinor > 100n, true);
    assert.equal(snapshot.value.srTwabMinor < 105n, true);
  });

  it('rejects forbidden participation inputs', () => {
    const participation = new AccessParticipationSnapshotService();
    const refused = participation.recordSettledBalanceObservation({
      subjectRef: subjectRefFor('bad'),
      observedAt: NOW,
      balanceMinor: 1n,
      sourceRef: 'x',
      sourceKind: 'SETTLED_TRANSFER',
      replayKey: 'bad',
      // @ts-expect-error simulation of forbidden field injection
      dataCategory: 'health',
    });
    assert.equal(refused.ok, false);
  });
});

describe('ACCESS-18 abuse tests', () => {
  it('refuses fake contribution settlement', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const refused = bridge.settleCompensation({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'fake_1',
      compensationPath: 'EXISTING_SR_TRANSFER',
      purposeRef: 'purpose.test',
      requestedPurposeRef: 'purpose.test',
      verified: false,
      fakeContribution: true,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.error.code, 'FAKE_CONTRIBUTION');
  });

  it('refuses duplicate contribution reward', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const base = {
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'hcontrib_dup',
      compensationPath: 'EXISTING_SR_TRANSFER' as const,
      purposeRef: 'purpose.test',
      requestedPurposeRef: 'purpose.test',
      verified: true,
    };
    assert.equal(bridge.settleCompensation(base).ok, true);
    const duplicate = bridge.settleCompensation(base);
    assert.equal(duplicate.ok, false);
    if (duplicate.ok) return;
    assert.equal(duplicate.error.code, 'DUPLICATE_SETTLEMENT');
  });

  it('refuses revoked consent before use', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const refused = bridge.optIn({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      consentRevokedBeforeUse: true,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.error.code, 'CONSENT_REVOKED_BEFORE_USE');
  });

  it('refuses purpose mismatch', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const refused = bridge.settleCompensation({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'hcontrib_purpose',
      compensationPath: 'EXISTING_SR_TRANSFER',
      purposeRef: 'purpose.wrong',
      requestedPurposeRef: 'purpose.test',
      verified: true,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.error.code, 'PURPOSE_MISMATCH');
  });

  it('refuses raw data export through access APIs', () => {
    const bridge = createBridge();
    const refused = bridge.refuseRawDataExport();
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.error.code, 'RAW_DATA_EXPORT_DENIED');
  });

  it('refuses AI compensation authorization', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const refused = bridge.settleCompensation({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'hcontrib_ai',
      compensationPath: 'EXISTING_SR_TRANSFER',
      purposeRef: 'purpose.test',
      requestedPurposeRef: 'purpose.test',
      verified: true,
      aiAuthorized: true,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.error.code, 'AI_CANNOT_AUTHORIZE_COMPENSATION');
  });

  it('records user decline without settlement', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const declined = bridge.decline({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
    });
    assert.equal(declined.ok, true);
    assert.equal(bridge.compensationHistory(subjectRefFor('cust_test')).length, 0);
  });

  it('refuses consent, data, and clean-room mint paths', () => {
    const bridge = createBridge();
    assert.equal(bridge.refuseMintFromConsent().ok, false);
    assert.equal(bridge.refuseMintFromDataRecord().ok, false);
    assert.equal(bridge.refuseMintFromCleanRoom().ok, false);
  });

  it('refuses direct data-to-access weighting', () => {
    const bridge = createBridge();
    const refused = bridge.attemptDirectDataToAccess({
      protectedTrait: 'health',
      dataMultiplier: 2,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.error.code, 'DIRECT_DATA_TO_ACCESS_FORBIDDEN');
  });

  it('refuses human-worth score and protected trait multiplier', () => {
    const bridge = createBridge();
    const opportunityId = fundAndOpen(bridge);
    const worth = bridge.settleCompensation({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'hcontrib_worth',
      compensationPath: 'EXISTING_SR_TRANSFER',
      purposeRef: 'purpose.test',
      requestedPurposeRef: 'purpose.test',
      verified: true,
      humanWorthScore: 0.9,
    });
    assert.equal(worth.ok, false);
    const trait = bridge.settleCompensation({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'hcontrib_trait',
      compensationPath: 'EXISTING_SR_TRANSFER',
      purposeRef: 'purpose.test',
      requestedPurposeRef: 'purpose.test',
      verified: true,
      protectedTraitMultiplier: 1.5,
    });
    assert.equal(trait.ok, false);
  });

  it('requires a compensation port for settlement', () => {
    const bridge = createHumanInformationAccessBridge({ nowUtc: () => NOW });
    const opportunityId = dataOpportunityIdFor('no-port');
    bridge.fundOpportunity({
      opportunityId,
      requesterLabel: 'x',
      informationRequested: 'y',
      purpose: 'AGGREGATED_RESEARCH',
      permittedPurposeRef: 'purpose.test',
      compensationPath: 'EXISTING_SR_TRANSFER',
      compensationAmountMinor: 1n,
      compensationAsset: 'SUNREY_COIN',
      fundedAmountMinor: 10n,
      expiresAt: EPOCH_END,
      revocationRules: 'r',
    });
    const refused = bridge.settleCompensation({
      opportunityId,
      subjectRef: subjectRefFor('cust_test'),
      subjectId: 'subj',
      customerId: 'cust',
      accountId: 'acct',
      contributionId: 'hcontrib_noport',
      compensationPath: 'EXISTING_SR_TRANSFER',
      purposeRef: 'purpose.test',
      requestedPurposeRef: 'purpose.test',
      verified: true,
    });
    assert.equal(refused.ok, false);
  });
});

describe('ACCESS-18 permanent invariants', () => {
  it('declares all participation invariants', () => {
    assert.deepEqual(ACCESS_PARTICIPATION_INVARIANT_IDS, [
      'NO_RAW_DATA_IN_ACCESS_FORMULA',
      'NO_CONSENT_EQUALS_MINT',
      'NO_DATA_RECORD_EQUALS_MINT',
      'NO_CLEAN_ROOM_RESULT_EQUALS_MINT',
      'NO_HUMAN_WORTH_SCORE',
      'NO_PROTECTED_TRAIT_ACCESS_MULTIPLIER',
      'ONLY_ACTUAL_SETTLED_SR_AFFECTS_SR_TWAB',
      'NO_DUPLICATE_HUMAN_CONTRIBUTION_REWARD',
    ]);
  });

  it('TWAB ignores data-category side channels', () => {
    const observations = [
      {
        observationId: 'srbal_a' as const,
        subjectRef: subjectRefFor('x'),
        observedAt: EPOCH_START,
        balanceMinor: 50n,
        sourceRef: 'a',
        sourceKind: 'OPENING_BALANCE' as const,
      },
    ];
    const twab = computeSrTwab(observations, EPOCH_START, EPOCH_END);
    assert.equal(twab.twabMinor, 50n);
  });
});
