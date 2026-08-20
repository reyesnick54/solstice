/**
 * Productive-economy UnitRegistry compatibility facade.
 *
 * Chunk 43 owns the protocol unit contract. Chunk 118 owns the single
 * canonical normalization authority at packages/sunrey-chain/src/units.
 * This class stays category-scoped for existing productive callers and
 * does not claim canonical unit authority. Unrelated economic dimensions
 * are never converted into one fake universal physical unit.
 */

import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from './types.ts';

export const UNIT_REGISTRY_ID = 'sunrey.unit-registry.productive.v1' as const;

export type UnitDefinition = {
  readonly unitId: string;
  readonly category: ProductiveCategory;
  readonly symbol: string;
  readonly baseUnitId: string;
  readonly scaleToBase: bigint;
};

export type NormalizedQuantity = {
  readonly category: ProductiveCategory;
  readonly unitId: string;
  readonly baseUnitId: string;
  readonly quantity: bigint;
  readonly normalizedQuantity: bigint;
};

const ENERGY_UNITS: readonly UnitDefinition[] = [
  { unitId: 'Wh', category: 'ENERGY', symbol: 'Wh', baseUnitId: 'Wh', scaleToBase: 1n },
  { unitId: 'kWh', category: 'ENERGY', symbol: 'kWh', baseUnitId: 'Wh', scaleToBase: 1_000n },
  { unitId: 'MWh', category: 'ENERGY', symbol: 'MWh', baseUnitId: 'Wh', scaleToBase: 1_000_000n },
];

const FOOD_UNITS: readonly UnitDefinition[] = [
  { unitId: 'kg', category: 'FOOD_AGRICULTURE', symbol: 'kg', baseUnitId: 'g', scaleToBase: 1_000n },
  { unitId: 't', category: 'FOOD_AGRICULTURE', symbol: 't', baseUnitId: 'g', scaleToBase: 1_000_000n },
];

const WATER_UNITS: readonly UnitDefinition[] = [
  { unitId: 'L', category: 'WATER', symbol: 'L', baseUnitId: 'L', scaleToBase: 1n },
  { unitId: 'm3', category: 'WATER', symbol: 'm3', baseUnitId: 'L', scaleToBase: 1_000n },
];

const MINERAL_UNITS: readonly UnitDefinition[] = [
  { unitId: 'kg', category: 'MINERALS_RAW_MATERIALS', symbol: 'kg', baseUnitId: 'g', scaleToBase: 1_000n },
  { unitId: 't', category: 'MINERALS_RAW_MATERIALS', symbol: 't', baseUnitId: 'g', scaleToBase: 1_000_000n },
];

const REAL_ESTATE_UNITS: readonly UnitDefinition[] = [
  { unitId: 'm2_hour', category: 'REAL_ESTATE_USE', symbol: 'm2·h', baseUnitId: 'm2_hour', scaleToBase: 1n },
];

const COMPUTE_UNITS: readonly UnitDefinition[] = [
  { unitId: 'GPU_HOUR', category: 'COMPUTE', symbol: 'GPU·h', baseUnitId: 'GPU_HOUR', scaleToBase: 1n },
  { unitId: 'CPU_HOUR', category: 'COMPUTE', symbol: 'CPU·h', baseUnitId: 'CPU_HOUR', scaleToBase: 1n },
];

const AI_COMPUTE_UNITS: readonly UnitDefinition[] = [
  { unitId: 'GPU_HOUR', category: 'AI_COMPUTE', symbol: 'GPU·h', baseUnitId: 'GPU_HOUR', scaleToBase: 1n },
  { unitId: 'TOKEN', category: 'AI_COMPUTE', symbol: 'tok', baseUnitId: 'TOKEN', scaleToBase: 1n },
];

const MANUFACTURING_UNITS: readonly UnitDefinition[] = [
  { unitId: 'UNIT', category: 'MANUFACTURING', symbol: 'unit', baseUnitId: 'UNIT', scaleToBase: 1n },
];

const LOGISTICS_UNITS: readonly UnitDefinition[] = [
  { unitId: 't_km', category: 'LOGISTICS_TRANSPORTATION', symbol: 't·km', baseUnitId: 't_km', scaleToBase: 1n },
];

const STORAGE_UNITS: readonly UnitDefinition[] = [
  { unitId: 'm3_hour', category: 'STORAGE', symbol: 'm3·h', baseUnitId: 'm3_hour', scaleToBase: 1n },
];

const BANDWIDTH_UNITS: readonly UnitDefinition[] = [
  { unitId: 'GB', category: 'BANDWIDTH_COMMUNICATIONS', symbol: 'GB', baseUnitId: 'MB', scaleToBase: 1_000n },
];

const INFRASTRUCTURE_UNITS: readonly UnitDefinition[] = [
  { unitId: 'facility_hour', category: 'INFRASTRUCTURE', symbol: 'fac·h', baseUnitId: 'facility_hour', scaleToBase: 1n },
];

const GOODS_UNITS: readonly UnitDefinition[] = [
  { unitId: 'UNIT', category: 'GOODS', symbol: 'unit', baseUnitId: 'UNIT', scaleToBase: 1n },
];

const SERVICES_UNITS: readonly UnitDefinition[] = [
  { unitId: 'service_hour', category: 'SERVICES', symbol: 'svc·h', baseUnitId: 'service_hour', scaleToBase: 1n },
  { unitId: 'UNIT', category: 'SERVICES', symbol: 'unit', baseUnitId: 'UNIT', scaleToBase: 1n },
];

const AUTOMATED_UNITS: readonly UnitDefinition[] = [
  { unitId: 'UNIT', category: 'AUTOMATED_MACHINE_OUTPUT', symbol: 'unit', baseUnitId: 'UNIT', scaleToBase: 1n },
];

const BY_CATEGORY: Readonly<Record<ProductiveCategory, readonly UnitDefinition[]>> = {
  ENERGY: ENERGY_UNITS,
  FOOD_AGRICULTURE: FOOD_UNITS,
  WATER: WATER_UNITS,
  MINERALS_RAW_MATERIALS: MINERAL_UNITS,
  REAL_ESTATE_USE: REAL_ESTATE_UNITS,
  COMPUTE: COMPUTE_UNITS,
  AI_COMPUTE: AI_COMPUTE_UNITS,
  MANUFACTURING: MANUFACTURING_UNITS,
  LOGISTICS_TRANSPORTATION: LOGISTICS_UNITS,
  STORAGE: STORAGE_UNITS,
  BANDWIDTH_COMMUNICATIONS: BANDWIDTH_UNITS,
  INFRASTRUCTURE: INFRASTRUCTURE_UNITS,
  GOODS: GOODS_UNITS,
  SERVICES: SERVICES_UNITS,
  AUTOMATED_MACHINE_OUTPUT: AUTOMATED_UNITS,
};

export class UnitRegistry {
  readonly registryId = UNIT_REGISTRY_ID;
  private readonly definitions = new Map<string, UnitDefinition>();

  constructor() {
    for (const category of PRODUCTIVE_CATEGORIES) {
      for (const definition of BY_CATEGORY[category]) {
        this.definitions.set(keyOf(category, definition.unitId), definition);
      }
    }
  }

  unitsFor(category: ProductiveCategory): readonly UnitDefinition[] {
    return BY_CATEGORY[category];
  }

  definitionOf(category: ProductiveCategory, unitId: string): UnitDefinition | undefined {
    return this.definitions.get(keyOf(category, unitId));
  }

  isAllowed(category: ProductiveCategory, unitId: string): boolean {
    return this.definitions.has(keyOf(category, unitId));
  }

  /**
   * Historical category-scoped scale. Not the semantic authority.
   * New contributions must call the Chunk 118 catalog via
   * `packages/sunrey-chain/src/units`.
   */
  normalize(category: ProductiveCategory, unitId: string, quantity: bigint): NormalizedQuantity | null {
    if (quantity < 0n) {
      return null;
    }
    const definition = this.definitionOf(category, unitId);
    if (!definition) {
      return null;
    }
    return Object.freeze({
      category,
      unitId,
      baseUnitId: definition.baseUnitId,
      quantity,
      normalizedQuantity: quantity * definition.scaleToBase,
    });
  }

  isIndependentSemanticAuthority(): false {
    return false;
  }
}

export const defaultUnitRegistry = new UnitRegistry();

function keyOf(category: ProductiveCategory, unitId: string): string {
  return `${category}:${unitId}`;
}
