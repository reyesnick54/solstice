/**
 * In-memory instrument master with temporal listing and venue resolution.
 */

import type { UtcInstant } from '@solstice/domain';

import { isEffectiveAt, isKnowableAt } from '../../feature-fabric/entity-resolution/temporal.ts';
import { HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA } from './taxonomy.ts';
import type {
  AdjustedResearchPricePoint,
  CorporateAction,
  ContractLifecycle,
  InstrumentIdentity,
  InstrumentListing,
  InstrumentMaster,
  RawPriceObservation,
  ResolvedListingAt,
  ResolvedVenueMapping,
  TradingSession,
  VenueInstrument,
} from './types.ts';

export type InstrumentMasterStore = {
  readonly putIdentity: (row: InstrumentIdentity) => void;
  readonly getIdentity: (instrumentIdentityId: string) => InstrumentIdentity | undefined;
  readonly putListing: (row: InstrumentListing) => void;
  readonly putVenueInstrument: (row: VenueInstrument) => void;
  readonly putTradingSession: (row: TradingSession) => void;
  readonly putCorporateAction: (row: CorporateAction) => void;
  readonly putContractLifecycle: (row: ContractLifecycle) => void;
  readonly appendRawPrice: (row: RawPriceObservation) => void;
  readonly putAdjustedPoint: (row: AdjustedResearchPricePoint) => void;
  readonly listRawPrices: (instrumentIdentityId: string) => readonly RawPriceObservation[];
  readonly listAdjustedPoints: (instrumentIdentityId: string) => readonly AdjustedResearchPricePoint[];
  readonly resolveListingAt: (input: {
    readonly ticker: string;
    readonly mic: string | null;
    readonly asOf: UtcInstant;
    readonly knowableAtCutoff: UtcInstant;
  }) => ResolvedListingAt;
  readonly resolveVenueInstrument: (input: {
    readonly mic: string;
    readonly exchangeNativeId: string;
    readonly asOf: UtcInstant;
    readonly knowableAtCutoff: UtcInstant;
  }) => ResolvedVenueMapping;
  readonly listCorporateActions: (instrumentIdentityId: string) => readonly CorporateAction[];
  readonly snapshot: () => InstrumentMaster;
};

export function createInstrumentMasterStore(): InstrumentMasterStore {
  const identities = new Map<string, InstrumentIdentity>();
  const listings: InstrumentListing[] = [];
  const venueInstruments: VenueInstrument[] = [];
  const tradingSessions: TradingSession[] = [];
  const corporateActions: CorporateAction[] = [];
  const contractLifecycles: ContractLifecycle[] = [];
  const rawPrices: RawPriceObservation[] = [];
  const adjustedPoints: AdjustedResearchPricePoint[] = [];

  return Object.freeze({
    putIdentity(row) {
      identities.set(row.instrumentIdentityId, Object.freeze({ ...row }));
    },
    getIdentity(id) {
      return identities.get(id);
    },
    putListing(row) {
      listings.push(Object.freeze({ ...row }));
    },
    putVenueInstrument(row) {
      venueInstruments.push(Object.freeze({ ...row }));
    },
    putTradingSession(row) {
      tradingSessions.push(Object.freeze({ ...row }));
    },
    putCorporateAction(row) {
      corporateActions.push(Object.freeze({ ...row }));
    },
    putContractLifecycle(row) {
      contractLifecycles.push(Object.freeze({ ...row }));
    },
    appendRawPrice(row) {
      if (rawPrices.some((existing) => existing.observationId === row.observationId)) {
        return;
      }
      rawPrices.push(Object.freeze({ ...row }));
    },
    putAdjustedPoint(row) {
      adjustedPoints.push(Object.freeze({ ...row }));
    },
    listRawPrices(instrumentIdentityId) {
      return Object.freeze(rawPrices.filter((row) => row.instrumentIdentityId === instrumentIdentityId));
    },
    listAdjustedPoints(instrumentIdentityId) {
      return Object.freeze(adjustedPoints.filter((row) => row.instrumentIdentityId === instrumentIdentityId));
    },
    resolveListingAt(input) {
      const ticker = input.ticker.trim().toUpperCase();
      const matches = listings.filter((row) => {
        if (row.ticker.toUpperCase() !== ticker) return false;
        if (input.mic && row.mic && row.mic !== input.mic) return false;
        return (
          isEffectiveAt(row.effectiveFrom, row.effectiveTo, input.asOf) &&
          isKnowableAt(row.knowableAt, input.knowableAtCutoff)
        );
      });
      if (matches.length === 0) {
        return Object.freeze({
          instrumentIdentityId: '',
          listing: null,
          ticker: null,
          resolutionState: 'UNRESOLVED' as const,
        });
      }
      if (matches.length > 1) {
        return Object.freeze({
          instrumentIdentityId: matches[0]!.instrumentIdentityId,
          listing: matches[0]!,
          ticker,
          resolutionState: 'AMBIGUOUS' as const,
        });
      }
      const hit = matches[0]!;
      return Object.freeze({
        instrumentIdentityId: hit.instrumentIdentityId,
        listing: hit,
        ticker,
        resolutionState: 'RESOLVED' as const,
      });
    },
    resolveVenueInstrument(input) {
      const hits = venueInstruments.filter(
        (row) =>
          row.mic === input.mic &&
          row.exchangeNativeId === input.exchangeNativeId &&
          isEffectiveAt(row.effectiveFrom, row.effectiveTo, input.asOf) &&
          isKnowableAt(row.knowableAt, input.knowableAtCutoff),
      );
      if (hits.length === 0) {
        return Object.freeze({
          instrumentIdentityId: null,
          venueInstrument: null,
          resolutionState: 'UNRESOLVED' as const,
        });
      }
      const hit = hits[0]!;
      return Object.freeze({
        instrumentIdentityId: hit.instrumentIdentityId,
        venueInstrument: hit,
        resolutionState: 'RESOLVED' as const,
      });
    },
    listCorporateActions(instrumentIdentityId) {
      return Object.freeze(corporateActions.filter((row) => row.instrumentIdentityId === instrumentIdentityId));
    },
    snapshot() {
      return Object.freeze({
        schemaVersion: HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA,
        identities: Object.freeze([...identities.values()]),
        listings: Object.freeze([...listings]),
        venueInstruments: Object.freeze([...venueInstruments]),
        tradingSessions: Object.freeze([...tradingSessions]),
        corporateActions: Object.freeze([...corporateActions]),
        contractLifecycles: Object.freeze([...contractLifecycles]),
        grantsExecutionAuthority: false as const,
      });
    },
  });
}
