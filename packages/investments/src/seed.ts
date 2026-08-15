import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { asInstrumentId, asInstrumentSymbol, asMarketId } from './ids.ts';
import { freezeInstrument, type Instrument } from './instrument.ts';
import { wholeShares } from './quantity.ts';

export const SIM_MARKET_US = asMarketId('SIM-MKT-US');

export const SIM_ETF_1: Instrument = freezeInstrument({
  instrumentId: asInstrumentId('SIM-ETF-1'),
  symbol: asInstrumentSymbol('SIM-ETF-1'),
  displayName: 'Simulated broad-market ETF fixture',
  instrumentType: 'ETF',
  currency: asCurrencyCode('USD'),
  marketId: SIM_MARKET_US,
  status: 'ACTIVE',
  fractionalSupported: false,
  minimumQuantityIncrement: (() => {
    const qty = wholeShares(1n);
    if (!qty.ok) {
      throw new Error(qty.error.message);
    }
    return qty.value;
  })(),
  pricePrecisionMinorDigits: 2n,
  simulation: true,
  listedClaim: 'DETERMINISTIC_FIXTURE',
  createdAt: asUtcInstant('2026-01-01T00:00:00.000Z'),
});

export function seedSimulationInstruments(): readonly Instrument[] {
  return Object.freeze([SIM_ETF_1]);
}
