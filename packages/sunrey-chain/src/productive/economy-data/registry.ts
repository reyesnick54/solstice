/**
 * Canonical productive asset / output registry.
 *
 * Extends Chunk 44 ProductiveEconomicObject. Does not expose sensitive
 * infrastructure coordinates when location policy forbids it.
 */

import { CATEGORY_TO_PRODUCTIVE, type ProductiveResourceRecord, type ProductiveEconomyCategory } from './types.ts';

export class ProductiveAssetRegistry {
  readonly #byId = new Map<string, ProductiveResourceRecord>();

  register(record: ProductiveResourceRecord): ProductiveResourceRecord {
    const stored = redactLocation(record);
    this.#byId.set(stored.resourceId, stored);
    return stored;
  }

  get(resourceId: string): ProductiveResourceRecord | undefined {
    return this.#byId.get(resourceId);
  }

  list(category?: ProductiveEconomyCategory): readonly ProductiveResourceRecord[] {
    const rows = [...this.#byId.values()];
    return category ? rows.filter((row) => row.category === category) : rows;
  }

  require(resourceId: string): ProductiveResourceRecord {
    const found = this.#byId.get(resourceId);
    if (!found) {
      throw new Error(`unknown productive resource ${resourceId}`);
    }
    return found;
  }
}

export function createResource(input: {
  readonly resourceId: string;
  readonly category: ProductiveEconomyCategory;
  readonly subtype: string;
  readonly ownerRef?: string | null;
  readonly operatorRef?: string | null;
  readonly jurisdiction: string;
  readonly region?: string | null;
  readonly publicDisclosureAllowed?: boolean;
  readonly unit: string;
  readonly valuationMethodologyId: string;
  readonly minimumSources?: number;
}): ProductiveResourceRecord {
  const publicDisclosureAllowed = input.publicDisclosureAllowed ?? false;
  return Object.freeze({
    schema: 'sunrey.productive.economy-data.v1',
    resourceId: input.resourceId,
    category: input.category,
    productiveCategory: CATEGORY_TO_PRODUCTIVE[input.category],
    subtype: input.subtype,
    ownerRef: input.ownerRef ?? null,
    operatorRef: input.operatorRef ?? null,
    location: Object.freeze({
      precision: publicDisclosureAllowed ? ('REGION' as const) : ('REDACTED' as const),
      jurisdiction: input.jurisdiction,
      region: publicDisclosureAllowed ? (input.region ?? null) : null,
      publicDisclosureAllowed,
    }),
    unit: input.unit,
    status: 'ACTIVE',
    sourceRequirements: Object.freeze(['SIGNED', 'PROVENANCED', 'LABELED_METRIC']),
    valuationMethodologyId: input.valuationMethodologyId,
    oracleRequirements: Object.freeze({
      minimumSources: input.minimumSources ?? 2,
      allowSingleSourceVerified: true,
      singleSourceIsNotConsensus: true as const,
    }),
    productionActive: false,
  });
}

export function redactLocation(record: ProductiveResourceRecord): ProductiveResourceRecord {
  if (record.location.publicDisclosureAllowed && record.location.precision !== 'REDACTED') {
    return record;
  }
  return Object.freeze({
    ...record,
    location: Object.freeze({
      precision: 'REDACTED' as const,
      jurisdiction: record.location.jurisdiction,
      region: null,
      publicDisclosureAllowed: false,
    }),
    ownerRef: record.ownerRef ? 'REDACTED' : null,
    operatorRef: record.operatorRef ? 'REDACTED' : null,
  });
}
