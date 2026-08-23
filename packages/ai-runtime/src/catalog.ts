import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { ModelId, ModelVersion } from '../../model-registry/src/ids.ts';
import {
  AI_PRODUCTION_AUTHORIZED,
  AI_PRODUCTION_READY,
  AI_ENVIRONMENT,
} from './posture.ts';
import type { AiApprovedPurpose, AiFailureCode, AiPrivacyClass, AiProviderKind } from './taxonomy.ts';

export const INFERENCE_MODEL_STATUSES = [
  'DISABLED',
  'TEST',
  'APPROVED_SANDBOX',
  'APPROVED_INTERNAL',
  'PREPRODUCTION',
  'PRODUCTION_APPROVED',
] as const;
export type InferenceModelStatus = (typeof INFERENCE_MODEL_STATUSES)[number];

export const INFERENCE_LATENCY_CLASSES = ['LOW', 'STANDARD', 'BATCH'] as const;
export type InferenceLatencyClass = (typeof INFERENCE_LATENCY_CLASSES)[number];

export const INFERENCE_ENVIRONMENTS = ['SIMULATION', 'SANDBOX', 'INTERNAL', 'PREPRODUCTION', 'PRODUCTION'] as const;
export type InferenceModelEnvironment = (typeof INFERENCE_ENVIRONMENTS)[number];

export type InferenceCostMetadata = {
  readonly inputMicrosPer1kTokens: number;
  readonly outputMicrosPer1kTokens: number;
  readonly currency: 'USD';
};

export type InferenceModelRecord = {
  readonly modelId: ModelId;
  readonly provider: AiProviderKind;
  readonly providerModel: string;
  readonly version: ModelVersion;
  readonly capabilities: readonly string[];
  readonly contextWindow: number;
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly supportsStructuredOutput: boolean;
  readonly approvedPurposes: readonly AiApprovedPurpose[];
  readonly environment: InferenceModelEnvironment;
  readonly status: InferenceModelStatus;
  readonly cost: InferenceCostMetadata;
  readonly latencyClass: InferenceLatencyClass;
  readonly dataHandling: readonly AiPrivacyClass[];
  readonly jurisdictionRestrictions: readonly string[];
  readonly liveApproved: false;
};

export type CatalogFailure = {
  readonly ok: false;
  readonly code: AiFailureCode;
  readonly detail: string;
};

export class InferenceModelCatalog {
  private readonly models = new Map<string, InferenceModelRecord>();

  register(record: InferenceModelRecord): Result<InferenceModelRecord, CatalogFailure> {
    if (record.liveApproved !== false) {
      return err({
        ok: false,
        code: 'PRODUCTION_APPROVAL_UNREACHABLE',
        detail: 'live model approval is forbidden on this tree',
      });
    }
    if (record.status === 'PRODUCTION_APPROVED') {
      return this.refuseProduction(record.modelId);
    }
    const key = this.key(record.modelId, record.version);
    this.models.set(key, Object.freeze({ ...record }));
    return ok(this.models.get(key)!);
  }

  get(modelId: ModelId, version: ModelVersion): InferenceModelRecord | null {
    return this.models.get(this.key(modelId, version)) ?? null;
  }

  list(): readonly InferenceModelRecord[] {
    return Object.freeze([...this.models.values()]);
  }

  listByPurpose(purpose: AiApprovedPurpose): readonly InferenceModelRecord[] {
    return Object.freeze(this.list().filter((model) => model.approvedPurposes.includes(purpose) && model.status !== 'DISABLED'));
  }

  transition(
    modelId: ModelId,
    version: ModelVersion,
    status: InferenceModelStatus,
    env: NodeJS.ProcessEnv = process.env,
  ): Result<InferenceModelRecord, CatalogFailure> {
    const current = this.get(modelId, version);
    if (!current) {
      return err({ ok: false, code: 'MODEL_REF_UNRESOLVED', detail: `${modelId}@${version} is not registered` });
    }
    if (status === 'PRODUCTION_APPROVED') {
      return this.refuseProduction(modelId, env);
    }
    const next = Object.freeze({ ...current, status });
    this.models.set(this.key(modelId, version), next);
    return ok(next);
  }

  private refuseProduction(modelId: ModelId, env: NodeJS.ProcessEnv = process.env): Result<never, CatalogFailure> {
    const envAsked =
      env.SUNREY_APPROVE_PRODUCTION_MODELS === 'true' ||
      env.SUNREY_MODEL_PRODUCTION_APPROVED === 'true' ||
      env.PRODUCTION_AUTHORIZED === 'true';
    void envAsked;
    return err({
      ok: false,
      code: 'PRODUCTION_APPROVAL_UNREACHABLE',
      detail:
        `model ${modelId} cannot become PRODUCTION_APPROVED while ENVIRONMENT=${AI_ENVIRONMENT}, ` +
        `PRODUCTION_READY=${String(AI_PRODUCTION_READY)}, production_authorized=${String(AI_PRODUCTION_AUTHORIZED)}`,
    });
  }

  private key(modelId: ModelId, version: ModelVersion): string {
    return `${modelId}@${version}`;
  }
}
