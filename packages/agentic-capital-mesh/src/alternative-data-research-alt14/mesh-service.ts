import { createHash } from 'node:crypto';

import { err, ok, type Result, type Clock } from '../imports.ts';
import type { CapitalContext } from '../types.ts';
import { loadHeliosResearchData } from '../institutional-research-mesh/data-context.ts';
import {
  assertAllAlt14RolesProduceArtifacts,
  thesisPassesAltLanguageGuard,
  validateAlternativeDataAlt14Artifact,
} from './artifact-validation.ts';
import {
  DEFAULT_ALTERNATIVE_DATA_ALT14_PIPELINE,
  defaultAlternativeDataAlt14Roles,
  rolesForAlt14Phase,
} from './routing.ts';
import { runAlternativeDataAlt14Role } from './role-runners.ts';
import { buildAlternativeDataResearchThesis } from './thesis-builder.ts';
import { ALTERNATIVE_DATA_ALT14_SCHEMA, type AlternativeDataAlt14Role } from './types.ts';
import type {
  AlternativeDataAlt14MeshFailure,
  AlternativeDataAlt14MeshRun,
  AlternativeDataAlt14Request,
} from './types.ts';

const DISPLAY_NAMES: Record<AlternativeDataAlt14Role, string> = {
  WORKFORCE_INTELLIGENCE: 'WorkforceIntelligenceAgent',
  DIGITAL_DEMAND: 'DigitalDemandAgent',
  PRODUCT_DEMAND: 'ProductDemandAgent',
  LOGISTICS: 'LogisticsAgent',
  GEOSPATIAL: 'GeospatialAgent',
  INNOVATION: 'InnovationAgent',
  PROCUREMENT: 'ProcurementAgent',
  SUPPLY_CHAIN: 'SupplyChainAgent',
  ALTERNATIVE_DATA_SKEPTIC: 'AlternativeDataSkepticAgent',
  ALTERNATIVE_DATA_SYNTHESIS: 'AlternativeDataSynthesisAgent',
};

export function alternativeDataAlt14RoleDisplayName(role: AlternativeDataAlt14Role): string {
  return DISPLAY_NAMES[role];
}

function runIdFor(workOrderId: string, subjectId: string, now: string): string {
  return `alt14_${createHash('sha256').update(`${workOrderId}:${subjectId}:${now}`).digest('hex').slice(0, 18)}`;
}

export class AlternativeDataResearchAlt14Mesh {
  private readonly clock: Clock;

  constructor(input: { readonly clock: Clock }) {
    this.clock = input.clock;
  }

  run(input: {
    readonly request: AlternativeDataAlt14Request;
    readonly context: CapitalContext;
  }): Result<AlternativeDataAlt14MeshRun, AlternativeDataAlt14MeshFailure> {
    const now = this.clock.now();
    const roles = input.request.roles ?? defaultAlternativeDataAlt14Roles();

    const dataResult = loadHeliosResearchData({
      context: input.context,
      subjectId: input.request.subjectId,
      contextRef: input.request.contextRef ?? `ctx/${input.request.workOrderId}`,
      evidenceBundle: input.request.evidenceBundle ?? Object.freeze([]),
    });
    if (!dataResult.ok) {
      return err({ code: 'DATA_UNAVAILABLE', message: dataResult.error.message });
    }

    const artifacts: import('./types.ts').AlternativeDataAlt14Artifact[] = [];
    const roleSet = new Set<AlternativeDataAlt14Role>(roles);

    for (const phase of DEFAULT_ALTERNATIVE_DATA_ALT14_PIPELINE) {
      for (const role of rolesForAlt14Phase(phase)) {
        if (!roleSet.has(role)) continue;
        const artifact = runAlternativeDataAlt14Role({
          role,
          workOrderId: input.request.workOrderId,
          subjectId: input.request.subjectId,
          entityId: input.request.entityId,
          objective: input.request.objective,
          informationTime: now,
          data: dataResult.value,
          priorArtifacts: Object.freeze([...artifacts]),
        });
        const validationErrors = validateAlternativeDataAlt14Artifact(artifact);
        if (validationErrors.length > 0) {
          return err({ code: 'VALIDATION_FAILED', message: validationErrors.join('; ') });
        }
        if (!thesisPassesAltLanguageGuard(artifact.thesis)) {
          return err({
            code: 'LANGUAGE_GUARD_VIOLATION',
            message: 'artifact thesis failed alternative-data language guard',
          });
        }
        artifacts.push(artifact);
      }
    }

    const missing = assertAllAlt14RolesProduceArtifacts(artifacts);
    if (roles.length === defaultAlternativeDataAlt14Roles().length && missing.length > 0) {
      return err({ code: 'VALIDATION_FAILED', message: missing.join('; ') });
    }

    const thesis = buildAlternativeDataResearchThesis({
      workOrderId: input.request.workOrderId,
      subjectId: input.request.subjectId,
      entityId: input.request.entityId,
      informationTime: now,
      artifacts,
    });

    return ok(
      Object.freeze({
        schema: ALTERNATIVE_DATA_ALT14_SCHEMA,
        runId: runIdFor(input.request.workOrderId, input.request.subjectId, now),
        workOrderId: input.request.workOrderId,
        subjectId: input.request.subjectId,
        entityId: input.request.entityId,
        informationTime: now,
        artifacts: Object.freeze([...artifacts]),
        thesis,
        simulationOnly: true,
      }),
    );
  }
}
