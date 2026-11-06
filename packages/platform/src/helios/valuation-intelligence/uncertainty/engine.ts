import { evaluateMedianAssumptionPath, runMonteCarloDcf } from '../val04-probabilistic-dcf/monte-carlo.ts';
import { DEFAULT_VAL04_MONTE_CARLO_PATHS } from '../val04-probabilistic-dcf/taxonomy.ts';
import { attachSobolAttribution, buildMonteCarloAttribution } from './attribution.ts';
import { buildAccountingUncertaintySpread } from './accounting-uncertainty.ts';
import { buildValuationConfidenceEnvelope } from './confidence.ts';
import { buildValuationFragility } from './fragility.ts';
import { buildCrossModelDispersion } from './model-dispersion.ts';
import { buildTerminalValueDependence } from './terminal-dependence.ts';
import {
  DEFAULT_VAL10_SEED,
  HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED,
  VAL10_SOBOL_MIN_PATHS,
  VAL10_UNCERTAINTY_ENGINE_SCHEMA,
} from './taxonomy.ts';
import type { Val10UncertaintyEngineInput, Val10UncertaintyEngineResult, ValuationUncertaintySource } from './types.ts';

export function runVal10UncertaintyEngine(input: Val10UncertaintyEngineInput): Val10UncertaintyEngineResult {
  const seed = input.seed ?? DEFAULT_VAL10_SEED;
  const pathCount = input.monteCarloPaths ?? input.probabilisticDcf.monteCarloPaths ?? DEFAULT_VAL04_MONTE_CARLO_PATHS;
  const dcfInput = Object.freeze({
    ...input.probabilisticDcf,
    seed,
    monteCarloPaths: pathCount,
  });

  const mc = runMonteCarloDcf(dcfInput);
  const representativePath = evaluateMedianAssumptionPath(dcfInput);
  let uncertainty = buildMonteCarloAttribution(mc.paths);
  if (input.enableSobolSensitivity && pathCount >= VAL10_SOBOL_MIN_PATHS) {
    uncertainty = attachSobolAttribution(uncertainty, mc.paths);
  }

  uncertainty = enrichQualitativeSources(uncertainty, input);

  const terminalDependence = buildTerminalValueDependence({
    paths: mc.paths,
    representativePath,
    forecastYears: dcfInput.forecastYears,
  });

  const fragility = buildValuationFragility(dcfInput);
  const accountingSpread = input.accountingStates
    ? buildAccountingUncertaintySpread({ dcf: dcfInput, states: input.accountingStates })
    : null;
  const crossModel = input.crossModelValues ? buildCrossModelDispersion(input.crossModelValues) : null;

  const confidence = buildValuationConfidenceEnvelope({
    uncertainty,
    terminalDependence,
    fragilityIndex: fragility.fragility.index,
    crossModel,
    accountingSpreadRatio: accountingSpread?.spreadRatio ?? null,
    dataQualityFlags: input.dataQualityFlags ?? [],
    entityResolutionFlags: input.entityResolutionFlags ?? [],
    pathCount: mc.paths.length,
  });

  return Object.freeze({
    schema: VAL10_UNCERTAINTY_ENGINE_SCHEMA,
    valuationId: input.valuationId,
    entityLabel: input.entityLabel,
    grantsExecutionAuthority: false,
    researchOnly: true,
    seed,
    pathCount: mc.paths.length,
    uncertainty,
    terminalDependence,
    fragility,
    modelRisk: Object.freeze({
      crossModel,
      accountingSpread,
    }),
    confidence,
    qualificationMarker: HELIOS_VAL10_UNCERTAINTY_ENGINE_QUALIFIED,
  });
}

function enrichQualitativeSources(
  state: import('./types.ts').ValuationUncertaintyState,
  input: Val10UncertaintyEngineInput,
): import('./types.ts').ValuationUncertaintyState {
  const extras: ValuationUncertaintySource[] = [];
  if (input.segmentUncertaintyNotes?.length) {
    extras.push(
      sourceRow('SEGMENT', 0, 0, null, [
        `segment_notes:${input.segmentUncertaintyNotes.length}`,
      ]),
    );
  }
  if (input.macroUncertaintyNotes?.length) {
    extras.push(sourceRow('MACRO', 0, 0, null, [`macro_notes:${input.macroUncertaintyNotes.length}`]));
  }
  if (input.dataQualityFlags?.length) {
    extras.push(sourceRow('DATA_QUALITY', 0, 0, null, [...input.dataQualityFlags]));
  }
  if (input.entityResolutionFlags?.length) {
    extras.push(sourceRow('ENTITY_RESOLUTION', 0, 0, null, [...input.entityResolutionFlags]));
  }
  if (input.accountingStates?.length) {
    extras.push(sourceRow('ACCOUNTING', 0, 0, null, [`accounting_states:${input.accountingStates.length}`]));
  }
  if (input.crossModelValues?.length) {
    extras.push(sourceRow('MODEL_SELECTION', 0, 0, null, [`models:${input.crossModelValues.length}`]));
  }
  if (extras.length === 0) return state;
  return Object.freeze({
    ...state,
    sources: Object.freeze([...state.sources, ...extras]),
  });
}

function sourceRow(
  source: ValuationUncertaintySource['source'],
  varianceShare: number,
  rankCorrelation: number,
  partialRankCorrelation: number | null,
  notes: readonly string[],
): ValuationUncertaintySource {
  return Object.freeze({
    source,
    label: source,
    varianceShare,
    rankCorrelation,
    partialRankCorrelation,
    notes: Object.freeze(notes),
  });
}
