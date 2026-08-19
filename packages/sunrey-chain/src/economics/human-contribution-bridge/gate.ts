/**
 * Fail-closed monetary gate.
 *
 * VerifiedHumanEconomicContribution is never sufficient by itself.
 * Settlement/valuation authorization is required, then the existing
 * Chunk 71 MonetaryIssuanceAuthority remains the only mint path.
 */

import { nativeAssetConstitution } from '../constitution.ts';
import { authorizeIssuance, developmentMoonReyAuthority, developmentSunReyAuthority } from '../issuance.ts';
import { emptyBook, supplyReconciles, type AssetSupplyBook } from '../supply.ts';
import type { HumanEconomicEvidence, MonetaryIssuanceAuthority, NativeAssetConstitution } from '../types.ts';
import { isEngineValuationAuthorization, validateSettlementAuthorization } from './authorization.ts';
import { toHumanEconomicEvidence, toMonetaryEvidenceCandidate, validateVerifiedContribution } from './evidence.ts';
import { firewallRejection } from './firewall.ts';
import type {
  BridgeRejection,
  ContributionCorrectionPolicy,
  HumanContributionSettlementAuthorization,
  HumanContributionSettlementBook,
  HumanContributionSettlementRequest,
  SettledContributionRecord,
  StandaloneMonetaryAttempt,
  VerifiedHumanEconomicContribution,
} from './types.ts';

export type HumanContributionIssuanceSuccess = {
  readonly ok: true;
  readonly evidence: HumanEconomicEvidence;
  readonly authority: MonetaryIssuanceAuthority;
  readonly book: AssetSupplyBook;
  readonly replayKey: string;
};

export type HumanContributionIssuanceFailure = {
  readonly ok: false;
  readonly code: BridgeRejection | import('../issuance.ts').IssuanceRejection;
};

export type HumanContributionIssuanceResult = HumanContributionIssuanceSuccess | HumanContributionIssuanceFailure;

export function emptySettlementBook(): HumanContributionSettlementBook {
  return {
    settledReplayKeys: new Set(),
    settledFingerprints: new Map(),
    settledAuthorizationIds: new Set(),
    settledContributionIds: new Set(),
    settledValuationIds: new Set(),
    issuedByEpoch: new Map(),
  };
}

export function replayKeyOf(
  fingerprint: string,
  authorizationId: string,
  extras?: {
    readonly valuationId?: string;
    readonly conversionPolicyVersion?: string;
  },
): string {
  if (extras?.valuationId && extras.conversionPolicyVersion) {
    return `${fingerprint}:${extras.valuationId}:${authorizationId}:${extras.conversionPolicyVersion}`;
  }
  return `${fingerprint}:${authorizationId}`;
}

export function refuseStandaloneAttempt(attempt: StandaloneMonetaryAttempt): HumanContributionIssuanceFailure {
  switch (attempt.kind) {
    case 'HIN_CONSENT':
      return { ok: false, code: 'HIN_CONSENT_ALONE_CANNOT_ISSUE' };
    case 'HIN_USAGE_RECEIPT':
      return { ok: false, code: 'HIN_USAGE_RECEIPT_ALONE_CANNOT_ISSUE' };
    case 'CLEAN_ROOM_RESULT':
      return { ok: false, code: 'CLEAN_ROOM_RESULT_ALONE_CANNOT_ISSUE' };
    case 'PEVE_SCORE':
      return { ok: false, code: 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY' };
    case 'USER_DECLARATION':
      return { ok: false, code: 'USER_DECLARATION_ALONE_CANNOT_ISSUE' };
    case 'CONSENT':
      return { ok: false, code: 'CONSENT_ALONE_CANNOT_ISSUE' };
    case 'PDV_RECORD':
      return { ok: false, code: 'PDV_ALONE_CANNOT_ISSUE' };
    case 'AI_OUTPUT':
      return { ok: false, code: 'AI_CANNOT_AUTHORIZE_ISSUANCE' };
    case 'FINANCIAL_AGENT_PROPOSAL':
      return { ok: false, code: 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE' };
    case 'S3M_OUTPUT':
      return { ok: false, code: 'S3M_CANNOT_AUTHORIZE_ISSUANCE' };
    case 'GROK_OUTPUT':
      return { ok: false, code: 'GROK_CANNOT_AUTHORIZE_ISSUANCE' };
    case 'MODEL_OUTPUT':
      return { ok: false, code: 'MODEL_OUTPUT_CANNOT_AUTHORIZE_ISSUANCE' };
    case 'VALUATION_RESULT':
      return { ok: false, code: 'VALUATION_RESULT_CANNOT_MINT' };
    default: {
      const _exhaustive: never = attempt;
      return _exhaustive;
    }
  }
}

function refuseCorrection(
  contribution: VerifiedHumanEconomicContribution,
  authorization: HumanContributionSettlementAuthorization,
  prior: SettledContributionRecord | undefined,
  correction: ContributionCorrectionPolicy | undefined,
): BridgeRejection | null {
  const superseded =
    contribution.verificationState === 'SUPERSEDED' ||
    contribution.supersededContributionId !== undefined ||
    (prior !== undefined && prior.contributionId !== contribution.contributionId);
  if (!superseded && !prior) {
    return null;
  }
  if (prior && !correction) {
    if (contribution.verificationState === 'SUPERSEDED' || contribution.supersededContributionId) {
      return 'SUPERSESSION_REQUIRES_EXPLICIT_ADJUSTMENT';
    }
    return 'DUPLICATE_CONTRIBUTION_SETTLEMENT';
  }
  if (contribution.verificationState === 'SUPERSEDED' && !correction) {
    return 'SUPERSESSION_REQUIRES_EXPLICIT_ADJUSTMENT';
  }
  if (!correction) {
    return null;
  }
  if (correction.kind !== 'EXPLICIT_ADJUSTMENT' || !correction.clawbackForbidden) {
    return 'SUPERSESSION_REQUIRES_EXPLICIT_ADJUSTMENT';
  }
  if (correction.adjustmentQuantity <= 0n) {
    return 'CLAWBACK_UNAVAILABLE';
  }
  if (prior && correction.adjustmentQuantity === prior.quantity && correction.priorAuthorizationId === authorization.authorizationId) {
    return 'SILENT_REMINT_FORBIDDEN';
  }
  if (prior && authorization.authorizationId === prior.authorizationId) {
    return 'SILENT_REMINT_FORBIDDEN';
  }
  if (prior && correction.adjustmentQuantity === prior.quantity && correction.adjustmentAuthorizationId === prior.authorizationId) {
    return 'SILENT_REMINT_FORBIDDEN';
  }
  if (authorization.authorizedSunReyQuantity !== correction.adjustmentQuantity) {
    return 'QUANTITY_NOT_SEPARATELY_AUTHORIZED';
  }
  if (authorization.authorizationId !== correction.adjustmentAuthorizationId) {
    return 'AUTHORIZATION_CONTRIBUTION_MISMATCH';
  }
  return null;
}

export class HumanContributionMonetaryBridge {
  readonly constitution: NativeAssetConstitution;
  readonly settlements: HumanContributionSettlementBook;
  moonreyBook: AssetSupplyBook;

  constructor(options?: {
    readonly constitution?: NativeAssetConstitution;
    readonly settlements?: HumanContributionSettlementBook;
    readonly moonreyBook?: AssetSupplyBook;
  }) {
    this.constitution = options?.constitution ?? nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    this.settlements = options?.settlements ?? emptySettlementBook();
    this.moonreyBook =
      options?.moonreyBook ?? emptyBook('MOONREY_COIN', this.constitution.assets[1]!.policyVersion.versionId);
  }

  candidate(contribution: VerifiedHumanEconomicContribution) {
    return toMonetaryEvidenceCandidate(contribution);
  }

  attempt(request: HumanContributionSettlementRequest, book: AssetSupplyBook): HumanContributionIssuanceResult {
    const extraPoison = request.extra ? firewallRejection(request.extra) : null;
    if (extraPoison) {
      return { ok: false, code: extraPoison };
    }
    if (request.standalone) {
      return refuseStandaloneAttempt(request.standalone);
    }
    if (request.actorKind === 'AI' || request.authorizedBy === 'AI') {
      return { ok: false, code: 'AI_CANNOT_AUTHORIZE_ISSUANCE' };
    }
    if (request.actorKind === 'AGENT' || request.actorKind === 'FINANCIAL_AGENT' || request.authorizedBy === 'FINANCIAL_AGENT') {
      return { ok: false, code: 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE' };
    }
    if (request.actorKind === 'S3M' || request.authorizedBy === 'S3M') {
      return { ok: false, code: 'S3M_CANNOT_AUTHORIZE_ISSUANCE' };
    }
    if (request.actorKind === 'GROK' || request.authorizedBy === 'GROK') {
      return { ok: false, code: 'GROK_CANNOT_AUTHORIZE_ISSUANCE' };
    }
    if (request.actorKind === 'MODEL' || request.authorizedBy === 'MODEL' || request.authorizedBy === 'MODEL_OUTPUT') {
      return { ok: false, code: 'MODEL_OUTPUT_CANNOT_AUTHORIZE_ISSUANCE' };
    }
    if (request.valuation && !request.authorization && !request.contribution) {
      return { ok: false, code: 'VALUATION_RESULT_CANNOT_MINT' };
    }
    if (!request.contribution) {
      return { ok: false, code: 'INVALID_CONTRIBUTION' };
    }
    const contributionCheck = validateVerifiedContribution(request.contribution);
    if (contributionCheck) {
      return { ok: false, code: contributionCheck };
    }
    if (request.valuation && !request.authorization) {
      return { ok: false, code: 'SETTLEMENT_AUTHORIZATION_REQUIRED' };
    }
    if (!request.authorization) {
      return { ok: false, code: 'SETTLEMENT_AUTHORIZATION_REQUIRED' };
    }
    const authCheck = validateSettlementAuthorization(
      request.contribution,
      request.authorization,
      request.valuation,
      request.conversionPolicy,
    );
    if (authCheck) {
      return { ok: false, code: authCheck };
    }
    const prior = this.settlements.settledFingerprints.get(request.contribution.fingerprint);
    const correctionCheck = refuseCorrection(
      request.contribution,
      request.authorization,
      prior,
      request.correction,
    );
    if (correctionCheck) {
      return { ok: false, code: correctionCheck };
    }
    if (
      prior &&
      isEngineValuationAuthorization(request.authorization) &&
      request.authorization.valuationId !== prior.valuationId &&
      !request.correction
    ) {
      return { ok: false, code: 'REVALUATION_DOES_NOT_REMINT' };
    }
    const engineAuth = isEngineValuationAuthorization(request.authorization) ? request.authorization : undefined;
    const replayKey = replayKeyOf(request.contribution.fingerprint, request.authorization.authorizationId, {
      ...(engineAuth
        ? { valuationId: engineAuth.valuationId, conversionPolicyVersion: engineAuth.conversionPolicyVersion }
        : {}),
    });
    if (
      this.settlements.settledReplayKeys.has(replayKey) ||
      this.settlements.settledAuthorizationIds.has(request.authorization.authorizationId) ||
      (engineAuth !== undefined && this.settlements.settledValuationIds.has(engineAuth.valuationId) && !request.correction) ||
      (this.settlements.settledContributionIds.has(request.contribution.contributionId) && !request.correction)
    ) {
      return { ok: false, code: 'DUPLICATE_CONTRIBUTION_SETTLEMENT' };
    }
    if (engineAuth && request.conversionPolicy) {
      const epochKey = request.epochKey ?? `${engineAuth.conversionPolicyVersion}:default`;
      const issuedThisEpoch = this.settlements.issuedByEpoch.get(epochKey) ?? 0n;
      if (issuedThisEpoch + engineAuth.authorizedSunReyQuantity > request.conversionPolicy.perEpochCeiling) {
        return { ok: false, code: 'EPOCH_CAP_EXCEEDED' };
      }
    }
    const evidence = toHumanEconomicEvidence(request.contribution, request.authorization);
    if (!evidence.ok) {
      return evidence;
    }
    const issued = authorizeIssuance(
      this.constitution,
      book,
      developmentSunReyAuthority({
        recipient: request.recipient,
        quantity: request.authorization.authorizedSunReyQuantity,
        replayIdentifier: replayKey,
        issuanceClass: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
        actorKind:
          request.actorKind === 'PROTOCOL' || request.actorKind === 'GOVERNED_PROTOCOL_SIMULATION'
            ? 'PROTOCOL'
            : 'HUMAN',
        evidence: evidence.evidence,
      }),
    );
    if (!issued.ok) {
      return { ok: false, code: issued.code };
    }
    const record: SettledContributionRecord = {
      contributionId: request.contribution.contributionId,
      fingerprint: request.contribution.fingerprint,
      authorizationId: request.authorization.authorizationId,
      replayKey,
      quantity: request.authorization.authorizedSunReyQuantity,
      superseded: request.contribution.verificationState === 'SUPERSEDED',
      ...(engineAuth
        ? {
            valuationId: engineAuth.valuationId,
            conversionPolicyVersion: engineAuth.conversionPolicyVersion,
          }
        : {}),
    };
    this.settlements.settledReplayKeys.add(replayKey);
    this.settlements.settledFingerprints.set(request.contribution.fingerprint, record);
    this.settlements.settledAuthorizationIds.add(request.authorization.authorizationId);
    this.settlements.settledContributionIds.add(request.contribution.contributionId);
    if (engineAuth) {
      this.settlements.settledValuationIds.add(engineAuth.valuationId);
      const epochKey = request.epochKey ?? `${engineAuth.conversionPolicyVersion}:default`;
      const issuedThisEpoch = this.settlements.issuedByEpoch.get(epochKey) ?? 0n;
      this.settlements.issuedByEpoch.set(epochKey, issuedThisEpoch + engineAuth.authorizedSunReyQuantity);
    }
    return {
      ok: true,
      evidence: evidence.evidence,
      authority: issued.authority,
      book: issued.book,
      replayKey,
    };
  }

  issueMoonReyUnaffected(input: {
    readonly quantity: bigint;
    readonly replayIdentifier: string;
    readonly contributionId: string;
    readonly fingerprint: string;
    readonly authorizationId: string;
  }) {
    const issued = authorizeIssuance(
      this.constitution,
      this.moonreyBook,
      developmentMoonReyAuthority(input),
    );
    if (issued.ok) {
      this.moonreyBook = issued.book;
    }
    return issued;
  }

  supplyReconciles(book: AssetSupplyBook): boolean {
    return supplyReconciles(book);
  }
}
