/**
 * In-memory valuation intelligence store (domain foundation — not durable persistence).
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  IntrinsicValueDistribution,
  MarketImpliedExpectation,
  ValuationAssumption,
  ValuationDistribution,
  ValuationIntelligenceStoreSnapshot,
  ValuationScenario,
  ValuationSnapshot,
} from './val01-canonical-domain.ts';
import {
  filterKnowableMarketImpliedExpectations,
  filterKnowableValuationArtifacts,
} from './knowable-at.ts';

export type ValuationIntelligenceStore = {
  upsertSnapshot(snapshot: ValuationSnapshot): void;
  upsertScenario(scenario: ValuationScenario): void;
  upsertAssumption(assumption: ValuationAssumption): void;
  upsertDistribution(distribution: ValuationDistribution): void;
  upsertIntrinsicDistribution(distribution: IntrinsicValueDistribution): void;
  upsertMarketImpliedExpectation(expectation: MarketImpliedExpectation): void;
  snapshot(): ValuationIntelligenceStoreSnapshot;
  snapshotKnowableAt(evaluationTime: UtcInstant): ValuationIntelligenceStoreSnapshot;
};

export function createValuationIntelligenceStore(): ValuationIntelligenceStore {
  const snapshots = new Map<string, ValuationSnapshot>();
  const scenarios = new Map<string, ValuationScenario>();
  const assumptions = new Map<string, ValuationAssumption>();
  const distributions = new Map<string, ValuationDistribution>();
  const intrinsicDistributions = new Map<string, IntrinsicValueDistribution>();
  const marketImplied = new Map<string, MarketImpliedExpectation>();

  const buildSnapshot = (
    snapshotRows: readonly ValuationSnapshot[],
    scenarioRows: readonly ValuationScenario[],
    assumptionRows: readonly ValuationAssumption[],
    distributionRows: readonly ValuationDistribution[],
    intrinsicRows: readonly IntrinsicValueDistribution[],
    marketRows: readonly MarketImpliedExpectation[],
  ): ValuationIntelligenceStoreSnapshot =>
    Object.freeze({
      snapshots: Object.freeze([...snapshotRows]),
      scenarios: Object.freeze([...scenarioRows]),
      assumptions: Object.freeze([...assumptionRows]),
      distributions: Object.freeze([...distributionRows]),
      intrinsicDistributions: Object.freeze([...intrinsicRows]),
      marketImpliedExpectations: Object.freeze([...marketRows]),
    });

  return {
    upsertSnapshot(snapshot) {
      snapshots.set(snapshot.snapshotId, Object.freeze({ ...snapshot }));
    },
    upsertScenario(scenario) {
      scenarios.set(scenario.scenarioId, Object.freeze({ ...scenario }));
    },
    upsertAssumption(assumption) {
      assumptions.set(assumption.assumptionId, Object.freeze({ ...assumption }));
    },
    upsertDistribution(distribution) {
      distributions.set(distribution.distributionId, Object.freeze({ ...distribution }));
    },
    upsertIntrinsicDistribution(distribution) {
      intrinsicDistributions.set(distribution.distributionId, Object.freeze({ ...distribution }));
    },
    upsertMarketImpliedExpectation(expectation) {
      marketImplied.set(expectation.expectationId, Object.freeze({ ...expectation }));
    },
    snapshot() {
      return buildSnapshot(
        [...snapshots.values()],
        [...scenarios.values()],
        [...assumptions.values()],
        [...distributions.values()],
        [...intrinsicDistributions.values()],
        [...marketImplied.values()],
      );
    },
    snapshotKnowableAt(evaluationTime) {
      return buildSnapshot(
        filterKnowableValuationArtifacts(evaluationTime, [...snapshots.values()]),
        filterKnowableValuationArtifacts(evaluationTime, [...scenarios.values()]),
        filterKnowableValuationArtifacts(evaluationTime, [...assumptions.values()]),
        filterKnowableValuationArtifacts(evaluationTime, [...distributions.values()]),
        filterKnowableValuationArtifacts(evaluationTime, [...intrinsicDistributions.values()]),
        filterKnowableMarketImpliedExpectations(evaluationTime, [...marketImplied.values()]),
      );
    },
  };
}
