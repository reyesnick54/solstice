import { sha256Hex } from '../../security/src/hash.ts';
import { asInstrumentId, asRightId, type InstrumentId, type ListingVersion } from './ids.ts';
import type {
  ExchangeInstrument,
  FamilyExtension,
  InformationUseRightInstrument,
  ListingGovernanceCheck,
} from './types-universal.ts';
import {
  CANONICAL_MARKET_FAMILIES,
  type CanonicalMarketFamily,
  type LegalReviewState,
  type MarketFamily,
} from './taxonomy.ts';

export function isCanonicalFamily(family: MarketFamily): family is CanonicalMarketFamily {
  return (CANONICAL_MARKET_FAMILIES as readonly string[]).includes(family);
}

export function informationRightFromInstrument(
  instrument: ExchangeInstrument,
): InformationUseRightInstrument | null {
  if (instrument.marketFamily !== 'HUMAN_INFORMATION_RIGHT' || instrument.extension.kind !== 'HUMAN_INFORMATION_RIGHT') {
    return null;
  }
  return Object.freeze({
    ...instrument.extension,
    instrumentId: instrument.instrumentId,
    marketFamily: 'HUMAN_INFORMATION_RIGHT',
  });
}

export function validateInstrumentSchema(instrument: ExchangeInstrument): readonly string[] {
  const reasons: string[] = [];
  if (!instrument.instrumentId) {
    reasons.push('MISSING_INSTRUMENT_ID');
  }
  if (!isCanonicalFamily(instrument.marketFamily) && instrument.marketFamily !== 'INFORMATION_ASSET') {
    reasons.push('UNKNOWN_MARKET_FAMILY');
  }
  if (instrument.settlementAssets.length === 0) {
    reasons.push('MISSING_SETTLEMENT_ASSET');
  }
  if (!instrument.unit) {
    reasons.push('MISSING_UNIT');
  }
  if (instrument.extension.kind === 'HUMAN_INFORMATION_RIGHT') {
    if (instrument.extension.rawExportAllowed !== false && instrument.rightsPolicy.rawExportAllowed !== false) {
      reasons.push('RAW_EXPORT_MUST_BE_FALSE');
    }
    if (!instrument.extension.cleanRoomRequirement || !instrument.rightsPolicy.cleanRoomRequired) {
      reasons.push('CLEAN_ROOM_REQUIRED');
    }
    if (!instrument.extension.purpose) {
      reasons.push('MISSING_PURPOSE');
    }
  }
  if (instrument.extension.kind === 'PRODUCTIVE_CAPACITY' && instrument.extension.tokenizesTitle !== false) {
    reasons.push('TITLE_TOKENIZATION_FORBIDDEN');
  }
  if (instrument.extension.kind === 'DIGITAL_ASSET' && instrument.extension.autoListForbidden !== true) {
    reasons.push('AUTO_LIST_FORBIDDEN');
  }
  return reasons;
}

export function evaluateListingGovernance(instrument: ExchangeInstrument): ListingGovernanceCheck {
  const schemaReasons = validateInstrumentSchema(instrument);
  const familyPolicyOk = isCanonicalFamily(instrument.marketFamily) || instrument.marketFamily === 'INFORMATION_ASSET';
  const rightsOk =
    instrument.marketFamily !== 'HUMAN_INFORMATION_RIGHT' ||
    (instrument.rightsPolicy.requiresConsent &&
      instrument.rightsPolicy.cleanRoomRequired &&
      instrument.rightsPolicy.rawExportAllowed === false);
  const oracleOk =
    instrument.marketFamily === 'DIGITAL_ASSET' ||
    instrument.marketFamily === 'HUMAN_INFORMATION_RIGHT' ||
    instrument.oraclePolicy.required;
  const legal: LegalReviewState =
    instrument.legalReviewState === 'COUNSEL_REVIEW_REQUIRED'
      ? 'COUNSEL_REVIEW_REQUIRED'
      : 'RESEARCH_REQUIRED';
  const reasonCodes = [
    ...schemaReasons,
    ...(familyPolicyOk ? [] : ['FAMILY_POLICY_DENIED']),
    ...(rightsOk ? [] : ['RIGHTS_REQUIREMENTS_UNMET']),
    ...(oracleOk ? [] : ['ORACLE_REQUIREMENTS_UNMET']),
    ...(instrument.operationalReady ? [] : ['OPERATIONAL_NOT_READY']),
    ...(instrument.status === 'SIMULATION_LISTED' || instrument.status === 'DRAFT' || instrument.status === 'RESEARCH_REQUIRED'
      ? []
      : ['STATUS_NOT_LISTABLE']),
  ];
  const accepted =
    schemaReasons.length === 0 &&
    familyPolicyOk &&
    rightsOk &&
    oracleOk &&
    instrument.operationalReady &&
    legal !== undefined;
  return Object.freeze({
    schemaValid: schemaReasons.length === 0,
    familyPolicyOk,
    rightsOk,
    oracleOk,
    legalResearchStatus: legal,
    operationalReady: instrument.operationalReady,
    aiApproved: false,
    accepted,
    reasonCodes,
  });
}

export function instrumentContentHash(instrument: ExchangeInstrument): string {
  return sha256Hex(
    JSON.stringify({
      instrumentId: instrument.instrumentId,
      family: instrument.marketFamily,
      version: instrument.listingVersion,
      unit: instrument.unit,
      settlement: instrument.settlementAssets,
      extension: instrument.extension,
    }),
  );
}

export class InstrumentRegistry {
  private readonly byId = new Map<string, ExchangeInstrument>();
  private readonly versions = new Map<string, ExchangeInstrument[]>();

  put(instrument: ExchangeInstrument): ListingGovernanceCheck {
    const check = evaluateListingGovernance(instrument);
    if (!check.accepted && instrument.status === 'SIMULATION_LISTED') {
      return check;
    }
    this.byId.set(instrument.instrumentId, instrument);
    const history = this.versions.get(instrument.instrumentId) ?? [];
    this.versions.set(instrument.instrumentId, [...history, instrument]);
    return check;
  }

  get(id: InstrumentId | string): ExchangeInstrument | undefined {
    return this.byId.get(id);
  }

  list(family?: MarketFamily): readonly ExchangeInstrument[] {
    const all = [...this.byId.values()];
    return family ? all.filter((row) => row.marketFamily === family) : all;
  }

  history(id: InstrumentId | string): readonly ExchangeInstrument[] {
    return this.versions.get(id) ?? [];
  }
}

export function digitalAssetInstrument(input: {
  readonly instrumentId: string;
  readonly nativeAssetId: string;
  readonly issuer: string;
  readonly settlementAssets: readonly string[];
  readonly listingVersion?: number;
}): ExchangeInstrument {
  return Object.freeze({
    instrumentId: asInstrumentId(input.instrumentId),
    marketFamily: 'DIGITAL_ASSET',
    issuerOrProvider: input.issuer,
    underlyingReference: input.nativeAssetId,
    unit: 'native_unit',
    settlementAssets: input.settlementAssets,
    jurisdictionPolicy: { permitted: ['GB' as never], denied: [] },
    eligibilityPolicy: {
      access: 'PUBLIC_DEVELOPMENT',
      counterpartyClasses: ['HUMAN', 'DEVELOPMENT', 'INSTITUTION'],
      requiredCapabilities: [],
      requireVerifiedAccount: false,
      machineAllowed: true,
      humanOnly: false,
    },
    rightsPolicy: {
      requiresConsent: false,
      requiresPurpose: false,
      cleanRoomRequired: false,
      rawExportAllowed: false,
      revocationBehavior: 'BLOCK_FUTURE_USE',
    },
    oraclePolicy: {
      required: false,
      factTypes: [],
      conflict: 'BLOCK_ON_CONFLICT',
      stale: 'BLOCK_ON_STALE',
      maxProviderShareBps: 10_000n,
    },
    deliveryPolicy: {
      model: 'NATIVE_ASSET_DVP',
      partial: 'PAY_VERIFIED_RELEASE_UNUSED',
      geographyRequired: false,
      permittedGeographies: [],
    },
    listingVersion: (input.listingVersion ?? 1) as ListingVersion,
    status: 'SIMULATION_LISTED',
    legalReviewState: 'RESEARCH_REQUIRED',
    operationalReady: true,
    extension: {
      kind: 'DIGITAL_ASSET',
      nativeAssetId: input.nativeAssetId,
      listingGovernanceRequired: true,
      autoListForbidden: true,
    } satisfies FamilyExtension,
  });
}

export function informationRightInstrument(input: {
  readonly instrumentId: string;
  readonly issuer: string;
  readonly cohortRef: string;
  readonly templateId: string;
  readonly purpose: string;
  readonly recipientClass: string;
  readonly consentPolicyRef: string;
  readonly settlementAsset: string;
}): ExchangeInstrument {
  return Object.freeze({
    instrumentId: asInstrumentId(input.instrumentId),
    marketFamily: 'HUMAN_INFORMATION_RIGHT',
    issuerOrProvider: input.issuer,
    underlyingReference: input.cohortRef,
    unit: 'authorized_computation',
    settlementAssets: [input.settlementAsset],
    jurisdictionPolicy: { permitted: ['GB' as never], denied: [] },
    eligibilityPolicy: {
      access: 'ELIGIBLE_COUNTERPARTY',
      counterpartyClasses: ['INSTITUTION', 'ELIGIBLE_COUNTERPARTY'],
      requiredCapabilities: [],
      requireVerifiedAccount: true,
      machineAllowed: false,
      humanOnly: true,
    },
    rightsPolicy: {
      requiresConsent: true,
      requiresPurpose: true,
      cleanRoomRequired: true,
      rawExportAllowed: false,
      revocationBehavior: 'BLOCK_FUTURE_USE',
    },
    oraclePolicy: {
      required: false,
      factTypes: [],
      conflict: 'BLOCK_ON_CONFLICT',
      stale: 'BLOCK_ON_STALE',
      maxProviderShareBps: 10_000n,
    },
    deliveryPolicy: {
      model: 'DELIVERY_VERSUS_RIGHT',
      partial: 'ALL_OR_NOTHING',
      geographyRequired: false,
      permittedGeographies: [],
    },
    listingVersion: 1 as ListingVersion,
    status: 'SIMULATION_LISTED',
    legalReviewState: 'RESEARCH_REQUIRED',
    operationalReady: true,
    extension: {
      kind: 'HUMAN_INFORMATION_RIGHT',
      rightId: asRightId(`right:${input.instrumentId}`),
      subjectOrCohortRef: input.cohortRef,
      permittedComputationTemplate: input.templateId,
      purpose: input.purpose,
      recipientEligibility: [input.recipientClass],
      duration: { startHeight: 0n, endHeight: 1_000_000n, startAt: null, endAt: null },
      revocationBehavior: 'BLOCK_FUTURE_USE',
      cleanRoomRequirement: true,
      outputRestrictions: ['AGGREGATE_ONLY', 'NO_RAW_ROWS'],
      compensationTerms: 'escrow_then_receipt',
      settlementAsset: input.settlementAsset,
      consentPolicyRef: input.consentPolicyRef,
    },
  });
}

export function computeInstrument(input: {
  readonly instrumentId: string;
  readonly provider: string;
  readonly serviceClass: import('./taxonomy.ts').ComputeServiceClass;
  readonly capacity: bigint;
  readonly unit: string;
  readonly settlementAsset: string;
  readonly region?: string;
}): ExchangeInstrument {
  return Object.freeze({
    instrumentId: asInstrumentId(input.instrumentId),
    marketFamily: 'INTELLIGENCE_COMPUTE',
    issuerOrProvider: input.provider,
    underlyingReference: `${input.provider}:${input.unit}`,
    unit: input.unit,
    settlementAssets: [input.settlementAsset],
    jurisdictionPolicy: { permitted: ['GB' as never], denied: [] },
    eligibilityPolicy: {
      access: 'MACHINE_ALLOWED',
      counterpartyClasses: ['MACHINE', 'HUMAN', 'INSTITUTION', 'DEVELOPMENT'],
      requiredCapabilities: [],
      requireVerifiedAccount: false,
      machineAllowed: true,
      humanOnly: false,
    },
    rightsPolicy: {
      requiresConsent: false,
      requiresPurpose: false,
      cleanRoomRequired: false,
      rawExportAllowed: false,
      revocationBehavior: 'BLOCK_FUTURE_USE',
    },
    oraclePolicy: {
      required: true,
      factTypes: ['COMPUTE_USAGE'],
      conflict: 'BLOCK_ON_CONFLICT',
      stale: 'BLOCK_ON_STALE',
      maxProviderShareBps: 8_000n,
    },
    deliveryPolicy: {
      model: 'COMPUTE_CONTRACT',
      partial: 'PAY_VERIFIED_RELEASE_UNUSED',
      geographyRequired: false,
      permittedGeographies: [],
    },
    listingVersion: 1 as ListingVersion,
    status: 'SIMULATION_LISTED',
    legalReviewState: 'RESEARCH_REQUIRED',
    operationalReady: true,
    extension: {
      kind: 'INTELLIGENCE_COMPUTE',
      provider: input.provider,
      region: input.region ?? 'simulation',
      hardwareOrServiceClass: input.serviceClass,
      capacity: input.capacity,
      deliveryWindow: { startHeight: 1n, endHeight: 10_000n, startAt: null, endAt: null },
      unit: input.unit,
      maximumLatencyClass: null,
      oracleMeteringPolicy: {
        required: true,
        factTypes: ['COMPUTE_USAGE'],
        conflict: 'BLOCK_ON_CONFLICT',
        stale: 'BLOCK_ON_STALE',
        maxProviderShareBps: 8_000n,
      },
      settlementAsset: input.settlementAsset,
    },
  });
}

export function capacityInstrument(input: {
  readonly instrumentId: string;
  readonly provider: string;
  readonly productiveObject: string;
  readonly category: import('./taxonomy.ts').CapacityCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly settlementAsset: string;
  readonly location: string;
}): ExchangeInstrument {
  return Object.freeze({
    instrumentId: asInstrumentId(input.instrumentId),
    marketFamily: 'PRODUCTIVE_CAPACITY',
    issuerOrProvider: input.provider,
    underlyingReference: input.productiveObject,
    unit: input.unit,
    settlementAssets: [input.settlementAsset],
    jurisdictionPolicy: { permitted: ['GB' as never], denied: [] },
    eligibilityPolicy: {
      access: 'VERIFIED_ACCOUNT',
      counterpartyClasses: ['INSTITUTION', 'MACHINE', 'HUMAN', 'DEVELOPMENT'],
      requiredCapabilities: [],
      requireVerifiedAccount: true,
      machineAllowed: true,
      humanOnly: false,
    },
    rightsPolicy: {
      requiresConsent: false,
      requiresPurpose: false,
      cleanRoomRequired: false,
      rawExportAllowed: false,
      revocationBehavior: 'BLOCK_FUTURE_USE',
    },
    oraclePolicy: {
      required: true,
      factTypes: ['MANUFACTURING_OUTPUT'],
      conflict: 'BLOCK_ON_CONFLICT',
      stale: 'BLOCK_ON_STALE',
      maxProviderShareBps: 8_000n,
    },
    deliveryPolicy: {
      model: 'CAPACITY_ESCROW_ORACLE',
      partial: 'PAY_VERIFIED_RELEASE_UNUSED',
      geographyRequired: true,
      permittedGeographies: [input.location],
    },
    listingVersion: 1 as ListingVersion,
    status: 'SIMULATION_LISTED',
    legalReviewState: 'RESEARCH_REQUIRED',
    operationalReady: true,
    extension: {
      kind: 'PRODUCTIVE_CAPACITY',
      productiveObject: input.productiveObject,
      capacityCategory: input.category,
      quantity: input.quantity,
      unit: input.unit,
      deliveryWindow: { startHeight: 100n, endHeight: 200n, startAt: null, endAt: null },
      deliveryLocation: input.location,
      rightsReference: `rights:${input.productiveObject}`,
      tokenizesTitle: false,
    },
  });
}
