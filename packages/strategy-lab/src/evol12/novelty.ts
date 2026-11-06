import { err, ok, type Result } from '@solstice/domain';

import { computeStrategyGenomeHash, lineageWithoutGenomeHash } from '../os05/hash.ts';
import type { StrategyGenome } from '../os05/types.ts';
import type { GenomeProposal, GenomeProposalNoveltyMode } from './types.ts';

const DEFAULT_JACCARD_DUPLICATE_THRESHOLD = 0.85;

function catalogRefsOf(genome: StrategyGenome): Set<string> {
  const refs = new Set<string>();
  for (const node of genome.nodes) {
    if (node.kind === 'FLOW') {
      continue;
    }
    refs.add(node.catalogRef);
  }
  return refs;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) {
      inter += 1;
    }
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function materialHash(genome: StrategyGenome): string {
  return computeStrategyGenomeHash({
    ...genome,
    lineage: lineageWithoutGenomeHash(genome.lineage),
  });
}

export type NoveltyGateFailure = {
  readonly code: 'DUPLICATE_GENOME' | 'TOO_SIMILAR_TO_ARCHIVE' | 'REFINEMENT_MISSING_PARENT' | 'REFINEMENT_PARENT_UNKNOWN';
  readonly message: string;
};

/**
 * Rejects proposals that duplicate or closely mirror archive genomes unless mode is PARAMETER_REFINEMENT
 * and lineage explicitly names parent hashes (governance still owns promotion and AAF rules).
 */
export function checkNoveltyAgainstArchive(input: {
  readonly proposalGenome: StrategyGenome;
  readonly noveltyMode: GenomeProposalNoveltyMode;
  readonly refinementParentHashes: readonly string[];
  readonly archiveGenomes: readonly StrategyGenome[];
  readonly jaccardDuplicateThreshold?: number;
}): Result<true, NoveltyGateFailure> {
  const threshold = input.jaccardDuplicateThreshold ?? DEFAULT_JACCARD_DUPLICATE_THRESHOLD;
  const proposalHash = materialHash(input.proposalGenome);
  const proposalRefs = catalogRefsOf(input.proposalGenome);

  if (input.noveltyMode === 'PARAMETER_REFINEMENT') {
    if (input.refinementParentHashes.length === 0) {
      return err({
        code: 'REFINEMENT_MISSING_PARENT',
        message: 'parameter refinement must declare parent archive hashes',
      });
    }
    const archiveByHash = new Map<string, StrategyGenome>();
    for (const g of input.archiveGenomes) {
      archiveByHash.set(materialHash(g), g);
    }
    for (const h of input.refinementParentHashes) {
      if (!archiveByHash.has(h)) {
        return err({
          code: 'REFINEMENT_PARENT_UNKNOWN',
          message: `refinement parent hash not found in supplied archive: ${h}`,
        });
      }
    }
    return ok(true);
  }

  for (const archived of input.archiveGenomes) {
    const archHash = materialHash(archived);
    if (archHash === proposalHash) {
      return err({
        code: 'DUPLICATE_GENOME',
        message: 'proposal genome duplicates an archived genome (exact material hash match)',
      });
    }
    const sim = jaccardSimilarity(proposalRefs, catalogRefsOf(archived));
    if (sim >= threshold) {
      return err({
        code: 'TOO_SIMILAR_TO_ARCHIVE',
        message: `proposal catalog fingerprint too similar to archive genome (${sim.toFixed(3)} ≥ ${threshold}); use PARAMETER_REFINEMENT or redesign`,
      });
    }
  }

  return ok(true);
}

/** Derive refinement parent hashes from a GenomeProposal (explicit lineage only). */
export function refinementParentHashesFromProposal(proposal: GenomeProposal): readonly string[] {
  if (proposal.novelty.mode !== 'PARAMETER_REFINEMENT') {
    return Object.freeze([]);
  }
  return Object.freeze([...proposal.novelty.similarArchiveGenomeHashes]);
}
