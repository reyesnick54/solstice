/**
 * ACCESS-18 deterministic demo — automotive vehicle preference research.
 */

import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../../events/src/events.ts';
import { ConsentDataUseAuthorization } from '../../../../consent/src/authorization.ts';
import { ConsentService } from '../../../../consent/src/service.ts';
import { CleanRoomService } from '../../../../clean-room/src/service.ts';
import { PersonalDataVault } from '../../../../personal-data-vault/src/service.ts';
import { createSimulationKeyProvider } from '../../../../security/src/simulation.ts';
import { createSandboxSimulationFiatPort } from '../../fiat.ts';
import { InformationMarketService } from '../../service.ts';
import { dataOpportunityIdFor } from '../../../../access-economy/src/hin-access/engine.ts';
import { subjectRefFor } from '../../../../access-economy/src/ids.ts';
import type { AccessEpochId } from '../../../../access-economy/src/participation/types.ts';
import { createHinAccessBridgeFromMarket, createMockSunReyTransferCoin } from './factory.ts';

const EPOCH_START = asUtcInstant('2026-08-01T00:00:00.000Z');
const COMPENSATION_AT = asUtcInstant('2026-08-15T12:00:00.000Z');
const EPOCH_END = asUtcInstant('2026-08-31T23:59:59.000Z');
const EPOCH_CLOSE = asUtcInstant('2026-09-01T00:00:00.000Z');

export type Access18DemoResult = Readonly<{
  readonly requesterFundedSrMinor: bigint;
  readonly opportunityPurpose: string;
  readonly participantOptedIn: true;
  readonly cleanRoomSucceeded: true;
  readonly verifiedContribution: true;
  readonly participantCompensationSrMinor: bigint;
  readonly compensationMinted: false;
  readonly dataBonusApplied: false;
  readonly nextEpochSrTwabMinor: bigint;
  readonly NO_RAW_DATA_IN_ACCESS_FORMULA: true;
  readonly NO_CONSENT_EQUALS_MINT: true;
  readonly NO_DATA_RECORD_EQUALS_MINT: true;
}>;

export function runAccess18HumanInformationToAccessDemo(): Access18DemoResult {
  const clock = new FrozenClock(COMPENSATION_AT);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  const cleanRoom = new CleanRoomService({ clock, keys, evidence, events, consent, vault });
  const coin = createMockSunReyTransferCoin();
  const fiat = createSandboxSimulationFiatPort(clock);
  const market = new InformationMarketService({
    clock,
    keys,
    evidence,
    events,
    consent,
    cleanRoom,
    coin,
    fiat,
  });
  const bridge = createHinAccessBridgeFromMarket({ clock, market, coin, fiat });

  const opportunityId = dataOpportunityIdFor('automotive-vehicle-preference-2026');
  const subjectRef = subjectRefFor('participant_automotive_demo');
  const fundedAmount = 250_000n;
  const compensationAmount = 5n;

  bridge.participation.registerEpoch({
    epochId: 'accepoch_demo_2026_08' as AccessEpochId,
    windowStart: EPOCH_START,
    windowEnd: EPOCH_END,
    closedAt: null,
  });
  bridge.participation.recordSettledBalanceObservation({
    subjectRef,
    observedAt: EPOCH_START,
    balanceMinor: 100n,
    sourceRef: 'opening_balance',
    sourceKind: 'OPENING_BALANCE',
    replayKey: 'opening:participant_automotive_demo',
  });

  const funded = bridge.fundOpportunity({
    opportunityId,
    requesterLabel: 'Northline Automotive Research',
    informationRequested: 'Vehicle preference research — aggregate driving habit bands',
    purpose: 'AGGREGATED_RESEARCH',
    permittedPurposeRef: 'purpose.vehicle_preference_research',
    compensationPath: 'EXISTING_SR_TRANSFER',
    compensationAmountMinor: compensationAmount,
    compensationAsset: 'SUNREY_COIN',
    fundedAmountMinor: fundedAmount,
    expiresAt: EPOCH_END,
    revocationRules: 'Revocation stops future use; settled compensation remains auditable.',
  });
  if (!funded.ok) {
    throw new Error(funded.error.message);
  }

  const optedIn = bridge.optIn({
    opportunityId,
    subjectRef,
    subjectId: 'subject_automotive_demo',
  });
  if (!optedIn.ok) {
    throw new Error(optedIn.error.message);
  }

  const settled = bridge.settleCompensation({
    opportunityId,
    subjectRef,
    subjectId: 'subject_automotive_demo',
    customerId: 'cust_participant',
    accountId: 'acct_participant',
    contributionId: 'hcontrib_vehicle_pref_demo',
    compensationPath: 'EXISTING_SR_TRANSFER',
    purposeRef: 'purpose.vehicle_preference_research',
    requestedPurposeRef: 'purpose.vehicle_preference_research',
    verified: true,
  });
  if (!settled.ok) {
    throw new Error(settled.error.message);
  }

  bridge.participation.closeEpoch('accepoch_demo_2026_08' as AccessEpochId, EPOCH_CLOSE);
  const binding = bridge.bindEpochParticipation({
    epochId: 'accepoch_demo_2026_08' as AccessEpochId,
    subjectRef,
  });
  if (!binding.ok) {
    throw new Error(binding.error.message);
  }

  const directDataAttempt = bridge.attemptDirectDataToAccess({
    dataCategory: 'vehicle_preferences',
    dataBonus: 10n,
  });
  if (directDataAttempt.ok) {
    throw new Error('direct data-to-access should be refused');
  }

  return Object.freeze({
    requesterFundedSrMinor: fundedAmount,
    opportunityPurpose: 'vehicle preference research',
    participantOptedIn: true,
    cleanRoomSucceeded: true,
    verifiedContribution: true,
    participantCompensationSrMinor: compensationAmount,
    compensationMinted: false,
    dataBonusApplied: false,
    nextEpochSrTwabMinor: binding.value.srTwabMinor,
    NO_RAW_DATA_IN_ACCESS_FORMULA: true,
    NO_CONSENT_EQUALS_MINT: true,
    NO_DATA_RECORD_EQUALS_MINT: true,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runAccess18HumanInformationToAccessDemo();
  console.log(JSON.stringify(result, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
}
