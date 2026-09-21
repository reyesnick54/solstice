/**
 * HELIOS Multi-Asset M15 — multi-source opportunity assembly.
 *
 * Validates work-order binding and envelope references before ranking.
 * Does not rank or authorize trades.
 */

import type {
  AssembledOpportunityCandidate,
  AssemblyRejection,
  OpportunityAssemblyInput,
  OpportunityAssemblyResult,
} from './types.ts';
import { HELIOS_M15_OPPORTUNITY_ASSEMBLY_VERSION } from './types.ts';

export function assembleOpportunityCandidates(input: OpportunityAssemblyInput): OpportunityAssemblyResult {
  const accepted: AssembledOpportunityCandidate[] = [];
  const rejected: AssemblyRejection[] = [];
  const seenIds = new Set<string>();

  if (!input.workOrderActive) {
    for (const candidate of input.candidates) {
      rejected.push(
        Object.freeze({
          opportunityId: candidate.opportunityId,
          reason: 'work order inactive',
          code: 'WORK_ORDER_INACTIVE',
        }),
      );
    }
    rejected.sort((a, b) => a.opportunityId.localeCompare(b.opportunityId));
    return Object.freeze({
      assemblyId: input.assemblyId,
      version: HELIOS_M15_OPPORTUNITY_ASSEMBLY_VERSION,
      workOrderId: input.workOrderId,
      accepted: Object.freeze([]),
      rejected: Object.freeze(rejected),
      assembledAt: input.now,
    });
  }

  for (const candidate of input.candidates) {
    if (seenIds.has(candidate.opportunityId)) {
      rejected.push(
        Object.freeze({
          opportunityId: candidate.opportunityId,
          reason: 'duplicate opportunity id',
          code: 'DUPLICATE',
        }),
      );
      continue;
    }
    seenIds.add(candidate.opportunityId);

    if (candidate.expiresAt <= input.now) {
      rejected.push(
        Object.freeze({
          opportunityId: candidate.opportunityId,
          reason: 'candidate expired before assembly',
          code: 'EXPIRED',
        }),
      );
      continue;
    }

    if (candidate.evidenceRefs.length === 0) {
      rejected.push(
        Object.freeze({
          opportunityId: candidate.opportunityId,
          reason: 'missing evidence references',
          code: 'MISSING_EVIDENCE',
        }),
      );
      continue;
    }

    const envelopeValid = input.envelopeValidByOpportunityId[candidate.opportunityId];
    if (candidate.envelopeRef !== null && envelopeValid === false) {
      rejected.push(
        Object.freeze({
          opportunityId: candidate.opportunityId,
          reason: 'decision-validity envelope invalid',
          code: 'ENVELOPE_INVALID',
        }),
      );
      continue;
    }

    accepted.push(candidate);
  }

  accepted.sort((a, b) => a.opportunityId.localeCompare(b.opportunityId));
  rejected.sort((a, b) => a.opportunityId.localeCompare(b.opportunityId));

  return Object.freeze({
    assemblyId: input.assemblyId,
    version: HELIOS_M15_OPPORTUNITY_ASSEMBLY_VERSION,
    workOrderId: input.workOrderId,
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
    assembledAt: input.now,
  });
}
