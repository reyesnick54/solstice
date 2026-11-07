import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ALTERNATIVE_DATA_ALT14_ROLES,
  AlternativeDataResearchAlt14Mesh,
  defaultAlternativeDataAlt14Roles,
  evaluateAlt14AlternativeDataQualification,
  HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_QUALIFIED,
  alternativeDataAlt14RoleDisplayName,
  validateAlternativeDataAlt14Artifact,
} from '../packages/agentic-capital-mesh/src/alternative-data-research-alt14/index.ts';
import type { EvidenceReference } from '../packages/agentic-capital-mesh/src/research-mesh/index.ts';
import { assembleCapitalContext, type ContextSource } from '../packages/agentic-capital-mesh/src/context.ts';

const NOW = asUtcInstant('2026-09-17T08:00:00.000Z');

function evidence(overrides: Partial<EvidenceReference> = {}): EvidenceReference {
  return Object.freeze({
    evidenceId: overrides.evidenceId ?? 'ev_alt14_1',
    sourceKind: overrides.sourceKind ?? 'MARKET_OBSERVATION',
    sourceRef: overrides.sourceRef ?? 'obs/sim-equity-alt14',
    observedAt: overrides.observedAt ?? NOW,
    freshnessOk: overrides.freshnessOk ?? true,
    entitlementOk: overrides.entitlementOk ?? true,
    provenanceRef: overrides.provenanceRef ?? 'prov/helios-alt14',
  });
}

function sourceFor(subjectId: string): ContextSource {
  return {
    subjectId,
    bind: (requested) =>
      requested === subjectId
        ? {
            subjectId,
            mandate: {
              mandateId: 'man_alt14',
              version: 1,
              status: 'ACTIVE',
              hardConstraintKinds: Object.freeze(['MINIMUM_CASH_RESERVE']),
              prohibitedCategories: Object.freeze([]),
              minimumLiquidMinor: 50_000n,
              compatibleWithInvestment: true,
            },
            growth: {
              planId: 'gpl_alt14',
              version: 1,
              considersInvestment: true,
              state: 'ACTIVE',
            },
            peve: {
              snapshotId: 'peve_alt14',
              resilienceLabel: 'moderate',
              goalProgressLabel: 'on-track',
              opportunityCapacityLabel: 'available',
              compositeOptimizationForbidden: true as const,
              humanWorthSemantics: false as const,
            },
            portfolio: {
              portfolioId: 'inv_alt14',
              brokerageCashMinor: 750_000n,
              unsettledCashMinor: 0n,
              pendingOrderNotionalMinor: 0n,
              holdings: Object.freeze([]),
              accountRestricted: false,
            },
            riskBudget: {
              budgetId: 'rbdg_alt14',
              version: 'risk-policy-v1',
              maximumInstrumentConcentrationUnits: 60_000_000n,
              minimumBrokerageCashMinor: 0n,
            },
            registeredModels: Object.freeze([]),
            universe: Object.freeze([
              {
                instrumentId: 'SIM-EQ-ALT14',
                instrumentType: 'EQUITY',
                available: true,
                fractionalSupported: true,
                incrementUnits: 1n,
                currency: 'USD',
              },
            ]),
            market: Object.freeze([
              {
                instrumentId: 'SIM-EQ-ALT14',
                priceMinor: 10_000n,
                currency: 'USD',
                quotedAt: NOW,
                stale: false,
              },
            ]),
            rdt: {
              state: 'RESEARCH_REQUIRED',
              legalReviewStatus: 'RESEARCH_REQUIRED',
              simulationOnly: true as const,
              regulatoryApproved: false as const,
            },
            scheduledObligationMinor: 0n,
          }
        : undefined,
  };
}

describe('HELIOS ALT14 agentic alternative-data research mesh', () => {
  it('registers ten specialist agents', () => {
    assert.equal(ALTERNATIVE_DATA_ALT14_ROLES.length, 10);
    assert.equal(defaultAlternativeDataAlt14Roles().length, 10);
    const expectedNames = Object.freeze([
      'WorkforceIntelligenceAgent',
      'DigitalDemandAgent',
      'ProductDemandAgent',
      'LogisticsAgent',
      'GeospatialAgent',
      'InnovationAgent',
      'ProcurementAgent',
      'SupplyChainAgent',
      'AlternativeDataSkepticAgent',
      'AlternativeDataSynthesisAgent',
    ]);
    assert.deepEqual(
      ALTERNATIVE_DATA_ALT14_ROLES.map((role) => alternativeDataAlt14RoleDisplayName(role)),
      expectedNames,
    );
  });

  it('runs ALT14 mesh through canonical HELIOS read tools only', () => {
    const clock = new FrozenClock(NOW);
    const mesh = new AlternativeDataResearchAlt14Mesh({ clock });
    const ctx = assembleCapitalContext({
      meshId: 'cmsh_alt14',
      subjectId: 'cust_alt14',
      now: NOW,
      source: sourceFor('cust_alt14'),
    });
    assert.ok(ctx.ok);
    if (!ctx.ok) throw new Error('context');
    const result = mesh.run({
      request: {
        workOrderId: 'wo_alt14',
        subjectId: 'cust_alt14',
        entityId: 'ent_target_co',
        objective: 'Assess alternative-data research evidence for SIM-EQ-ALT14',
        evidenceBundle: Object.freeze([evidence()]),
      },
      context: ctx.value,
    });
    assert.ok(result.ok, result.ok ? '' : result.error.message);
    if (!result.ok) return;
    assert.equal(result.value.artifacts.length, 10);
    assert.equal(result.value.thesis.researchEvidenceOnly, true);
    for (const artifact of result.value.artifacts) {
      assert.equal(validateAlternativeDataAlt14Artifact(artifact).length, 0);
    }
    const qualification = evaluateAlt14AlternativeDataQualification({
      sampleArtifacts: result.value.artifacts,
    });
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_ALT14_AGENTIC_ALTERNATIVE_DATA_QUALIFIED);
  });
});
