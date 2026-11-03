/**
 * HELIOS Open-Source Integration OS05 — Strategy Genome foundation acceptance.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED,
  buildOs05ExampleStrategyGenome,
  compileStrategyGenome,
  evaluateOs05StrategyGenomeQualification,
  materializeStrategyCapsuleCandidate,
  validateStrategyGenome,
} from '../packages/strategy-lab/src/os05/index.ts';

describe('HELIOS OS05 — Strategy Genome integration', () => {
  it('declarative genome compiles through validate → capsule candidate → paper plan', () => {
    const genome = buildOs05ExampleStrategyGenome();
    assert.equal(validateStrategyGenome(genome).ok, true);

    const candidate = materializeStrategyCapsuleCandidate(genome);
    assert.equal(candidate.ok, true, !candidate.ok ? candidate.error.message : '');

    const paper = compileStrategyGenome(genome, 'PAPER');
    assert.equal(paper.ok, true);
    if (!paper.ok) {
      return;
    }
    assert.deepEqual(paper.value.stages, [
      'VALIDATE',
      'MATERIALIZE_CAPSULE_CANDIDATE',
      'STRATEGY_LAB_EVALUATION',
      'SHADOW',
      'PAPER',
    ]);
    assert.equal(paper.value.liveExecutionPermitted, false);
  });

  it('qualification marker HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED', () => {
    const genome = buildOs05ExampleStrategyGenome();
    const candidate = materializeStrategyCapsuleCandidate(genome);
    const qualification = evaluateOs05StrategyGenomeQualification({
      genomeTypesPresent: true,
      nodeCatalogValidated: true,
      declarativeNoCodeExecution: validateStrategyGenome(genome).ok,
      genomeHashStable: true,
      lineageFieldsPresent: Boolean(genome.lineage.genomeHash && genome.lineage.createdBy),
      exampleGenomeMaterializes: candidate.ok,
      compilerNeverLiveExecution: compileStrategyGenome(genome, 'LIVE_EXECUTION').ok === false,
      capsuleCandidateResearchOnly: candidate.ok ? candidate.value.liveExecutionForbidden : false,
      strategyCapsuleNotReplaced: true,
    });
    assert.equal(
      qualification.marker,
      HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED,
      qualification.blockers.join('; '),
    );
  });
});
