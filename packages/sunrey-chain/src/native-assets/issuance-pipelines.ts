/**
 * Productized SunRey Coin and MoonRey Coin issuance pipelines.
 *
 * Both converge on authorizeIssuance / AssetSupplyBook. Raw user data,
 * unverified contributions, AI valuation, and a single oracle response
 * cannot mint. Valuation is not Exchange market price.
 */

import { createHash } from 'node:crypto';

import {
  developmentMoonReyAuthority,
  developmentSunReyAuthority,
  rejectFactOnlyMint,
  rejectOracleOnlyMint,
  rejectPdvAutomaticMint,
  rejectUnrestrictedMint,
  type IssuanceRejection,
} from '../economics/issuance.ts';
import { expectedTotal, type AssetSupplyBook } from '../economics/supply.ts';
import type { MonetaryIssuanceAuthority, NativeMonetaryAssetId } from '../economics/types.ts';
import {
  ProtocolNativeSupplyAuthority,
  evaluateHumanGovernanceGate,
  refuseForbiddenMutator,
  type SupplyActor,
} from './economic-controls.ts';
import { economicPolicyDocument } from './economic-policy.ts';

export const ISSUANCE_PROPOSAL_SCHEMA = 'sunrey.native-asset.issuance-proposal.v1' as const;

export const ISSUANCE_PROPOSAL_STATUSES = [
  'DRAFT',
  'AWAITING_GOVERNANCE',
  'REFUSED',
  'AUTHORIZED_SIMULATION',
  'APPLIED_SIMULATION',
] as const;
export type IssuanceProposalStatus = (typeof ISSUANCE_PROPOSAL_STATUSES)[number];

export const PRODUCTIVE_CATEGORY_CATALOG = [
  'ENERGY',
  'COMPUTE',
  'MANUFACTURING_OUTPUT',
  'RESOURCES',
  'AGRICULTURE',
  'LOGISTICS',
  'REAL_ESTATE_PRODUCTIVE_INFRASTRUCTURE',
  'OTHER_APPROVED_PRODUCTIVE_VALUE',
] as const;
export type ProductiveCategoryId = (typeof PRODUCTIVE_CATEGORY_CATALOG)[number];

export type OracleObservationQuality = {
  readonly observationId: string;
  readonly quality: 'VALID' | 'INVALID' | 'STALE' | 'DISPUTED';
  readonly confidenceBps: number;
  readonly provenance: string;
  readonly freshnessUtc: string;
  readonly stale: boolean;
  readonly disputed: boolean;
};

export type OracleSafetyDecision =
  | { readonly ok: true; readonly consensus: 'QUORUM' }
  | {
      readonly ok: false;
      readonly code:
        | 'ORACLE_STALE'
        | 'ORACLE_INVALID'
        | 'ORACLE_DISPUTED'
        | 'SINGLE_ORACLE_CANNOT_MINT'
        | 'ORACLE_OBSERVATION_CANNOT_MINT';
    };

export function evaluateOracleSafety(input: {
  readonly observations: readonly OracleObservationQuality[];
  readonly permitSingleOracleMint?: boolean;
}): OracleSafetyDecision {
  if (input.observations.length === 0) {
    return { ok: false, code: 'ORACLE_INVALID' };
  }
  if (input.observations.some((row) => row.quality === 'INVALID')) {
    return { ok: false, code: 'ORACLE_INVALID' };
  }
  if (input.observations.some((row) => row.stale || row.quality === 'STALE')) {
    return { ok: false, code: 'ORACLE_STALE' };
  }
  if (input.observations.some((row) => row.disputed || row.quality === 'DISPUTED')) {
    return { ok: false, code: 'ORACLE_DISPUTED' };
  }
  if (input.observations.length === 1 && input.permitSingleOracleMint !== true) {
    return { ok: false, code: 'SINGLE_ORACLE_CANNOT_MINT' };
  }
  return { ok: false, code: 'ORACLE_OBSERVATION_CANNOT_MINT' };
}

export type ProtocolValuationInput = {
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly referenceValue: string;
  readonly denomination: string;
  readonly isExchangeMarketPrice: false;
};

export type ExchangeMarketPrice = {
  readonly available: boolean;
  readonly lastTradeMinorUnits: string | null;
  readonly quoteAsset: string | null;
  readonly label: 'LAST_TRADE_NOT_GUARANTEED' | 'NO_EXCHANGE_PRICE';
  readonly valuationDoesNotSetPrice: true;
};

export function separateValuationFromMarketPrice(input: {
  readonly valuation: ProtocolValuationInput;
  readonly exchangePrice?: { readonly lastTradeMinorUnits: string; readonly quoteAsset: string };
}): {
  readonly protocolValuation: ProtocolValuationInput;
  readonly marketPrice: ExchangeMarketPrice;
  readonly hardCodedFromValuation: false;
} {
  return Object.freeze({
    protocolValuation: Object.freeze({ ...input.valuation, isExchangeMarketPrice: false as const }),
    marketPrice: Object.freeze({
      available: input.exchangePrice !== undefined,
      lastTradeMinorUnits: input.exchangePrice?.lastTradeMinorUnits ?? null,
      quoteAsset: input.exchangePrice?.quoteAsset ?? null,
      label: input.exchangePrice ? ('LAST_TRADE_NOT_GUARANTEED' as const) : ('NO_EXCHANGE_PRICE' as const),
      valuationDoesNotSetPrice: true as const,
    }),
    hardCodedFromValuation: false,
  });
}

export type NativeIssuanceProposal = {
  readonly schema: typeof ISSUANCE_PROPOSAL_SCHEMA;
  readonly proposalId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly amount: string;
  readonly basis: string;
  readonly inputReferences: readonly string[];
  readonly valuationMethodology: string;
  readonly policyVersion: string;
  readonly supplyBefore: string;
  readonly supplyAfter: string;
  readonly requiredApprovals: readonly string[];
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly status: IssuanceProposalStatus;
  readonly aiSelfApproved: false;
  readonly actorCannotApprove: 'AI' | 'AGENT';
};

export function createIssuanceProposal(input: {
  readonly proposalId: string;
  readonly asset: NativeMonetaryAssetId;
  readonly amount: bigint;
  readonly basis: string;
  readonly inputReferences: readonly string[];
  readonly valuationMethodology: string;
  readonly policyVersion: string;
  readonly book: AssetSupplyBook;
  readonly network: NativeIssuanceProposal['network'];
  readonly aiAttemptedApproval?: boolean;
}): NativeIssuanceProposal {
  if (input.aiAttemptedApproval) {
    throw new TypeError('AI cannot self-approve an issuance proposal');
  }
  const supplyBefore = expectedTotal(input.book);
  return Object.freeze({
    schema: ISSUANCE_PROPOSAL_SCHEMA,
    proposalId: input.proposalId,
    asset: input.asset,
    amount: input.amount.toString(),
    basis: input.basis,
    inputReferences: Object.freeze([...input.inputReferences]),
    valuationMethodology: input.valuationMethodology,
    policyVersion: input.policyVersion,
    supplyBefore: supplyBefore.toString(),
    supplyAfter: (supplyBefore + input.amount).toString(),
    requiredApprovals: Object.freeze(['HUMAN_GOVERNANCE', 'MONETARY_ISSUANCE_AUTHORITY']),
    network: input.network,
    status: input.network === 'MAINNET' ? 'AWAITING_GOVERNANCE' : 'DRAFT',
    aiSelfApproved: false,
    actorCannotApprove: 'AI',
  });
}

export type PipelineRefusal =
  | IssuanceRejection
  | import('./economic-controls.ts').SupplyInvariantFailure
  | 'UNVERIFIED_CONTRIBUTION'
  | 'RAW_USER_DATA'
  | 'AI_VALUATION_CANNOT_MINT'
  | 'MAINNET_ECONOMICS_NOT_AUTHORIZED'
  | 'MISSING_GOVERNANCE'
  | 'UNAUTHORIZED_ACTOR'
  | 'ORACLE_STALE'
  | 'ORACLE_INVALID'
  | 'ORACLE_DISPUTED'
  | 'SINGLE_ORACLE_CANNOT_MINT'
  | 'PRODUCTIVE_SOURCE_NOT_CONNECTED';

export type PipelineResult =
  | {
      readonly ok: true;
      readonly proposal: NativeIssuanceProposal;
      readonly book: AssetSupplyBook;
      readonly evidenceId: string;
    }
  | { readonly ok: false; readonly code: PipelineRefusal };

export type SunReyIssuanceInput = {
  readonly actor: SupplyActor;
  readonly network: NativeIssuanceProposal['network'];
  readonly recipient: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly contributionVerified: boolean;
  readonly rawUserData?: boolean;
  readonly aiValuation?: boolean;
  readonly pdvOrCleanRoomOnly?: boolean;
  readonly valuationMethodology?: string;
};

export function runSunReyIssuancePipeline(
  authority: ProtocolNativeSupplyAuthority,
  input: SunReyIssuanceInput,
): PipelineResult {
  const actorRefusal = refuseForbiddenMutator(input.actor);
  if (actorRefusal) {
    return { ok: false, code: actorRefusal };
  }
  if (input.rawUserData) {
    return { ok: false, code: 'RAW_USER_DATA' };
  }
  if (!input.contributionVerified) {
    return { ok: false, code: 'UNVERIFIED_CONTRIBUTION' };
  }
  if (input.aiValuation) {
    return { ok: false, code: 'AI_VALUATION_CANNOT_MINT' };
  }
  if (input.pdvOrCleanRoomOnly) {
    return { ok: false, code: rejectPdvAutomaticMint() };
  }
  const gate = evaluateHumanGovernanceGate({ network: input.network, actor: input.actor });
  if (!gate.ok) {
    return { ok: false, code: gate.code };
  }
  const draft = developmentSunReyAuthority({
    recipient: input.recipient,
    quantity: input.quantity,
    replayIdentifier: input.replayIdentifier,
    issuanceClass: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
  });
  const proposal = createIssuanceProposal({
    proposalId: `iss.sunrey.${input.replayIdentifier}`,
    asset: 'SUNREY_COIN',
    amount: input.quantity,
    basis: 'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
    inputReferences: [draft.authorityId],
    valuationMethodology: input.valuationMethodology ?? 'HUMAN_CONTRIBUTION_BRIDGE_NOT_MARKET_PRICE',
    policyVersion: draft.monetaryPolicyVersion,
    book: authority.book('SUNREY_COIN'),
    network: input.network,
  });
  const applied = authority.applyIssuance({ actor: input.actor, authority: draft });
  if (!applied.ok) {
    return { ok: false, code: applied.code };
  }
  return {
    ok: true,
    proposal: Object.freeze({ ...proposal, status: 'APPLIED_SIMULATION' }),
    book: applied.book,
    evidenceId: createHash('sha256').update(draft.replayIdentifier).digest('hex'),
  };
}

export type MoonReyIssuanceInput = {
  readonly actor: SupplyActor;
  readonly network: NativeIssuanceProposal['network'];
  readonly recipient: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly authorizationId: string;
  readonly category: ProductiveCategoryId;
  readonly sourceConnected?: boolean;
  readonly observations?: readonly OracleObservationQuality[];
  readonly oracleOnly?: boolean;
  readonly verifiedFactOnly?: boolean;
};

export function runMoonReyIssuancePipeline(
  authority: ProtocolNativeSupplyAuthority,
  input: MoonReyIssuanceInput,
): PipelineResult {
  const actorRefusal = refuseForbiddenMutator(input.actor);
  if (actorRefusal) {
    return { ok: false, code: actorRefusal };
  }
  if (input.sourceConnected === false) {
    return { ok: false, code: 'PRODUCTIVE_SOURCE_NOT_CONNECTED' };
  }
  if (input.oracleOnly) {
    return { ok: false, code: rejectOracleOnlyMint() };
  }
  if (input.verifiedFactOnly) {
    return { ok: false, code: rejectFactOnlyMint() };
  }
  if (input.observations) {
    const safety = evaluateOracleSafety({ observations: input.observations });
    if (!safety.ok && safety.code !== 'ORACLE_OBSERVATION_CANNOT_MINT') {
      return { ok: false, code: safety.code };
    }
    if (input.oracleOnly || !input.authorizationId) {
      return { ok: false, code: rejectOracleOnlyMint() };
    }
  }
  const gate = evaluateHumanGovernanceGate({ network: input.network, actor: input.actor });
  if (!gate.ok) {
    return { ok: false, code: gate.code };
  }
  const draft = developmentMoonReyAuthority({
    recipient: input.recipient,
    quantity: input.quantity,
    replayIdentifier: input.replayIdentifier,
    contributionId: input.contributionId,
    fingerprint: input.fingerprint,
    authorizationId: input.authorizationId,
  });
  const proposal = createIssuanceProposal({
    proposalId: `iss.moonrey.${input.replayIdentifier}`,
    asset: 'MOONREY_COIN',
    amount: input.quantity,
    basis: `VERIFIED_PRODUCTIVE_CONTRIBUTION:${input.category}`,
    inputReferences: [draft.authorityId, input.contributionId],
    valuationMethodology: 'GPUV_PRODUCTIVE_VALUE_NOT_MARKET_PRICE',
    policyVersion: draft.monetaryPolicyVersion,
    book: authority.book('MOONREY_COIN'),
    network: input.network,
  });
  const applied = authority.applyIssuance({ actor: input.actor, authority: draft });
  if (!applied.ok) {
    return { ok: false, code: applied.code };
  }
  return {
    ok: true,
    proposal: Object.freeze({ ...proposal, status: 'APPLIED_SIMULATION' }),
    book: applied.book,
    evidenceId: createHash('sha256').update(draft.replayIdentifier).digest('hex'),
  };
}

export function refuseUnrestrictedMint(): IssuanceRejection {
  return rejectUnrestrictedMint();
}

export function agentCannotMint(actor: SupplyActor): boolean {
  return actor === 'AGENT' || actor === 'AI';
}

export function exchangeCannotChangeSupply(actor: SupplyActor): boolean {
  return actor === 'EXCHANGE_DATABASE';
}

export function frontendCannotChangeSupply(actor: SupplyActor): boolean {
  return actor === 'FRONTEND';
}

export function issuanceAuthorityFingerprint(authority: MonetaryIssuanceAuthority): string {
  return createHash('sha256')
    .update(`${authority.assetId}:${authority.replayIdentifier}:${authority.quantity.toString()}`)
    .digest('hex');
}

export function mainnetPolicyBlocksIssuance(): boolean {
  return economicPolicyDocument({ network: 'MAINNET' }).mainnetEconomics !== 'AUTHORIZED';
}
