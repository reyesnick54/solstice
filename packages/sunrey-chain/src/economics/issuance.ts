/**
 * MonetaryIssuanceAuthority, issuance classes, replay protection, and
 * the human-economic evidence boundary.
 *
 * There is no unrestricted mint. AI cannot authorize. PDV / Consent /
 * Clean Room / Human Information Market data does not mint SunRey Coin.
 * MoonRey still requires the complete productive-contribution path.
 */

import { createHash } from 'node:crypto';

import { policyFor, requireKnownAsset } from './constitution.ts';
import {
  creditCirculating,
  emptyBook,
  type AssetSupplyBook,
} from './supply.ts';
import {
  PRODUCTION_PARAMETER_UNCONFIGURED,
  type GenesisEvidence,
  type HumanEconomicEvidence,
  type HumanEvidencePurposeClass,
  type IssuanceClass,
  type MonetaryIssuanceAuthority,
  type MoonReyProductiveEvidence,
  type NativeAssetConstitution,
  type NativeMonetaryAssetId,
} from './types.ts';

const FORBIDDEN_PERSONAL_KEYS = [
  'name',
  'email',
  'phone',
  'address',
  'ssn',
  'passport',
  'dateOfBirth',
  'kyc',
  'pdvPayload',
  'cleanRoomRow',
  'rawPersonalData',
  'biometric',
  'race',
  'religion',
  'ethnicity',
  'sexualOrientation',
  'politicalAffiliation',
  'disability',
  'medicalCondition',
  'humanWorthScore',
  'socialCreditScore',
  'creditScore',
  'desirabilityScore',
] as const;

export type IssuanceRejection =
  | 'UNRESTRICTED_MINT_UNAVAILABLE'
  | 'INVENTED_ASSET'
  | 'WRONG_ASSET_ISSUANCE'
  | 'DUPLICATE_ISSUANCE'
  | 'AI_MONETARY_AUTHORIZATION_REJECTED'
  | 'RAW_PERSONAL_DATA_REJECTED'
  | 'PDV_CONSENT_CLEAN_ROOM_CANNOT_MINT'
  | 'MOONREY_WITHOUT_PRODUCTIVE_AUTHORIZATION'
  | 'ORACLE_OBSERVATION_CANNOT_MINT'
  | 'VERIFIED_FACT_ALONE_CANNOT_MINT'
  | 'UNAUTHORIZED_ISSUANCE_CLASS'
  | 'PRODUCTION_ISSUANCE_UNCONFIGURED'
  | 'QUANTITY_EXCEEDS_CEILING';

export type IssuanceResult =
  | { readonly ok: true; readonly authority: MonetaryIssuanceAuthority; readonly book: AssetSupplyBook }
  | { readonly ok: false; readonly code: IssuanceRejection };

export function privacySafeHumanEvidence(input: {
  readonly evidenceId: string;
  readonly policyVersion: string;
  readonly authorizationId: string;
  readonly contentHash: string;
  readonly quantityBasis: bigint;
  readonly purposeClass: HumanEvidencePurposeClass;
  readonly contributionId?: string;
  readonly fingerprint?: string;
  readonly verificationPolicyVersion?: string;
  readonly settlementAuthorizationRef?: string;
  readonly valuationPolicyRef?: string;
  readonly valuationVersion?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}): HumanEconomicEvidence {
  if (input.extra) {
    for (const key of Object.keys(input.extra)) {
      if ((FORBIDDEN_PERSONAL_KEYS as readonly string[]).includes(key)) {
        throw new TypeError('raw personal data rejected from monetary evidence');
      }
    }
  }
  if (!/^[0-9a-f]{64}$/.test(input.contentHash)) {
    throw new TypeError('monetary evidence requires a privacy-safe content hash');
  }
  return Object.freeze({
    evidenceId: input.evidenceId,
    policyVersion: input.policyVersion,
    authorizationId: input.authorizationId,
    contentHash: input.contentHash,
    quantityBasis: input.quantityBasis,
    purposeClass: input.purposeClass,
    containsRawPersonalData: false,
    pdvSourceExposed: false,
    cleanRoomSourceExposed: false,
    ...(input.contributionId !== undefined ? { contributionId: input.contributionId } : {}),
    ...(input.fingerprint !== undefined ? { fingerprint: input.fingerprint } : {}),
    ...(input.verificationPolicyVersion !== undefined
      ? { verificationPolicyVersion: input.verificationPolicyVersion }
      : {}),
    ...(input.settlementAuthorizationRef !== undefined
      ? { settlementAuthorizationRef: input.settlementAuthorizationRef }
      : {}),
    ...(input.valuationPolicyRef !== undefined ? { valuationPolicyRef: input.valuationPolicyRef } : {}),
    ...(input.valuationVersion !== undefined ? { valuationVersion: input.valuationVersion } : {}),
  });
}

export function evidenceHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function moonreyProductiveEvidence(input: {
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly authorizationId: string;
  readonly policyVersion: string;
}): MoonReyProductiveEvidence {
  return Object.freeze({
    evidenceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    contributionId: input.contributionId,
    fingerprint: input.fingerprint,
    authorizationId: input.authorizationId,
    policyVersion: input.policyVersion,
    moonreyIssuanceAuthorizationRequired: true,
    oracleObservationAloneInsufficient: true,
    verifiedFactAloneInsufficient: true,
  });
}

export function genesisEvidence(input: {
  readonly manifestHash: string;
  readonly category: GenesisEvidence['category'];
}): GenesisEvidence {
  return Object.freeze({
    evidenceClass: 'GENESIS_ALLOCATION_MANIFEST',
    manifestHash: input.manifestHash,
    category: input.category,
    categoryVersion: 'sunrey.genesis.distribution.category.v1',
  });
}

function replayIdOf(authority: Pick<MonetaryIssuanceAuthority, 'replayIdentifier' | 'assetId' | 'issuanceClass'>): string {
  return `${authority.assetId}:${authority.issuanceClass}:${authority.replayIdentifier}`;
}

export function authorizeIssuance(
  constitution: NativeAssetConstitution,
  book: AssetSupplyBook,
  draft: MonetaryIssuanceAuthority,
): IssuanceResult {
  let assetId: NativeMonetaryAssetId;
  try {
    assetId = requireKnownAsset(draft.assetId);
  } catch {
    return { ok: false, code: 'INVENTED_ASSET' };
  }
  if (assetId !== book.assetId) {
    return { ok: false, code: 'WRONG_ASSET_ISSUANCE' };
  }
  const policy = policyFor(constitution, assetId);
  if (!policy.permittedIssuanceClasses.includes(draft.issuanceClass as IssuanceClass)) {
    return { ok: false, code: 'UNAUTHORIZED_ISSUANCE_CLASS' };
  }
  if (draft.actorKind === 'AI' || draft.actorKind === 'AGENT') {
    return { ok: false, code: 'AI_MONETARY_AUTHORIZATION_REJECTED' };
  }
  if (!draft.authorized) {
    return { ok: false, code: 'UNRESTRICTED_MINT_UNAVAILABLE' };
  }
  if (draft.authorizationSource === 'DEVELOPMENT_GOVERNED_SIMULATION' && policy.policyState === 'PRODUCTION_CANDIDATE') {
    return { ok: false, code: 'PRODUCTION_ISSUANCE_UNCONFIGURED' };
  }
  if (policy.supplyConstraints.productionIssuanceActivated) {
    return { ok: false, code: 'PRODUCTION_ISSUANCE_UNCONFIGURED' };
  }
  if (policy.issuancePolicy.productionActivation === PRODUCTION_PARAMETER_UNCONFIGURED && policy.policyState === 'PRODUCTION_CANDIDATE') {
    return { ok: false, code: 'PRODUCTION_ISSUANCE_UNCONFIGURED' };
  }
  if (draft.quantity <= 0n || draft.quantity > draft.quantityCeiling) {
    return { ok: false, code: 'QUANTITY_EXCEEDS_CEILING' };
  }
  if (assetId === 'MOONREY_COIN') {
    const evidence = draft.economicEvidence as MoonReyProductiveEvidence;
    if (evidence.evidenceClass !== 'VERIFIED_PRODUCTIVE_CONTRIBUTION') {
      return { ok: false, code: 'MOONREY_WITHOUT_PRODUCTIVE_AUTHORIZATION' };
    }
    if (!evidence.authorizationId || !evidence.fingerprint || !evidence.contributionId) {
      return { ok: false, code: 'MOONREY_WITHOUT_PRODUCTIVE_AUTHORIZATION' };
    }
    if (draft.authorizationSource !== 'MOONREY_PRODUCTIVE_AUTHORIZATION') {
      return { ok: false, code: 'MOONREY_WITHOUT_PRODUCTIVE_AUTHORIZATION' };
    }
  }
  if (assetId === 'SUNREY_COIN' && draft.issuanceClass === 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION') {
    const evidence = draft.economicEvidence as HumanEconomicEvidence;
    if (!evidence.contentHash || evidence.containsRawPersonalData) {
      return { ok: false, code: 'RAW_PERSONAL_DATA_REJECTED' };
    }
  }
  const replay = replayIdOf(draft);
  if (book.usedReplayIds.has(replay)) {
    return { ok: false, code: 'DUPLICATE_ISSUANCE' };
  }
  const next = cloneBook(book);
  next.usedReplayIds.add(replay);
  if (draft.issuanceClass === 'GENESIS_ONLY') {
    next.genesisAllocated += draft.quantity;
  } else {
    next.issuedPostGenesis += draft.quantity;
  }
  creditCirculating(next, draft.recipient, draft.quantity);
  return { ok: true, authority: Object.freeze(draft), book: next };
}

export function rejectUnrestrictedMint(): IssuanceRejection {
  return 'UNRESTRICTED_MINT_UNAVAILABLE';
}

export function rejectPdvAutomaticMint(): IssuanceRejection {
  return 'PDV_CONSENT_CLEAN_ROOM_CANNOT_MINT';
}

export function rejectOracleOnlyMint(): IssuanceRejection {
  return 'ORACLE_OBSERVATION_CANNOT_MINT';
}

export function rejectFactOnlyMint(): IssuanceRejection {
  return 'VERIFIED_FACT_ALONE_CANNOT_MINT';
}

export function cloneBook(book: AssetSupplyBook): AssetSupplyBook {
  const next = emptyBook(book.assetId, book.policyVersion);
  next.genesisAllocated = book.genesisAllocated;
  next.issuedPostGenesis = book.issuedPostGenesis;
  next.burned = book.burned;
  next.circulating = book.circulating;
  next.locked = book.locked;
  next.escrowed = book.escrowed;
  next.feeReserved = book.feeReserved;
  for (const [key, value] of book.positions) {
    next.positions.set(key, value);
  }
  for (const [key, value] of book.locks) {
    next.locks.set(key, value);
  }
  for (const id of book.usedReplayIds) {
    next.usedReplayIds.add(id);
  }
  return next;
}

export function developmentSunReyAuthority(input: {
  readonly recipient: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly issuanceClass?: IssuanceClass;
  readonly actorKind?: MonetaryIssuanceAuthority['actorKind'];
  readonly authorized?: boolean;
  readonly evidence?: HumanEconomicEvidence | GenesisEvidence;
}): MonetaryIssuanceAuthority {
  const issuanceClass = input.issuanceClass ?? 'GOVERNED_ISSUANCE';
  return Object.freeze({
    authorityId: `mia.sunrey.${input.replayIdentifier}`,
    assetId: 'SUNREY_COIN',
    recipient: input.recipient,
    issuanceClass,
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
    authorizationSource: issuanceClass === 'GENESIS_ONLY' ? 'GENESIS_ALLOCATION_MANIFEST' : 'DEVELOPMENT_GOVERNED_SIMULATION',
    economicEvidence:
      input.evidence ??
      privacySafeHumanEvidence({
        evidenceId: `ev.${input.replayIdentifier}`,
        policyVersion: 'sunrey.monetary.constitution.v1',
        authorizationId: `auth.${input.replayIdentifier}`,
        contentHash: evidenceHash(input.replayIdentifier),
        quantityBasis: input.quantity,
        purposeClass: 'AUTHORIZED_ECONOMIC_PARTICIPATION_EVENT',
      }),
    quantity: input.quantity,
    quantityCeiling: input.quantity,
    epoch: 0,
    timeDomain: 'HEIGHT',
    replayIdentifier: input.replayIdentifier,
    activationState: 'DEVELOPMENT_ACTIVE',
    actorKind: input.actorKind ?? 'HUMAN',
    authorized: input.authorized ?? true,
  });
}

export function developmentMoonReyAuthority(input: {
  readonly recipient?: string;
  readonly quantity: bigint;
  readonly replayIdentifier: string;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly authorizationId: string;
  readonly authorized?: boolean;
}): MonetaryIssuanceAuthority {
  return Object.freeze({
    authorityId: `mia.moonrey.${input.replayIdentifier}`,
    assetId: 'MOONREY_COIN',
    recipient: input.recipient ?? `acct_${input.replayIdentifier}`,
    issuanceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
    authorizationSource: 'MOONREY_PRODUCTIVE_AUTHORIZATION',
    economicEvidence: moonreyProductiveEvidence({
      contributionId: input.contributionId,
      fingerprint: input.fingerprint,
      authorizationId: input.authorizationId,
      policyVersion: 'moonrey.issuance.formula.v1',
    }),
    quantity: input.quantity,
    quantityCeiling: input.quantity,
    epoch: 0,
    timeDomain: 'EPOCH',
    replayIdentifier: input.replayIdentifier,
    activationState: 'DEVELOPMENT_ACTIVE',
    actorKind: 'PROTOCOL',
    authorized: input.authorized ?? true,
  });
}
