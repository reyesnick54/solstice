import { commitCanonical } from '../../hash.ts';
import type { ExecutableTransaction, FeeAssetId } from '../types.ts';
import { checkedAdd, checkedMul, PROTOCOL_U128_MAX, WEIGHT_PRICE_SCALE } from './arithmetic.ts';
import { usageV2ForTransaction, weightedUsage } from './meter.ts';
import {
  FEE_QUOTE_V2_DOMAIN,
  type FeePolicyV2,
  type FeeQuoteV2,
  type ResourceUsageV2,
  type V2TransactionExtras,
} from './types.ts';

export type QuoteInput = {
  readonly policy: FeePolicyV2;
  readonly usage: ResourceUsageV2;
  readonly baseResourcePrice: bigint;
  readonly feeAsset: FeeAssetId;
  readonly maximumAuthorizedFee: bigint;
  readonly authorizedPriorityFee?: bigint;
  readonly priorityAuthorized?: boolean;
};

export type QuoteResult =
  | { readonly ok: true; readonly quote: FeeQuoteV2 }
  | { readonly ok: false; readonly code: QuoteRejectionCode; readonly detail: string };

export const QUOTE_REJECTION_CODES = [
  'FEE_ARITHMETIC_OVERFLOW',
  'PRIORITY_FIELD_TAMPER',
  'UNSUPPORTED_FEE_ASSET',
  'INSUFFICIENT_MAX_FEE',
  'FEE_BELOW_MINIMUM',
] as const;
export type QuoteRejectionCode = (typeof QUOTE_REJECTION_CODES)[number];

export function quoteFeeV2(input: QuoteInput): QuoteResult {
  try {
    if (input.feeAsset !== input.policy.feeAsset) {
      return { ok: false, code: 'UNSUPPORTED_FEE_ASSET', detail: `${input.feeAsset} is not the active v2 fee asset` };
    }
    if (input.feeAsset === 'MOONREY_COIN' && input.policy.moonreyFeeEnabled !== true) {
      return { ok: false, code: 'UNSUPPORTED_FEE_ASSET', detail: 'MoonRey is not an enabled fee asset' };
    }
    const weighted = weightedUsage(input.usage, input.policy.weights);
    const baseCharge = checkedMul(weighted, input.baseResourcePrice, 'baseCharge') / WEIGHT_PRICE_SCALE;
    let priorityFee = 0n;
    if (input.policy.priorityEnabled) {
      const declared = input.authorizedPriorityFee ?? 0n;
      if (declared > 0n && input.priorityAuthorized !== true) {
        return { ok: false, code: 'PRIORITY_FIELD_TAMPER', detail: 'priority fee must be explicitly authorized by the signer' };
      }
      if (declared < 0n) {
        return { ok: false, code: 'PRIORITY_FIELD_TAMPER', detail: 'priority fee must be unsigned' };
      }
      priorityFee = input.priorityAuthorized === true ? declared : 0n;
    } else if ((input.authorizedPriorityFee ?? 0n) > 0n) {
      return { ok: false, code: 'PRIORITY_FIELD_TAMPER', detail: 'priority fee is disabled by the active policy' };
    }
    const estimatedTotal = checkedAdd(baseCharge, priorityFee, 'estimatedTotal');
    const required = estimatedTotal > input.policy.minimumFee ? estimatedTotal : input.policy.minimumFee;
    if (input.maximumAuthorizedFee < input.policy.minimumFee) {
      return { ok: false, code: 'FEE_BELOW_MINIMUM', detail: 'max_fee is below the active minimum' };
    }
    if (required > input.maximumAuthorizedFee) {
      return {
        ok: false,
        code: 'INSUFFICIENT_MAX_FEE',
        detail: 'required fee exceeds the signed max_fee; insufficient-fee path applies',
      };
    }
    return {
      ok: true,
      quote: Object.freeze({
        policyVersion: 2,
        policyRevision: input.policy.version,
        resourceUsage: input.usage,
        weightedUsage: weighted,
        baseResourcePrice: input.baseResourcePrice,
        baseCharge,
        priorityFee,
        estimatedTotal: required,
        feeAsset: input.feeAsset,
        maximumAuthorizedFee: input.maximumAuthorizedFee,
        informational: true,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      code: 'FEE_ARITHMETIC_OVERFLOW',
      detail: error instanceof Error ? error.message : 'fee arithmetic overflow',
    };
  }
}

export function quoteInputForTransaction(
  policy: FeePolicyV2,
  tx: ExecutableTransaction & V2TransactionExtras,
  baseResourcePrice: bigint,
  maximumAuthorizedFee: bigint,
): QuoteInput {
  return {
    policy,
    usage: usageV2ForTransaction(tx),
    baseResourcePrice,
    feeAsset: tx.budget.feeAsset,
    maximumAuthorizedFee,
    ...(tx.authorizedPriorityFee !== undefined ? { authorizedPriorityFee: tx.authorizedPriorityFee } : {}),
    ...(tx.priorityAuthorized !== undefined ? { priorityAuthorized: tx.priorityAuthorized } : {}),
  };
}

export function estimateFeeV2(
  policy: FeePolicyV2,
  tx: ExecutableTransaction & V2TransactionExtras,
  baseResourcePrice: bigint,
): QuoteResult {
  const quoted = quoteFeeV2(
    quoteInputForTransaction(policy, tx, baseResourcePrice, PROTOCOL_U128_MAX),
  );
  if (!quoted.ok) {
    return quoted;
  }
  return {
    ok: true,
    quote: Object.freeze({
      ...quoted.quote,
      maximumAuthorizedFee: tx.budget.maxFee,
    }),
  };
}

export function hashFeeQuoteV2(quote: FeeQuoteV2): string {
  return commitCanonical({
    domain: FEE_QUOTE_V2_DOMAIN,
    policyVersion: quote.policyVersion,
    policyRevision: quote.policyRevision,
    weightedUsage: quote.weightedUsage.toString(),
    baseResourcePrice: quote.baseResourcePrice.toString(),
    baseCharge: quote.baseCharge.toString(),
    priorityFee: quote.priorityFee.toString(),
    estimatedTotal: quote.estimatedTotal.toString(),
    feeAsset: quote.feeAsset,
    maximumAuthorizedFee: quote.maximumAuthorizedFee.toString(),
  });
}

/**
 * An estimate is informational. Transaction authorization remains the
 * signed canonical max_fee.
 */
export function estimateIsInformational(quote: FeeQuoteV2): true {
  return quote.informational;
}
