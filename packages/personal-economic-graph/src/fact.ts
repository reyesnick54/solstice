import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { Money } from '../../money/src/money.ts';
import type { EconomicEdgeId, EconomicFactId, EconomicGraphId, EconomicNodeId } from './ids.ts';
import {
  assertFactConfidence,
  type DataQualityState,
  type FactConfidence,
  type Provenance,
  type ProvenanceFailure,
} from './provenance.ts';

export type FactValue =
  | { readonly type: 'MONEY'; readonly minorUnits: string; readonly currency: string }
  | { readonly type: 'TEXT'; readonly value: string }
  | { readonly type: 'INT'; readonly value: string }
  | { readonly type: 'BOOL'; readonly value: boolean }
  | { readonly type: 'INSTANT'; readonly value: UtcInstant }
  | { readonly type: 'REF'; readonly system: string; readonly id: string };

export type EconomicFact = {
  readonly factId: EconomicFactId;
  readonly graphId: EconomicGraphId;
  readonly nodeId?: EconomicNodeId;
  readonly edgeId?: EconomicEdgeId;
  readonly key: string;
  readonly value: FactValue;
  readonly confidence: FactConfidence;
  readonly quality: DataQualityState;
  readonly provenance: Provenance;
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant | null;
  readonly observedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
  readonly supersededBy: EconomicFactId | null;
  readonly version: number;
  readonly survivesRebuild: boolean;
};

export type FactFailure = ProvenanceFailure | { readonly code: 'FLOATING_POINT'; readonly message: string };

export function moneyFactValue(money: Money): FactValue {
  return { type: 'MONEY', minorUnits: money.minorUnits.toString(), currency: money.currency };
}

export function factValueKey(value: FactValue): string {
  switch (value.type) {
    case 'MONEY':
      return `MONEY:${value.currency}:${value.minorUnits}`;
    case 'TEXT':
      return `TEXT:${value.value}`;
    case 'INT':
      return `INT:${value.value}`;
    case 'BOOL':
      return `BOOL:${value.value ? '1' : '0'}`;
    case 'INSTANT':
      return `INSTANT:${value.value}`;
    case 'REF':
      return `REF:${value.system}:${value.id}`;
  }
}

export function freezeFact(fact: EconomicFact): Result<EconomicFact, FactFailure> {
  const allowed = assertFactConfidence(fact.provenance.sourceType, fact.confidence, fact.key);
  if (!allowed.ok) {
    return allowed;
  }
  if (fact.value.type === 'MONEY') {
    try {
      Money.fromMinorUnitsString(fact.value.minorUnits, fact.value.currency);
    } catch (error) {
      return err({
        code: 'FLOATING_POINT',
        message: error instanceof Error ? error.message : 'invalid money fact',
      });
    }
  }
  return ok(
    Object.freeze({
      ...fact,
      value: Object.freeze({ ...fact.value }) as FactValue,
      provenance: Object.freeze({ ...fact.provenance }),
    }),
  );
}

export function isCurrentFact(fact: EconomicFact, at: UtcInstant): boolean {
  if (fact.supersededBy !== null) {
    return false;
  }
  if (fact.validTo !== null && fact.validTo <= at) {
    return false;
  }
  return fact.validFrom <= at;
}
