import type { UtcInstant } from '@solstice/domain';

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

  push('raw_event', true, `fixture raw seq=${input.sequence}`);

  const sequenceOk = input.sequence === input.priorSequence + 1;
  push(
    'sequence_verification',
    sequenceOk,
    sequenceOk ? 'sequence intact' : 'sequence gap detected',
  );

  const timeOk = input.knowableAt >= input.eventTime;
  push('time_envelope', timeOk, timeOk ? 'knowableAt >= eventTime' : 'time envelope violation');

  push('normalized_event', sequenceOk && timeOk, 'canonical instrument + normalized payload');

  push('book_reconstruction', true, 'deterministic L2 snapshot from normalized quotes');

  push('redundant_source_reconciliation', true, 'primary corroborated by secondary fixture source');

  const qualityState = sequenceOk && timeOk ? 'VALID' : 'DESYNCHRONIZED';
  push('quality_state', sequenceOk && timeOk, `quality=${qualityState}`);

  push('durable_store', true, 'simulation store append-only');

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
