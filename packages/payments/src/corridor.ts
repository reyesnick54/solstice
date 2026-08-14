import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import { asCorridorId, type CorridorId } from './ids.ts';

export type CorridorStatus = 'ACTIVE_SIMULATION' | 'DISABLED' | 'RESEARCH_REQUIRED';

export type PaymentCorridor = {
  readonly corridorId: CorridorId;
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly sourceCurrency: CurrencyCode;
  readonly destinationCurrency: CurrencyCode;
  readonly servingLegalEntityId: LegalEntityId;
  readonly policyStatus: 'RESEARCH_REQUIRED';
  readonly simulationStatus: CorridorStatus;
  readonly liveStatus: 'DISABLED';
};

const CORRIDORS: readonly PaymentCorridor[] = [
  corridor('US-SA-USD-SAR', 'US', 'SA', 'USD', 'SAR', 'le_solstice_us_inc', 'ACTIVE_SIMULATION'),
  corridor('SA-US-SAR-USD', 'SA', 'US', 'SAR', 'USD', 'le_solstice_sa_entity', 'ACTIVE_SIMULATION'),
  corridor('US-GB-USD-GBP', 'US', 'GB', 'USD', 'GBP', 'le_solstice_us_inc', 'DISABLED'),
  corridor('GB-US-GBP-USD', 'GB', 'US', 'GBP', 'USD', 'le_solstice_uk_ltd', 'DISABLED'),
  corridor('US-EU-USD-EUR', 'US', 'DE', 'USD', 'EUR', 'le_solstice_us_inc', 'DISABLED'),
  corridor('US-AE-USD-AED', 'US', 'AE', 'USD', 'AED', 'le_solstice_us_inc', 'DISABLED'),
];

function corridor(
  id: string,
  sourceCountry: string,
  destinationCountry: string,
  sourceCurrency: string,
  destinationCurrency: string,
  servingLegalEntityId: string,
  simulationStatus: CorridorStatus,
): PaymentCorridor {
  return Object.freeze({
    corridorId: asCorridorId(id),
    sourceCountry,
    destinationCountry,
    sourceCurrency: sourceCurrency as CurrencyCode,
    destinationCurrency: destinationCurrency as CurrencyCode,
    servingLegalEntityId: servingLegalEntityId as LegalEntityId,
    policyStatus: 'RESEARCH_REQUIRED',
    simulationStatus,
    liveStatus: 'DISABLED',
  });
}

export function listCorridors(): readonly PaymentCorridor[] {
  return CORRIDORS;
}

export function findCorridor(id: string): PaymentCorridor | undefined {
  return CORRIDORS.find((row) => row.corridorId === id);
}

export function findCorridorByPair(
  sourceCountry: string,
  destinationCountry: string,
  sourceCurrency: string,
  destinationCurrency: string,
): PaymentCorridor | undefined {
  return CORRIDORS.find(
    (row) =>
      row.sourceCountry === sourceCountry &&
      row.destinationCountry === destinationCountry &&
      row.sourceCurrency === sourceCurrency &&
      row.destinationCurrency === destinationCurrency,
  );
}

export function corridorIsSimulationEnabled(corridor: PaymentCorridor): boolean {
  return corridor.simulationStatus === 'ACTIVE_SIMULATION' && corridor.liveStatus === 'DISABLED';
}
