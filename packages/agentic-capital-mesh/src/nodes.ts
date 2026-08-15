import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { asModelId, asModelValidationId, asModelVersion } from '../../model-registry/src/ids.ts';
import { ModelRegistry, type RegistryFailure } from '../../model-registry/src/registry.ts';
import type { RegisteredModelVersion } from '../../model-registry/src/types.ts';
import { asCapitalAgentNodeId } from './ids.ts';
import {
  APPROVED_MESH_TOOLS,
  SPECIALIST_ROLES,
  type NodeOutput,
  type SpecialistNode,
  type SpecialistRole,
} from './types.ts';

export const CANONICAL_MESH_MODEL_ID = asModelId('mdl_capital_mesh_specialist');
export const CANONICAL_MESH_MODEL_VERSION = asModelVersion('mesh-specialist-v1');

export function defaultSpecialistNodes(): readonly SpecialistNode[] {
  return Object.freeze(
    SPECIALIST_ROLES.map((role) =>
      Object.freeze({
        nodeId: asCapitalAgentNodeId(`cmnode_${role.toLowerCase()}`),
        role,
        model: Object.freeze({
          modelId: CANONICAL_MESH_MODEL_ID,
          version: CANONICAL_MESH_MODEL_VERSION,
        }),
        approvedTools: APPROVED_MESH_TOOLS,
        inputSchema: `CapitalContext/${role}`,
        outputSchema: `NodeOutput/${role}`,
        limits: Object.freeze(['read-only', 'simulation-only', 'no-execution']),
        simulationOnly: true as const,
      }),
    ),
  );
}

export function nodeForRole(role: SpecialistRole, nodes = defaultSpecialistNodes()): SpecialistNode {
  const found = nodes.find((node) => node.role === role);
  if (!found) {
    throw new Error(`specialist role ${role} is not registered`);
  }
  return found;
}

export function freezeNodeOutput(output: NodeOutput): NodeOutput {
  return Object.freeze({
    ...output,
    facts: Object.freeze([...output.facts]),
    assumptions: Object.freeze([...output.assumptions]),
    model: Object.freeze({ ...output.model }),
  });
}

export function seedCanonicalMeshModel(
  registry: ModelRegistry,
  actor: unknown,
  now: UtcInstant,
): Result<RegisteredModelVersion, RegistryFailure> {
  const registered = registry.register({
    modelId: CANONICAL_MESH_MODEL_ID,
    version: CANONICAL_MESH_MODEL_VERSION,
    type: 'AI_MODEL_REFERENCE',
    description: 'Simulation specialist-node reference for Agentic Capital Mesh. Not a second AI runtime.',
    owner: 'solstice-capital-mesh',
    inputSchema: 'CapitalContext + CandidateSpec',
    outputSchema: 'NodeOutput',
    determinism: 'DETERMINISTIC',
    configurationCanonical: JSON.stringify({
      modelId: 'mdl_capital_mesh_specialist',
      version: 'mesh-specialist-v1',
      roles: SPECIALIST_ROLES,
      simulationOnly: true,
      liveApproved: false,
    }),
    createdAt: now,
    limitations: Object.freeze([
      'Does not execute trades',
      'Does not approve itself',
      'Structured critique only',
    ]),
    applicableDomain: 'CAPITAL_MESH_SIMULATION',
    dataRequirements: Object.freeze(['capital-context', 'registered-models']),
    artifactKind: 'CONFIGURATION',
    artifactDescription: 'Canonical specialist-node configuration for simulation Mesh runs',
  });
  if (!registered.ok) {
    const existing = registry.get(CANONICAL_MESH_MODEL_ID, CANONICAL_MESH_MODEL_VERSION);
    if (existing?.lifecycle === 'APPROVED_FOR_SIMULATION') {
      return ok(existing);
    }
    return registered;
  }
  const queued = registry.requireValidation(CANONICAL_MESH_MODEL_ID, CANONICAL_MESH_MODEL_VERSION);
  if (!queued.ok) {
    return queued;
  }
  const validated = registry.recordValidation({
    validationId: asModelValidationId('mvn_canonical_mesh_v1'),
    modelId: CANONICAL_MESH_MODEL_ID,
    version: CANONICAL_MESH_MODEL_VERSION,
    testsExecuted: Object.freeze(['schema', 'no-execution', 'subject-isolation']),
    testDatasetReference: 'fixture:capital-mesh-demo',
    expectedBehavior: 'Produce structured node output without execution authority',
    observedBehavior: 'Deterministic specialist output in simulation',
    limitations: Object.freeze(['Simulation only']),
    status: 'PASSED_SIMULATION',
    reviewer: 'operator_1',
    reviewerKind: 'HUMAN_OPERATOR',
    timestamp: now,
    claimsRealWorldPerformance: false,
  });
  if (!validated.ok) {
    return validated;
  }
  return registry.approveForSimulation(actor, {
    modelId: CANONICAL_MESH_MODEL_ID,
    version: CANONICAL_MESH_MODEL_VERSION,
    reason: 'Human operator approved the simulation Mesh specialist reference',
    now,
  });
}

export function refuseModelSelfApproval(): Result<never, RegistryFailure> {
  return err({
    code: 'SELF_APPROVAL_FORBIDDEN',
    message: 'the Mesh cannot approve a model, including its own specialist reference',
  });
}
