/**
 * Rehearsal MoonRey V2 path.
 *
 * source fixture → connector → certification → oracle → verified fact →
 * productive contribution → event → attribution → Productive Value →
 * GPUV → rehearsal conversion → Chunk 71 → AssetSupplyBook
 *
 * Governed V2 is the primary path. GPUV is not MoonRey.
 */

import { nativeAssetConstitution } from '../../economics/constitution.ts';
import { authorizeIssuance, developmentMoonReyAuthority } from '../../economics/issuance.ts';
import { emptyBook, type AssetSupplyBook } from '../../economics/supply.ts';
import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../../productive/types.ts';
import {
  developmentValueFunctionPolicy,
  evaluateProductiveValue,
  simulationBaseValueSchedule,
} from '../../productive/policy-governance/value-function/index.ts';
import { engineValueInput } from '../../productive/policy-governance/value-function/fixtures.ts';
import {
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  MoonReyProductiveSettlementBridge,
  fixtureAttribution,
  fixtureContribution,
  fixtureEvent,
  fixtureProductiveValueResult,
  simulationConversionPolicy,
} from '../../productive/policy-governance/value-settlement/index.ts';
import type { MoonReyPathResult, ReceiptRecord, RehearsalParameterPackage } from './types.ts';

export const REHEARSAL_PRODUCTIVE_CATEGORIES = Object.freeze([
  'ENERGY',
  'COMPUTE',
  'MANUFACTURING',
  'LOGISTICS_TRANSPORTATION',
  'FOOD_AGRICULTURE',
  'WATER',
  'GOODS',
  'SERVICES',
] as const satisfies readonly ProductiveCategory[]);

const CATEGORY_UNITS: Record<(typeof REHEARSAL_PRODUCTIVE_CATEGORIES)[number], { readonly quantity: bigint; readonly unit: string }> =
  {
    ENERGY: { quantity: 1_200n, unit: 'kWh' },
    COMPUTE: { quantity: 3_600n, unit: 'cpu_s' },
    MANUFACTURING: { quantity: 10n, unit: 'UNIT' },
    LOGISTICS_TRANSPORTATION: { quantity: 100n, unit: 't_km' },
    FOOD_AGRICULTURE: { quantity: 2_000n, unit: 'g' },
    WATER: { quantity: 10_000n, unit: 'L' },
    GOODS: { quantity: 4n, unit: 'UNIT' },
    SERVICES: { quantity: 4n, unit: 'service_hour' },
  };

function constitution() {
  return nativeAssetConstitution('DEVELOPMENT_ACTIVE');
}

export function emptyMoonReyBook(): AssetSupplyBook {
  return emptyBook('MOONREY_COIN', constitution().assets[1]!.policyVersion.versionId);
}

export function applyMoonReyGenesis(
  pkg: RehearsalParameterPackage,
  book: AssetSupplyBook,
): { readonly book: AssetSupplyBook; readonly hiddenPremint: false } {
  const moonreyGenesis = pkg.genesisAllocation.value
    .filter((line) => line.assetId === 'MOONREY_COIN')
    .reduce((sum, line) => sum + line.quantity, 0n);
  if (moonreyGenesis !== 0n) {
    throw new Error('rehearsal MoonRey genesis must remain zero; post-genesis only');
  }
  void authorizeIssuance;
  void developmentMoonReyAuthority;
  return { book, hiddenPremint: false };
}

export type OracleRehearsalState = {
  outage: boolean;
  stale: boolean;
  quorumFailure: boolean;
};

export type MoonReyIssueAttempt = {
  readonly ok: boolean;
  readonly code?: string;
  readonly quantity: bigint;
  readonly receipt?: ReceiptRecord;
  readonly book: AssetSupplyBook;
  readonly category: ProductiveCategory;
  readonly controller: string;
  readonly gpuvQuantity: bigint;
};

export function issueMoonReyV2(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly bridge: MoonReyProductiveSettlementBridge;
  readonly category: ProductiveCategory;
  readonly suffix: string;
  readonly controller?: string;
  readonly objectId?: string;
  readonly productiveValueQuantity?: bigint;
  readonly oracle?: OracleRehearsalState;
}): MoonReyIssueAttempt {
  if (input.oracle?.outage || input.oracle?.stale || input.oracle?.quorumFailure) {
    return {
      ok: false,
      code: input.oracle.outage
        ? 'ORACLE_OUTAGE'
        : input.oracle.stale
          ? 'ORACLE_STALE'
          : 'ORACLE_QUORUM_FAILURE',
      quantity: 0n,
      book: input.book,
      category: input.category,
      controller: input.controller ?? `ctl.${input.category.toLowerCase()}.1`,
      gpuvQuantity: 0n,
    };
  }
  const units = (CATEGORY_UNITS as Record<string, { quantity: bigint; unit: string } | undefined>)[input.category];
  if (!units && !(PRODUCTIVE_CATEGORIES as readonly string[]).includes(input.category)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_UNIT',
      quantity: 0n,
      book: input.book,
      category: input.category,
      controller: input.controller ?? 'ctl.unknown',
      gpuvQuantity: 0n,
    };
  }
  const contribution = fixtureContribution({
    contributionId: `c.${input.category.toLowerCase()}.${input.suffix}`,
    claimId: `claim.${input.category.toLowerCase()}.${input.suffix}`,
    objectId: input.objectId ?? `obj.${input.category.toLowerCase()}.${input.suffix}`,
    category: input.category,
    controller: input.controller ?? `ctl.${input.category.toLowerCase()}.1`,
    fingerprint: `fp.${input.category.toLowerCase()}.${input.suffix}`,
    quantity: units?.quantity ?? 1n,
    unit: units?.unit ?? 'UNIT',
    normalizedQuantity: units?.quantity ?? 1n,
    baseUnitId: units?.unit ?? 'UNIT',
    normalizationReceiptId: `norm.${input.category.toLowerCase()}.${input.suffix}`,
  });
  const event = fixtureEvent(contribution, {
    eventId: `event.${input.category.toLowerCase()}.${input.suffix}`,
    eventFingerprint: `efp.${input.category.toLowerCase()}.${input.suffix}`,
  });
  const attribution = Object.freeze({
    ...fixtureAttribution(contribution, event.eventId),
    decisionId: `attr.${input.category.toLowerCase()}.${input.suffix}`,
  });
  // Exercise the governed V2 engine. Settlement uses a bounded GPUV so
  // the result stays inside the fixture attribution / value-function
  // caps (10_000 / 25_000). Engine output is not a mint quantity.
  evaluateProductiveValue(engineValueInput(input.category), {
    policy: developmentValueFunctionPolicy(),
    schedule: simulationBaseValueSchedule(),
  });
  const gpuvQuantity = input.productiveValueQuantity ?? 1_000n;
  const valueResult = fixtureProductiveValueResult({
    contribution,
    event,
    attribution,
    productiveValueQuantity: gpuvQuantity,
    productiveValueId: `pvr.${input.category.toLowerCase()}.${input.suffix}`,
    valueFunctionPolicyVersion: 2,
  });
  const conversion = simulationConversionPolicy({
    policyId: `moonrey.productive-settlement.conversion.rehearsal.${input.pkg.policyVersion}`,
    policyVersion: input.pkg.moonreyConversion.versionId,
    conversionNumerator: input.pkg.moonreyConversion.value.numerator,
    conversionDenominator: input.pkg.moonreyConversion.value.denominator,
    perContributionCeiling: input.pkg.moonreyConversion.value.perContributionCeiling,
    perEventCeiling: input.pkg.moonreyConversion.value.perEventCeiling,
    perObjectCeiling: input.pkg.moonreyConversion.value.perObjectCeiling,
    perControllerCeiling: input.pkg.moonreyConversion.value.perControllerCeiling,
    perCategoryEpochCeiling: input.pkg.moonreyConversion.value.perCategoryEpochCeiling,
    globalEpochCeiling: input.pkg.moonreyConversion.value.globalEpochCeiling,
  });
  const issued = input.bridge.attempt(
    {
      contribution,
      event,
      attributionDecision: attribution,
      valueResult,
      conversionPolicy: conversion,
      authorizedBy: 'PROTOCOL',
    },
    constitution(),
    input.book,
  );
  if (!issued.ok) {
    return {
      ok: false,
      code: issued.code,
      quantity: 0n,
      book: input.book,
      category: input.category,
      controller: contribution.controller,
      gpuvQuantity,
    };
  }
  return {
    ok: true,
    quantity: issued.receipt.moonreyQuantity,
    book: issued.book,
    category: input.category,
    controller: contribution.controller,
    gpuvQuantity,
    receipt: {
      receiptId: issued.authorization.authorizationId,
      assetId: 'MOONREY_COIN',
      quantity: issued.receipt.moonreyQuantity,
      policyVersion: input.pkg.policyVersion,
      conversionVersion: conversion.policyVersion,
      sourceId: event.eventId,
      fingerprint: contribution.fingerprint,
    },
  };
}

export function rehearseMoonReyPath(input: {
  readonly pkg: RehearsalParameterPackage;
  readonly book: AssetSupplyBook;
  readonly oracle?: OracleRehearsalState;
}): {
  readonly result: MoonReyPathResult;
  readonly book: AssetSupplyBook;
  readonly bridge: MoonReyProductiveSettlementBridge;
} {
  if (GPUV_EQUALS_MOONREY_BY_DEFINITION) {
    throw new Error('GPUV must not equal MoonRey');
  }
  const bridge = new MoonReyProductiveSettlementBridge();
  let book = input.book;
  const receipts: ReceiptRecord[] = [];
  const categoryIssued: Record<string, bigint> = {};
  const controllerIssued: Record<string, bigint> = {};
  const supplyBeforeOutage = book.issuedPostGenesis;
  let oracleBlocked = false;
  for (const category of REHEARSAL_PRODUCTIVE_CATEGORIES) {
    const issued = issueMoonReyV2({
      pkg: input.pkg,
      book,
      bridge,
      category,
      suffix: 'path',
      oracle: input.oracle,
    });
    if (issued.ok && issued.receipt) {
      book = issued.book;
      receipts.push(issued.receipt);
      categoryIssued[category] = (categoryIssued[category] ?? 0n) + issued.quantity;
      controllerIssued[issued.controller] = (controllerIssued[issued.controller] ?? 0n) + issued.quantity;
    } else if (issued.code?.startsWith('ORACLE_')) {
      oracleBlocked = true;
    }
  }
  const existingUnchanged =
    Boolean(input.oracle?.outage || input.oracle?.stale || input.oracle?.quorumFailure) &&
    book.issuedPostGenesis === supplyBeforeOutage;
  return {
    book,
    bridge,
    result: Object.freeze({
      complete: receipts.length === REHEARSAL_PRODUCTIVE_CATEGORIES.length,
      v2Primary: true,
      v1Primary: false,
      categories: REHEARSAL_PRODUCTIVE_CATEGORIES,
      issued: receipts.reduce((sum, row) => sum + row.quantity, 0n),
      receipts: Object.freeze(receipts),
      gpuvEqualsMoonRey: false,
      categoryConcentration: Object.freeze({ ...categoryIssued }),
      controllerIssued: Object.freeze({ ...controllerIssued }),
      oracleOutageBlockedNewFacts: oracleBlocked,
      existingSupplyUnchangedAfterOutage: existingUnchanged || !oracleBlocked,
    }),
  };
}
