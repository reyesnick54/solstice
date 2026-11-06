import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildOs05ExampleStrategyGenome } from '../os05/fixtures.ts';
import { attachGenomeHash } from '../os05/hash.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion } from '../os05/ids.ts';

import { evaluateAntiClone } from './anti-clone.ts';
import { computeStrategyBehaviorFingerprint } from './behavior-fingerprint.ts';
import { DEFAULT_EVOL07_ANTI_CLONE_THRESHOLDS, DEFAULT_EVOL07_NOVELTY_WEIGHTS } from './constants.ts';
import { computeStrategySemanticFingerprint, structuralDistance } from './semantic-fingerprint.ts';
import { evaluateEvol07NoveltyEngineQualification, evol07EngineeringQualificationChecks } from './qualification.ts';
import { computeStrategyNoveltyScore } from './novelty-score.ts';
import { emptyPopulationDiversityState, populationArchiveEntryFromGenome, withArchivedEntry } from './population-state.ts';
import { researchSelectionNoveltyReward } from './research-selection.ts';
import { HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED } from './taxonomy.ts';

test('evol07: semantic fingerprint is stable for fixture genome', () => {
  const g = buildOs05ExampleStrategyGenome();
  const a = computeStrategySemanticFingerprint(g);
  const b = computeStrategySemanticFingerprint(g);
  assert.equal(structuralDistance(a, b), 0);
});

test('evol07: novelty score increases when archive is empty vs populated', () => {
  const g = buildOs05ExampleStrategyGenome();
  const behavior = computeStrategyBehaviorFingerprint(g);
  const empty = emptyPopulationDiversityState();
  const nEmpty = computeStrategyNoveltyScore(g, behavior, empty, DEFAULT_EVOL07_NOVELTY_WEIGHTS);
  const entry = populationArchiveEntryFromGenome(g, behavior);
  const populated = withArchivedEntry(empty, entry);
  const nPop = computeStrategyNoveltyScore(g, behavior, populated, DEFAULT_EVOL07_NOVELTY_WEIGHTS);
  assert.ok(nEmpty.nearestNeighborDistance >= nPop.nearestNeighborDistance);
});

test('evol07: anti-clone flags genome redundant copy', () => {
  const g = buildOs05ExampleStrategyGenome();
  const entry = populationArchiveEntryFromGenome(g);
  const state = withArchivedEntry(emptyPopulationDiversityState(), entry);
  const clone = {
    ...g,
    genomeId: asStrategyGenomeId('sgnm_clone_same_structure'),
  };
  const cloneHashed = attachGenomeHash(clone);
  const behaviorClone = computeStrategyBehaviorFingerprint(cloneHashed);
  const outcome = evaluateAntiClone(cloneHashed, state, {
    genomeRedundantMaxDistance: 0.2,
    behaviorRedundantMaxDistance: 0.001,
  });
  assert.equal(outcome.kind, 'GENOME_REDUNDANT');
});

test('evol07: research selection does not reward novelty alone', () => {
  const g = buildOs05ExampleStrategyGenome();
  const novelty = computeStrategyNoveltyScore(
    g,
    computeStrategyBehaviorFingerprint(g),
    emptyPopulationDiversityState(),
    DEFAULT_EVOL07_NOVELTY_WEIGHTS,
  );
  const invalid = researchSelectionNoveltyReward({
    candidateGenome: g,
    behavior: computeStrategyBehaviorFingerprint(g),
    novelty,
    candidateValid: false,
    cohortFitnessRank: 0.2,
  });
  assert.equal(invalid.applied, false);
  const inferior = researchSelectionNoveltyReward({
    candidateGenome: g,
    behavior: computeStrategyBehaviorFingerprint(g),
    novelty,
    candidateValid: true,
    cohortFitnessRank: 0.9,
  });
  assert.equal(inferior.applied, false);
});

test('evol07: engineering qualification passes', () => {
  const root = new URL('../../../..', import.meta.url).pathname;
  const checks = evol07EngineeringQualificationChecks(root);
  const q = evaluateEvol07NoveltyEngineQualification(checks);
  assert.equal(q.qualified, true);
  assert.equal(q.marker, HELIOS_EVOL07_NOVELTY_ENGINE_QUALIFIED);
});

test('evol07: divergent genome is accepted under anti-clone', () => {
  const base = buildOs05ExampleStrategyGenome();
  const divergent = attachGenomeHash({
    ...base,
    genomeId: asStrategyGenomeId('sgnm_evol07_divergent'),
    version: asStrategyGenomeVersion('v2'),
    nodes: [
      ...base.nodes,
      {
        nodeId: 'reg_gate_1',
        kind: 'REGIME_GATE' as const,
        catalogRef: 'regime.trend_filter',
        permittedRegimes: ['RISK_ON'],
        prohibitedRegimes: [],
        params: {},
      },
    ],
    parameters: { ...base.parameters, entryZScore: -2.5 },
  });
  const entry = populationArchiveEntryFromGenome(base);
  const st = withArchivedEntry(emptyPopulationDiversityState(), entry);
  const out = evaluateAntiClone(divergent, st, DEFAULT_EVOL07_ANTI_CLONE_THRESHOLDS);
  assert.equal(out.kind, 'ACCEPT');
});
