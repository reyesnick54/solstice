const INSTRUMENT_METADATA: Readonly<
  Record<string, { readonly assetClass: string; readonly displayLabel: string }>
> = Object.freeze({
  'SIM-ETF-1': Object.freeze({ assetClass: 'ETF', displayLabel: 'Sandbox ETF 1' }),
  'SIM-EQ-1': Object.freeze({ assetClass: 'EQUITIES', displayLabel: 'Sandbox Equity 1' }),
  USD: Object.freeze({ assetClass: 'CASH', displayLabel: 'US Dollar' }),
});

export function resolveInstrumentMetadata(instrumentId: string): {
  readonly assetClass: string;
  readonly displayLabel: string;
} {
  return (
    INSTRUMENT_METADATA[instrumentId] ?? Object.freeze({ assetClass: 'UNKNOWN', displayLabel: instrumentId })
  );
}
