import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../../../domain/src/brand.ts';

export type HumanEconomyConsentGrantId = Brand<string, 'HumanEconomyConsentGrantId'>;
export type AuthorizedContributionId = Brand<string, 'AuthorizedContributionId'>;
export type HumanDataUsageReceiptId = Brand<string, 'HumanDataUsageReceiptId'>;
export type OffChainRecordRefId = Brand<string, 'OffChainRecordRefId'>;

export const HUMAN_ECONOMY_ID_PREFIXES = Object.freeze({
  humanConsent: 'hcs_',
  authorizedContribution: 'act_',
  usageReceipt: 'hur_',
  offChainRef: 'ocr_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} must be ${prefix} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, T>(value);
}

export function asHumanEconomyConsentGrantId(value: string): HumanEconomyConsentGrantId {
  return asPrefixedHex(value, HUMAN_ECONOMY_ID_PREFIXES.humanConsent, 'HumanEconomyConsentGrantId');
}

export function asAuthorizedContributionId(value: string): AuthorizedContributionId {
  return asPrefixedHex(value, HUMAN_ECONOMY_ID_PREFIXES.authorizedContribution, 'AuthorizedContributionId');
}

export function asHumanDataUsageReceiptId(value: string): HumanDataUsageReceiptId {
  return asPrefixedHex(value, HUMAN_ECONOMY_ID_PREFIXES.usageReceipt, 'HumanDataUsageReceiptId');
}

export function asOffChainRecordRefId(value: string): OffChainRecordRefId {
  return asPrefixedHex(value, HUMAN_ECONOMY_ID_PREFIXES.offChainRef, 'OffChainRecordRefId');
}

export function newHumanEconomyConsentGrantId(seed: string): HumanEconomyConsentGrantId {
  return asHumanEconomyConsentGrantId(
    `${HUMAN_ECONOMY_ID_PREFIXES.humanConsent}${digest(`human-consent:${seed}`)}`,
  );
}

export function newAuthorizedContributionId(seed: string): AuthorizedContributionId {
  return asAuthorizedContributionId(
    `${HUMAN_ECONOMY_ID_PREFIXES.authorizedContribution}${digest(`authorized-contribution:${seed}`)}`,
  );
}

export function newHumanDataUsageReceiptId(seed: string): HumanDataUsageReceiptId {
  return asHumanDataUsageReceiptId(
    `${HUMAN_ECONOMY_ID_PREFIXES.usageReceipt}${digest(`human-usage-receipt:${seed}`)}`,
  );
}

export function newOffChainRecordRefId(seed: string): OffChainRecordRefId {
  return asOffChainRecordRefId(
    `${HUMAN_ECONOMY_ID_PREFIXES.offChainRef}${digest(`off-chain-ref:${seed}`)}`,
  );
}
