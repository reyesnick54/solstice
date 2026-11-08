import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import { assertSubjectBound } from '../context.ts';
import type { CapitalContext } from '../types.ts';
import { loadHeliosResearchData } from '../institutional-research-mesh/data-context.ts';
import {
  assertAllAlpha14RolesProduceArtifacts,
  textViolatesAlpha14AuthorityGuard,
  validateAlpha14CommitteeArtifact,
  validateAlphaEvidenceThesis,
} from './artifact-validation.ts';
import { assertAlphaEvidencePackUnchanged, freezeAlphaEvidencePack } from './evidence-pack.ts';
import {
  defaultAlpha14CommitteeRoles,
  DEFAULT_ALPHA14_COMMITTEE_PIPELINE,
  rolesForAlpha14Phase,
} from './routing.ts';
import { runAlpha14CommitteeRole } from './role-runners.ts';
import { buildAlphaEvidenceThesis } from './thesis-builder.ts';
import { ALPHA14_COMMITTEE_AGENT_NAMES, ALPHA_EVIDENCE_COMMITTEE_SCHEMA, type Alpha14CommitteeRole } from './taxonomy.ts';
import type { Alpha14CommitteeArtifact, Alpha14CommitteeFailure, Alpha14CommitteeRequest, Alpha14CommitteeRun } from './types.ts';

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `alpha14_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 18)}`;
}

export function alpha14RoleDisplayName(role: Alpha14CommitteeRole): string {
  return ALPHA14_COMMITTEE_AGENT_NAMES[role];
}

export class AlphaEvidenceAgenticCommittee {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  run(input: {
    readonly request: Alpha14CommitteeRequest;
    readonly context: CapitalContext;
  }): Result<Alpha14CommitteeRun, Alpha14CommitteeFailure> {
    const subjectCheck = assertSubjectBound(input.context, input.request.subjectId);
    if (!subjectCheck.ok) {
      return err({ code: 'SUBJECT_MISMATCH', message: subjectCheck.error.message });
    }

    const now = this.clock.now();
    const pack = freezeAlphaEvidencePack({
      packId: `aep_${input.request.workOrderId}`,
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

    const roles = input.request.roles ?? defaultAlpha14CommitteeRoles();
    const roleSet = new Set<Alpha14CommitteeRole>(roles);
    const artifacts: Alpha14CommitteeArtifact[] = [];

    for (const phase of DEFAULT_ALPHA14_COMMITTEE_PIPELINE) {
      if (phase === 'EVIDENCE_FREEZE' || phase === 'CLAIM_ENVELOPE') {
        continue;
      }
      for (const role of rolesForAlpha14Phase(phase)) {
        if (!roleSet.has(role)) {
          continue;
        }
        try {
          assertAlphaEvidencePackUnchanged(pack, input.request.evidenceBundle);
        } catch (error) {
          return err({
            code: 'EVIDENCE_MUTATED',
            message: error instanceof Error ? error.message : 'evidence mutated',
          });
        }

        const artifact = runAlpha14CommitteeRole({
          role,
          workOrderId: input.request.workOrderId,
          subjectId: input.request.subjectId,
          strategyRef: input.request.strategyRef,
          objective: input.request.objective,
          informationTime: now,
          data: dataResult.value,
          performanceClaim: input.request.performanceClaim,
          priorArtifacts: Object.freeze([...artifacts]),
        });

        const validationErrors = validateAlpha14CommitteeArtifact(artifact);
        if (validationErrors.length > 0) {
          return err({ code: 'VALIDATION_FAILED', message: validationErrors.join('; ') });
        }

        const guard = textViolatesAlpha14AuthorityGuard(artifact.thesis);
        if (guard) {
          return err({ code: 'FORBIDDEN_AGENT_ACTION', message: guard });
        }

        artifacts.push(artifact);
      }
    }

    const missing = assertAllAlpha14RolesProduceArtifacts(artifacts);
    if (roles.length === defaultAlpha14CommitteeRoles().length && missing.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: missing.join('; ') });
    }

    let thesis;
    try {
      thesis = buildAlphaEvidenceThesis({
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        strategyRef: input.request.strategyRef,
        informationTime: now,
        pack,
        performanceClaim: input.request.performanceClaim,
        artifacts: Object.freeze([...artifacts]),
      });
    } catch (error) {
      return err({
        code: 'LANGUAGE_GUARD_VIOLATION',
        message: error instanceof Error ? error.message : 'thesis language guard',
      });
    }

    const thesisErrors = validateAlphaEvidenceThesis(thesis);
    if (thesisErrors.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: thesisErrors.join('; ') });
    }

    return ok(
      Object.freeze({
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        schema: ALPHA_EVIDENCE_COMMITTEE_SCHEMA,
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        strategyRef: input.request.strategyRef,
        phases: Object.freeze([...DEFAULT_ALPHA14_COMMITTEE_PIPELINE]),
        frozenEvidencePack: pack,
        performanceClaim: input.request.performanceClaim,
        artifacts: Object.freeze([...artifacts]),
        thesis,
        createdAt: now,
        completedAt: now,
      }),
    );
  }
}
