import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  asEconomicValueModelVersion,
  asValuationFormulaVersion,
  type EconomicValueModelVersion,
  type ValuationFormulaVersion,
} from './ids.ts';
import {
  ECONOMIC_VALUE_DIMENSIONS,
  type EconomicValueDimensionKind,
  type FormulaLifecycle,
} from './taxonomy.ts';
import type { EconomicValueSnapshot, FormulaModel, ModelComparison } from './types.ts';

export const FORMULA_V1 = asValuationFormulaVersion('peve-formula-v1');
export const FORMULA_V2 = asValuationFormulaVersion('peve-formula-v2');
export const MODEL_V1 = asEconomicValueModelVersion('peve-model-v1');
export const MODEL_V2 = asEconomicValueModelVersion('peve-model-v2');

const WEIGHTS_V1: Readonly<Record<EconomicValueDimensionKind, number>> = Object.freeze({
  LIQUIDITY_RESILIENCE: 1500,
  CASH_FLOW_STABILITY: 1000,
  SAVINGS_CAPACITY: 800,
  DEBT_BURDEN: 1000,
  GOAL_PROGRESS: 800,
  ECONOMIC_RESILIENCE: 1200,
  OPPORTUNITY_CAPACITY: 700,
  INCOME_DIVERSIFICATION: 500,
  FINANCIAL_FRICTION: 500,
  ECONOMIC_PROGRESS: 800,
  ATTRIBUTED_VALUE_CREATED: 700,
  DATA_PROVENANCE_STRENGTH: 500,
});

const WEIGHTS_V2: Readonly<Record<EconomicValueDimensionKind, number>> = Object.freeze({
  LIQUIDITY_RESILIENCE: 1800,
  CASH_FLOW_STABILITY: 1000,
  SAVINGS_CAPACITY: 800,
  DEBT_BURDEN: 1100,
  GOAL_PROGRESS: 800,
  ECONOMIC_RESILIENCE: 1400,
  OPPORTUNITY_CAPACITY: 700,
  INCOME_DIVERSIFICATION: 500,
  FINANCIAL_FRICTION: 500,
  ECONOMIC_PROGRESS: 700,
  ATTRIBUTED_VALUE_CREATED: 200,
  DATA_PROVENANCE_STRENGTH: 500,
});

function assertWeightSum(weights: Readonly<Record<EconomicValueDimensionKind, number>>): void {
  const sum = ECONOMIC_VALUE_DIMENSIONS.reduce((acc, kind) => acc + weights[kind], 0);
  if (sum !== 10000) {
    throw new Error(`PEVE weights must sum to 10000, got ${String(sum)}`);
  }
}

assertWeightSum(WEIGHTS_V1);
assertWeightSum(WEIGHTS_V2);

function modelOf(
  formulaVersion: ValuationFormulaVersion,
  modelVersion: EconomicValueModelVersion,
  weights: Readonly<Record<EconomicValueDimensionKind, number>>,
  extras: {
    readonly reserveCoverageTargetMonths: number;
    readonly attributedValueScaleMinorUnits: string;
  },
): FormulaModel {
  return Object.freeze({
    formulaVersion,
    modelVersion,
    lifecycle: 'EXPERIMENTAL',
    weights,
    weightDenominator: 10000,
    reserveCoverageTargetMonths: extras.reserveCoverageTargetMonths,
    attributedValueScaleMinorUnits: extras.attributedValueScaleMinorUnits,
    debtPressureHighNumerator: 40,
    debtPressureHighDenominator: 100,
    researchRequired: true,
  });
}

export class FormulaRegistry {
  private readonly models = new Map<string, FormulaModel>();
  private activeKey: string | undefined;

  constructor() {
    this.register(
      modelOf(FORMULA_V1, MODEL_V1, WEIGHTS_V1, {
        reserveCoverageTargetMonths: 3,
        attributedValueScaleMinorUnits: '10000',
      }),
    );
    this.register(
      modelOf(FORMULA_V2, MODEL_V2, WEIGHTS_V2, {
        reserveCoverageTargetMonths: 3,
        attributedValueScaleMinorUnits: '10000',
      }),
    );
    this.activate(FORMULA_V1, MODEL_V1);
  }

  register(model: FormulaModel): FormulaModel {
    const key = this.key(model.formulaVersion, model.modelVersion);
    const existing = this.models.get(key);
    if (existing) {
      throw new Error(`formula ${key} is immutable once registered`);
    }
    const frozen = Object.freeze({ ...model, weights: Object.freeze({ ...model.weights }) });
    this.models.set(key, frozen);
    return frozen;
  }

  activate(
    formulaVersion: ValuationFormulaVersion,
    modelVersion: EconomicValueModelVersion,
    at?: UtcInstant,
  ): Result<FormulaModel, { readonly code: 'FORMULA_NOT_FOUND' | 'FORMULA_RETIRED'; readonly message: string }> {
    const key = this.key(formulaVersion, modelVersion);
    const model = this.models.get(key);
    if (!model) {
      return err({ code: 'FORMULA_NOT_FOUND', message: `unknown formula ${key}` });
    }
    if (model.lifecycle === 'RETIRED') {
      return err({ code: 'FORMULA_RETIRED', message: `${key} is retired and cannot be reactivated` });
    }
    if (this.activeKey && this.activeKey !== key) {
      const previous = this.models.get(this.activeKey);
      if (previous && previous.lifecycle === 'ACTIVE') {
        this.models.set(this.activeKey, Object.freeze({ ...previous, lifecycle: 'RETIRED', retiredAt: at }));
      }
    }
    const next: FormulaModel = Object.freeze({
      ...model,
      lifecycle: 'ACTIVE' as FormulaLifecycle,
      ...(at ? { activatedAt: at } : {}),
    });
    this.models.set(key, next);
    this.activeKey = key;
    return ok(next);
  }

  retire(
    formulaVersion: ValuationFormulaVersion,
    modelVersion: EconomicValueModelVersion,
    at: UtcInstant,
  ): Result<FormulaModel, { readonly code: 'FORMULA_NOT_FOUND'; readonly message: string }> {
    const key = this.key(formulaVersion, modelVersion);
    const model = this.models.get(key);
    if (!model) {
      return err({ code: 'FORMULA_NOT_FOUND', message: `unknown formula ${key}` });
    }
    const next = Object.freeze({ ...model, lifecycle: 'RETIRED' as FormulaLifecycle, retiredAt: at });
    this.models.set(key, next);
    if (this.activeKey === key) {
      this.activeKey = undefined;
    }
    return ok(next);
  }

  get(formulaVersion: ValuationFormulaVersion, modelVersion: EconomicValueModelVersion): FormulaModel | undefined {
    return this.models.get(this.key(formulaVersion, modelVersion));
  }

  active(): FormulaModel {
    if (!this.activeKey) {
      throw new Error('no active PEVE formula');
    }
    const model = this.models.get(this.activeKey);
    if (!model) {
      throw new Error('active PEVE formula missing');
    }
    return model;
  }

  list(): readonly FormulaModel[] {
    return Object.freeze([...this.models.values()]);
  }

  compare(
    leftVersion: { readonly formulaVersion: ValuationFormulaVersion; readonly modelVersion: EconomicValueModelVersion },
    rightVersion: { readonly formulaVersion: ValuationFormulaVersion; readonly modelVersion: EconomicValueModelVersion },
    snapshots?: { readonly left: EconomicValueSnapshot; readonly right: EconomicValueSnapshot },
  ): Result<ModelComparison, { readonly code: 'FORMULA_NOT_FOUND'; readonly message: string }> {
    const left = this.get(leftVersion.formulaVersion, leftVersion.modelVersion);
    const right = this.get(rightVersion.formulaVersion, rightVersion.modelVersion);
    if (!left || !right) {
      return err({ code: 'FORMULA_NOT_FOUND', message: 'both formula versions are required for comparison' });
    }
    const leftKinds = new Set(ECONOMIC_VALUE_DIMENSIONS.filter((kind) => left.weights[kind] > 0));
    const rightKinds = new Set(ECONOMIC_VALUE_DIMENSIONS.filter((kind) => right.weights[kind] > 0));
    const dimensionsAdded = ECONOMIC_VALUE_DIMENSIONS.filter((kind) => !leftKinds.has(kind) && rightKinds.has(kind));
    const dimensionsRemoved = ECONOMIC_VALUE_DIMENSIONS.filter((kind) => leftKinds.has(kind) && !rightKinds.has(kind));
    const weightsChanged = ECONOMIC_VALUE_DIMENSIONS.filter((kind) => left.weights[kind] !== right.weights[kind]).map(
      (kind) => ({ kind, left: left.weights[kind], right: right.weights[kind] }),
    );
    const formulaChanged =
      left.reserveCoverageTargetMonths !== right.reserveCoverageTargetMonths ||
      left.attributedValueScaleMinorUnits !== right.attributedValueScaleMinorUnits ||
      left.debtPressureHighNumerator !== right.debtPressureHighNumerator ||
      weightsChanged.length > 0;
    const comparison: ModelComparison = {
      left,
      right,
      dimensionsAdded: Object.freeze(dimensionsAdded),
      dimensionsRemoved: Object.freeze(dimensionsRemoved),
      weightsChanged: Object.freeze(weightsChanged),
      formulaChanged,
      ...(snapshots
        ? {
            outputDifference: {
              snapshotId: snapshots.left.snapshotId,
              leftComposite: snapshots.left.composite.measure.points,
              rightComposite: snapshots.right.composite.measure.points,
              dimensionDeltas: Object.freeze(
                ECONOMIC_VALUE_DIMENSIONS.map((kind) => ({
                  kind,
                  left: snapshots.left.vector.dimensions.find((item) => item.kind === kind)?.measure.points ?? '0',
                  right: snapshots.right.vector.dimensions.find((item) => item.kind === kind)?.measure.points ?? '0',
                })),
              ),
            },
          }
        : {}),
    };
    return ok(Object.freeze(comparison));
  }

  private key(formulaVersion: string, modelVersion: string): string {
    return `${formulaVersion}:${modelVersion}`;
  }
}
