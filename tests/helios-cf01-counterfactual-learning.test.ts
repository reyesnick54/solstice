/**
 * HELIOS CF01 — Counterfactual decision research record (immutable episode + outcome attachment).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { HELIOS_FEATURE_FABRIC_SCHEMA } from '../packages/platform/src/helios/feature-fabric/types.ts';
import {
  digestCandidateActionSetContent,
  evaluateCf01DecisionLedgerQualification,
  HELIOS_CF01_DECISION_LEDGER_QUALIFIED,
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA,
  sealDecisionEpisode,
  type DecisionContext,
} from '../packages/platform/src/helios/counterfactual-learning/index.ts';

const T0 = asUtcInstant('2026-01-15T14:30:00.000Z');

function minimalContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return Object.freeze({
    decisionTime: T0,
    canonicalEntityId: 'ent_cf01_demo',
    instrumentId: 'inst_demo',
    portfolioState: Object.freeze({
      snapshotDigest: 'pf_snapshot_digest_cf01',
      reportingCurrency: 'USD',
      positionLineDigests: Object.freeze(['lot_a', 'lot_b']),
      cashMinorUnits: '1000000000',
    }),
    marketState: Object.freeze({
      observationBundleDigest: 'mkt_obs_bundle_cf01',
      sessionLabel: 'REGULAR',
    }),
    featureManifest: Object.freeze({
      schemaVersion: HELIOS_FEATURE_FABRIC_SCHEMA,
      manifestId: 'mf_cf01',
      evaluationTimestamp: T0,
      featureDefinitions: Object.freeze([]),
      transformations: Object.freeze([]),
      sourceDatasets: Object.freeze(['ds_forward_shadow_demo']),
      sourceObservationRanges: Object.freeze([]),
      entitlements: Object.freeze([]),
      pointInTimeRule: 'knowable_at_lte_evaluation_time',
      universeDefinition: 'demo_universe',
      missingValuePolicy: 'fail',
      codeVersion: 'cf01-test',
      modelVersion: 'm0',
      featureSnapshotIds: Object.freeze([]),
      grantsExecutionAuthority: false,
    }),
    aafDatasetCertification: null,
    earningsState: Object.freeze({
      earningsKnowledgeDigest: 'earn_k_cf01',
      nextEventKnowable: true,
    }),
    valuationState: Object.freeze({
      valuationSnapshotDigest: 'val_snap_cf01',
      methodologyId: 'val12_demo',
    }),
    regimeState: Object.freeze({
      regimeLabel: 'RISK_OFF',
      regimeModelDigest: 'reg_m_cf01',
    }),
    riskState: Object.freeze({
      riskBundleDigest: 'risk_b_cf01',
      stressBand: 'NORMAL',
    }),
    liquidityState: Object.freeze({
      liquidityDigest: 'liq_cf01',
      tradability: 'NORMAL',
    }),
    twinBinding: Object.freeze({
      bindingDigest: 'twin_bind_cf01',
      executionTwinRunRef: 'et_run_demo',
      forwardShadowRunRef: 'fs_run_demo',
    }),
    growIntelligenceDigest: 'grow_digest_cf01',
    outcomeAttributionSchemaRef: 'sunrey.helios.grow.outcome-attribution.v1',
    ...overrides,
  });
}

describe('HELIOS CF01 — counterfactual decision ledger', () => {
  it('architecture guard: counterfactual-learning stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const scoped = findings.filter((f) => f.file.includes('helios/counterfactual-learning'));
    assert.deepEqual(scoped, []);
  });

  it('seals a decision episode and qualifies when invariants hold', () => {
    const context = minimalContext();
    const cand1 = Object.freeze({
      candidateId: 'c1',
      actionClass: 'ENTER' as const,
      parametersDigest: 'p1',
      label: 'enter demo',
    });
    const cand2 = Object.freeze({
      candidateId: 'c2',
      actionClass: 'NO_ACTION' as const,
      parametersDigest: 'p2',
      label: null,
    });
    const setDigest = digestCandidateActionSetContent({
      setId: 'set_cf01',
      candidates: [
        { candidateId: 'c1', actionClass: 'ENTER' },
        { candidateId: 'c2', actionClass: 'NO_ACTION' },
      ],
    });
    const episode = sealDecisionEpisode({
      episodeId: 'ep_cf01_1',
      context,
      candidateSet: Object.freeze({
        setId: 'set_cf01',
        candidates: Object.freeze([cand1, cand2]),
        contentDigest: setDigest,
      }),
      chosenAction: Object.freeze({
        actionClass: 'NO_ACTION',
        candidateId: 'c2',
        observedDigest: 'obs_noop',
        source: 'CHOICE',
      }),
      rejectedActions: Object.freeze([
        Object.freeze({
          candidateId: 'c1',
          actionClass: 'ENTER',
          reasons: Object.freeze([{ code: 'RISK_CAP', detail: 'within band' }]),
        }),
      ]),
      reasons: Object.freeze([{ code: 'POLICY_HOLD', detail: null }]),
      policySnapshot: Object.freeze({
        policyId: 'pol_cf01',
        policyVersion: '1.0.0',
        policyContentDigest: 'pol_hash',
      }),
      strategyGenome: Object.freeze({
        genomeId: 'sg_demo',
        genomeVersion: 'v7',
        contentDigest: 'sg_hash',
      }),
      modelVersions: Object.freeze({ forecaster: '1.2', allocator: '0.9' }),
      evidence: Object.freeze({
        evidenceVaultRefs: Object.freeze(['vault_ref_cf01']),
        contextDigest: '',
      }),
      manifest: Object.freeze({
        manifestId: 'm_cf01',
        contentDigest: 'mf_content',
        compilationNotes: null,
      }),
      sealedAt: T0,
    });

    assert.equal(episode.schema, HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA);
    assert(episode.seal !== null);
    const q = evaluateCf01DecisionLedgerQualification(episode);
    assert.equal(q.qualified, true);
    assert.equal(q.marker, HELIOS_CF01_DECISION_LEDGER_QUALIFIED);
  });
});
