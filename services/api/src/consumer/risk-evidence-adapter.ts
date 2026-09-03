// @ts-nocheck
/**
 * BFF adapter for risk evidence — no provider internals exposed.
 */

import {
  createDefaultRiskAdapterStates,
  createRiskEvidencePlane,
  evaluateAgentRiskGate,
  evaluateExchangeRiskGate,
  evaluateMoneyRiskGate,
  sampleSecurityActionCenterEvents,
  toBffRiskSummary,
  wave4CoverageSummary,
  type RiskEvidencePlane,
} from '../../../../packages/risk-evidence/src/index.ts';

export type RiskEvidenceBffSnapshot = {
  readonly schema: 'sunrey.bff.risk-evidence.v1';
  readonly coverage: {
    readonly eligibleCatalogCount: number;
    readonly implementedCount: number;
    readonly fixtureCount: number;
    readonly missingCategoryCount: number;
  };
  readonly riskSummary: ReturnType<typeof toBffRiskSummary>;
  readonly securityEvents: readonly { readonly type: string; readonly summary: string };
  readonly providerDetailsExposed: false;
};

let sharedPlane: RiskEvidencePlane | null = null;

export function riskEvidencePlane(): RiskEvidencePlane {
  if (!sharedPlane) {
    sharedPlane = createRiskEvidencePlane({
      nowUtc: new Date().toISOString(),
      states: createDefaultRiskAdapterStates(),
    });
  }
  return sharedPlane;
}

export function buildRiskEvidenceBffSnapshot(subjectRef: string): RiskEvidenceBffSnapshot {
  const plane = riskEvidencePlane();
  const digital = plane.collectSessionRisk({
    sessionId: `bff:${subjectRef}`,
    subjectRef,
  });
  const decision = plane.evaluatePolicy([], digital);
  const events = sampleSecurityActionCenterEvents(plane, decision);
  const coverage = wave4CoverageSummary();
  return Object.freeze({
    schema: 'sunrey.bff.risk-evidence.v1',
    coverage: Object.freeze({
      eligibleCatalogCount: coverage.eligibleCatalogCount,
      implementedCount: coverage.implementedCount,
      fixtureCount: coverage.fixtureCount,
      missingCategoryCount: coverage.missingCategoryCount,
    }),
    riskSummary: toBffRiskSummary(decision),
    securityEvents: Object.freeze(
      events.map((e) => Object.freeze({ type: e.type, summary: e.summary })),
    ),
    providerDetailsExposed: false,
  });
}

export function resetRiskEvidencePlaneForTests(): void {
  sharedPlane = null;
}

export { evaluateMoneyRiskGate, evaluateExchangeRiskGate, evaluateAgentRiskGate };
