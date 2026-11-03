/**
 * AAF entity resolution for US SEC registrants (CIK / ticker → canonical entity id).
 */

import { entityCommitmentFromRefs } from '@solstice/sunrey-chain/economic-proof';

export type SecCorporateAliasInput = {
  readonly cik: string;
  readonly ticker?: string | null;
  readonly jurisdiction?: string;
};

export type SecCorporateEntityResolution = {
  readonly canonicalEntityId: string;
  readonly cik: string;
  readonly ticker: string | null;
  readonly aliasCommitments: readonly string[];
  readonly entityCommitment: string;
};

const CIK_PAD = (cik: string): string => cik.replace(/\D/g, '').padStart(10, '0');

/** Stable SunRey company id used across external-data and HELIOS feature fabric. */
export function secCorporateEntityId(input: SecCorporateAliasInput): string {
  const jurisdiction = input.jurisdiction ?? 'US';
  return `sunrey:company:${jurisdiction.toLowerCase()}:${CIK_PAD(input.cik)}`;
}

export function resolveSecCorporateEntity(input: SecCorporateAliasInput): SecCorporateEntityResolution {
  const cik = CIK_PAD(input.cik);
  const canonicalEntityId = secCorporateEntityId({ ...input, cik });
  const aliasCommitments = Object.freeze([
    `cik:${cik}`,
    ...(input.ticker ? [`ticker:${input.ticker.toUpperCase()}`] : []),
  ]);
  return Object.freeze({
    canonicalEntityId,
    cik,
    ticker: input.ticker ?? null,
    aliasCommitments,
    entityCommitment: entityCommitmentFromRefs(aliasCommitments),
  });
}
