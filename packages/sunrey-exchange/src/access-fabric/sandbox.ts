import { FrozenClock, addMs } from '../../../config/src/clock.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { Ledger } from '../../../ledger/src/journal.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { Money } from '../../../money/src/money.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import { AUTHORITY_TTL_MS, AuthorityIssuer } from '../../../permissions/src/execution-authority.ts';
import { InMemoryCoinPort, InMemoryFiatPort } from '../adapters.ts';
import { asExchangeMarketId } from '../ids.ts';
import { capacityInstrument, computeInstrument } from '../instruments.ts';
import { SimulationNativeDvpAdapter } from '../native-settlement.ts';
import { exchangePrice } from '../price.ts';
import { SimulationCustodyRail } from '../product/sandbox.ts';
import type { SettlementRails } from '../product/settlement.ts';
import type { EligibilityContext } from '../types-universal.ts';
import { InMemoryAccessEntitlementPort, InMemoryRewardCreditPort } from './adapters.ts';
import { CapacityAccessMarketEngine } from './engine.ts';
import { capacityMarketConfiguration } from './policy.ts';
import { capacityAccessTerms, termsFromInstrument } from './terms.ts';
import type { CapacityAccessTerms } from './types.ts';
import type { AccessSettlementSemantics, ConsiderationKind } from './taxonomy.ts';

const NOW = asUtcInstant('2026-08-29T10:00:00.000Z');

export const CAPACITY_ACCESS_MARKET_ID = asExchangeMarketId('market:productive-capacity-access-simulation');
export const COMPUTE_ACCESS_MARKET_ID = asExchangeMarketId('market:compute-capacity-access-simulation');
export const SIMULATION_JURISDICTION = asJurisdiction('GB');
export const FORBIDDEN_JURISDICTION = asJurisdiction('KP');
export const FACILITY_HOUR_UNIT = 'facility_hour';
export const GPU_SECOND_UNIT = 'GPU_SECOND';

/**
 * Deterministic capacity access world for demos and tests. Fiat rides the
 * canonical Ledger, native coin rides the custody or chain rail, and entitlement
 * and reward credit ride their owning ports.
 */
export function createCapacityAccessSandbox(now: UtcInstant = NOW) {
  const clock = new FrozenClock(now);
  const issuer = new AuthorityIssuer('sunrey-exchange-access-fabric');
  const ledger = new Ledger(issuer, clock);
  const coin = new InMemoryCoinPort();
  const fiat = new InMemoryFiatPort();
  const chain = new SimulationNativeDvpAdapter();
  const custody = new SimulationCustodyRail();
  const entitlements = new InMemoryAccessEntitlementPort();
  const rewards = new InMemoryRewardCreditPort();
  const finalized = new Set<string>(['always']);

  const rails: SettlementRails = {
    ledger: {
      kind: 'LEDGER_FIAT',
      ledger,
      registerAccount: (account) => ledger.accounts.registerSystemAccount(account),
    },
    custody,
    native: {
      kind: 'NATIVE_CHAIN',
      port: chain,
      queryFinality: (txId) =>
        finalized.has(txId) || finalized.has('always') ? 'BFT_FINALIZED' : 'PENDING_PROPOSAL',
      recordTx: (_txId) => undefined,
    },
    application: { kind: 'APPLICATION_PORT', coin, fiat },
  };

  const engine = new CapacityAccessMarketEngine({ rails, entitlements, rewards });

  const capacityListing = capacityInstrument({
    instrumentId: 'xins:manufacturing-line-capacity',
    provider: 'provider:northline-works',
    productiveObject: 'pobj:northline-line-7',
    category: 'MANUFACTURING',
    quantity: 10_000n,
    unit: FACILITY_HOUR_UNIT,
    settlementAsset: 'USD',
    location: 'GB-MAN',
  });

  const computeListing = computeInstrument({
    instrumentId: 'xins:gpu-cluster-capacity',
    provider: 'provider:helios-compute',
    serviceClass: 'GPU_COMPUTE',
    capacity: 500_000n,
    unit: GPU_SECOND_UNIT,
    settlementAsset: 'MOONREY_COIN',
    region: 'GB-LON',
  });

  engine.configureMarket(
    capacityMarketConfiguration({
      marketId: CAPACITY_ACCESS_MARKET_ID,
      permittedMechanisms: ['FIXED_PRICE_OFFER', 'REQUEST_FOR_QUOTE', 'BATCH_AUCTION', 'QUEUE_ALLOCATION'],
      permittedConsideration: ['FIAT', 'SUNREY_COIN', 'ACCESS_ENTITLEMENT', 'REWARD_CREDIT'],
      defaultSemantics: 'RESERVATION_VERSUS_CONSIDERATION',
      deniedJurisdictions: [FORBIDDEN_JURISDICTION],
    }),
  );
  engine.configureMarket(
    capacityMarketConfiguration({
      marketId: COMPUTE_ACCESS_MARKET_ID,
      permittedMechanisms: ['FIXED_PRICE_OFFER', 'REQUEST_FOR_QUOTE'],
      permittedConsideration: ['MOONREY_COIN', 'ACCESS_ENTITLEMENT'],
      defaultSemantics: 'DELIVERY_VERSUS_PAYMENT',
      deniedJurisdictions: [FORBIDDEN_JURISDICTION],
    }),
  );

  function terms(input: {
    readonly termsId: string;
    readonly unit?: string;
    readonly quantity?: bigint;
    readonly semantics?: AccessSettlementSemantics;
    readonly permittedConsideration?: readonly ConsiderationKind[];
    readonly partialDeliveryAllowed?: boolean;
    readonly instrumentId?: string;
    readonly deliveryLocation?: string;
  }): CapacityAccessTerms {
    const unit = input.unit ?? FACILITY_HOUR_UNIT;
    return capacityAccessTerms({
      termsId: input.termsId,
      family: 'PRODUCTIVE_CAPACITY',
      instrumentId: input.instrumentId ?? 'xins:manufacturing-line-capacity',
      productiveObject: {
        objectId: 'pobj:northline-line-7',
        claimId: 'pclm:northline-line-7-capacity-2026w35',
        claimType: 'CAPACITY',
        productiveCategory: 'MANUFACTURING',
        canonicalUnit: unit,
        normalizationReceiptId: 'nrcpt:northline-line-7-2026w35',
        claimVerified: true,
        tokenizesTitle: false,
      },
      quantity: input.quantity ?? 1_000n,
      unit,
      availabilityWindow: { startHeight: 100n, endHeight: 200n, startAt: null, endAt: null },
      geography: {
        deliveryLocation: input.deliveryLocation ?? 'GB-MAN',
        region: 'GB',
        gridOrNetworkZone: 'GB-NW-3',
      },
      serviceClass: {
        label: 'MANUFACTURING',
        computeClass: null,
        capacityCategory: 'MANUFACTURING',
        maximumLatencyClass: null,
        minimumAvailabilityBps: 9_500n,
      },
      rightsTerms: {
        rightsReference: 'rights:pobj:northline-line-7',
        grantsUseNotOwnership: true,
        sublicensable: false,
        revocationBehavior: 'BLOCK_FUTURE_USE',
        permittedPurposes: ['CONTRACT_MANUFACTURING'],
      },
      policyRequirements: {
        requiredCapabilities: [],
        requireVerifiedAccount: true,
        permittedJurisdictions: [SIMULATION_JURISDICTION],
        deniedJurisdictions: [FORBIDDEN_JURISDICTION],
        requiresManualReviewAbove: null,
        oraclePolicy: capacityListing.oraclePolicy,
      },
      jurisdiction: SIMULATION_JURISDICTION,
      provenance: {
        providerId: 'provider:northline-works',
        attestationRefs: ['attest:northline-iso-9001'],
        oracleFactIds: ['fact:northline-line-7-capacity-2026w35'],
        economicAssetId: 'easset:northline-line-7',
        recordedAt: now,
      },
      deliveryRequirements: {
        semantics: input.semantics ?? 'RESERVATION_VERSUS_CONSIDERATION',
        requiresOracleAttestation: true,
        acceptedEvidenceQualities: ['FINALIZED'],
        partialDeliveryAllowed: input.partialDeliveryAllowed ?? true,
        deliveryConditions: ['ORACLE_ATTESTED_FACILITY_HOURS'],
      },
      permittedConsideration:
        input.permittedConsideration ?? ['FIAT', 'SUNREY_COIN', 'ACCESS_ENTITLEMENT', 'REWARD_CREDIT'],
    });
  }

  function computeTerms(input: {
    readonly termsId: string;
    readonly quantity?: bigint;
    readonly semantics?: AccessSettlementSemantics;
    readonly permittedConsideration?: readonly ConsiderationKind[];
  }): CapacityAccessTerms {
    return termsFromInstrument({
      termsId: input.termsId,
      instrument: computeListing,
      productiveCategory: 'AI_COMPUTE',
      claimId: 'pclm:helios-gpu-capacity-2026w35',
      claimVerified: true,
      normalizationReceiptId: 'nrcpt:helios-gpu-2026w35',
      quantity: input.quantity ?? 100_000n,
      jurisdiction: SIMULATION_JURISDICTION,
      provenance: {
        providerId: 'provider:helios-compute',
        attestationRefs: ['attest:helios-soc2'],
        oracleFactIds: ['fact:helios-gpu-seconds-2026w35'],
        economicAssetId: 'easset:helios-gpu-cluster',
        recordedAt: now,
      },
      semantics: input.semantics ?? 'DELIVERY_VERSUS_PAYMENT',
      permittedConsideration: input.permittedConsideration ?? ['MOONREY_COIN', 'ACCESS_ENTITLEMENT'],
      permittedPurposes: ['MODEL_TRAINING'],
      deliveryConditions: ['ORACLE_METERED_GPU_SECONDS'],
    });
  }

  function actorContext(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
    return Object.freeze({
      actorClass: 'INSTITUTION',
      capabilities: [],
      jurisdiction: SIMULATION_JURISDICTION,
      geography: 'GB-MAN',
      machineId: null,
      purpose: 'CONTRACT_MANUFACTURING',
      recipientClass: null,
      consentActive: true,
      consentRevoked: false,
      verifiedAccount: true,
      access: 'VERIFIED_ACCOUNT',
      ...overrides,
    });
  }

  function unitPrice(input: { readonly unit?: string; readonly priceUnits?: bigint } = {}) {
    return exchangePrice({
      baseAssetId: input.unit ?? FACILITY_HOUR_UNIT,
      quoteAssetId: 'USD',
      quoteKind: 'FIAT_MONEY',
      priceUnits: input.priceUnits ?? 250n,
      basePrecision: 0,
    });
  }

  function nativeUnitPrice(input: { readonly unit?: string; readonly assetId?: string; readonly priceUnits?: bigint } = {}) {
    return exchangePrice({
      baseAssetId: input.unit ?? GPU_SECOND_UNIT,
      quoteAssetId: input.assetId ?? 'MOONREY_COIN',
      quoteKind: 'ASSET',
      priceUnits: input.priceUnits ?? 40n,
      basePrecision: 0,
    });
  }

  function issueSettlementAuthority(accountId: string, idempotencyKey: string) {
    return issuer.issue({
      authorityId: `ea_${idempotencyKey}`,
      actionType: ACTION_TYPES.SETTLE_EXCHANGE_TRADE,
      accountId,
      intentId: idempotencyKey,
      idempotencyKey,
      amount: null,
      issuedAt: clock.now(),
      expiresAt: addMs(clock.now(), AUTHORITY_TTL_MS),
    });
  }

  function seedFiat(accountId: string, minor: bigint) {
    fiat.seed(accountId, Money.fromMinorUnits(minor, 'USD'));
  }

  function seedNative(owner: string, assetId: string, units: bigint) {
    chain.seed(owner, AssetQuantity.fromScaledUnits(units, assetId));
  }

  return {
    now,
    clock,
    issuer,
    ledger,
    coin,
    fiat,
    chain,
    custody,
    entitlements,
    rewards,
    finalized,
    rails,
    engine,
    capacityListing,
    computeListing,
    terms,
    computeTerms,
    actorContext,
    unitPrice,
    nativeUnitPrice,
    issueSettlementAuthority,
    seedFiat,
    seedNative,
  };
}
