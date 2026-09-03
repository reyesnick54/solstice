/**
 * ACCESS-18 — Human Information to SunRey to Access bridge engine.
 *
 * Domain orchestration only. HIN settlement adapters are injected through ports.
 */

import { createHash } from 'node:crypto';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { SubjectRef } from '../ids.ts';
import {
  AccessParticipationSnapshotService,
  type AccessEpochId,
  type AccessParticipationSnapshot,
} from '../participation/index.ts';
import { assertParticipationInputBoundary } from '../participation/invariants.ts';
import type { HinCompensationSettlementPort, HinOpportunityAcceptancePort } from './contract.ts';
import type {
  CompensationHistoryEntry,
  CompensationPathKind,
  CompensationSettlementId,
  ConsentStatusView,
  DataOpportunityId,
  DataOpportunityView,
  HinAccessEpochBinding,
  HinAccessFailure,
  ParticipationEventId,
  ParticipationHistoryEntry,
} from './types.ts';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function dataOpportunityIdFor(seed: string): DataOpportunityId {
  return `dataopp_${sha256(seed).slice(0, 24)}` as DataOpportunityId;
}

export type HinAccessStore = {
  readonly opportunities: Map<DataOpportunityId, DataOpportunityView>;
  readonly participation: ParticipationHistoryEntry[];
  readonly compensation: CompensationHistoryEntry[];
  readonly settlementReplay: Set<string>;
  readonly contributionReplay: Set<string>;
  readonly fundedEscrowMinor: Map<DataOpportunityId, bigint>;
};

export function createHinAccessStore(): HinAccessStore {
  return {
    opportunities: new Map(),
    participation: [],
    compensation: [],
    settlementReplay: new Set(),
    contributionReplay: new Set(),
    fundedEscrowMinor: new Map(),
  };
}

export type HumanInformationAccessBridgeOptions = {
  readonly nowUtc: () => string;
  readonly participation?: AccessParticipationSnapshotService;
  readonly store?: HinAccessStore;
  readonly opportunityAcceptance?: HinOpportunityAcceptancePort;
  readonly compensationSettlement?: HinCompensationSettlementPort;
};

export class HumanInformationAccessBridge {
  private readonly nowUtc: () => string;
  readonly participation: AccessParticipationSnapshotService;
  readonly store: HinAccessStore;
  private readonly opportunityAcceptance: HinOpportunityAcceptancePort | null;
  private readonly compensationSettlement: HinCompensationSettlementPort | null;

  constructor(options: HumanInformationAccessBridgeOptions) {
    this.nowUtc = options.nowUtc;
    this.participation = options.participation ?? new AccessParticipationSnapshotService();
    this.store = options.store ?? createHinAccessStore();
    this.opportunityAcceptance = options.opportunityAcceptance ?? null;
    this.compensationSettlement = options.compensationSettlement ?? null;
  }

  fundOpportunity(input: {
    readonly opportunityId: DataOpportunityId;
    readonly requesterLabel: string;
    readonly informationRequested: string;
    readonly purpose: string;
    readonly permittedPurposeRef: string;
    readonly compensationPath: CompensationPathKind;
    readonly compensationAmountMinor: bigint;
    readonly compensationAsset: 'SUNREY_COIN' | 'FIAT_MONEY';
    readonly fundedAmountMinor: bigint;
    readonly expiresAt: string;
    readonly revocationRules: string;
  }): Result<DataOpportunityView, HinAccessFailure> {
    const boundary = assertParticipationInputBoundary(input);
    if (boundary) {
      return err({
        code: 'DIRECT_DATA_TO_ACCESS_FORBIDDEN',
        message: `opportunity contains forbidden access input: ${boundary}`,
      });
    }
    if (input.fundedAmountMinor < input.compensationAmountMinor) {
      return err({
        code: 'OPPORTUNITY_NOT_FUNDED',
        message: 'funding must cover at least one compensation unit',
      });
    }
    const opportunity = Object.freeze({
      opportunityId: input.opportunityId,
      requesterLabel: input.requesterLabel,
      informationRequested: input.informationRequested,
      purpose: input.purpose,
      permittedPurposeRef: input.permittedPurposeRef,
      compensationPath: input.compensationPath,
      compensationAmountMinor: input.compensationAmountMinor,
      compensationAsset: input.compensationAsset,
      fundedAmountMinor: input.fundedAmountMinor,
      expiresAt: asUtcInstant(input.expiresAt),
      revocationRules: input.revocationRules,
      status: 'FUNDED' as const,
      rawPdvExposed: false as const,
    });
    this.store.opportunities.set(opportunity.opportunityId, opportunity);
    this.store.fundedEscrowMinor.set(opportunity.opportunityId, input.fundedAmountMinor);
    const open = Object.freeze({ ...opportunity, status: 'OPEN' as const });
    this.store.opportunities.set(open.opportunityId, open);
    return ok(open);
  }

  listOpportunities(): readonly DataOpportunityView[] {
    return Object.freeze([...this.store.opportunities.values()]);
  }

  getOpportunity(opportunityId: DataOpportunityId): DataOpportunityView | undefined {
    return this.store.opportunities.get(opportunityId);
  }

  optIn(input: {
    readonly opportunityId: DataOpportunityId;
    readonly subjectRef: SubjectRef;
    readonly subjectId: string;
    readonly consentId?: string;
    readonly marketOpportunityId?: string;
    readonly consentRevokedBeforeUse?: boolean;
  }): Result<ParticipationHistoryEntry, HinAccessFailure> {
    const opportunity = this.store.opportunities.get(input.opportunityId);
    if (!opportunity) {
      return err({ code: 'OPPORTUNITY_UNKNOWN', message: 'opportunity is unknown' });
    }
    if (Date.parse(opportunity.expiresAt) <= Date.parse(this.nowUtc())) {
      return err({ code: 'OPPORTUNITY_EXPIRED', message: 'opportunity has expired' });
    }
    if (input.consentRevokedBeforeUse) {
      return err({ code: 'CONSENT_REVOKED_BEFORE_USE', message: 'revoked consent cannot authorize future use' });
    }
    if (input.marketOpportunityId && input.consentId && this.opportunityAcceptance) {
      const accepted = this.opportunityAcceptance.acceptOpportunity({
        subjectId: input.subjectId,
        marketOpportunityId: input.marketOpportunityId,
        consentId: input.consentId,
      });
      if (!accepted.ok) {
        return err({ code: 'CONSENT_REVOKED_BEFORE_USE', message: accepted.error.message });
      }
    }
    const entry = Object.freeze({
      eventId: `partevt_${sha256(`${input.opportunityId}:${input.subjectRef}:optin`).slice(0, 20)}` as ParticipationEventId,
      opportunityId: input.opportunityId,
      subjectRef: input.subjectRef,
      action: 'OPTED_IN' as const,
      occurredAt: this.nowUtc(),
      contributionId: null,
      dataUsedForAccessWeighting: false as const,
    });
    this.store.participation.push(entry);
    this.store.opportunities.set(
      input.opportunityId,
      Object.freeze({ ...opportunity, status: 'OPTED_IN' }),
    );
    return ok(entry);
  }

  decline(input: {
    readonly opportunityId: DataOpportunityId;
    readonly subjectRef: SubjectRef;
    readonly subjectId: string;
    readonly marketOpportunityId?: string;
  }): Result<ParticipationHistoryEntry, HinAccessFailure> {
    if (input.marketOpportunityId && this.opportunityAcceptance) {
      const declined = this.opportunityAcceptance.declineOpportunity({
        subjectId: input.subjectId,
        marketOpportunityId: input.marketOpportunityId,
      });
      if (!declined.ok) {
        return err({ code: 'USER_DECLINED', message: declined.error.message });
      }
    }
    const entry = Object.freeze({
      eventId: `partevt_${sha256(`${input.opportunityId}:${input.subjectRef}:decline`).slice(0, 20)}` as ParticipationEventId,
      opportunityId: input.opportunityId,
      subjectRef: input.subjectRef,
      action: 'DECLINED' as const,
      occurredAt: this.nowUtc(),
      contributionId: null,
      dataUsedForAccessWeighting: false as const,
    });
    this.store.participation.push(entry);
    return ok(entry);
  }

  settleCompensation(input: {
    readonly opportunityId: DataOpportunityId;
    readonly subjectRef: SubjectRef;
    readonly subjectId: string;
    readonly customerId: string;
    readonly accountId: string;
    readonly contributionId: string;
    readonly compensationPath: CompensationPathKind;
    readonly purposeRef: string;
    readonly requestedPurposeRef: string;
    readonly verified: boolean;
    readonly fakeContribution?: boolean;
    readonly aiAuthorized?: boolean;
    readonly humanWorthScore?: number;
    readonly protectedTraitMultiplier?: number;
    readonly dataCategoryBonus?: unknown;
  }): Result<CompensationHistoryEntry, HinAccessFailure> {
    if (input.fakeContribution) {
      return err({ code: 'FAKE_CONTRIBUTION', message: 'unverified contribution cannot settle' });
    }
    if (!input.verified) {
      return err({ code: 'CONTRIBUTION_NOT_VERIFIED', message: 'contribution must be verified before settlement' });
    }
    if (input.aiAuthorized) {
      return err({ code: 'AI_CANNOT_AUTHORIZE_COMPENSATION', message: 'AI cannot authorize compensation' });
    }
    if (input.humanWorthScore != null) {
      return err({ code: 'HUMAN_WORTH_SCORE_FORBIDDEN', message: 'human-worth scores cannot influence compensation' });
    }
    if (input.protectedTraitMultiplier != null) {
      return err({
        code: 'PROTECTED_TRAIT_MULTIPLIER_FORBIDDEN',
        message: 'protected trait multipliers are forbidden',
      });
    }
    if (input.dataCategoryBonus != null) {
      return err({
        code: 'DIRECT_DATA_TO_ACCESS_FORBIDDEN',
        message: 'data categories cannot create access bonuses',
      });
    }
    if (input.purposeRef !== input.requestedPurposeRef) {
      return err({ code: 'PURPOSE_MISMATCH', message: 'purpose must match the permitted opportunity purpose' });
    }
    const replay = `${input.opportunityId}:${input.contributionId}:settlement`;
    if (this.store.settlementReplay.has(replay)) {
      return err({ code: 'DUPLICATE_SETTLEMENT', message: 'duplicate settlement is denied' });
    }
    if (this.store.contributionReplay.has(input.contributionId)) {
      return err({ code: 'DUPLICATE_CONTRIBUTION', message: 'duplicate human contribution reward is denied' });
    }
    const opportunity = this.store.opportunities.get(input.opportunityId);
    if (!opportunity) {
      return err({ code: 'OPPORTUNITY_UNKNOWN', message: 'opportunity is unknown' });
    }
    if (input.compensationPath === 'GOVERNED_SUNREY_ISSUANCE') {
      return err({
        code: 'GOVERNED_ISSUANCE_NOT_AUTHORIZED',
        message: 'governed issuance requires explicit monetary constitution authorization; use existing SR transfer in simulation',
      });
    }
    if (!this.compensationSettlement) {
      return err({ code: 'COMPENSATION_REFUSED', message: 'compensation settlement port is not configured' });
    }

    const amountMinor = opportunity.compensationAmountMinor;
    let settlementRef = '';

    if (input.compensationPath === 'EXISTING_SR_TRANSFER' && opportunity.compensationAsset === 'SUNREY_COIN') {
      const transfer = this.compensationSettlement.transferExistingSunRey({
        subjectId: input.subjectId,
        customerId: input.customerId,
        amountMinor,
        contributionId: input.contributionId,
      });
      if (!transfer.ok) {
        return err(transfer.error);
      }
      settlementRef = transfer.value.settlementRef;
      const priorObservations = this.participation.listObservations(input.subjectRef);
      const prior =
        priorObservations.length === 0
          ? 0n
          : [...priorObservations].sort(
              (left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt),
            )[0]!.balanceMinor;
      this.participation.recordSettledBalanceObservation({
        subjectRef: input.subjectRef,
        observedAt: this.nowUtc(),
        balanceMinor: prior + amountMinor,
        sourceRef: settlementRef,
        sourceKind: 'SETTLED_TRANSFER',
        replayKey: replay,
      });
    } else if (input.compensationPath === 'FIAT_PAYMENT' && opportunity.compensationAsset === 'FIAT_MONEY') {
      const credit = this.compensationSettlement.creditFiat({
        subjectId: input.subjectId,
        customerId: input.customerId,
        accountId: input.accountId,
        amountMinor,
        contributionId: input.contributionId,
      });
      if (!credit.ok) {
        return err(credit.error);
      }
      settlementRef = credit.value.settlementRef;
    } else {
      return err({ code: 'COMPENSATION_REFUSED', message: 'compensation path and asset mismatch' });
    }

    const settlement = Object.freeze({
      settlementId: `compsett_${sha256(replay).slice(0, 20)}` as CompensationSettlementId,
      opportunityId: input.opportunityId,
      subjectRef: input.subjectRef,
      contributionId: input.contributionId,
      compensationPath: input.compensationPath,
      amountMinor,
      asset: opportunity.compensationAsset,
      settledAt: this.nowUtc(),
      minted: false as const,
      retroactiveClawback: false as const,
    });
    this.store.compensation.push(settlement);
    this.store.settlementReplay.add(replay);
    this.store.contributionReplay.add(input.contributionId);
    this.store.opportunities.set(
      input.opportunityId,
      Object.freeze({ ...opportunity, status: 'COMPLETED' }),
    );
    this.store.participation.push(
      Object.freeze({
        eventId: `partevt_${sha256(`${input.opportunityId}:${input.subjectRef}:complete`).slice(0, 20)}` as ParticipationEventId,
        opportunityId: input.opportunityId,
        subjectRef: input.subjectRef,
        action: 'COMPLETED' as const,
        occurredAt: this.nowUtc(),
        contributionId: input.contributionId,
        dataUsedForAccessWeighting: false as const,
      }),
    );
    return ok(settlement);
  }

  refuseMintFromConsent(): Result<never, HinAccessFailure> {
    return err({ code: 'CONSENT_CANNOT_MINT', message: 'consent alone cannot mint SunRey' });
  }

  refuseMintFromDataRecord(): Result<never, HinAccessFailure> {
    return err({ code: 'DATA_CANNOT_MINT', message: 'a data record alone cannot mint SunRey' });
  }

  refuseMintFromCleanRoom(): Result<never, HinAccessFailure> {
    return err({ code: 'CLEAN_ROOM_CANNOT_MINT', message: 'a clean-room result alone cannot mint SunRey' });
  }

  refuseRawDataExport(): Result<never, HinAccessFailure> {
    return err({ code: 'RAW_DATA_EXPORT_DENIED', message: 'raw PDV export is denied through access APIs' });
  }

  attemptDirectDataToAccess(input: Record<string, unknown>): Result<never, HinAccessFailure> {
    const boundary = assertParticipationInputBoundary(input);
    if (boundary) {
      return err({
        code: 'DIRECT_DATA_TO_ACCESS_FORBIDDEN',
        message: `direct data-to-access attempt blocked: ${boundary}`,
      });
    }
    return err({ code: 'DIRECT_DATA_TO_ACCESS_FORBIDDEN', message: 'personal data cannot directly increase access weight' });
  }

  bindEpochParticipation(input: {
    readonly epochId: AccessEpochId;
    readonly subjectRef: SubjectRef;
  }): Result<HinAccessEpochBinding, HinAccessFailure> {
    const snapshot = this.participation.buildSnapshot({
      epochId: input.epochId,
      subjectRef: input.subjectRef,
      computedAt: this.nowUtc(),
    });
    if (!snapshot.ok) {
      return err({ code: 'COMPENSATION_REFUSED', message: snapshot.error.message });
    }
    return ok(
      Object.freeze({
        epochId: input.epochId,
        subjectRef: input.subjectRef,
        srTwabMinor: snapshot.value.srTwabMinor,
        dataBonusApplied: false as const,
      }),
    );
  }

  participationHistory(subjectRef: SubjectRef): readonly ParticipationHistoryEntry[] {
    return Object.freeze(this.store.participation.filter((row) => row.subjectRef === subjectRef));
  }

  compensationHistory(subjectRef: SubjectRef): readonly CompensationHistoryEntry[] {
    return Object.freeze(this.store.compensation.filter((row) => row.subjectRef === subjectRef));
  }

  consentStatus(subjectRef: SubjectRef): ConsentStatusView {
    const active = this.store.participation.filter(
      (row) => row.subjectRef === subjectRef && row.action === 'OPTED_IN',
    ).length;
    const revoked = this.store.participation.filter(
      (row) => row.subjectRef === subjectRef && row.action === 'REVOKED',
    ).length;
    return Object.freeze({
      subjectRef,
      activeConsents: active,
      revokedConsents: revoked,
      participationEligible: active > revoked,
      rawPdvExposed: false,
    });
  }

  getParticipationSnapshot(
    epochId: AccessEpochId,
    subjectRef: SubjectRef,
  ): Result<AccessParticipationSnapshot, HinAccessFailure> {
    const snapshot = this.participation.buildSnapshot({
      epochId,
      subjectRef,
      computedAt: this.nowUtc(),
    });
    if (!snapshot.ok) {
      return err({
        code: 'COMPUTATION_FAILED',
        message: snapshot.error.message,
      });
    }
    return ok(snapshot.value);
  }
}

export function createHumanInformationAccessBridge(
  options: HumanInformationAccessBridgeOptions,
): HumanInformationAccessBridge {
  return new HumanInformationAccessBridge(options);
}
