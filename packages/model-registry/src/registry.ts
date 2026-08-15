import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { isVerifiedActorContext, type VerifiedActorContext } from '../../identity/src/actor-context.ts';
import {
  asModelArtifactReference,
  asModelId,
  asModelValidationId,
  asModelVersion,
  type ModelId,
  type ModelVersion,
} from './ids.ts';
import type {
  ModelApproval,
  ModelArtifact,
  ModelRegistrySnapshot,
  ModelValidationReport,
  RegisteredModelVersion,
} from './types.ts';

export type RegistryFailure = {
  readonly code:
    | 'MODEL_NOT_FOUND'
    | 'VERSION_EXISTS'
    | 'ARTIFACT_IMMUTABLE'
    | 'INVALID_TRANSITION'
    | 'SELF_APPROVAL_FORBIDDEN'
    | 'HUMAN_OPERATOR_REQUIRED'
    | 'ACTOR_CONTEXT_REQUIRED'
    | 'VALIDATION_REQUIRED'
    | 'LIVE_APPROVAL_FORBIDDEN'
    | 'EXECUTABLE_CODE_FORBIDDEN';
  readonly message: string;
};

const LEGAL_TRANSITIONS: Readonly<Record<RegisteredModelVersion['lifecycle'], readonly RegisteredModelVersion['lifecycle'][]>> =
  Object.freeze({
    DRAFT: Object.freeze(['VALIDATION_REQUIRED', 'REJECTED'] as const),
    VALIDATION_REQUIRED: Object.freeze(['VALIDATED_FOR_SIMULATION', 'REJECTED'] as const),
    VALIDATED_FOR_SIMULATION: Object.freeze(['APPROVED_FOR_SIMULATION', 'REJECTED'] as const),
    APPROVED_FOR_SIMULATION: Object.freeze(['RETIRED'] as const),
    REJECTED: Object.freeze([] as const),
    RETIRED: Object.freeze([] as const),
  });

export function sha256Canonical(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function artifactReferenceFor(sha256: string): ReturnType<typeof asModelArtifactReference> {
  return asModelArtifactReference(`mar_${sha256.slice(0, 24)}`);
}

export function freezeArtifact(input: {
  readonly kind: ModelArtifact['kind'];
  readonly description: string;
  readonly configurationCanonical: string;
}): ModelArtifact {
  if (/\b(eval|Function|new Function|child_process|import\s*\()/i.test(input.configurationCanonical)) {
    throw new Error('model artifacts must not store executable code');
  }
  const sha256 = sha256Canonical(input.configurationCanonical);
  return Object.freeze({
    reference: artifactReferenceFor(sha256),
    sha256,
    kind: input.kind,
    description: input.description,
    simulationOnly: true as const,
  });
}

export class ModelRegistry {
  private readonly models = new Map<string, RegisteredModelVersion>();
  private readonly validations: ModelValidationReport[] = [];
  private readonly approvals: ModelApproval[] = [];

  private key(modelId: ModelId, version: ModelVersion): string {
    return `${modelId}@${version}`;
  }

  get(modelId: ModelId, version: ModelVersion): RegisteredModelVersion | undefined {
    return this.models.get(this.key(modelId, version));
  }

  list(): readonly RegisteredModelVersion[] {
    return Object.freeze([...this.models.values()]);
  }

  snapshot(): ModelRegistrySnapshot {
    return Object.freeze({
      models: this.list(),
      validations: Object.freeze([...this.validations]),
      approvals: Object.freeze([...this.approvals]),
    });
  }

  restore(snapshot: ModelRegistrySnapshot): void {
    this.models.clear();
    this.validations.length = 0;
    this.approvals.length = 0;
    for (const model of snapshot.models) {
      this.models.set(this.key(model.modelId, model.version), model);
    }
    this.validations.push(...snapshot.validations);
    this.approvals.push(...snapshot.approvals);
  }

  register(input: Omit<RegisteredModelVersion, 'lifecycle' | 'liveApproved' | 'simulationOnly' | 'artifact'> & {
    readonly artifactKind: ModelArtifact['kind'];
    readonly artifactDescription: string;
  }): Result<RegisteredModelVersion, RegistryFailure> {
    if (/\b(eval|Function|new Function)\b/.test(input.configurationCanonical)) {
      return err({
        code: 'EXECUTABLE_CODE_FORBIDDEN',
        message: 'model configuration must not contain executable code',
      });
    }
    const existing = this.get(input.modelId, input.version);
    if (existing) {
      return err({
        code: 'VERSION_EXISTS',
        message: `model ${input.modelId} version ${input.version} already exists and cannot be replaced`,
      });
    }
    const artifact = freezeArtifact({
      kind: input.artifactKind,
      description: input.artifactDescription,
      configurationCanonical: input.configurationCanonical,
    });
    const recorded: RegisteredModelVersion = Object.freeze({
      modelId: input.modelId,
      version: input.version,
      type: input.type,
      description: input.description,
      owner: input.owner,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      determinism: input.determinism,
      artifact,
      configurationCanonical: input.configurationCanonical,
      createdAt: input.createdAt,
      lifecycle: 'DRAFT',
      limitations: Object.freeze([...input.limitations]),
      applicableDomain: input.applicableDomain,
      dataRequirements: Object.freeze([...input.dataRequirements]),
      simulationOnly: true,
      liveApproved: false,
    });
    this.models.set(this.key(recorded.modelId, recorded.version), recorded);
    return ok(recorded);
  }

  requireValidation(modelId: ModelId, version: ModelVersion): Result<RegisteredModelVersion, RegistryFailure> {
    return this.transition(modelId, version, 'VALIDATION_REQUIRED');
  }

  recordValidation(report: ModelValidationReport): Result<RegisteredModelVersion, RegistryFailure> {
    if (report.reviewerKind !== 'HUMAN_OPERATOR') {
      return err({
        code: 'HUMAN_OPERATOR_REQUIRED',
        message: 'only a human operator may record model validation',
      });
    }
    if (report.claimsRealWorldPerformance !== false) {
      return err({
        code: 'INVALID_TRANSITION',
        message: 'validation must not claim real-world performance without real evidence',
      });
    }
    const current = this.get(report.modelId, report.version);
    if (!current) {
      return err({ code: 'MODEL_NOT_FOUND', message: 'model version is not registered' });
    }
    this.validations.push(Object.freeze({ ...report, limitations: Object.freeze([...report.limitations]) }));
    if (report.status === 'PASSED_SIMULATION') {
      return this.transition(report.modelId, report.version, 'VALIDATED_FOR_SIMULATION');
    }
    if (report.status === 'FAILED') {
      return this.transition(report.modelId, report.version, 'REJECTED');
    }
    return ok(current);
  }

  approveForSimulation(
    actor: unknown,
    input: {
      readonly modelId: ModelId;
      readonly version: ModelVersion;
      readonly reason: string;
      readonly now: UtcInstant;
    },
  ): Result<RegisteredModelVersion, RegistryFailure> {
    if (!isVerifiedActorContext(actor)) {
      return err({
        code: 'ACTOR_CONTEXT_REQUIRED',
        message: 'model approval requires a verified ActorContext',
      });
    }
    const context = actor as VerifiedActorContext;
    if (context.actorId === input.modelId || context.actorId.startsWith('mdl_')) {
      return err({
        code: 'SELF_APPROVAL_FORBIDDEN',
        message: 'a model cannot approve itself',
      });
    }
    if (input.reason.trim().length === 0) {
      return err({
        code: 'HUMAN_OPERATOR_REQUIRED',
        message: 'approval requires an explicit human reason',
      });
    }
    const current = this.get(input.modelId, input.version);
    if (!current) {
      return err({ code: 'MODEL_NOT_FOUND', message: 'model version is not registered' });
    }
    if (current.lifecycle !== 'VALIDATED_FOR_SIMULATION') {
      return err({
        code: 'VALIDATION_REQUIRED',
        message: 'simulation approval requires VALIDATED_FOR_SIMULATION',
      });
    }
    const approved = this.transition(input.modelId, input.version, 'APPROVED_FOR_SIMULATION');
    if (!approved.ok) {
      return approved;
    }
    this.approvals.push(
      Object.freeze({
        modelId: input.modelId,
        version: input.version,
        actorId: context.actorId,
        subjectId: context.subjectId,
        sessionId: context.sessionId,
        actorKind: 'HUMAN_OPERATOR',
        reason: input.reason,
        approvedAt: input.now,
      }),
    );
    return approved;
  }

  retire(modelId: ModelId, version: ModelVersion): Result<RegisteredModelVersion, RegistryFailure> {
    return this.transition(modelId, version, 'RETIRED');
  }

  rejectInPlaceReplacement(
    modelId: ModelId,
    version: ModelVersion,
    nextConfiguration: string,
  ): Result<true, RegistryFailure> {
    const current = this.get(modelId, version);
    if (!current) {
      return err({ code: 'MODEL_NOT_FOUND', message: 'model version is not registered' });
    }
    if (current.configurationCanonical !== nextConfiguration || current.artifact.sha256 !== sha256Canonical(nextConfiguration)) {
      return err({
        code: 'ARTIFACT_IMMUTABLE',
        message: 'changing weights, parameters, features, or formula requires a new model version',
      });
    }
    return ok(true);
  }

  private transition(
    modelId: ModelId,
    version: ModelVersion,
    next: RegisteredModelVersion['lifecycle'],
  ): Result<RegisteredModelVersion, RegistryFailure> {
    const current = this.get(modelId, version);
    if (!current) {
      return err({ code: 'MODEL_NOT_FOUND', message: 'model version is not registered' });
    }
    if (next === current.lifecycle) {
      return ok(current);
    }
    if (!LEGAL_TRANSITIONS[current.lifecycle].includes(next)) {
      return err({
        code: 'INVALID_TRANSITION',
        message: `cannot move ${current.lifecycle} to ${next}`,
      });
    }
    const updated = Object.freeze({ ...current, lifecycle: next, liveApproved: false as const });
    this.models.set(this.key(modelId, version), updated);
    return ok(updated);
  }
}

export const CANONICAL_RISK_MODEL_ID = asModelId('mdl_investment_pretrade');
export const CANONICAL_RISK_MODEL_VERSION = asModelVersion('risk-model-v1');

export const CANONICAL_RISK_MODEL_CONFIGURATION = Object.freeze({
  modelId: 'mdl_investment_pretrade',
  version: 'risk-model-v1',
  type: 'RISK_MODEL',
  ratioScale: 8,
  concentrationLimitDefault: '60000000',
  stressEquityNegative20: '80000000',
  stalePricePolicy: 'REQUIRE_REVIEW',
  missingPricePolicy: 'INSUFFICIENT_DATA',
  simulationOnly: true,
  liveApproved: false,
});

export function seedCanonicalRiskModel(
  registry: ModelRegistry,
  actor: unknown,
  now: UtcInstant,
): Result<RegisteredModelVersion, RegistryFailure> {
  const configurationCanonical = JSON.stringify(CANONICAL_RISK_MODEL_CONFIGURATION);
  const registered = registry.register({
    modelId: CANONICAL_RISK_MODEL_ID,
    version: CANONICAL_RISK_MODEL_VERSION,
    type: 'RISK_MODEL',
    description: 'Deterministic paper-portfolio pre-trade risk model. Engineering/simulation only.',
    owner: 'solstice-risk',
    inputSchema: 'PortfolioRiskSnapshot + ProposedPaperTrade',
    outputSchema: 'RiskDecision',
    determinism: 'DETERMINISTIC',
    configurationCanonical,
    createdAt: now,
    limitations: Object.freeze([
      'Does not predict investment outcomes',
      'Uses fixture liquidity and simulated prices only',
      'Not a regulatory capital model',
    ]),
    applicableDomain: 'INVESTMENTS_PAPER_SIMULATION',
    dataRequirements: Object.freeze(['positions', 'prices', 'brokerage-cash', 'mandate-liquidity']),
    artifactKind: 'FORMULA',
    artifactDescription: 'Canonical pre-trade concentration, cash-reserve, freshness, and stress formulas',
  });
  if (!registered.ok) {
    const existing = registry.get(CANONICAL_RISK_MODEL_ID, CANONICAL_RISK_MODEL_VERSION);
    if (existing?.lifecycle === 'APPROVED_FOR_SIMULATION') {
      return ok(existing);
    }
    return registered;
  }
  const queued = registry.requireValidation(CANONICAL_RISK_MODEL_ID, CANONICAL_RISK_MODEL_VERSION);
  if (!queued.ok) {
    return queued;
  }
  const validated = registry.recordValidation({
    validationId: asModelValidationId('mvn_canonical_risk_v1'),
    modelId: CANONICAL_RISK_MODEL_ID,
    version: CANONICAL_RISK_MODEL_VERSION,
    testsExecuted: Object.freeze(['concentration-block', 'cash-reserve', 'stale-price', 'reproducibility']),
    testDatasetReference: 'fixture:paper-etf-portfolio',
    expectedBehavior: 'BLOCK when post-trade concentration exceeds the configured hard limit',
    observedBehavior: 'Deterministic BLOCK on 80 percent concentration fixture',
    limitations: Object.freeze(['Simulation fixtures only; no live market evidence']),
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
    modelId: CANONICAL_RISK_MODEL_ID,
    version: CANONICAL_RISK_MODEL_VERSION,
    reason: 'Human operator approved the simulation risk model after fixture validation',
    now,
  });
}
