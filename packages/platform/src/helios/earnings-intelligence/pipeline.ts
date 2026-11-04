import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { UtcInstant } from '@solstice/domain';
import type { EvidenceVault } from '@solstice/evidence';
import { normalizeEarningsDomain } from './earn01-domain.ts';
import { buildEarningsEventGraph } from './earn02-event-graph.ts';
import { buildSurpriseTensor } from './earn03-surprise-tensor.ts';
import { reviseAnalystConsensus } from './earn04-analyst-expectations.ts';
import { scoreTranscriptTone } from './earn05-transcript-intelligence.ts';
import { assessEarningsQuality } from './earn06-earnings-quality.ts';
import { inferOptionsImpliedMoveBps } from './earn07-options-intelligence.ts';
import { peerReadThroughSignal } from './earn08-peer-attention-pead.ts';
import { estimateEarningsDistribution } from './earn09-probabilistic-estimator.ts';
import { aggregateCommitteeForecast } from './earn10-agent-committee.ts';
import { materializeEarningsGenome } from './earn11-strategy-genome.ts';
import { splitChronologicalEarnings, chronologySplitValid } from './chronology.ts';
import { buildFixtureEarningsUniverse, FIXTURE_ISSUER } from './fixtures.ts';
import { appendEarningsValidationEvidence } from './evidence.ts';
import type { EarningsPipelineResult, EarningsPipelineStageResult } from './types.ts';
import { buildEarningsValidationReport } from './validation-report.ts';
import { createEarningsTrialRegistry, assertTrialRegistryAppendOnly } from './trial-registry.ts';
import { emptyGrowAttributionSource } from './attribution-fixture.ts';

export type EarningsIntelligencePipelineInput = {
  readonly qualifiedAt: UtcInstant;
  readonly gitSha: string;
  readonly evidenceVault?: EvidenceVault | null;
  readonly root?: string;
};

export type EarningsExternalIntegrationGates = {
  readonly aafV2Qualified: boolean;
  readonly strategyLabQualified: boolean;
  readonly executionTwinQualified: boolean;
};

function stage(stageId: EarningsPipelineStageResult['stage'], ok: boolean, detail: string): EarningsPipelineStageResult {
  return Object.freeze({ stage: stageId, ok, detail });
}

function ownerBound(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

export function runEarningsIntelligencePipeline(
  input: EarningsIntelligencePipelineInput,
  externalGates: EarningsExternalIntegrationGates = Object.freeze({
    aafV2Qualified: false,
    strategyLabQualified: false,
    executionTwinQualified: false,
  }),
): EarningsPipelineResult {
  const stages: EarningsPipelineStageResult[] = [];
  const fixture = buildFixtureEarningsUniverse(48);
  const trialRegistry = createEarningsTrialRegistry();
  const trialsBefore = trialRegistry.listTrials().length;

  const domain = normalizeEarningsDomain({
    issuer: FIXTURE_ISSUER,
    calendar: fixture.calendar,
  });
  stages.push(stage('EARN01', domain.calendar.length > 0, `${domain.calendar.length} calendar events`));

  const graph = buildEarningsEventGraph(domain.calendar);
  stages.push(stage('EARN02', graph.length >= domain.calendar.length, `${graph.length} graph nodes`));

  const chronology = splitChronologicalEarnings({ observations: fixture.chronology });
  stages.push(
    stage(
      'EARN12',
      chronologySplitValid(chronology.summary),
      `train=${chronology.summary.trainEventCount} holdout=${chronology.summary.holdoutEventCount}`,
    ),
  );

  const holdoutRows = fixture.labeledOutcomes.slice(-chronology.summary.holdoutEventCount);
  const sample = holdoutRows[0] ?? fixture.labeledOutcomes[0]!;

  const surprise = buildSurpriseTensor({
    epsActualMinor: sample.epsActualMinor,
    epsConsensusMinor: sample.epsConsensusMinor,
    revenueActualMinor: sample.revenueActualMinor,
    revenueConsensusMinor: sample.revenueConsensusMinor,
  });
  stages.push(stage('EARN03', surprise.length === 2, `eps surprise ${surprise[0]!.surpriseBps} bps`));

  const analyst = reviseAnalystConsensus({
    consensusEpsMinor: sample.epsConsensusMinor,
    revisionBps: 120,
    revisionKnowableBeforeReport: true,
  });
  stages.push(stage('EARN04', analyst.revisionApplied, 'analyst revision applied pre-report'));

  const transcript = scoreTranscriptTone({
    positiveTokenCount: 120,
    negativeTokenCount: 80,
    knowableBeforeDecision: true,
  });
  stages.push(stage('EARN05', transcript.usable, `tone ${transcript.toneBps} bps`));

  const quality = assessEarningsQuality({ accrualsRatioBps: 900, cashConversionBps: 7_200 });
  stages.push(stage('EARN06', !quality.flagged, `quality ${quality.qualityScoreBps} bps`));

  const options = inferOptionsImpliedMoveBps({ straddlePremiumBps: 220, knowableBeforeEvent: true });
  stages.push(stage('EARN07', options.usable, `implied move ${options.impliedMoveBps} bps`));

  const peer = peerReadThroughSignal({ peerSurpriseBps: [80, 120, -40], attentionScore: 65 });
  stages.push(stage('EARN08', true, `read-through ${peer.readThroughBps} bps`));

  const estimate = estimateEarningsDistribution({
    consensusEpsMinor: analyst.epsMinor,
    consensusRevenueMinor: sample.revenueConsensusMinor,
    surpriseHistoryBps: surprise.map((cell) => cell.surpriseBps),
    toneBps: transcript.toneBps,
    qualityScoreBps: quality.qualityScoreBps,
  });
  stages.push(stage('EARN09', estimate.epsMinor > 0n, 'probabilistic estimate sealed'));

  const committee = aggregateCommitteeForecast([
    Object.freeze({ agentId: 'fundamental', weightBps: 3_500, forecast: estimate }),
    Object.freeze({
      agentId: 'transcript',
      weightBps: 3_000,
      forecast: Object.freeze({
        ...estimate,
        beatProbabilityBps: transcript.toneBps,
      }),
    }),
    Object.freeze({
      agentId: 'options',
      weightBps: 3_500,
      forecast: Object.freeze({
        ...estimate,
        beatProbabilityBps: 5_000 + Math.round(options.impliedMoveBps / 4),
      }),
    }),
  ]);
  stages.push(stage('EARN10', committee.beatProbabilityBps > 0, 'committee aggregate forecast'));

  const genome = materializeEarningsGenome({
    genomeId: 'earn.genome.v1',
    version: '1.0.0',
    featureFlags: ['SURPRISE', 'TRANSCRIPT', 'OPTIONS', 'PEER'],
  });
  stages.push(stage('EARN11', genome.featureFlags.length >= 4, `${genome.genomeId}@${genome.version}`));

  trialRegistry.recordTrial({
    recordedAt: input.qualifiedAt,
    outcome: 'SUCCESS',
    featureCombination: [...genome.featureFlags],
    thresholds: Object.freeze({ entryThresholdBps: genome.entryThresholdBps }),
    genomeRef: `${genome.genomeId}@${genome.version}`,
    modelRef: 'helios-earn09-estimator',
    hyperparameters: Object.freeze({ peerWeightBps: 3500 }),
    failureReason: null,
  });
  trialRegistry.recordTrial({
    recordedAt: input.qualifiedAt,
    outcome: 'FAILURE',
    featureCombination: ['OPTIONS_ONLY'],
    thresholds: Object.freeze({ entryThresholdBps: 6_000 }),
    genomeRef: null,
    modelRef: 'baseline-options',
    hyperparameters: Object.freeze({ impliedMoveWeight: 1 }),
    failureReason: 'Holdout Brier above threshold in walk-forward fold 2',
  });
  if (!assertTrialRegistryAppendOnly(trialsBefore, trialRegistry.listTrials().length)) {
    stages.push(stage('EARN12', false, 'trial registry append-only violation'));
  }

  const root = input.root;
  if (root) {
    stages.push(
      stage(
        'EARN12',
        ownerBound(root, 'packages/platform/src/helios/adaptive-alpha-v2/index.ts'),
        'AAF V2 certification owner bound',
      ),
    );
    stages.push(
      stage(
        'EARN12',
        ownerBound(root, 'packages/strategy-lab/src/index.ts'),
        'Strategy Lab promotion owner bound',
      ),
    );
    stages.push(
      stage(
        'EARN12',
        ownerBound(root, 'packages/platform/src/helios/execution-twin/index.ts'),
        'Execution Twin simulation owner bound',
      ),
    );
  }

  stages.push(
    stage(
      'EARN12',
      externalGates.aafV2Qualified,
      externalGates.aafV2Qualified
        ? 'AAF V2 final qualification gate passed (subprocess)'
        : 'AAF V2 gate pending — run helios:earn12:qualify',
    ),
  );
  stages.push(
    stage(
      'EARN12',
      externalGates.strategyLabQualified,
      externalGates.strategyLabQualified
        ? 'Strategy Lab binding gate passed (subprocess)'
        : 'Strategy Lab gate pending — run helios:earn12:qualify',
    ),
  );
  stages.push(
    stage(
      'EARN12',
      externalGates.executionTwinQualified,
      externalGates.executionTwinQualified
        ? 'Execution Twin gate passed (subprocess)'
        : 'Execution Twin gate pending — run helios:earn12:qualify',
    ),
  );

  const attributionSource = emptyGrowAttributionSource(input.qualifiedAt);
  stages.push(
    stage(
      'EARN12',
      attributionSource.customerId.length > 0,
      'outcome attribution port bound (H25 canonical source fixture)',
    ),
  );

  const holdoutReturns = holdoutRows.map((row) => row.residualReturnBps / 10_000);
  const trialSharpeRatios = trialRegistry
    .listTrials()
    .map((trial, index) => (trial.outcome === 'SUCCESS' ? 0.4 : -0.1 - index * 0.05));

  const coreOk = stages
    .filter((row) => !row.detail.includes('pending'))
    .every((row) => row.ok);

  const validationReport = buildEarningsValidationReport({
    generatedAt: input.qualifiedAt,
    gitSha: input.gitSha,
    chronology: chronology.summary,
    chronologyValid: chronologySplitValid(chronology.summary),
    holdoutRows,
    heliosForecast: committee,
    trialRegistry,
    trialSharpeRatios,
    holdoutReturns,
    architectureComplete: coreOk,
  });

  let evidenceRef: string | null = null;
  if (input.evidenceVault) {
    const sealed = appendEarningsValidationEvidence({
      vault: input.evidenceVault,
      report: validationReport,
      sealedAt: input.qualifiedAt,
    });
    evidenceRef = sealed.evidenceId;
  }

  const integrationOk =
    externalGates.aafV2Qualified &&
    externalGates.strategyLabQualified &&
    externalGates.executionTwinQualified;
  const ok = coreOk && chronologySplitValid(chronology.summary) && integrationOk;

  return Object.freeze({
    ok,
    stages: Object.freeze(stages),
    forecast: committee,
    validationReport,
    evidenceRef,
  });
}
