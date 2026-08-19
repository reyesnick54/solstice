/**
 * Productive Value → MoonRey settlement bridge.
 *
 * Fail-closed: no incomplete chain may authorize. Only this bridge
 * prepares V2 monetary evidence. Chunk 71 MonetaryIssuanceAuthority
 * remains the only mint.
 */

import {
  authorizeIssuance,
  type IssuanceRejection,
} from '../../../economics/issuance.ts';
import type { AssetSupplyBook } from '../../../economics/supply.ts';
import type { MonetaryIssuanceAuthority, NativeAssetConstitution } from '../../../economics/types.ts';
import { governedValueMoonReyAuthority } from '../../../economics/issuance.ts';
import type { MoonReyIssuanceReceipt } from '../../issuance.ts';
import { createProductiveSettlementAuthorization, validateProductiveSettlementAuthorization } from './authorization.ts';
import { finalizeGovernedValueReceipt, toGovernedValueMonetaryEvidence } from './evidence.ts';
import { emptySettlementBook, recordSettlement, replayKeyOf } from './replay.ts';
import { attributionAdjustmentReview, revaluationReview } from './review.ts';
import type {
  ProductiveSettlementBook,
  SettlementContext,
  SettlementRejection,
  SettlementReviewRecord,
  StandaloneMonetaryAttempt,
} from './types.ts';

export type GovernedValueIssuanceSuccess = {
  readonly ok: true;
  readonly authorization: SettlementContext extends never ? never : import('./types.ts').MoonReyProductiveSettlementAuthorization;
  readonly evidence: ReturnType<typeof toGovernedValueMonetaryEvidence>;
  readonly authority: MonetaryIssuanceAuthority;
  readonly book: AssetSupplyBook;
  readonly receipt: MoonReyIssuanceReceipt;
  readonly replayKey: string;
};

export type GovernedValueIssuanceFailure = {
  readonly ok: false;
  readonly code: SettlementRejection | IssuanceRejection;
  readonly review?: SettlementReviewRecord;
};

export type GovernedValueIssuanceResult = GovernedValueIssuanceSuccess | GovernedValueIssuanceFailure;

export function refuseStandaloneAttempt(attempt: StandaloneMonetaryAttempt): GovernedValueIssuanceFailure {
  switch (attempt.kind) {
    case 'ORACLE_OBSERVATION':
      return { ok: false, code: 'ORACLE_OBSERVATION_ALONE_CANNOT_ISSUE' };
    case 'VERIFIED_ECONOMIC_FACT':
      return { ok: false, code: 'VERIFIED_FACT_ALONE_CANNOT_ISSUE' };
    case 'PRODUCTIVE_CLAIM':
      return { ok: false, code: 'PRODUCTIVE_CLAIM_ALONE_CANNOT_ISSUE' };
    case 'VERIFIED_PRODUCTIVE_CONTRIBUTION':
      return { ok: false, code: 'CONTRIBUTION_ALONE_CANNOT_ISSUE' };
    case 'PRODUCTIVE_ECONOMIC_EVENT':
      return { ok: false, code: 'EVENT_ALONE_CANNOT_ISSUE' };
    case 'ATTRIBUTION_DECISION':
      return { ok: false, code: 'ATTRIBUTION_ALONE_CANNOT_ISSUE' };
    case 'PRODUCTIVE_VALUE_RESULT':
      return { ok: false, code: 'PRODUCTIVE_VALUE_ALONE_CANNOT_ISSUE' };
    case 'GPUV_QUANTITY':
      return { ok: false, code: 'GPUV_ALONE_CANNOT_ISSUE' };
    default: {
      const _exhaustive: never = attempt;
      return _exhaustive;
    }
  }
}

export class MoonReyProductiveSettlementBridge {
  readonly book: ProductiveSettlementBook;

  constructor(book: ProductiveSettlementBook = emptySettlementBook()) {
    this.book = book;
  }

  attempt(
    context: SettlementContext,
    constitution: NativeAssetConstitution,
    monetaryBook: AssetSupplyBook,
    options?: {
      readonly recipient?: string;
      readonly blockHeight?: number;
      readonly blockId?: string;
      readonly attributionChanged?: boolean;
    },
  ): GovernedValueIssuanceResult {
    if (context.conversionPolicy.environment === 'PRODUCTION_CANDIDATE' || context.conversionPolicy.productionActivated) {
      return { ok: false, code: 'PRODUCTION_V2_UNAVAILABLE' };
    }
    const prior = this.book.settledFingerprints.get(context.contribution.fingerprint);
    if (prior) {
      if (options?.attributionChanged || context.attributionDecision.decisionId !== prior.attributionDecisionId) {
        return {
          ok: false,
          code: 'ATTRIBUTION_SETTLEMENT_ADJUSTMENT_REVIEW_REQUIRED',
          review: attributionAdjustmentReview(prior, context.contribution.contributionId),
        };
      }
      if (context.valueResult.productiveValueId !== prior.productiveValueId) {
        return {
          ok: false,
          code: 'REVALUATION_SETTLEMENT_REVIEW',
          review: revaluationReview(prior, context.contribution.contributionId),
        };
      }
      return { ok: false, code: 'REPLAY_REJECTED' };
    }
    if (
      this.book.settledValueIds.has(context.valueResult.productiveValueId) ||
      this.book.settledValueDigests.has(context.valueResult.productiveValueDigest) ||
      this.book.settledEventIds.has(context.event.eventId)
    ) {
      return { ok: false, code: 'REPLAY_REJECTED' };
    }
    const usage = {
      eventIssued: this.book.issuedByEvent.get(context.event.eventId) ?? 0n,
      objectIssued: this.book.issuedByObject.get(context.contribution.objectId) ?? 0n,
      controllerIssued: this.book.issuedByController.get(context.contribution.controller) ?? 0n,
      categoryEpochIssued:
        this.book.issuedByCategoryEpoch.get(`${context.contribution.category}:${context.valueResult.epoch}`) ?? 0n,
      globalEpochIssued: this.book.issuedByGlobalEpoch.get(String(context.valueResult.epoch)) ?? 0n,
    };
    const created = createProductiveSettlementAuthorization({ ...context, usage });
    if (!created.ok) {
      return created;
    }
    if (this.book.settledAuthorizationIds.has(created.authorization.authorizationId)) {
      return { ok: false, code: 'REPLAY_REJECTED' };
    }
    const validation = validateProductiveSettlementAuthorization(created.authorization, { ...context, usage });
    if (validation) {
      return { ok: false, code: validation };
    }
    const evidence = toGovernedValueMonetaryEvidence(created.authorization);
    const authority = governedValueMoonReyAuthority({
      recipient: options?.recipient ?? context.contribution.controller,
      quantity: created.authorization.authorizedMoonReyQuantity,
      quantityCeiling: created.authorization.quantityCeiling,
      replayIdentifier: replayKeyOf({
        contributionFingerprint: created.authorization.contributionFingerprint,
        eventId: created.authorization.eventId,
        productiveValueId: created.authorization.productiveValueId,
        productiveValueDigest: created.authorization.productiveValueDigest,
        authorizationId: created.authorization.authorizationId,
        conversionPolicyVersion: created.authorization.conversionPolicyVersion,
      }),
      evidence,
    });
    const issued = authorizeIssuance(constitution, monetaryBook, authority);
    if (!issued.ok) {
      return { ok: false, code: issued.code };
    }
    const receipt = finalizeGovernedValueReceipt({
      authorization: created.authorization,
      valueResult: context.valueResult,
      recipient: authority.recipient,
      category: context.contribution.category,
      inputQuantity: context.contribution.quantity,
      inputUnit: context.contribution.unit,
      monetaryPolicyVersion: authority.monetaryPolicyVersion,
      oracleFacts: context.contribution.oracleFactIds,
      blockHeight: options?.blockHeight ?? 10,
      blockId: options?.blockId ?? 'blk_governed_value_10',
    });
    recordSettlement(
      this.book,
      {
        contributionId: created.authorization.contributionId,
        contributionFingerprint: created.authorization.contributionFingerprint,
        eventId: created.authorization.eventId,
        productiveValueId: created.authorization.productiveValueId,
        productiveValueDigest: created.authorization.productiveValueDigest,
        authorizationId: created.authorization.authorizationId,
        conversionPolicyVersion: created.authorization.conversionPolicyVersion,
        attributionDecisionId: created.authorization.attributionDecisionId,
        quantity: created.authorization.authorizedMoonReyQuantity,
      },
      {
        objectId: context.contribution.objectId,
        controller: context.contribution.controller,
        categoryEpoch: `${context.contribution.category}:${context.valueResult.epoch}`,
        globalEpoch: String(context.valueResult.epoch),
      },
    );
    return {
      ok: true,
      authorization: created.authorization,
      evidence,
      authority: issued.authority,
      book: issued.book,
      receipt,
      replayKey: authority.replayIdentifier,
    };
  }
}
