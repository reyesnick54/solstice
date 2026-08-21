import {
  CANONICAL_SIMULATION_CURRENCIES,
  CURRENCY_REGISTRY,
  currencyRecord,
  type CanonicalSimulationCurrency,
  type CurrencyRecord,
} from '../../domain/src/currency.ts';

/**
 * Productized currency catalog for the FX engine.
 * Presence of metadata does not imply live capability.
 */
export type SupportedCurrency = {
  readonly code: CanonicalSimulationCurrency;
  readonly isoNumeric: string;
  readonly name: string;
  readonly minorUnitExponent: number;
  readonly symbol: string;
  readonly enabled: boolean;
  readonly depositAvailable: boolean;
  readonly withdrawalAvailable: boolean;
  readonly fxAvailable: boolean;
  readonly liveEnabled: false;
  readonly liveDepositAvailable: false;
  readonly liveWithdrawalAvailable: false;
  readonly liveFxAvailable: false;
  readonly supportedLegalEntityIds: readonly string[];
  readonly restrictedProductIds: readonly string[];
  readonly restrictedJurisdictions: readonly string[];
  readonly status: CurrencyRecord['status'];
};

export function listSupportedCurrencies(): readonly SupportedCurrency[] {
  return CANONICAL_SIMULATION_CURRENCIES.map((code) => projectCurrency(CURRENCY_REGISTRY[code]));
}

export function getSupportedCurrency(code: string): SupportedCurrency | undefined {
  const record = currencyRecord(code);
  return record ? projectCurrency(record) : undefined;
}

export function currencyAllowsFx(code: string): boolean {
  const record = currencyRecord(code);
  return record?.simulation.fxAvailable === true && record.live.fxAvailable === false;
}

export function currencyAllowsDeposit(code: string): boolean {
  const record = currencyRecord(code);
  return record?.simulation.depositAvailable === true && record.live.depositAvailable === false;
}

export function currencyAllowsWithdrawal(code: string): boolean {
  const record = currencyRecord(code);
  return record?.simulation.withdrawalAvailable === true && record.live.withdrawalAvailable === false;
}

function projectCurrency(record: CurrencyRecord): SupportedCurrency {
  return Object.freeze({
    code: record.code as CanonicalSimulationCurrency,
    isoNumeric: record.isoNumeric,
    name: record.name,
    minorUnitExponent: record.minorUnitExponent,
    symbol: record.display.symbol,
    enabled: record.simulation.enabled,
    depositAvailable: record.simulation.depositAvailable,
    withdrawalAvailable: record.simulation.withdrawalAvailable,
    fxAvailable: record.simulation.fxAvailable,
    liveEnabled: false,
    liveDepositAvailable: false,
    liveWithdrawalAvailable: false,
    liveFxAvailable: false,
    supportedLegalEntityIds: record.supportedLegalEntityIds,
    restrictedProductIds: record.restrictedProductIds,
    restrictedJurisdictions: record.restrictedJurisdictions,
    status: record.status,
  });
}
