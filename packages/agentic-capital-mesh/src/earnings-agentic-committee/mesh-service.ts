import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import type { CapitalContext } from '../types.ts';
import { loadHeliosResearchData } from '../institutional-research-mesh/data-context.ts';
import { assertEarningsEvidencePackUnchanged, freezeEarningsEvidencePack } from './evidence-pack.ts';
import { assignEarningsSpecialists, assignedRoles } from './h20-routing.ts';
import { buildProbabilisticEarningsState } from './probabilistic-state.ts';
import { DEFAULT_EARNINGS_COMMITTEE_PIPELINE, rolesForEarningsPhase } from './routing.ts';
import { runEarningsCommitteeRole } from './role-runners.ts';
import { buildEarningsInvestmentThesis } from './thesis-builder.ts';
import { EARNINGS_COMMITTEE_SCHEMA } from './taxonomy.ts';
import type {
  EarningsCommitteeFailure,
  EarningsCommitteeRequest,
  EarningsCommitteeRun,
  EarningsSpecialistArtifact,
} from './types.ts';
import { validateEarningsInvestmentThesis, validateEarningsSpecialistArtifact } from './validation.ts';

const THESIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `earn10_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 18)}`;
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export class EarningsAgenticCommittee {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  run(input: {
    readonly request: EarningsCommitteeRequest;
    readonly context: CapitalContext;
  }): Result<EarningsCommitteeRun, EarningsCommitteeFailure> {
    const now = this.clock.now();
    const pack = freezeEarningsEvidencePack({
      packId: `ep_${input.request.workOrderId}`,
      evidence: input.request.evidenceBundle,
      frozenAt: now,
    });

    const dataResult = loadHeliosResearchData({
      context: input.context,
      subjectId: input.request.subjectId,
      contextRef: input.request.contextRef,
      evidenceBundle: pack.evidence,
    });
    if (!dataResult.ok) {
      return err({ code: dataResult.error.code, message: dataResult.error.message });
    }

    const probabilisticState = buildProbabilisticEarningsState({
      entity: input.request.entity,
      event: input.request.event,
      informationTime: now,
      pack,
    });

    const decisionImportance = input.request.decisionImportance ?? 0.7;
    const h20Assignments = assignEarningsSpecialists({
      currentUncertainty: probabilisticState.uncertaintyScore,
      decisionImportance,
      ...(input.request.forceAllSpecialists !== undefined
        ? { forceAllSpecialists: input.request.forceAllSpecialists }
        : {}),
    });
    const assigned = new Set(assignedRoles(h20Assignments));

    const artifacts: EarningsSpecialistArtifact[] = [];
    const runnerBase = {
      workOrderId: input.request.workOrderId,
      subjectId: input.request.subjectId,
      entity: input.request.entity,
      event: input.request.event,
      objective: input.request.objective,
      informationTime: now,
      data: dataResult.value,
      probabilisticState,
    };

    for (const phase of DEFAULT_EARNINGS_COMMITTEE_PIPELINE) {
      if (phase === 'EVIDENCE_FREEZE' || phase === 'PROBABILISTIC_STATE' || phase === 'H20_SPECIALIST_ASSIGNMENT') {
        continue;
      }

      const challengeMode = phase === 'CONTRADICTION_CHALLENGE';
      for (const role of rolesForEarningsPhase(phase)) {
        if (!assigned.has(role)) {
          continue;
        }
        try {
          assertEarningsEvidencePackUnchanged(pack, input.request.evidenceBundle);
        } catch (error) {
          return err({
            code: 'EVIDENCE_MUTATED',
            message: error instanceof Error ? error.message : 'evidence mutated',
          });
        }

        const artifact = runEarningsCommitteeRole({
          ...runnerBase,
          role,
          priorArtifacts: Object.freeze([...artifacts]),
          challengeMode,
        });
        const validationErrors = validateEarningsSpecialistArtifact(artifact);
        if (validationErrors.length > 0) {
          return err({ code: 'VALIDATION_FAILED', message: validationErrors.join('; ') });
        }
        if (challengeMode) {
          const index = artifacts.findIndex((row) => row.role === role);
          if (index >= 0) {
            const prior = artifacts[index]!;
            artifacts[index] = Object.freeze({
              ...prior,
              challengesIssued: Object.freeze([...prior.challengesIssued, ...artifact.challengesIssued]),
            });
          }
        } else {
          artifacts.push(artifact);
        }
      }
    }

    const thesis = buildEarningsInvestmentThesis({
      workOrderId: input.request.workOrderId,
      entity: input.request.entity,
      event: input.request.event,
      timeHorizon: input.request.timeHorizon ?? 'EARNINGS_WINDOW',
      informationTime: now,
      expirationTime: addMs(now, THESIS_TTL_MS) as import('../imports.ts').UtcInstant,
      pack,
      probabilisticState,
      artifacts: Object.freeze([...artifacts]),
      assignedCoverage: Object.freeze([...assigned]),
    });

    const thesisErrors = validateEarningsInvestmentThesis(thesis);
    if (thesisErrors.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: thesisErrors.join('; ') });
    }

    return ok(
      Object.freeze({
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        schema: EARNINGS_COMMITTEE_SCHEMA,
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        entity: input.request.entity,
        event: input.request.event,
        phases: DEFAULT_EARNINGS_COMMITTEE_PIPELINE,
        frozenEvidencePack: pack,
        probabilisticState,
        h20Assignments,
        artifacts: Object.freeze([...artifacts]),
        thesis,
        createdAt: now,
        completedAt: now,
      }),
    );
  }
}
