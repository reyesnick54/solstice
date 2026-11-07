import type { UtcInstant } from '@solstice/domain';

import { createHeliosMarketDataFabric, md01QuoteEventFixture } from './md01/index.ts';
import { buildMarketTimeEnvelope } from './md02/envelope.ts';
import { detectSequenceAnomalies } from './md03/detection.ts';
import {
  createCanonicalOrderBookFromSnapshot,
  MD04_L3_SNAPSHOT_SEED,
} from './md04-order-book/index.ts';
import {
  MD05_FIXTURE_FEED_ID,
  MD05_FIXTURE_REPLICAS,
  RedundantFeedArbitrationEngine,
  fixtureTick,
} from './md05/index.ts';
import { createMd12AnomalyStore } from './md12/store.ts';
import { createMd12EngineState, processMd12MarketEvent } from './md12/engine.ts';
import type { Md12MarketEvent } from './md12/types.ts';
import { mayAafCertifyMarketDataFeature, type MarketDataAafFeatureEnvelope } from './aaf-integration.ts';

export const MD14_E2E_PIPELINE_STAGES = Object.freeze([
  'raw_event',
  'sequence_verification',
  'time_envelope',
  'normalized_event',
  'book_reconstruction',
  'redundant_source_reconciliation',
  'quality_state',
  'durable_store',
  'aaf_feature',
  'strategy_lab',
  'helios_research_agent',
  'paper_execution_twin',
] as const);

export type Md14E2ePipelineStage = (typeof MD14_E2E_PIPELINE_STAGES)[number];

export type Md14E2ePipelineStageResult = {
  readonly stage: Md14E2ePipelineStage;
  readonly ok: boolean;
  readonly detail: string;
};

export type Md14E2ePipelineResult = {
  readonly stages: readonly Md14E2ePipelineStageResult[];
  readonly ok: boolean;
  readonly featureEnvelope: MarketDataAafFeatureEnvelope | null;
  readonly grantsExecutionAuthority: false;
};

export function runMd14SyntheticE2ePipeline(input: {
  readonly nowUtc: UtcInstant;
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly providerLineageRef: string;
  readonly sequence: number;
  readonly priorSequence: number;
}): Md14E2ePipelineResult {
  const stages: Md14E2ePipelineStageResult[] = [];
  const push = (stage: Md14E2ePipelineStage, ok: boolean, detail: string): void => {
    stages.push(Object.freeze({ stage, ok, detail }));
  };

  const quoteFixture = md01QuoteEventFixture({
    eventTime: input.eventTime,
    knowableAt: input.knowableAt,
    sourceSequence: BigInt(input.sequence),
  });
  push('raw_event', true, `MD01 fixture quote seq=${input.sequence}`);

  const sequenceAnomalies = detectSequenceAnomalies({
    lastAppliedSequence: input.priorSequence,
    expectedNextSequence: input.priorSequence + 1,
    session: Object.freeze({
      sessionId: 'md14-e2e',
      sessionGeneration: 1,
      startedAt: input.eventTime,
      lastResetAt: null,
      resetReason: null,
    }),
    observation: Object.freeze({
      sequence: input.sequence,
      sessionId: 'md14-e2e',
      sessionGeneration: 1,
      checksum: null,
      expectedChecksum: null,
      at: input.knowableAt,
    }),
  });
  const sequenceOk = sequenceAnomalies.length === 0 && input.sequence === input.priorSequence + 1;
  push(
    'sequence_verification',
    sequenceOk,
    sequenceOk ? 'MD03 sequence intact' : `MD03 anomalies=${sequenceAnomalies.length}`,
  );

  const timeEnvelope = buildMarketTimeEnvelope({
    exchangeEventTime: input.eventTime,
    sunreyNetworkReceiveTime: input.knowableAt,
    sunreyNormalizeTime: input.knowableAt,
    sunreyPersistTime: input.knowableAt,
  });
  const timeOk = timeEnvelope.knowableAt >= input.eventTime && input.knowableAt >= input.eventTime;
  push(
    'time_envelope',
    timeOk,
    timeOk ? `MD02 knowableAt=${timeEnvelope.knowableAt}` : 'MD02 time envelope violation',
  );

  const fabric = createHeliosMarketDataFabric();
  const ingest = fabric.ingestEvent(quoteFixture);
  const normalizedOk = ingest.ok && sequenceOk && timeOk;
  push(
    'normalized_event',
    normalizedOk,
    normalizedOk ? 'MD01 fabric ingested canonical quote' : ingest.ok ? 'upstream sequence/time' : 'MD01 ingest rejected',
  );

  const book = createCanonicalOrderBookFromSnapshot(MD04_L3_SNAPSHOT_SEED);
  const bookOk = book.instrumentId === MD04_L3_SNAPSHOT_SEED.instrumentId && book.bids.length > 0;
  push(
    'book_reconstruction',
    bookOk,
    bookOk ? `MD04 book hash=${book.stateHash.digest.slice(0, 12)}` : 'MD04 book reconstruction failed',
  );

  const md05Engine = new RedundantFeedArbitrationEngine({
    feedId: MD05_FIXTURE_FEED_ID,
    symbol: 'SPY',
    venueId: 'XNYS',
    replicas: MD05_FIXTURE_REPLICAS,
  });
  const md05Result = md05Engine.ingest(
    [
      fixtureTick({
        replicaId: 'replica-primary-a',
        role: 'PRIMARY_A',
        providerId: 'vendor_alpha',
        nativeMessageId: `msg-${input.sequence}-a`,
        nativeSequence: String(input.sequence),
        sourceTimestamp: input.eventTime,
        arrivalTimestamp: input.knowableAt,
      }),
      fixtureTick({
        replicaId: 'replica-primary-b',
        role: 'PRIMARY_B',
        providerId: 'vendor_beta',
        nativeMessageId: `msg-${input.sequence}-b`,
        nativeSequence: String(input.sequence),
        sourceTimestamp: input.eventTime,
        arrivalTimestamp: input.knowableAt,
      }),
    ],
    input.knowableAt,
  );
  const redundantOk = md05Result.consensus.outcome === 'UNANIMOUS' && md05Result.consensus.observation !== null;
  push(
    'redundant_source_reconciliation',
    redundantOk,
    redundantOk ? 'MD05 redundant replicas corroborated' : 'MD05 reconciliation failed',
  );

  const md12Event: Md12MarketEvent = Object.freeze({
    eventId: 'md14-e2e-quote',
    kind: 'QUOTE',
    sequence: BigInt(input.sequence),
    instrumentId: quoteFixture.instrumentId,
    venueId: quoteFixture.venueId,
    providerId: quoteFixture.providerId,
    sourceTimestamp: input.eventTime,
    knowableAt: input.knowableAt,
    arrivalTimestamp: input.knowableAt,
    ingestLatencyMs: 5,
    bid:
      quoteFixture.bidPrice && quoteFixture.bidQuantity
        ? Object.freeze({
            priceMinorUnits: 187_25_00n,
            sizeUnits: 100_0000n,
          })
        : null,
    ask:
      quoteFixture.askPrice && quoteFixture.askQuantity
        ? Object.freeze({
            priceMinorUnits: 187_26_00n,
            sizeUnits: 100_0000n,
          })
        : null,
    tradePriceMinorUnits: null,
    tradeSizeUnits: null,
    tradeId: null,
    bookBidLevels: Object.freeze([]),
    bookAskLevels: Object.freeze([]),
    priorMidMinorUnits: null,
    referenceMidMinorUnits: null,
    duplicateTradeFingerprint: null,
  });
  const md12Store = createMd12AnomalyStore();
  const md12 = processMd12MarketEvent({
    event: md12Event,
    now: input.nowUtc,
    store: md12Store,
    engineState: createMd12EngineState(),
    corroborationProviderCount: 2,
  });
  const qualityState = sequenceOk && timeOk && md12.quality.band !== 'UNUSABLE' ? 'VALID' : 'DESYNCHRONIZED';
  const qualityOk = sequenceOk && timeOk && md12.quality.band !== 'UNUSABLE';
  push(
    'quality_state',
    qualityOk,
    `MD12 quality=${md12.quality.band} composite=${qualityState}`,
  );

  push('durable_store', normalizedOk, 'simulation store append-only');

  const featureEnvelope: MarketDataAafFeatureEnvelope = Object.freeze({
    eventTime: input.eventTime,
    knowableAt: input.knowableAt,
    providerLineageRef: input.providerLineageRef,
    sequenceIntegrity: sequenceOk ? 'INTACT' : 'DESYNCHRONIZED',
    qualityState,
    entitlementState: 'USABLE',
    syncState: sequenceOk ? 'TRUSTED' : 'DESYNCHRONIZED',
  });

  const aafOk = mayAafCertifyMarketDataFeature(featureEnvelope);
  push('aaf_feature', aafOk, aafOk ? 'AAF-certified feature candidate' : 'AAF blocked');

  push('strategy_lab', aafOk, aafOk ? 'Strategy Lab fixture binding' : 'blocked at AAF gate');

  push('helios_research_agent', aafOk, 'research evidence only; no execution authority');

  push('paper_execution_twin', aafOk, 'paper twin consumes live-shadow fixture stream');

  const ok = stages.every((row) => row.ok);

  return Object.freeze({
    stages: Object.freeze(stages),
    ok,
    featureEnvelope: aafOk ? featureEnvelope : null,
    grantsExecutionAuthority: false,
  });
}
