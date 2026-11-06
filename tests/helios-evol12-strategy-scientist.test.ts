/**
 * HELIOS EVOL12 — Strategy Scientist (typed declarative proposals, deterministic gates).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EVOL12_SCIENTIFIC_LOOP_STAGES,
  HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED,
  assertScientificLoopDocumented,
  buildEvol12SampleGenomeProposal,
  checkNoveltyAgainstArchive,
  evaluateEvol12StrategyScientistQualification,
  validateGenomeProposal,
} from '../packages/strategy-lab/src/evol12/index.ts';
import { buildOs05ExampleStrategyGenome } from '../packages/strategy-lab/src/os05/fixtures.ts';
import { computeStrategyGenomeHash, lineageWithoutGenomeHash } from '../packages/strategy-lab/src/os05/hash.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

function materialHash(genome: ReturnType<typeof buildOs05ExampleStrategyGenome>): string {
  return computeStrategyGenomeHash({
    ...genome,
    lineage: lineageWithoutGenomeHash(genome.lineage),
  });
}

describe('HELIOS EVOL12 — Strategy Scientist', () => {
  it('respects helios boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('validates a sample GenomeProposal against static declarative genome rules', () => {
    const proposal = buildEvol12SampleGenomeProposal();
    const v = validateGenomeProposal(proposal);
    assert.equal(v.ok, true, !v.ok ? v.error.message : '');
  });

  it('runs novelty gate: rejects near-duplicate of archive in NOVEL mode', () => {
    const proposal = buildEvol12SampleGenomeProposal();
    const archived = buildOs05ExampleStrategyGenome();
    const n = checkNoveltyAgainstArchive({
      proposalGenome: proposal.declarativeGenome,
      noveltyMode: 'NOVEL',
      refinementParentHashes: [],
      archiveGenomes: [archived],
    });
    assert.equal(n.ok, false);
    if (!n.ok) {
      assert.equal(n.error.code === 'DUPLICATE_GENOME' || n.error.code === 'TOO_SIMILAR_TO_ARCHIVE', true);
    }
  });

  it('runs novelty gate: PARAMETER_REFINEMENT passes when parent is in archive', () => {
    const proposal = buildEvol12SampleGenomeProposal();
    const parent = buildOs05ExampleStrategyGenome();
    const parentHash = materialHash(parent);
    const refined = {
      ...proposal,
      novelty: Object.freeze({
        mode: 'PARAMETER_REFINEMENT' as const,
        similarArchiveGenomeHashes: Object.freeze([parentHash]),
      }),
    };
    const n = checkNoveltyAgainstArchive({
      proposalGenome: refined.declarativeGenome,
      noveltyMode: 'PARAMETER_REFINEMENT',
      refinementParentHashes: [parentHash],
      archiveGenomes: [parent],
    });
    assert.equal(n.ok, true);
  });

  it('documents the full EVOL12 scientific loop in canonical order', () => {
    assert.equal(assertScientificLoopDocumented(EVOL12_SCIENTIFIC_LOOP_STAGES), true);
  });

  it('qualification marker HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED when checks pass', () => {
    const proposal = buildEvol12SampleGenomeProposal();
    const novelty = checkNoveltyAgainstArchive({
      proposalGenome: proposal.declarativeGenome,
      noveltyMode: proposal.novelty.mode,
      refinementParentHashes:
        proposal.novelty.mode === 'PARAMETER_REFINEMENT'
          ? [...proposal.novelty.similarArchiveGenomeHashes]
          : [],
      archiveGenomes: [],
    });
    const staticGenome = validateGenomeProposal(proposal);
    const q = evaluateEvol12StrategyScientistQualification({
      proposalSchemaValid: proposal.schema.startsWith('sunrey.helios.evol12'),
      scientistRoleValid: proposal.scientist.role === 'STRATEGY_SCIENTIST',
      genomeStaticValidationPasses: staticGenome.ok,
      noveltyGatePasses: novelty.ok,
      holdoutSealed: proposal.sealedHoldoutAccessDenied === true,
      noExecutableStrategyEscape: true,
      scientificLoopDocumented: assertScientificLoopDocumented(EVOL12_SCIENTIFIC_LOOP_STAGES),
    });
    assert.equal(q.marker, HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED, q.blockers.join('; '));
  });
});
