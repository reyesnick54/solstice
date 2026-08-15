import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { InstrumentId, InstrumentSymbol, MarketId } from './ids.ts';
import type { InstrumentStatus, InstrumentType } from './types.ts';
import { QUANTITY_SCALE, type InvestmentQuantity } from './quantity.ts';

export type Instrument = {
  readonly instrumentId: InstrumentId;
  readonly symbol: InstrumentSymbol;
  readonly displayName: string;
  readonly instrumentType: InstrumentType;
  readonly currency: CurrencyCode;
  readonly marketId: MarketId;
  readonly status: InstrumentStatus;
  readonly fractionalSupported: boolean;
  readonly minimumQuantityIncrement: InvestmentQuantity;
  readonly pricePrecisionMinorDigits: bigint;
  readonly simulation: true;
  readonly listedClaim: 'DETERMINISTIC_FIXTURE';
  readonly createdAt: UtcInstant;
};

export function freezeInstrument(instrument: Instrument): Instrument {
  if (instrument.simulation !== true) {
    throw new Error('live instrument listings are not permitted in this chunk');
  }
  if (instrument.minimumQuantityIncrement.scale !== QUANTITY_SCALE) {
    throw new Error('instrument increment scale must be 8');
  }
  if (
    instrument.instrumentType !== 'EQUITY' &&
    instrument.instrumentType !== 'ETF' &&
    instrument.instrumentType !== 'BOND' &&
    instrument.instrumentType !== 'FUND' &&
    instrument.instrumentType !== 'CASH_EQUIVALENT'
  ) {
    throw new Error('derivatives and digital assets are not permitted on this path');
  }
  return Object.freeze({ ...instrument });
}
