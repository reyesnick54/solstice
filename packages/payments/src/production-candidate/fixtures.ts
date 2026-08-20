import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { LegalEntityId } from '../../../domain/src/legal-entity.ts';
import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import { secretRef } from '../../../security/src/secrets.ts';
import { freezeRailCapability, type RailCapability } from '../rail-capability.ts';
import { asProviderId } from '../rail-ids.ts';
import { freezeBankingProviderCandidateProfile, type BankingProviderCandidateProfile } from './banking-profile.ts';
import { freezePaymentRailProviderCandidateProfile, type PaymentRailProviderCandidateProfile } from './rail-profile.ts';
import {
  freezeFxLiquidityProviderCandidateProfile,
  type CandidateFxQuote,
  type FxLiquidityProviderCandidateProfile,
} from './fx-profile.ts';
import { evidenceRef, type CredentialDescriptorRef } from './types.ts';

export const FIXTURE_NOW: UtcInstant = asUtcInstant('2026-08-20T12:00:00.000Z');

function descriptor(path: string): CredentialDescriptorRef {
  return Object.freeze({
    descriptorId: `cred_desc_fixture_${path.replaceAll('/', '_')}`,
    plane: 'CHUNK_149_PROVIDER_CREDENTIAL_PLANE',
    secretRef: secretRef('simulation', path),
    plaintextCredential: false,
  });
}

export function fixtureBankUs(): BankingProviderCandidateProfile {
  return freezeBankingProviderCandidateProfile({
    providerId: 'fixture-bank-us',
    version: 'fixture-bank-us/1',
    providerAcceptanceRef: {
      domain: 'BANKING_REFERENCE',
      providerId: 'fixture-bank-us',
      recordId: 'acc_fixture-bank-us',
    },
    supportedAccountReferenceClasses: ['EXTERNAL_ACCOUNT_ID', 'ROUTING_ACCOUNT_COORDINATE', 'ACCOUNT_LIFECYCLE'],
    supportedCurrencies: ['USD' as CurrencyCode],
    supportedRegions: ['US'],
    supportedCorridors: ['US-SA-USD-SAR'],
    credentialDescriptorRef: descriptor('payments/fixture-bank-us'),
    endpointProfileRef: { profileId: 'ep_fixture-bank-us', sandboxOnly: true, liveEndpoint: false },
    webhookProfileRef: {
      profileId: 'wh_fixture-bank-us',
      signatureRequired: true,
      timestampWindowRequired: true,
      nonceReplayProtection: true,
    },
    settlementReportProfileRef: { profileId: 'sr_fixture-bank-us', isLedgerSourceOfTruth: false },
    dataResidencyRef: { refId: 'res_fixture-bank-us', legalConclusion: false },
    contractEvidenceRef: evidenceRef('ev_fixture-bank-us_contract', 'SERVICE_CONTRACT'),
    licenseRegistrationEvidenceRef: evidenceRef('ev_fixture-bank-us_license', 'LICENSE_REGISTRATION'),
    jurisdictionEvidenceRef: evidenceRef('ev_fixture-bank-us_jurisdiction', 'JURISDICTION'),
    securityEvidenceRef: evidenceRef('ev_fixture-bank-us_security', 'SECURITY_ASSESSMENT'),
    commercialEvidenceRef: evidenceRef('ev_fixture-bank-us_commercial', 'SERVICE_LEVEL_AGREEMENT'),
    state: 'SANDBOX_READY',
    productionAuthorized: false,
  });
}

export function fixtureBankGcc(): BankingProviderCandidateProfile {
  return freezeBankingProviderCandidateProfile({
    providerId: 'fixture-bank-gcc',
    version: 'fixture-bank-gcc/1',
    providerAcceptanceRef: {
      domain: 'BANKING_REFERENCE',
      providerId: 'fixture-bank-gcc',
      recordId: 'acc_fixture-bank-gcc',
    },
    supportedAccountReferenceClasses: ['EXTERNAL_ACCOUNT_ID', 'ACCOUNT_LIFECYCLE'],
    supportedCurrencies: ['SAR' as CurrencyCode, 'USD' as CurrencyCode],
    supportedRegions: ['SA', 'AE'],
    supportedCorridors: ['US-SA-USD-SAR'],
    credentialDescriptorRef: descriptor('payments/fixture-bank-gcc'),
    endpointProfileRef: { profileId: 'ep_fixture-bank-gcc', sandboxOnly: true, liveEndpoint: false },
    webhookProfileRef: {
      profileId: 'wh_fixture-bank-gcc',
      signatureRequired: true,
      timestampWindowRequired: true,
      nonceReplayProtection: true,
    },
    settlementReportProfileRef: { profileId: 'sr_fixture-bank-gcc', isLedgerSourceOfTruth: false },
    dataResidencyRef: { refId: 'res_fixture-bank-gcc', legalConclusion: false },
    contractEvidenceRef: evidenceRef('ev_fixture-bank-gcc_contract', 'SERVICE_CONTRACT'),
    licenseRegistrationEvidenceRef: evidenceRef('ev_fixture-bank-gcc_license', 'LICENSE_REGISTRATION'),
    jurisdictionEvidenceRef: evidenceRef('ev_fixture-bank-gcc_jurisdiction', 'JURISDICTION'),
    securityEvidenceRef: evidenceRef('ev_fixture-bank-gcc_security', 'SECURITY_ASSESSMENT'),
    commercialEvidenceRef: evidenceRef('ev_fixture-bank-gcc_commercial', 'SERVICE_LEVEL_AGREEMENT'),
    state: 'SANDBOX_READY',
    productionAuthorized: false,
  });
}

export function fixtureRailInternational(): PaymentRailProviderCandidateProfile {
  return freezePaymentRailProviderCandidateProfile({
    providerId: 'fixture-rail-international',
    version: 'fixture-rail-international/1',
    railClass: 'INTERNATIONAL_CORRESPONDENT',
    direction: 'OUTBOUND',
    currencies: ['USD' as CurrencyCode, 'SAR' as CurrencyCode],
    sourceJurisdictions: ['US'],
    destinationJurisdictions: ['SA'],
    minimumAmount: Money.fromMinorUnits(1n, 'SAR'),
    maximumAmount: Money.fromMinorUnits(100_000_000n, 'SAR'),
    settlementClass: 'CORRESPONDENT',
    expectedFinalityClass: 'CORRESPONDENT_MULTI_DAY',
    supportsCancellation: true,
    supportsReturns: true,
    supportsInbound: true,
    idempotencyRequired: true,
    queryAfterUnknownRequired: true,
    statusMappingVersion: 'canonical-rail-status/1',
    credentialDescriptorRef: descriptor('payments/fixture-rail-international'),
    webhookProfileRef: {
      profileId: 'wh_fixture-rail-international',
      signatureRequired: true,
      timestampWindowRequired: true,
      nonceReplayProtection: true,
    },
    providerAcceptanceRef: {
      domain: 'PAYMENT_RAIL',
      providerId: 'fixture-rail-international',
      recordId: 'acc_fixture-rail-international',
    },
    state: 'SANDBOX_READY',
    productionAuthorized: false,
    namedNetworkMembershipClaimed: false,
  });
}

export function fixtureRailInternationalFailover(): PaymentRailProviderCandidateProfile {
  return freezePaymentRailProviderCandidateProfile({
    ...fixtureRailInternational(),
    providerId: 'fixture-rail-international-b',
    version: 'fixture-rail-international-b/1',
    credentialDescriptorRef: descriptor('payments/fixture-rail-international-b'),
    providerAcceptanceRef: {
      domain: 'PAYMENT_RAIL',
      providerId: 'fixture-rail-international-b',
      recordId: 'acc_fixture-rail-international-b',
    },
  });
}

export function fixtureFxUsdSar(): FxLiquidityProviderCandidateProfile {
  return freezeFxLiquidityProviderCandidateProfile({
    providerId: 'fixture-fx-usd-sar',
    version: 'fixture-fx-usd-sar/1',
    supportedCurrencyPairs: [{ base: 'USD' as CurrencyCode, quote: 'SAR' as CurrencyCode }],
    quoteTtlMs: 60_000n,
    precision: { maxDecimalPlaces: 6, representation: 'EXACT_RATIONAL' },
    credentialDescriptorRef: descriptor('payments/fixture-fx-usd-sar'),
    endpointProfileRef: { profileId: 'ep_fixture-fx-usd-sar', sandboxOnly: true, liveEndpoint: false },
    priceSourceClass: 'FIXTURE_BOOK',
    liquidityClass: 'FIRM_SANDBOX',
    providerAcceptanceRef: {
      domain: 'FX_LIQUIDITY',
      providerId: 'fixture-fx-usd-sar',
      recordId: 'acc_fixture-fx-usd-sar',
    },
    externalEvidenceRefs: [evidenceRef('ev_fixture-fx-usd-sar', 'DATA_LICENSE_AGREEMENT')],
    state: 'SANDBOX_READY',
    productionAuthorized: false,
  });
}

export function fixtureUsdSarQuote(now: UtcInstant = FIXTURE_NOW): CandidateFxQuote {
  return Object.freeze({
    providerQuoteId: 'fxq_fixture-fx-usd-sar_1',
    sourceTimestamp: now,
    receivedTimestamp: now,
    expiresAt: asUtcInstant('2026-08-20T12:01:00.000Z'),
    pair: { base: 'USD' as CurrencyCode, quote: 'SAR' as CurrencyCode },
    rate: { numerator: 3745n, denominator: 1000n },
    fee: Money.fromMinorUnits(1500n, 'USD'),
    spread: { numerator: 3n, denominator: 1000n },
    rateSource: 'FIXTURE_FX_NOT_LIVE_MARKET',
  });
}

export function fixtureInternationalCapability(): RailCapability {
  return freezeRailCapability({
    capabilityId: 'cap-fixture-rail-international',
    rail: 'INTERNATIONAL_CORRESPONDENT',
    provider: asProviderId('fixture-rail-international'),
    sourceCountries: ['US'],
    destinationCountries: ['SA'],
    supportedCurrencies: ['USD' as CurrencyCode, 'SAR' as CurrencyCode],
    amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
    direction: 'OUTBOUND',
    cancellationSupported: true,
    returnSupported: true,
    expectedSettlementClass: 'CORRESPONDENT',
    available: true,
    connectivity: 'SIMULATION',
    servingLegalEntityId: 'le_solstice_us_inc' as LegalEntityId,
    health: 'AVAILABLE',
    policyCapabilityRef: 'cap-us-sim-cross-border-payment',
    enabled: true,
  });
}
