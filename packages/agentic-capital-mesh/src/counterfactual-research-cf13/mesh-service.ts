import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import type { CapitalContext } from '../types.ts';
import { loadHeliosResearchData } from '../institutional-research-mesh/data-context.ts';
import {
  assertAllCf13RolesProduceArtifacts,
  thesisPassesLanguageGuard,
  validateCounterfactualCf13Artifact,
} from './artifact-validation.ts';
import {
  defaultCounterfactualCf13Roles,
  DEFAULT_COUNTERFACTUAL_CF13_PIPELINE,
  rolesForCf13Phase,
} from './routing.ts';
import { runCounterfactualCf13Role } from './role-runners.ts';
import { buildCounterfactualResearchThesis } from './thesis-builder.ts';
import { COUNTERFACTUAL_CF13_SCHEMA } from './types.ts';
import type {
  CounterfactualCf13MeshFailure,
  CounterfactualCf13MeshRun,
  CounterfactualCf13Request,
  CounterfactualCf13Role,
} from './types.ts';

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `cf13_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 18)}`;
}

export class CounterfactualResearchCf13Mesh {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  run(input: {
    readonly request: CounterfactualCf13Request;
    readonly context: CapitalContext;
  }): Result<CounterfactualCf13MeshRun, CounterfactualCf13MeshFailure> {
    const now = this.clock.now();
    const roles = input.request.roles ?? defaultCounterfactualCf13Roles();

    const dataResult = loadHeliosResearchData({
      context: input.context,
      subjectId: input.request.subjectId,
      contextRef: input.request.contextRef,
      evidenceBundle: input.request.evidenceBundle,
    });
    if (!dataResult.ok) {
      return err({ code: dataResult.error.code, message: dataResult.error.message });
    }

    const artifacts: import('./types.ts').CounterfactualCf13Artifact[] = [];
    const roleSet = new Set<CounterfactualCf13Role>(roles);

    for (const phase of DEFAULT_COUNTERFACTUAL_CF13_PIPELINE) {
      for (const role of rolesForCf13Phase(phase)) {
        if (!roleSet.has(role)) {
          continue;
        }
        const artifact = runCounterfactualCf13Role({
          role,
          workOrderId: input.request.workOrderId,
          subjectId: input.request.subjectId,
          objective: input.request.objective,
          informationTime: now,
          data: dataResult.value,
          factualPolicyHint: input.request.factualPolicyHint,
          priorArtifacts: Object.freeze([...artifacts]),
        });
        const validationErrors = validateCounterfactualCf13Artifact(artifact);
        if (validationErrors.length > 0) {
          return err({ code: 'VALIDATION_FAILED', message: validationErrors.join('; ') });
        }
        if (!thesisPassesLanguageGuard(artifact.thesis)) {
          return err({
            code: 'LANGUAGE_GUARD_VIOLATION',
            message: 'artifact thesis failed definite counterfactual earnings guard',
          });
        }
        artifacts.push(artifact);
      }
    }

    const missing = assertAllCf13RolesProduceArtifacts(artifacts);
    if (roles.length === defaultCounterfactualCf13Roles().length && missing.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: missing.join('; ') });
    }

    let thesis;
    try {
      thesis = buildCounterfactualResearchThesis({
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        objective: input.request.objective,
        informationTime: now,
        artifacts: Object.freeze([...artifacts]),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('LANGUAGE_GUARD_VIOLATION')) {
        return err({ code: 'LANGUAGE_GUARD_VIOLATION', message });
      }
      return err({ code: 'VALIDATION_FAILED', message });
    }

    if (!thesisPassesLanguageGuard(thesis.conclusion) || !thesisPassesLanguageGuard(thesis.factualOutcome)) {
      return err({
        code: 'LANGUAGE_GUARD_VIOLATION',
        message: 'assembled thesis failed definite counterfactual earnings guard',
      });
    }

    return ok(
      Object.freeze({
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        schema: COUNTERFACTUAL_CF13_SCHEMA,
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        objective: input.request.objective,
        phases: DEFAULT_COUNTERFACTUAL_CF13_PIPELINE,
        artifacts: Object.freeze([...artifacts]),
        thesis,
        createdAt: now,
        completedAt: now,
      }),
    );
  }
}

export function counterfactualCf13RoleDisplayName(role: CounterfactualCf13Role): string {
  switch (role) {
    case 'COUNTERFACTUAL_POLICY':
      return 'CounterfactualPolicyAgent';
    case 'OUTCOME_MODEL':
      return 'OutcomeModelAgent';
    case 'PROPENSITY_SUPPORT':
      return 'PropensitySupportAgent';
    case 'EXECUTION_REALITY':
      return 'ExecutionRealityAgent';
    case 'CAUSAL_INFERENCE':
      return 'CausalInferenceAgent';
    case 'PORTFOLIO_PATH':
      return 'PortfolioPathAgent';
    case 'RISK_COUNTERFACTUAL':
      return 'RiskCounterfactualAgent';
    case 'SKEPTIC':
      return 'SkepticAgent';
    case 'COUNTERFACTUAL_SYNTHESIS':
      return 'CounterfactualSynthesisAgent';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
