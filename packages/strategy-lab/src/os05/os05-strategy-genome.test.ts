import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import {
  STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
  STRATEGY_GENOME_NODE_CATALOG,
  STRATEGY_GENOME_NODE_CATALOG_VERSION,
} from './catalog.ts';
import { buildOs05ExampleStrategyGenome } from './fixtures.ts';
import { computeStrategyGenomeHash, lineageWithoutGenomeHash } from './hash.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion, STRATEGY_GENOME_SCHEMA } from './ids.ts';
import { compileStrategyGenome, GENOME_COMPILER_FORBIDDEN_STAGES } from './pipeline.ts';
import {
  evaluateOs05StrategyGenomeQualification,
  HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED,
} from './qualification.ts';
import { materializeStrategyCapsuleCandidate } from './materialize.ts';
import { validateStrategyGenome } from './validate.ts';
import { attachGenomeHash } from './hash.ts';

describe('HELIOS OS05 — Strategy Genome foundation', () => {
  it('validates example genome and produces stable genomeHash', () => {
    const genome = buildOs05ExampleStrategyGenome();
    const validated = validateStrategyGenome(genome);
    assert.equal(validated.ok, true, !validated.ok ? validated.error.message : '');
    const hashA = computeStrategyGenomeHash({
      ...genome,
      lineage: lineageWithoutGenomeHash(genome.lineage),
    });
    const hashB = computeStrategyGenomeHash({
      ...genome,
      lineage: lineageWithoutGenomeHash(genome.lineage),
    });
    assert.equal(hashA, hashB);
    assert.match(genome.lineage.genomeHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(genome.lineage.parentGenomeIds, []);
    assert.equal(genome.lineage.nodeCatalogVersion, STRATEGY_GENOME_NODE_CATALOG_VERSION);
    assert.equal(genome.lineage.featureManifestVersion, STRATEGY_GENOME_FEATURE_MANIFEST_VERSION);
  });

  it('materializes Strategy Capsule candidate without replacing Strategy Capsule model', () => {
    const genome = buildOs05ExampleStrategyGenome();
    const candidate = materializeStrategyCapsuleCandidate(genome);
    assert.equal(candidate.ok, true, !candidate.ok ? candidate.error.message : '');
    if (!candidate.ok) {
      return;
    }
    assert.equal(candidate.value.liveExecutionForbidden, true);
    assert.equal(candidate.value.simulationOnly, true);
    assert.equal(candidate.value.qualificationState, 'RESEARCH_ONLY');
    assert.match(candidate.value.materialHash, /^[a-f0-9]{64}$/);
    assert.equal(candidate.value.material.decisionRule.ruleType, 'STRATEGY_GENOME_DECLARATIVE');
  });

  it('compiler reaches evaluation/shadow/paper but never live execution', () => {
    const genome = buildOs05ExampleStrategyGenome();
    for (const stage of ['STRATEGY_LAB_EVALUATION', 'SHADOW', 'PAPER'] as const) {
      const plan = compileStrategyGenome(genome, stage);
      assert.equal(plan.ok, true, !plan.ok ? plan.error.message : '');
      if (!plan.ok) {
        return;
      }
      assert.equal(plan.value.liveExecutionPermitted, false);
      assert.ok(plan.value.capsuleCandidate);
    }
    const live = compileStrategyGenome(genome, 'LIVE_EXECUTION');
    assert.equal(live.ok, false);
    if (live.ok) {
      return;
    }
    assert.equal(live.error.code, 'LIVE_EXECUTION_FORBIDDEN');
    assert.deepEqual(GENOME_COMPILER_FORBIDDEN_STAGES, ['LIVE_EXECUTION']);
  });

  it('rejects arbitrary code in genome parameters', () => {
    const base = buildOs05ExampleStrategyGenome();
    const poisoned = attachGenomeHash({
      ...base,
      parameters: Object.freeze({
        ...base.parameters,
        evil: 'eval("hack")',
      }),
      lineage: lineageWithoutGenomeHash(base.lineage),
    });
    const validated = validateStrategyGenome(poisoned);
    assert.equal(validated.ok, false);
    if (validated.ok) {
      return;
    }
    assert.equal(validated.error.code, 'ARBITRARY_CODE_FORBIDDEN');
  });

  it('emits HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED when checks pass', () => {
    const genome = buildOs05ExampleStrategyGenome();
    const candidate = materializeStrategyCapsuleCandidate(genome);
    const paperPlan = compileStrategyGenome(genome, 'PAPER');
    const hashA = computeStrategyGenomeHash({
      ...genome,
      lineage: lineageWithoutGenomeHash(genome.lineage),
    });
    const hashB = computeStrategyGenomeHash({
      ...genome,
      lineage: lineageWithoutGenomeHash(genome.lineage),
    });
    const result = evaluateOs05StrategyGenomeQualification({
      genomeTypesPresent: true,
      nodeCatalogValidated: Object.keys(STRATEGY_GENOME_NODE_CATALOG).length >= 8,
      declarativeNoCodeExecution: validateStrategyGenome(
        attachGenomeHash({
          schema: STRATEGY_GENOME_SCHEMA,
          genomeId: asStrategyGenomeId('sgnm_os05_catalog_probe'),
          version: asStrategyGenomeVersion('v1'),
          name: 'probe',
          hypothesis: 'probe',
          nodes: genome.nodes,
          parameters: genome.parameters,
          lineage: {
            parentGenomeIds: [],
            mutationReason: null,
            createdBy: 'test',
            createdAt: asUtcInstant('2026-11-03T06:00:00.000Z'),
            featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
            nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
          },
        }),
      ).ok,
      genomeHashStable: hashA === hashB,
      lineageFieldsPresent:
        genome.lineage.createdBy.length > 0 &&
        genome.lineage.createdAt.length > 0 &&
        genome.lineage.genomeHash.length > 0,
      exampleGenomeMaterializes: candidate.ok,
      compilerNeverLiveExecution: compileStrategyGenome(genome, 'LIVE_EXECUTION').ok === false,
      capsuleCandidateResearchOnly: candidate.ok ? candidate.value.liveExecutionForbidden : false,
      strategyCapsuleNotReplaced: candidate.ok ? candidate.value.schema.includes('capsule-candidate') : false,
    });
    assert.equal(paperPlan.ok, true);
    assert.equal(result.marker, HELIOS_OS05_STRATEGY_GENOME_FOUNDATION_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });
});
