export type RegisteredModel = {
  readonly modelId: string;
  readonly name: string;
  readonly version: string;
  readonly kind: 'DATA_VALUATION';
  readonly presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE';
  readonly notAGuaranteedPrice: true;
  readonly specialistReviewRequired: true;
};

const REGISTRY = new Map<string, RegisteredModel>();

export class ModelRegistry {
  register(model: RegisteredModel): void {
    REGISTRY.set(model.modelId, Object.freeze({ ...model }));
  }

  get(modelId: string): RegisteredModel | undefined {
    return REGISTRY.get(modelId);
  }

  list(): readonly RegisteredModel[] {
    return [...REGISTRY.values()];
  }
}

export const DATA_VALUATION_MODEL_ID = 'indicative-data-compensation-v1';

export function registerDataValuationModel(registry: ModelRegistry): RegisteredModel {
  const model: RegisteredModel = Object.freeze({
    modelId: DATA_VALUATION_MODEL_ID,
    name: 'Indicative personal-data compensation (simulation)',
    version: '1',
    kind: 'DATA_VALUATION',
    presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
    notAGuaranteedPrice: true,
    specialistReviewRequired: true,
  });
  registry.register(model);
  return model;
}
