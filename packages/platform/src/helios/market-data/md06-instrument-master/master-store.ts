/**
 * In-memory InstrumentMaster — reference metadata only.
 */

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA } from './taxonomy.ts';
import type {
  AppendRawBarInput,
  ContractLifecycle,
  CorporateAction,
  InstrumentIdentity,
  InstrumentListing,
  InstrumentMasterSnapshot,
  RawPriceBar,
  TradingSession,
  VenueInstrument,
} from './types.ts';
import { appendRawPriceBar, buildAdjustedResearchSeries, rejectRawBarMutation } from './price-series.ts';

export type InstrumentMasterStore = {
  readonly masterVersion: () => number;
  readonly putIdentity: (row: InstrumentIdentity) => void;
  readonly getIdentity: (instrumentIdentityId: string) => InstrumentIdentity | undefined;
  readonly listIdentities: () => readonly InstrumentIdentity[];
  readonly putListing: (row: InstrumentListing) => void;
  readonly listListings: () => readonly InstrumentListing[];
  readonly resolveListingByTicker: (
    ticker: string,
    venueMic: string,
    asOf: UtcInstant,
    knowableAtCutoff: UtcInstant,
  ) => InstrumentListing | null;
  readonly putVenueInstrument: (row: VenueInstrument) => void;
  readonly listVenueInstruments: () => readonly VenueInstrument[];
  readonly putTradingSession: (row: TradingSession) => void;
  readonly listTradingSessions: () => readonly TradingSession[];
  readonly putCorporateAction: (row: CorporateAction) => void;
  readonly listCorporateActions: () => readonly CorporateAction[];
  readonly putContractLifecycle: (row: ContractLifecycle) => void;
  readonly listContractLifecycles: () => readonly ContractLifecycle[];
  readonly appendRawBar: (input: AppendRawBarInput) => RawPriceBar;
  readonly listRawBars: (instrumentIdentityId: string) => readonly RawPriceBar[];
  readonly rebuildAdjustedResearch: (instrumentIdentityId: string, knowableAtCutoff: UtcInstant) => void;
  readonly listAdjustedBars: (instrumentIdentityId: string) => readonly import('./types.ts').AdjustedResearchBar[];
  readonly snapshot: (sealedAt: UtcInstant) => InstrumentMasterSnapshot;
  readonly restore: (snapshot: InstrumentMasterSnapshot) => void;
};

export function createInstrumentMasterStore(): InstrumentMasterStore {
  let version = 0;
  const identities = new Map<string, InstrumentIdentity>();
  const listings: InstrumentListing[] = [];
  const venueInstruments: VenueInstrument[] = [];
  const tradingSessions: TradingSession[] = [];
  const corporateActions: CorporateAction[] = [];
  const contractLifecycles: ContractLifecycle[] = [];
  const rawBars = new Map<string, RawPriceBar[]>();
  const adjustedByInstrument = new Map<string, import('./types.ts').AdjustedResearchBar[]>();

  const bump = (): void => {
    version += 1;
  };

  return Object.freeze({
    masterVersion: () => version,
    putIdentity(row) {
      identities.set(row.instrumentIdentityId, row);
      bump();
    },
    getIdentity(instrumentIdentityId) {
      return identities.get(instrumentIdentityId);
    },
    listIdentities() {
      return Object.freeze([...identities.values()]);
    },
    putListing(row) {
      listings.push(row);
      bump();
    },
    listListings() {
      return Object.freeze([...listings]);
    },
    resolveListingByTicker(ticker, venueMic, asOf, knowableAtCutoff) {
      const hits = listings.filter((row) => {
        if (row.ticker !== ticker || row.venueMic !== venueMic) return false;
        if (Date.parse(knowableAtCutoff) < Date.parse(row.knowableAt)) return false;
        if (Date.parse(asOf) < Date.parse(row.effectiveFrom)) return false;
        if (row.effectiveTo !== null && Date.parse(asOf) >= Date.parse(row.effectiveTo)) return false;
        return true;
      });
      return hits.length === 1 ? hits[0]! : null;
    },
    putVenueInstrument(row) {
      venueInstruments.push(row);
      bump();
    },
    listVenueInstruments() {
      return Object.freeze([...venueInstruments]);
    },
    putTradingSession(row) {
      tradingSessions.push(row);
      bump();
    },
    listTradingSessions() {
      return Object.freeze([...tradingSessions]);
    },
    putCorporateAction(row) {
      corporateActions.push(row);
      bump();
    },
    listCorporateActions() {
      return Object.freeze([...corporateActions]);
    },
    putContractLifecycle(row) {
      contractLifecycles.push(row);
      bump();
    },
    listContractLifecycles() {
      return Object.freeze([...contractLifecycles]);
    },
    appendRawBar(input) {
      const bar = appendRawPriceBar(rawBars, input);
      bump();
      return bar;
    },
    listRawBars(instrumentIdentityId) {
      return Object.freeze([...(rawBars.get(instrumentIdentityId) ?? [])]);
    },
    rebuildAdjustedResearch(instrumentIdentityId, knowableAtCutoff) {
      const raw = rawBars.get(instrumentIdentityId) ?? [];
      const actions = corporateActions.filter((row) => row.instrumentIdentityId === instrumentIdentityId);
      adjustedByInstrument.set(
        instrumentIdentityId,
        buildAdjustedResearchSeries(raw, actions, knowableAtCutoff),
      );
      bump();
    },
    listAdjustedBars(instrumentIdentityId) {
      return Object.freeze([...(adjustedByInstrument.get(instrumentIdentityId) ?? [])]);
    },
    snapshot(sealedAt) {
      return Object.freeze({
        schema: HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA,
        masterVersion: version,
        identities: Object.freeze([...identities.values()]),
        listings: Object.freeze([...listings]),
        venueInstruments: Object.freeze([...venueInstruments]),
        tradingSessions: Object.freeze([...tradingSessions]),
        corporateActions: Object.freeze([...corporateActions]),
        contractLifecycles: Object.freeze([...contractLifecycles]),
        rawBars: Object.freeze([...rawBars.values()].flat()),
        adjustedBars: Object.freeze([...adjustedByInstrument.values()].flat()),
        sealedAt,
      });
    },
    restore(snapshot) {
      rejectRawBarMutation();
      identities.clear();
      for (const row of snapshot.identities) {
        identities.set(row.instrumentIdentityId, row);
      }
      listings.length = 0;
      listings.push(...snapshot.listings);
      venueInstruments.length = 0;
      venueInstruments.push(...snapshot.venueInstruments);
      tradingSessions.length = 0;
      tradingSessions.push(...snapshot.tradingSessions);
      corporateActions.length = 0;
      corporateActions.push(...snapshot.corporateActions);
      contractLifecycles.length = 0;
      contractLifecycles.push(...snapshot.contractLifecycles);
      rawBars.clear();
      for (const bar of snapshot.rawBars) {
        const list = rawBars.get(bar.instrumentIdentityId) ?? [];
        list.push(bar);
        rawBars.set(bar.instrumentIdentityId, list);
      }
      adjustedByInstrument.clear();
      const byInstrument = new Map<string, import('./types.ts').AdjustedResearchBar[]>();
      for (const bar of snapshot.adjustedBars) {
        const list = byInstrument.get(bar.instrumentIdentityId) ?? [];
        list.push(bar);
        byInstrument.set(bar.instrumentIdentityId, list);
      }
      for (const [id, bars] of byInstrument) {
        adjustedByInstrument.set(id, bars);
      }
      version = snapshot.masterVersion;
    },
  });
}
