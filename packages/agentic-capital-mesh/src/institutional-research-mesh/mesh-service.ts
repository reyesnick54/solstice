import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import type { CapitalContext } from '../types.ts';
import { assertAllRolesProduceArtifacts, validateStructuredResearchArtifact } from './artifact-validation.ts';
import { loadHeliosResearchData } from './data-context.ts';
import { defaultInstitutionalRoles, DEFAULT_INSTITUTIONAL_MESH_PIPELINE, rolesForPhase } from './routing.ts';
import { runInstitutionalResearchRole } from './role-runners.ts';
import type {
  InstitutionalResearchMeshFailure,
  InstitutionalResearchMeshRun,
  InstitutionalResearchRequest,
  InstitutionalResearchRole,
  StructuredResearchArtifact,
} from './types.ts';

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `irm_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 20)}`;
}

export class InstitutionalResearchMesh {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  run(input: {
    readonly request: InstitutionalResearchRequest;
    readonly context: CapitalContext;
  }): Result<InstitutionalResearchMeshRun, InstitutionalResearchMeshFailure> {
    const now = this.clock.now();
    const roles = input.request.roles ?? defaultInstitutionalRoles();
    const dataResult = loadHeliosResearchData({
      context: input.context,
      subjectId: input.request.subjectId,
      contextRef: input.request.contextRef,
      evidenceBundle: input.request.evidenceBundle,
    });
    if (!dataResult.ok) {
      return err({ code: dataResult.error.code, message: dataResult.error.message });
    }

    const artifacts: StructuredResearchArtifact[] = [];
    const instrumentHints = Object.freeze([...(input.request.instrumentHints ?? [])]);
    const regimeHints = Object.freeze([...(input.request.regimeHints ?? [])]);

    for (const phase of DEFAULT_INSTITUTIONAL_MESH_PIPELINE) {
      for (const role of rolesForPhase(phase)) {
        if (!roles.includes(role)) {
          continue;
        }
        const artifact = runInstitutionalResearchRole({
          role,
          workOrderId: input.request.workOrderId,
          subjectId: input.request.subjectId,
          objective: input.request.objective,
          informationTime: now,
          data: dataResult.value,
          instrumentHints,
          regimeHints,
          priorArtifacts: Object.freeze([...artifacts]),
        });
        const validationErrors = validateStructuredResearchArtifact(artifact);
        if (validationErrors.length > 0) {
          return err({
            code: 'VALIDATION_FAILED',
            message: validationErrors.join('; '),
          });
        }
        artifacts.push(artifact);
      }
    }

    const missing = assertAllRolesProduceArtifacts(artifacts);
    if (roles.length === defaultInstitutionalRoles().length && missing.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: missing.join('; ') });
    }

    const synthesis = artifacts.find((row) => row.role === 'RESEARCH_SYNTHESIS');
    return ok(
      Object.freeze({
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        objective: input.request.objective,
        phases: DEFAULT_INSTITUTIONAL_MESH_PIPELINE,
        artifacts: Object.freeze([...artifacts]),
        synthesisArtifactId: synthesis?.artifactId ?? null,
        createdAt: now,
        completedAt: now,
      }),
    );
  }
}

export function roleDisplayName(role: InstitutionalResearchRole): string {
  switch (role) {
    case 'FUNDAMENTAL_RESEARCH':
      return 'FundamentalResearchAgent';
    case 'EARNINGS_RESEARCH':
      return 'EarningsResearchAgent';
    case 'TECHNICAL_RESEARCH':
      return 'TechnicalResearchAgent';
    case 'MACRO_RESEARCH':
      return 'MacroResearchAgent';
    case 'NEWS_RESEARCH':
      return 'NewsResearchAgent';
    case 'SENTIMENT_RESEARCH':
      return 'SentimentResearchAgent';
    case 'OPTIONS_RESEARCH':
      return 'OptionsResearchAgent';
    case 'FLOW_RESEARCH':
      return 'FlowResearchAgent';
    case 'CRYPTO_ONCHAIN_RESEARCH':
      return 'CryptoOnChainResearchAgent';
    case 'BULL_RESEARCH':
      return 'BullResearchAgent';
    case 'BEAR_RESEARCH':
      return 'BearResearchAgent';
    case 'RISK_RESEARCH':
      return 'RiskResearchAgent';
    case 'EXECUTION_RESEARCH':
      return 'ExecutionResearchAgent';
    case 'RESEARCH_SYNTHESIS':
      return 'ResearchSynthesisAgent';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
