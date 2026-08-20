/**
 * Rehearsal SunRey path.
 *
 * synthetic HIN evidence → consent/right → chain anchoring →
 * verified human contribution → valuation → reference value →
 * rehearsal conversion → settlement authorization →
 * Chunk 71 DEVELOPMENT/REHEARSAL authority → AssetSupplyBook
 *
 * Synthetic human data only. PEVE is never a SunRey formula.
 */

import { nativeAssetConstitution } from '../../economics/constitution.ts';
import {
  HumanContributionMonetaryBridge,
  PEVE_USED_AS_TOKEN_FORMULA,
  convertReferenceToSunRey,
  createDevelopmentSettlementAuthorization,
  fixtureVerifiedContribution,
  simulationConversionPolicy,
  type MonetaryContributionClass,
} from '../../economics/human-contribution-bridge/index.ts';
import { authorizeIssuance, developmentSunReyAuthority } from '../../economics/issuance.ts';
import { emptyBook, type AssetSupplyBook } from '../../economics/supply.ts';
import type { RehearsalParameterPackage, ReceiptRecord, SunReyPathResult } from './types.ts';

export type SunReyCapUsage = {
  readonly byClass: Map<string, bigint>;
  readonly byEpoch: Map<string, bigint>;
};

export function emptySunReyCaps(): SunReyCapUsage {
  return { byClass: new Map(), byEpoch: new Map() };
}

export type HinRehearsalState = {
  consentState: 'ACTIVE' | 'REVOKED';
  anchorState: 'PENDING' | 'FINALIZED' | 'OUTAGE';
  requireFinalizedAnchor: boolean;
};

export function emptyHinState(requireFinalizedAnchor: boolean): HinRehearsalState {
  return {
    consentState: 'ACTIVE',
    anchorState: 'FINALIZED',
    requireFinalizedAnchor,
  };
}

function constitution() {
  return nativeAssetConstitution('DEVELOPMENT_ACTIVE');
}

export function emptySunReyBook(): AssetSupplyBook {
  return emptyBook('SUNREY_COIN', constitution().assets[0]!.policyVersion.versionId);
}

export function applySunReyGenesis(
  pkg: RehearsalParameterPackage,
  book: AssetSupplyBook,
): { readonly book: AssetSupplyBook; readonly hiddenPremint: false; readonly faucetMigration: false } {
  let current = book;
  for (const line of pkg.genesisAllocation.value) {
    if (line.assetId !== 'SUNREY_COIN' || line.quantity === 0n) {
      continue;
    }
    const issued = authorizeIssuance(
      constitution(),
      current,
      developmentSunReyAuthority({
        recipient: line.destination,
        quantity: line.quantity,
        replayIdentifier: `genesis.${line.lineId}`,
        issuanceClass: 'GENESIS_ONLY',
      }),
    );
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    current = issued.book;
  }
  return { book: current, hiddenPremint: false, faucetMigration: false };
}

function rehearsalReferenceValue(measurementQuantity: bigint): bigint {
  return measurementQuantity * 100n;
}

export type SunReyIssueAttempt = {
  readonly ok: boolean;
  readonly code?: string;
  readonly quantity: bigint;
  readonly receipt?: ReceiptRecord;
  readonly book: AssetSupplyBook;
  readonly hinBlocked: boolean;
};

export function issueSunReyContribution(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: HumanContributionMonetaryBridge;
  readonly hin: HinRehearsalState;
  readonly contributionId: string;
  readonly contributionClass?: MonetaryContributionClass;
  readonly measurementQuantity?: bigint;
  readonly authorizationId?: string;
  readonly epochKey?: string;
  readonly caps?: SunReyCapUsage;
}): SunReyIssueAttempt {
  if (input.hin.consentState === 'REVOKED') {
    return { ok: false, code: 'HIN_CONSENT_REVOKED', quantity: 0n, book: input.book, hinBlocked: true };
  }
  if (input.hin.requireFinalizedAnchor && input.hin.anchorState !== 'FINALIZED') {
    return { ok: false, code: 'HIN_ANCHOR_NOT_FINALIZED', quantity: 0n, book: input.book, hinBlocked: true };
  }
  const contribution = fixtureVerifiedContribution({
    contributionId: input.contributionId,
    contributionClass: input.contributionClass ?? 'COMMUNITY_CONTRIBUTION',
  });
  const conversion = simulationConversionPolicy({
    policyId: `sunrey.human-settlement.conversion.rehearsal.${input.pkg.policyVersion}`,
    version: input.pkg.sunreyConversion.versionId,
    conversionNumerator: input.pkg.sunreyConversion.value.numerator,
    conversionDenominator: input.pkg.sunreyConversion.value.denominator,
    perContributionCeiling: input.pkg.sunreyConversion.value.perContributionCeiling,
    perEpochCeiling: input.pkg.sunreyConversion.value.perEpochCeiling,
    jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
  });
  const referenceValue = rehearsalReferenceValue(input.measurementQuantity ?? 5n);
  const converted = convertReferenceToSunRey(referenceValue, conversion);
  const authorized = converted > conversion.perContributionCeiling ? conversion.perContributionCeiling : converted;
  if (authorized <= 0n) {
    return { ok: false, code: 'CONVERSION_POLICY_INVALID', quantity: 0n, book: input.book, hinBlocked: false };
  }
  const authorization = createDevelopmentSettlementAuthorization({
    contribution,
    authorizedSunReyQuantity: authorized,
    authorizationId: input.authorizationId ?? `hcesa.rehearsal.${input.contributionId}`,
    environment: 'DEVELOPMENT',
  });
  const contributionClass = input.contributionClass ?? 'COMMUNITY_CONTRIBUTION';
  const classUsed = input.caps?.byClass.get(contributionClass) ?? 0n;
  const classCeiling =
    input.pkg.perClassCaps.value[contributionClass] ?? input.pkg.sunreyConversion.value.perClassCeiling;
  if (classUsed + authorized > classCeiling) {
    return { ok: false, code: 'PER_CLASS_CAP_EXCEEDED', quantity: 0n, book: input.book, hinBlocked: false };
  }
  const epochKey = input.epochKey ?? `${input.pkg.policyVersion}:epoch-1`;
  const epochUsed = input.caps?.byEpoch.get(epochKey) ?? 0n;
  if (epochUsed + authorized > input.pkg.sunreyConversion.value.perEpochCeiling) {
    return { ok: false, code: 'EPOCH_CAP_EXCEEDED', quantity: 0n, book: input.book, hinBlocked: false };
  }
  const projected = input.book.genesisAllocated + input.book.issuedPostGenesis + authorized;
  if (projected > input.pkg.sunreyMaximumSupply.value || projected > input.pkg.sunreyConversion.value.globalSupplyGuard) {
    return { ok: false, code: 'GLOBAL_SUPPLY_GUARD', quantity: 0n, book: input.book, hinBlocked: false };
  }
  const issued = input.bridge.attempt(
    {
      recipient: 'rehearsal.synthetic.human',
      contribution,
      authorization,
      actorKind: 'HUMAN',
      epochKey,
    },
    input.book,
  );
  if (!issued.ok) {
    return { ok: false, code: issued.code, quantity: 0n, book: input.book, hinBlocked: false };
  }
  if (input.caps) {
    input.caps.byClass.set(contributionClass, classUsed + issued.authority.quantity);
    input.caps.byEpoch.set(epochKey, epochUsed + issued.authority.quantity);
  }
  return {
    ok: true,
    quantity: issued.authority.quantity,
    book: issued.book,
    hinBlocked: false,
    receipt: {
      receiptId: authorization.authorizationId,
      assetId: 'SUNREY_COIN',
      quantity: issued.authority.quantity,
      policyVersion: input.pkg.policyVersion,
      conversionVersion: conversion.version,
      sourceId: contribution.contributionId,
      fingerprint: contribution.fingerprint,
    },
  };
}

export function rehearseSunReyPath(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly hin?: HinRehearsalState;
}): {
  readonly result: SunReyPathResult;
  readonly book: AssetSupplyBook;
  readonly bridge: HumanContributionMonetaryBridge;
} {
  if (PEVE_USED_AS_TOKEN_FORMULA) {
    throw new Error('PEVE must not be a SunRey formula');
  }
  const hin = input.hin ?? emptyHinState(input.pkg.requireFinalizedHinAnchor.value);
  const steps = Object.freeze([
    'synthetic_hin_evidence',
    'consent_right',
    'chain_anchoring',
    'verified_human_contribution',
    'human_contribution_valuation',
    'reference_value',
    'rehearsal_sunrey_conversion',
    'settlement_authorization',
    'chunk_71_development_rehearsal_authority',
    'asset_supply_book',
  ]);
  const bridge = new HumanContributionMonetaryBridge({ constitution: constitution() });
  const first = issueSunReyContribution({
    pkg: input.pkg,
    book: input.book,
    bridge,
    hin,
    contributionId: 'hec.rehearsal.path.1',
    measurementQuantity: 5n,
    authorizationId: 'hcesa.rehearsal.path.1',
  });
  const receipts = first.receipt ? [first.receipt] : [];
  return {
    book: first.book,
    bridge,
    result: Object.freeze({
      complete: first.ok,
      steps,
      issued: first.quantity,
      receipts: Object.freeze(receipts),
      syntheticHumanDataOnly: true,
      peveUsedAsSunReyFormula: false,
      hinConsentRevoked: hin.consentState === 'REVOKED',
      hinAnchorFinalized: hin.anchorState === 'FINALIZED',
      hinOutageBlockedIssuance: first.hinBlocked && hin.anchorState === 'OUTAGE',
    }),
  };
}
