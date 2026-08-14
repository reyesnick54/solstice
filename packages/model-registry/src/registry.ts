import type {
  AllocationGrant,
  AllocationRefusal,
  ModelRecord,
  ReleasedModel,
} from '../../contracts/src/model-types.ts';
import { isReleasedModel } from '../../contracts/src/model-types.ts';

/**
 * Registry of every economically consequential model.
 * A model not in RELEASED validation state cannot receive allocation —
 * enforced by the ReleasedModel type, not a runtime flag that can be skipped.
 */
export class ModelRegistry {
  private readonly models = new Map<string, ModelRecord>();

  register(model: ModelRecord): ModelRecord {
    const frozen = Object.freeze({ ...model, features: Object.freeze([...model.features]) });
    this.models.set(key(model.modelId, model.version), frozen);
    return frozen;
  }

  get(modelId: string, version: string): ModelRecord | undefined {
    return this.models.get(key(modelId, version));
  }

  list(): readonly ModelRecord[] {
    return [...this.models.values()];
  }

  /**
   * Structural gate. Only ReleasedModel may be allocated.
   */
  allocatable(modelId: string, version: string): ReleasedModel | AllocationRefusal {
    const model = this.get(modelId, version);
    if (!model || !isReleasedModel(model)) {
      return {
        ok: false,
        code: 'MODEL_NOT_RELEASED',
        modelId,
        validationState: model?.validationState ?? 'DRAFT',
      };
    }
    return model;
  }

  allocate(
    modelId: string,
    version: string,
    weightNumerator: bigint,
    weightDenominator: bigint,
  ): AllocationGrant | AllocationRefusal {
    const gate = this.allocatable(modelId, version);
    if ('ok' in gate && gate.ok === false) {
      return gate;
    }
    return {
      ok: true,
      model: gate,
      weightNumerator,
      weightDenominator,
    };
  }
}

function key(modelId: string, version: string): string {
  return `${modelId}@${version}`;
}

export function allocateReleased(
  model: ReleasedModel,
  weightNumerator: bigint,
  weightDenominator: bigint,
): AllocationGrant {
  return {
    ok: true,
    model,
    weightNumerator,
    weightDenominator,
  };
}
