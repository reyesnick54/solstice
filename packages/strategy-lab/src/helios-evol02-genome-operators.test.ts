import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { STRATEGY_GENOME_NODE_CATALOG } from './os05/catalog.ts';
import { attachGenomeHash, computeStrategyGenomeHash, lineageWithoutGenomeHash } from './os05/hash.ts';
import { buildOs05ExampleStrategyGenome } from './os05/fixtures.ts';
import { validateStrategyGenome } from './os05/validate.ts';
import {
  CANONICAL_RISK_ENGINE_CATALOG_REF,
  EVOLUTION_ENGINE_VERSION,
  HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED,
  crossoverStrategyGenomes,
  evaluateEvolutionOperatorsQualification,
  mutateStrategyGenome,
} from './evolution/operators/index.ts';

const FIXED_TIME = '2026-11-03T12:00:00.000Z';

describe('HELIOS EVOL02 — genome evolution operators', () => {
  it('mutates with schema validation and records lineage fields', () => {
    const base = buildOs05ExampleStrategyGenome();
    const out = mutateStrategyGenome({
      genome: base,
      family: 'PARAMETER_MUTATION',
      randomSeed: 'seed-a',
      createdAt: FIXED_TIME,
    });
    assert.equal(out.ok, true, !out.ok ? out.error.message : '');
    if (!out.ok) {
      return;
    }
    const g = out.value;
    assert.equal(validateStrategyGenome(g).ok, true);
    assert.deepEqual(g.lineage.parentGenomeIds, [base.genomeId]);
    assert.equal(g.lineage.operator, 'PARAMETER_MUTATION');
    assert.equal(g.lineage.operatorVersion, EVOLUTION_ENGINE_VERSION);
    assert.equal(g.lineage.randomSeed, 'seed-a');
    assert.equal(g.lineage.mutationReason, 'mutation:PARAMETER_MUTATION');
    assert.equal(g.lineage.featureManifestVersion, base.lineage.featureManifestVersion);
    assert.equal(g.lineage.nodeCatalogVersion, base.lineage.nodeCatalogVersion);
  });

  it('same parents + seed + operator version produces the same child (deterministic)', () => {
    const base = buildOs05ExampleStrategyGenome();
    const mutA = mutateStrategyGenome({
      genome: base,
      family: 'FEATURE_SUBSTITUTION',
      randomSeed: 'repro-1',
      createdAt: FIXED_TIME,
    });
    const mutB = mutateStrategyGenome({
      genome: base,
      family: 'FEATURE_SUBSTITUTION',
      randomSeed: 'repro-1',
      createdAt: FIXED_TIME,
    });
    assert.equal(mutA.ok, true);
    assert.equal(mutB.ok, true);
    if (!mutA.ok || !mutB.ok) {
      return;
    }
    const hA = computeStrategyGenomeHash({
      ...mutA.value,
      lineage: lineageWithoutGenomeHash(mutA.value.lineage),
    });
    const hB = computeStrategyGenomeHash({
      ...mutB.value,
      lineage: lineageWithoutGenomeHash(mutB.value.lineage),
    });
    assert.equal(hA, hB);
  });

  it('crossover validates and preserves canonical risk catalog ref', () => {
    const a = buildOs05ExampleStrategyGenome();
    const b = mutateStrategyGenome({
      genome: a,
      family: 'PARAMETER_MUTATION',
      randomSeed: 'x1',
      createdAt: FIXED_TIME,
    });
    assert.equal(b.ok, true);
    if (!b.ok) {
      return;
    }
    const child = crossoverStrategyGenomes({
      parentA: a,
      parentB: b.value,
      mode: 'ENTRY_EXIT_CROSSOVER',
      randomSeed: 'cx-1',
      createdAt: FIXED_TIME,
    });
    assert.equal(child.ok, true, !child.ok ? child.error.message : '');
    if (!child.ok) {
      return;
    }
    const risk = child.value.nodes.find((n) => n.kind === 'RISK');
    assert.ok(risk && risk.kind === 'RISK');
    assert.equal(risk.catalogRef, CANONICAL_RISK_ENGINE_CATALOG_REF);
    assert.equal(child.value.lineage.operator, 'ENTRY_EXIT_CROSSOVER');
  });

  it('rejects lookahead when signal reference exceeds feature lookback', () => {
    const base = buildOs05ExampleStrategyGenome();
    const feat = base.nodes.find((n) => n.kind === 'FEATURE');
    const sig = base.nodes.find((n) => n.kind === 'SIGNAL');
    assert.ok(feat && feat.kind === 'FEATURE');
    assert.ok(sig && sig.kind === 'SIGNAL');
    const poisonedNodes = base.nodes.map((n) => {
      if (n.kind === 'FEATURE') {
        return { ...n, params: { ...n.params, lookbackDays: 5 } };
      }
      if (n.kind === 'SIGNAL') {
        return { ...n, params: { ...n.params, referenceWindowBars: 40 } };
      }
      return n;
    });
    const genome = attachGenomeHash({
      ...base,
      nodes: Object.freeze(poisonedNodes),
      lineage: lineageWithoutGenomeHash(base.lineage),
    });
    const v = validateStrategyGenome(genome);
    assert.equal(v.ok, true);
    if (!v.ok) {
      return;
    }
    const m = mutateStrategyGenome({
      genome: v.value,
      family: 'PARAMETER_MUTATION',
      randomSeed: 'noop',
      createdAt: FIXED_TIME,
    });
    assert.equal(m.ok, false);
    if (m.ok) {
      return;
    }
    assert.equal(m.error.code, 'EVOLUTION_LOOKAHEAD_INTRODUCED');
  });

  it('qualification marker HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED', () => {
    const base = buildOs05ExampleStrategyGenome();
    const m = mutateStrategyGenome({
      genome: base,
      family: 'ENTRY_RULE_MUTATION',
      randomSeed: 'q1',
      createdAt: FIXED_TIME,
    });
    const b = mutateStrategyGenome({
      genome: base,
      family: 'PARAMETER_MUTATION',
      randomSeed: 'q2',
      createdAt: FIXED_TIME,
    });
    assert.equal(m.ok, true);
    assert.equal(b.ok, true);
    if (!m.ok || !b.ok) {
      return;
    }
    const c = crossoverStrategyGenomes({
      parentA: m.value,
      parentB: b.value,
      mode: 'PARAMETER_BLEND',
      randomSeed: 'q3',
      createdAt: FIXED_TIME,
    });
    assert.equal(c.ok, true);
    const d1 = mutateStrategyGenome({
      genome: base,
      family: 'FEATURE_SUBSTITUTION',
      randomSeed: 'det',
      createdAt: FIXED_TIME,
    });
    const d2 = mutateStrategyGenome({
      genome: base,
      family: 'FEATURE_SUBSTITUTION',
      randomSeed: 'det',
      createdAt: FIXED_TIME,
    });
    assert.equal(d1.ok, true);
    assert.equal(d2.ok, true);
    if (!d1.ok || !d2.ok) {
      return;
    }
    const h1 = computeStrategyGenomeHash({
      ...d1.value,
      lineage: lineageWithoutGenomeHash(d1.value.lineage),
    });
    const h2 = computeStrategyGenomeHash({
      ...d2.value,
      lineage: lineageWithoutGenomeHash(d2.value.lineage),
    });
    const q = evaluateEvolutionOperatorsQualification({
      mutationValidates: m.ok,
      crossoverValidates: c.ok,
      deterministicChild: h1 === h2,
      catalogFeatureSubstitutionPresent: 'feature.realized_volatility_alt' in STRATEGY_GENOME_NODE_CATALOG,
    });
    assert.equal(q.marker, HELIOS_EVOL02_GENOME_OPERATORS_QUALIFIED, q.blockers.join('; '));
  });
});
