import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import type { CapitalContext } from '../types.ts';
import { loadHeliosResearchData } from '../institutional-research-mesh/data-context.ts';
import {
  assertValuationEvidencePackUnchanged,
  freezeValuationEvidencePack,
} from './evidence-pack.ts';
import { buildValuationAssumptionChallengeState } from './assumption-state.ts';
import { assignValuationSpecialists, assignedRoles } from './h20-routing.ts';
import { DEFAULT_VALUATION_COMMITTEE_PIPELINE, rolesForValuationPhase } from './routing.ts';
import { runValuationCommitteeRole } from './role-runners.ts';
import { buildValuationInvestmentThesis } from './thesis-builder.ts';
import { VALUATION_COMMITTEE_SCHEMA } from './taxonomy.ts';
import type {
  ValuationCommitteeFailure,
  ValuationCommitteeRequest,
  ValuationCommitteeRun,
  ValuationSpecialistArtifact,
} from './types.ts';
import {
  validateValuationInvestmentThesis,
  validateValuationSpecialistArtifact,
} from './validation.ts';

const THESIS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `val06_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 18)}`;
}

function addMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

function marketPriceFromContext(
  data: import('../institutional-research-mesh/data-context.ts').HeliosResearchDataSnapshot,
  instrumentId: string,
): bigint | null {
  const snapshot = data.reads['getMarketSnapshot'];
  if (!Array.isArray(snapshot)) return null;
  const row = snapshot.find(
    (item: { readonly instrumentId?: string }) => item.instrumentId === instrumentId,
  ) as { readonly priceMinor?: bigint } | undefined;
  return row?.priceMinor ?? null;
}

export class ValuationAgenticCommittee {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  run(input: {
    readonly request: ValuationCommitteeRequest;
    readonly context: CapitalContext;
  }): Result<ValuationCommitteeRun, ValuationCommitteeFailure> {
    const now = this.clock.now();
    const pack = freezeValuationEvidencePack({
      packId: `vp_${input.request.workOrderId}`,
      evidence: input.request.evidenceBundle,
      canonicalFinancialFacts: input.request.canonicalFinancialFacts,
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

    const marketPriceMinor = marketPriceFromContext(dataResult.value, input.request.instrumentId);

    const assumptionChallengeState = buildValuationAssumptionChallengeState({
      entity: input.request.entity,
      instrumentId: input.request.instrumentId,
      informationTime: now,
      pack,
      marketPriceMinor,
    });

    const decisionImportance = input.request.decisionImportance ?? 0.7;
    const h20Assignments = assignValuationSpecialists({
      currentUncertainty: assumptionChallengeState.uncertaintyScore,
      decisionImportance,
      ...(input.request.forceAllSpecialists !== undefined
        ? { forceAllSpecialists: input.request.forceAllSpecialists }
        : {}),
    });
    const assigned = new Set(assignedRoles(h20Assignments));

    const artifacts: ValuationSpecialistArtifact[] = [];
    const runnerBase = {
      workOrderId: input.request.workOrderId,
      subjectId: input.request.subjectId,
      entity: input.request.entity,
      instrumentId: input.request.instrumentId,
      objective: input.request.objective,
      informationTime: now,
      data: dataResult.value,
      pack,
      assumptionChallengeState,
    };

    for (const phase of DEFAULT_VALUATION_COMMITTEE_PIPELINE) {
      if (
        phase === 'EVIDENCE_FREEZE' ||
        phase === 'CANONICAL_FACTS_BIND' ||
        phase === 'ASSUMPTION_CHALLENGE_STATE' ||
        phase === 'H20_SPECIALIST_ASSIGNMENT'
      ) {
        continue;
      }

      const challengeMode = phase === 'CONTRADICTION_CHALLENGE';
      for (const role of rolesForValuationPhase(phase)) {
        if (!assigned.has(role)) {
          continue;
        }
        try {
          assertValuationEvidencePackUnchanged(
            pack,
            input.request.evidenceBundle,
            input.request.canonicalFinancialFacts,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'pack mutated';
          const code = message.includes('canonical') ? 'CANONICAL_FACTS_MUTATED' : 'EVIDENCE_MUTATED';
          return err({ code, message });
        }

        const artifact = runValuationCommitteeRole({
          ...runnerBase,
          role,
          priorArtifacts: Object.freeze([...artifacts]),
          challengeMode,
        });
        const validationErrors = validateValuationSpecialistArtifact(artifact);
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

    const thesis = buildValuationInvestmentThesis({
      workOrderId: input.request.workOrderId,
      entity: input.request.entity,
      instrumentId: input.request.instrumentId,
      timeHorizon: input.request.timeHorizon ?? 'MEDIUM_TERM',
      informationTime: now,
      expirationTime: addMs(now, THESIS_TTL_MS) as import('../imports.ts').UtcInstant,
      pack,
      assumptionChallengeState,
      artifacts: Object.freeze([...artifacts]),
      assignedCoverage: Object.freeze([...assigned]),
    });

    const thesisErrors = validateValuationInvestmentThesis(thesis);
    if (thesisErrors.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: thesisErrors.join('; ') });
    }

    return ok(
      Object.freeze({
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        schema: VALUATION_COMMITTEE_SCHEMA,
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        entity: input.request.entity,
        instrumentId: input.request.instrumentId,
        phases: DEFAULT_VALUATION_COMMITTEE_PIPELINE,
        frozenEvidencePack: pack,
        assumptionChallengeState,
        h20Assignments,
        artifacts: Object.freeze([...artifacts]),
        thesis,
        createdAt: now,
        completedAt: now,
      }),
    );
  }
}
