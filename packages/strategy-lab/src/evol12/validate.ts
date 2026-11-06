import { err, ok, type Result } from '@solstice/domain';

import { validateStrategyGenome } from '../os05/validate.ts';
import {
  HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED,
  HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED,
  STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA,
} from './taxonomy.ts';
import type { Evol12QualificationChecks, Evol12QualificationResult, GenomeProposal } from './types.ts';
import { STRATEGY_SCIENTIST_AGENT_ROLE } from './taxonomy.ts';

export type GenomeProposalValidationFailure = {
  readonly code: string;
  readonly message: string;
};

function nonEmpty(value: string, label: string): Result<true, GenomeProposalValidationFailure> {
  if (value.trim().length === 0) {
    return err({ code: `${label}_EMPTY`, message: `${label} must be non-empty` });
  }
  return ok(true);
}

function nonEmptyList(values: readonly string[], label: string): Result<true, GenomeProposalValidationFailure> {
  if (values.length === 0) {
    return err({ code: `${label}_EMPTY`, message: `${label} must list at least one item` });
  }
  for (const v of values) {
    const inner = nonEmpty(v, `${label}_ITEM`);
    if (!inner.ok) {
      return inner;
    }
  }
  return ok(true);
}

/**
 * Static validation: schema, role, declarative genome compiles, novelty rules, and holdout seal.
 */
export function validateGenomeProposal(input: GenomeProposal): Result<true, GenomeProposalValidationFailure> {
  if (input.schema !== STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA) {
    return err({ code: 'SCHEMA_MISMATCH', message: 'GenomeProposal schema mismatch' });
  }
  if (input.scientist.role !== STRATEGY_SCIENTIST_AGENT_ROLE) {
    return err({ code: 'INVALID_AGENT_ROLE', message: 'StrategyScientistAgent must use STRATEGY_SCIENTIST role' });
  }
  const agentRef = nonEmpty(input.scientist.agentRef, 'agentRef');
  if (!agentRef.ok) {
    return agentRef;
  }
  if (!input.scientist.agentRef.startsWith('agent/')) {
    return err({ code: 'INVALID_AGENT_REF', message: 'agentRef must be agent-scoped (agent/...)' });
  }

  const hypId = nonEmpty(input.researchHypothesis.hypothesisId, 'hypothesisId');
  if (!hypId.ok) {
    return hypId;
  }
  for (const field of ['statement', 'prediction', 'negation'] as const) {
    const r = nonEmpty(input.researchHypothesis[field], field);
    if (!r.ok) {
      return r;
    }
  }

  const rEcon = nonEmpty(input.rationale.economicRationale, 'economicRationale');
  if (!rEcon.ok) {
    return rEcon;
  }
  const rEdge = nonEmpty(input.rationale.expectedEdge, 'expectedEdge');
  if (!rEdge.ok) {
    return rEdge;
  }
  const rRegime = nonEmpty(input.rationale.expectedRegime, 'expectedRegime');
  if (!rRegime.ok) {
    return rRegime;
  }
  const rHorizon = nonEmpty(input.rationale.expectedHoldingHorizonDescription, 'expectedHoldingHorizon');
  if (!rHorizon.ok) {
    return rHorizon;
  }
  const rFals = nonEmpty(input.rationale.falsifiableHypothesis, 'falsifiableHypothesis');
  if (!rFals.ok) {
    return rFals;
  }
  const fm = nonEmptyList(input.rationale.failureModes, 'failureModes');
  if (!fm.ok) {
    return fm;
  }
  const rf = nonEmptyList(input.rationale.requiredFeatures, 'requiredFeatures');
  if (!rf.ok) {
    return rf;
  }

  const genomeValid = validateStrategyGenome(input.declarativeGenome);
  if (!genomeValid.ok) {
    return err({
      code: 'DECLARATIVE_GENOME_INVALID',
      message: genomeValid.error.message,
    });
  }
  if (input.sealedHoldoutAccessDenied !== true) {
    return err({ code: 'HOLDOUT_SEAL_BROKEN', message: 'proposal must deny sealed holdout access' });
  }

  if (input.novelty.mode === 'NOVEL' && input.novelty.similarArchiveGenomeHashes.length > 0) {
    return err({
      code: 'NOVELTY_ARCHIVE_CONFLICT',
      message: 'NOVEL mode must not list similar archive hashes unless documenting refinement intent',
    });
  }
  if (input.novelty.mode === 'PARAMETER_REFINEMENT' && input.novelty.similarArchiveGenomeHashes.length === 0) {
    return err({
      code: 'REFINEMENT_REQUIRES_LINEAGE',
      message: 'PARAMETER_REFINEMENT must name similar archive genome hashes',
    });
  }

  const mech = input.mechanism;
  if (mech.kind === 'CROSSOVER') {
    if (mech.parentGenomeHashes.length !== 2) {
      return err({ code: 'CROSSOVER_PARENTS', message: 'crossover requires exactly two parent hashes' });
    }
  }

  return ok(true);
}

export function evaluateEvol12StrategyScientistQualification(
  checks: Evol12QualificationChecks,
): Evol12QualificationResult {
  const blockers: string[] = [];
  if (!checks.proposalSchemaValid) {
    blockers.push('GenomeProposal schema invalid');
  }
  if (!checks.scientistRoleValid) {
    blockers.push('StrategyScientistAgent role invalid');
  }
  if (!checks.genomeStaticValidationPasses) {
    blockers.push('declarative genome static validation failed');
  }
  if (!checks.noveltyGatePasses) {
    blockers.push('novelty gate rejected proposal');
  }
  if (!checks.holdoutSealed) {
    blockers.push('sealed holdout must remain inaccessible to scientist');
  }
  if (!checks.noExecutableStrategyEscape) {
    blockers.push('executable strategy escape must be forbidden');
  }
  if (!checks.scientificLoopDocumented) {
    blockers.push('scientific loop stages must be recorded');
  }

  if (blockers.length > 0) {
    return { marker: HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED, blockers: Object.freeze([...blockers]) };
  }
  return { marker: HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED, blockers: Object.freeze([]) };
}
