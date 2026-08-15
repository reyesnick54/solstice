import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import type { Money } from '../../money/src/money.ts';
import {
  asCapabilityId,
  asPolicyCapabilityRef,
  asProviderId,
  type CapabilityId,
  type PolicyCapabilityRef,
  type ProviderId,
} from './rail-ids.ts';
import {
  type ConnectivityMode,
  type RailClass,
  type RailDirection,
  type RailHealthState,
  type SettlementClass,
} from './rail-types.ts';

export const RAIL_CAPABILITY_REGISTRY_VERSION = 'rail-capability-v1';

export type AmountConstraint = {
  readonly minMinorUnits: bigint;
  readonly maxMinorUnits: bigint;
};

export type RailCapability = {
  readonly capabilityId: CapabilityId;
  readonly version: string;
  readonly rail: RailClass;
  readonly provider: ProviderId;
  readonly sourceCountries: readonly string[];
  readonly destinationCountries: readonly string[];
  readonly supportedCurrencies: readonly CurrencyCode[];
  readonly amountConstraints: AmountConstraint;
  readonly direction: RailDirection;
  readonly cancellationSupported: boolean;
  readonly returnSupported: boolean;
  readonly expectedSettlementClass: SettlementClass;
  readonly available: boolean;
  readonly connectivity: ConnectivityMode;
  readonly servingLegalEntityId: LegalEntityId;
  readonly health: RailHealthState;
  readonly policyCapabilityRef: PolicyCapabilityRef;
  readonly enabled: boolean;
};

export type RailCapabilityInput = Omit<RailCapability, 'capabilityId' | 'version' | 'provider' | 'policyCapabilityRef'> & {
  readonly capabilityId: string;
  readonly provider: string;
  readonly policyCapabilityRef: string;
};

/**
 * Capabilities default disabled unless explicitly simulation-enabled.
 * Live connectivity is never implied.
 */
export function freezeRailCapability(input: RailCapabilityInput): RailCapability {
  const connectivity = input.connectivity === 'LIVE' ? 'SIMULATION' : input.connectivity;
  const enabled = input.enabled === true && connectivity === 'SIMULATION';
  return Object.freeze({
    capabilityId: asCapabilityId(input.capabilityId),
    version: RAIL_CAPABILITY_REGISTRY_VERSION,
    rail: input.rail,
    provider: asProviderId(input.provider),
    sourceCountries: Object.freeze([...input.sourceCountries]),
    destinationCountries: Object.freeze([...input.destinationCountries]),
    supportedCurrencies: Object.freeze([...input.supportedCurrencies]),
    amountConstraints: Object.freeze({ ...input.amountConstraints }),
    direction: input.direction,
    cancellationSupported: input.cancellationSupported,
    returnSupported: input.returnSupported,
    expectedSettlementClass: input.expectedSettlementClass,
    available: enabled && input.available && input.health !== 'UNAVAILABLE' && input.health !== 'MAINTENANCE',
    connectivity,
    servingLegalEntityId: input.servingLegalEntityId,
    health: input.health,
    policyCapabilityRef: asPolicyCapabilityRef(input.policyCapabilityRef),
    enabled,
  });
}

export function capabilitySupports(
  capability: RailCapability,
  facts: {
    readonly sourceCountry: string;
    readonly destinationCountry: string;
    readonly currency: string;
    readonly amount: Money;
    readonly direction: 'INBOUND' | 'OUTBOUND';
  },
): string | null {
  if (!capability.enabled) {
    return 'capability_disabled';
  }
  if (capability.connectivity !== 'SIMULATION') {
    return 'live_connectivity_forbidden';
  }
  if (!capability.available || capability.health === 'UNAVAILABLE' || capability.health === 'MAINTENANCE') {
    return 'rail_unavailable';
  }
  if (capability.direction !== 'BOTH' && capability.direction !== facts.direction) {
    return 'direction_unsupported';
  }
  if (!capability.sourceCountries.includes(facts.sourceCountry)) {
    return 'source_country_unsupported';
  }
  if (!capability.destinationCountries.includes(facts.destinationCountry)) {
    return 'destination_country_unsupported';
  }
  if (!capability.supportedCurrencies.includes(facts.currency as CurrencyCode)) {
    return 'currency_unsupported';
  }
  if (facts.amount.minorUnits < capability.amountConstraints.minMinorUnits) {
    return 'amount_below_minimum';
  }
  if (facts.amount.minorUnits > capability.amountConstraints.maxMinorUnits) {
    return 'amount_above_maximum';
  }
  return null;
}

export class RailCapabilityRegistry {
  private readonly rows = new Map<string, RailCapability>();

  constructor(initial: readonly RailCapability[] = []) {
    for (const row of initial) {
      this.rows.set(row.capabilityId, row);
    }
  }

  register(capability: RailCapability): void {
    this.rows.set(capability.capabilityId, capability);
  }

  get(capabilityId: string): RailCapability | undefined {
    return this.rows.get(capabilityId);
  }

  list(): readonly RailCapability[] {
    return [...this.rows.values()];
  }

  findFor(rail: RailClass, provider: string): RailCapability | undefined {
    return [...this.rows.values()].find((row) => row.rail === rail && row.provider === provider);
  }

  withHealth(provider: string, health: RailHealthState): void {
    for (const [id, row] of this.rows) {
      if (row.provider === provider) {
        this.rows.set(
          id,
          freezeRailCapability({
            ...row,
            capabilityId: row.capabilityId,
            provider: row.provider,
            policyCapabilityRef: row.policyCapabilityRef,
            health,
            available: health === 'AVAILABLE' || health === 'DEGRADED',
          }),
        );
      }
    }
  }
}

export function simulationCapabilities(): readonly RailCapability[] {
  return Object.freeze([
    freezeRailCapability({
      capabilityId: 'cap-sim-us-batch',
      rail: 'US_BATCH',
      provider: 'SIMULATED_PROVIDER_US_BATCH',
      sourceCountries: ['US'],
      destinationCountries: ['US'],
      supportedCurrencies: ['USD' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: true,
      returnSupported: true,
      expectedSettlementClass: 'BATCH',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_us_inc' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-us-sim-cross-border-payment',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-us-instant',
      rail: 'US_INSTANT',
      provider: 'SIMULATED_PROVIDER_US_INSTANT',
      sourceCountries: ['US'],
      destinationCountries: ['US'],
      supportedCurrencies: ['USD' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'INSTANT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_us_inc' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-us-sim-cross-border-payment',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-eu-sepa',
      rail: 'EU_SEPA',
      provider: 'SIMULATED_PROVIDER_SEPA',
      sourceCountries: ['DE', 'FR', 'IE', 'NL'],
      destinationCountries: ['DE', 'FR', 'IE', 'NL'],
      supportedCurrencies: ['EUR' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: true,
      returnSupported: true,
      expectedSettlementClass: 'BATCH',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_eu_entity' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-eu-sim-deposit-banking',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-eu-sepa-instant',
      rail: 'EU_SEPA_INSTANT',
      provider: 'SIMULATED_PROVIDER_SEPA_INSTANT',
      sourceCountries: ['DE', 'FR', 'IE', 'NL'],
      destinationCountries: ['DE', 'FR', 'IE', 'NL'],
      supportedCurrencies: ['EUR' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'INSTANT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_eu_entity' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-eu-sim-deposit-banking',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-uk-faster',
      rail: 'UK_FASTER_PAYMENT',
      provider: 'SIMULATED_PROVIDER_UK',
      sourceCountries: ['GB'],
      destinationCountries: ['GB'],
      supportedCurrencies: ['GBP' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'INSTANT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_uk_ltd' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-gb-sim-deposit-banking',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-correspondent',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      provider: 'SIMULATED_PROVIDER_CORRESPONDENT',
      sourceCountries: ['US', 'SA', 'GB', 'AE'],
      destinationCountries: ['US', 'SA', 'GB', 'AE'],
      supportedCurrencies: ['USD' as CurrencyCode, 'SAR' as CurrencyCode, 'GBP' as CurrencyCode, 'AED' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'CORRESPONDENT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_us_inc' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-us-sim-cross-border-payment',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-gcc',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      provider: 'SIMULATED_PROVIDER_GCC',
      sourceCountries: ['US', 'SA'],
      destinationCountries: ['US', 'SA'],
      supportedCurrencies: ['USD' as CurrencyCode, 'SAR' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'CORRESPONDENT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_us_inc' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-us-sim-cross-border-payment',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-sa-domestic',
      rail: 'SA_DOMESTIC',
      provider: 'SIMULATED_PROVIDER_SA',
      sourceCountries: ['SA'],
      destinationCountries: ['SA'],
      supportedCurrencies: ['SAR' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'INSTANT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_sa_entity' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-sa-sim-cross-border-payment',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-ae-domestic',
      rail: 'AE_DOMESTIC',
      provider: 'SIMULATED_PROVIDER_AE',
      sourceCountries: ['AE'],
      destinationCountries: ['AE'],
      supportedCurrencies: ['AED' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'BOTH',
      cancellationSupported: false,
      returnSupported: true,
      expectedSettlementClass: 'INSTANT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_ae_entity' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-ae-sim-deposit-banking',
      enabled: true,
    }),
    freezeRailCapability({
      capabilityId: 'cap-sim-blocked',
      rail: 'INTERNATIONAL_CORRESPONDENT',
      provider: 'SIMULATED_PROVIDER_BLOCKED',
      sourceCountries: ['US'],
      destinationCountries: ['SA'],
      supportedCurrencies: ['SAR' as CurrencyCode],
      amountConstraints: { minMinorUnits: 1n, maxMinorUnits: 100_000_000n },
      direction: 'OUTBOUND',
      cancellationSupported: false,
      returnSupported: false,
      expectedSettlementClass: 'CORRESPONDENT',
      available: true,
      connectivity: 'SIMULATION',
      servingLegalEntityId: 'le_solstice_us_inc' as LegalEntityId,
      health: 'AVAILABLE',
      policyCapabilityRef: 'cap-us-sim-cross-border-payment',
      enabled: false,
    }),
  ]);
}
