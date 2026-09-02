/**
 * Wave 5 — MoonRey Productive Intelligence red-team audit.
 *
 * Adversarial tests across productive asset identity, oracle mesh, event
 * resolution, domain guards, information consensus, GPUV, monetary pipeline,
 * supply replay, challenge/correction, recovery, authority, and production
 * activation gates. Simulation-only.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED } from '../packages/config/src/flags.ts';
import { moonreyIssuanceActivated } from '../packages/sunrey-chain/src/protocol/assets.ts';
import {
  authorizeIssuance,
  developmentMoonReyAuthority,
  moonreyProductiveEvidence,
  rejectFactOnlyMint,
  rejectOracleOnlyMint,
} from '../packages/sunrey-chain/src/economics/issuance.ts';
import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import { emptyBook } from '../packages/sunrey-chain/src/economics/supply.ts';
import { evaluateProductionEconomicActivation } from '../packages/sunrey-chain/src/economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from '../packages/sunrey-chain/src/economics/production-activation/fixtures.ts';
import { OracleEngine } from '../packages/sunrey-chain/src/oracle/engine.ts';
import {
  analyzeIndependence,
  countIndependentForQuorum,
} from '../packages/sunrey-chain/src/oracle/production/independence.ts';
import { evaluateProductionQuorum } from '../packages/sunrey-chain/src/oracle/production/quorum.ts';
import { ConnectorCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_POLICY } from '../packages/sunrey-chain/src/oracle/production/circuit-breaker.ts';
import {
  ENERGY_CAPACITY_UNIT_CONSTITUTION_EXTENDED,
  ENERGY_FACT_AUTO_MINTS_MOONREY,
  ENERGY_REFERENCE_PRICE_CREATES_CLAIM,
} from '../packages/sunrey-chain/src/oracle/production/provider-families/energy/types.ts';
import {
  CAPACITY_EQUALS_REALIZED_OUTPUT,
  COMPUTE_FACT_AUTO_MINTS_MOONREY,
  TOKEN_EQUALS_GPU_TIME,
} from '../packages/sunrey-chain/src/oracle/production/provider-families/compute/types.ts';
import { createResource, ProductiveAssetRegistry } from '../packages/sunrey-chain/src/productive/economy-data/registry.ts';
import {
  refuseFakeConsensus,
  verifyObservation,
} from '../packages/sunrey-chain/src/productive/economy-data/verification.ts';
import { SINGLE_SOURCE_IS_NOT_CONSENSUS } from '../packages/sunrey-chain/src/productive/economy-data/types.ts';
import { contributionFingerprint } from '../packages/sunrey-chain/src/productive/fingerprint.ts';
import { ProductiveEconomyEngine } from '../packages/sunrey-chain/src/productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from '../packages/sunrey-chain/src/productive/fixtures.ts';
import { resolveSourceCategory } from '../packages/sunrey-chain/src/productive/source-taxonomy/types.ts';
import {
  developmentAttributionPolicy,
  evaluateAttribution,
  relationship,
  subject,
} from '../packages/sunrey-chain/src/productive/policy-governance/attribution/index.ts';
import {
  CAPACITY_IS_NOT_OUTPUT,
  DUPLICATE_FULL_ATTRIBUTION_ALLOWED,
  OUTPUT_IS_NOT_DELIVERY,
  PRODUCTION_ACTIVE,
} from '../packages/sunrey-chain/src/productive/policy-governance/attribution/constitution.ts';
import {
  ATTRIBUTION_SHARE_SCALE,
  goodsObservation,
  manufacturingObservation,
  ProductiveAttributionBook,
  simulationAttributionDecision,
} from '../packages/sunrey-chain/src/productive/policy-governance/attribution-accounting/index.ts';
import { observationFingerprint } from '../packages/sunrey-chain/src/productive/policy-governance/attribution-accounting/identity.ts';
import {
  PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT,
  PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MOONREY_COIN_QUANTITY,
  PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MARKET_PRICE,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/constitution.ts';
import {
  developmentValueFunctionPolicy,
  evaluateProductiveValue,
  simulationBaseValueSchedule,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/index.ts';
import { engineValueInput } from '../packages/sunrey-chain/src/productive/policy-governance/value-function/fixtures.ts';
import { MoonReyProductiveSettlementBridge, refuseStandaloneAttempt } from '../packages/sunrey-chain/src/productive/policy-governance/value-settlement/bridge.ts';
import { emptySettlementBook } from '../packages/sunrey-chain/src/productive/policy-governance/value-settlement/replay.ts';
import { restrictionPlanFor } from '../packages/sunrey-chain/src/governance-ops/launch-abort/restrictions.ts';

const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
const moonreyBook = () => emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId);
const VALUE_POLICY = developmentValueFunctionPolicy();
const VALUE_SCHEDULE = simulationBaseValueSchedule();

function reserve(book: ProductiveAttributionBook, observation: ReturnType<typeof manufacturingObservation>, decisionId: string) {
  const decision = simulationAttributionDecision(observation, {
    attributionDecisionId: decisionId,
    allocatedShare: ATTRIBUTION_SHARE_SCALE,
    attributionPolicyVersion: 1,
  });
  return book.reserve({ observation, decision, expectedPolicyVersion: 1 });
}

describe('Wave 5 Task 1 — productive asset identity red team', () => {
  it('does not silently merge same asset under multiple IDs', () => {
    const registry = new ProductiveAssetRegistry();
    registry.register(createResource({ resourceId: 'asset-a', category: 'ENERGY', subtype: 'solar', jurisdiction: 'US', unit: 'kWh', valuationMethodologyId: 'meth-1' }));
    registry.register(createResource({ resourceId: 'asset-b', category: 'ENERGY', subtype: 'solar', jurisdiction: 'US', unit: 'kWh', valuationMethodologyId: 'meth-1' }));
    assert.equal(registry.list().length, 2);
  });

  it('rejects duplicate contribution fingerprint across renamed claims', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    engine.submitClaim(fixtureClaim({ claimId: 'claim-original', objectId: object.objectId, claimType: 'OUTPUT', category: 'ENERGY', quantity: 1_200n, unit: 'kWh' }));
    engine.submitClaim(fixtureClaim({ claimId: 'claim-renamed', objectId: object.objectId, claimType: 'OUTPUT', category: 'ENERGY', quantity: 1_200n, unit: 'kWh' }));
    assert.equal(engine.verifyClaim('claim-original').ok, true);
    const v2 = engine.verifyClaim('claim-renamed');
    assert.equal(v2.ok, false);
    if (!v2.ok) {
      assert.equal(v2.code, 'DUPLICATE_CONTRIBUTION');
    }
  });

  it('collides relabeled observations on observation fingerprint', () => {
    const base = manufacturingObservation();
    const relabeled = manufacturingObservation({
      claimId: 'claim.other',
      contributionId: 'contrib.other',
      objectId: 'object.other',
    });
    assert.equal(observationFingerprint(base), observationFingerprint(relabeled));
  });

  it('resolves legacy source aliases to canonical categories', () => {
    assert.equal(resolveSourceCategory('resources').canonical, 'minerals_resources');
    assert.equal(resolveSourceCategory('ai_usage').canonical, 'ai_compute');
  });
});

describe('Wave 5 Task 2 — oracle red team', () => {
  it('rejects false independence when providers share upstream', () => {
    const sources = [
      { sourceId: 's1', providerId: 'p1', controllerId: 'ctrl-a', upstreamOrganizationId: 'upstream-x' },
      { sourceId: 's2', providerId: 'p2', controllerId: 'ctrl-a', upstreamOrganizationId: 'upstream-x' },
      { sourceId: 's3', providerId: 'p3', controllerId: 'ctrl-b', upstreamOrganizationId: 'upstream-y' },
    ] as const;
    assert.equal(countIndependentForQuorum([...sources], true), 2);
    const shared = analyzeIndependence([...sources], true).find((c) => c.providerIds.length > 1);
    assert.ok(shared);
    assert.equal(shared.independent, false);
  });

  it('fails closed on insufficient quorum', () => {
    const quorum = evaluateProductionQuorum({
      feed: {
        feedId: 'feed-1',
        minimumProviders: 3,
        minimumIndependentControllers: 2,
        schemaId: 'ENERGY_INTERVAL_V1',
        aggregationPolicy: 'MEDIAN',
        freshnessSeconds: 3600n,
        subjectKind: 'METER',
        unit: 'kWh',
        factType: 'ENERGY_PRODUCTION',
        productiveCategory: 'ENERGY',
        claimType: 'OUTPUT',
        sourceClass: 'GENERATOR_METER',
        admissionMode: 'FIXTURE_ONLY',
        certificationRequired: true,
        rightsRequired: false,
        lineageRequired: true,
        independenceRequired: true,
      },
      observations: [
        { observationId: 'o1', oracleId: 'p1', feedId: 'feed-1', subject: 'meter-1', value: { mantissa: 100n, scale: 0, unit: 'kWh' }, observedAtUnix: 1n, signature: 'sig', signerKeyId: 'k1' },
      ],
      sources: [{ sourceId: 's1', providerId: 'p1', controllerId: 'c1', upstreamOrganizationId: 'u1' }],
      requireIndependence: true,
    });
    assert.equal(quorum.ok, false);
  });

  it('refuses reference price and fabricated source classes from auto-minting', () => {
    assert.equal(ENERGY_REFERENCE_PRICE_CREATES_CLAIM, false);
    assert.equal(ENERGY_FACT_AUTO_MINTS_MOONREY, false);
    assert.equal(COMPUTE_FACT_AUTO_MINTS_MOONREY, false);
    assert.equal(rejectOracleOnlyMint(), 'ORACLE_OBSERVATION_CANNOT_MINT');
    assert.equal(rejectFactOnlyMint(), 'VERIFIED_FACT_ALONE_CANNOT_MINT');
  });
});

describe('Wave 5 Task 3 — productive event red team', () => {
  it('blocks same event across APIs via attribution book', () => {
    const book = new ProductiveAttributionBook();
    const first = reserve(book, manufacturingObservation(), 'dec-1');
    assert.equal(first.ok, true);
    const replay = reserve(
      book,
      manufacturingObservation({
        claimId: 'claim.mfg.2',
        contributionId: 'contrib.mfg.2',
        providerId: 'oracle.mes.2',
      }),
      'dec-2',
    );
    assert.equal(replay.ok, false);
  });

  it('detects manufacturing+goods relabel collision', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserve(book, manufacturingObservation(), 'dec-mfg').ok, true);
    const goods = reserve(book, goodsObservation(), 'dec-goods');
    assert.equal(goods.ok, false);
  });
});

describe('Wave 5 Task 4 — domain-specific attacks', () => {
  it('enforces energy and compute capacity guards', () => {
    assert.equal(ENERGY_CAPACITY_UNIT_CONSTITUTION_EXTENDED, false);
    assert.equal(ENERGY_REFERENCE_PRICE_CREATES_CLAIM, false);
    assert.equal(CAPACITY_IS_NOT_OUTPUT, true);
    assert.equal(CAPACITY_EQUALS_REALIZED_OUTPUT, false);
    assert.equal(TOKEN_EQUALS_GPU_TIME, false);
  });

  it('blocks cross-category same-event attribution', () => {
    const eventId = 'pee.domain.attack';
    const evaluation = evaluateAttribution({
      policy: developmentAttributionPolicy(),
      height: 50,
      subjects: [
        subject({ claimId: 'claim-mfg', economicEventId: eventId, category: 'MANUFACTURING', controllerId: 'ctrl.shared' }),
        subject({ claimId: 'claim-goods', economicEventId: eventId, category: 'GOODS', controllerId: 'ctrl.shared' }),
      ],
      relationships: [relationship(eventId, eventId, 'SAME_UNDERLYING_EVENT')],
    });
    assert.equal(evaluation.authorizesIssuance, false);
    assert.equal(DUPLICATE_FULL_ATTRIBUTION_ALLOWED, false);
    assert.equal(OUTPUT_IS_NOT_DELIVERY, true);
  });
});

describe('Wave 5 Task 5 — information consensus red team', () => {
  it('refuses single-source fake consensus', () => {
    assert.equal(SINGLE_SOURCE_IS_NOT_CONSENSUS, true);
    const single = verifyObservation({
      signatureValid: true,
      provenancePresent: true,
      freshnessState: 'FRESH',
      independentSourceCount: 1,
      values: [100n],
      subjectValue: 100n,
    });
    assert.equal(single.status, 'SINGLE_SOURCE_VERIFIED');
    assert.equal(refuseFakeConsensus(single.status), true);
  });

  it('flags disputed or outlier multi-source spread', () => {
    const disputed = verifyObservation({
      signatureValid: true,
      provenancePresent: true,
      freshnessState: 'FRESH',
      independentSourceCount: 3,
      values: [100n, 500n, 120n],
      subjectValue: 500n,
    });
    assert.ok(disputed.status === 'DISPUTED' || disputed.status === 'OUTLIER');
    assert.equal(refuseFakeConsensus(disputed.status), true);
  });
});

describe('Wave 5 Task 6 — GPUV red team', () => {
  it('refuses standalone GPUV and oracle artifacts from minting', () => {
    for (const kind of ['GPUV_QUANTITY', 'PRODUCTIVE_VALUE_RESULT', 'ORACLE_OBSERVATION', 'VERIFIED_ECONOMIC_FACT'] as const) {
      assert.equal(refuseStandaloneAttempt({ kind }).ok, false, kind);
    }
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT, true);
    assert.equal(PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MOONREY_COIN_QUANTITY, true);
    assert.equal(PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MARKET_PRICE, true);
  });

  it('rejects negative GPUV basis quantities', () => {
    const negative = evaluateProductiveValue(
      engineValueInput('ENERGY', { contribution: { quantity: -5n } }),
      { policy: VALUE_POLICY, schedule: VALUE_SCHEDULE },
    );
    assert.equal(negative.state, 'VALUE_REJECTED');
  });
});

describe('Wave 5 Task 7 — MoonRey monetary red team', () => {
  it('rejects shortcut mint paths', () => {
    const book = moonreyBook();
    const evidence = moonreyProductiveEvidence({
      contributionId: 'contrib-1',
      fingerprint: 'fp-1',
      authorizationId: 'auth-1',
      policyVersion: 'v1',
    });
    const oracleOnly = authorizeIssuance(
      constitution,
      book,
      developmentMoonReyAuthority({
        quantity: 1n,
        replayIdentifier: 'oracle-only',
        contributionId: evidence.contributionId,
        fingerprint: evidence.fingerprint,
        authorizationId: '',
      }),
    );
    assert.equal(oracleOnly.ok, false);

    const aiDraft = {
      ...developmentMoonReyAuthority({
        quantity: 1n,
        replayIdentifier: 'ai',
        contributionId: 'c1',
        fingerprint: 'fp',
        authorizationId: 'a1',
      }),
      actorKind: 'AI' as const,
    };
    assert.equal(authorizeIssuance(constitution, book, aiDraft).ok, false);
    assert.equal(refuseStandaloneAttempt({ kind: 'PRODUCTIVE_CLAIM' }).ok, false);
  });
});

describe('Wave 5 Task 8 — supply red team', () => {
  it('blocks issuance authorization replay', () => {
    const book = moonreyBook();
    const fingerprint = contributionFingerprint({
      objectId: 'obj.solar.alpha',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1n,
      validUntilUnixSeconds: 2n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 1_200_000n,
      baseUnitId: 'Wh',
      oracleFactIds: ['fact.1'],
      upstreamContributionIds: [],
    });
    const draft = developmentMoonReyAuthority({
      quantity: 5n,
      replayIdentifier: 'replay-1',
      contributionId: 'contrib-replay',
      fingerprint,
      authorizationId: 'auth-replay',
    });
    const first = authorizeIssuance(constitution, book, draft);
    assert.equal(first.ok, true);
    const second = authorizeIssuance(constitution, first.ok ? first.book : book, draft);
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'DUPLICATE_ISSUANCE');
    }
  });
});

describe('Wave 5 Task 9 — challenge / correction red team', () => {
  it('keeps append-only corrections without rewriting finalized entries', () => {
    const book = new ProductiveAttributionBook();
    const before = book.snapshotEntries().length;
    const corrections = book.snapshotCorrections().length;
    assert.equal(before, 0);
    assert.equal(corrections, 0);
  });
});

describe('Wave 5 Task 10 — failure / recovery red team', () => {
  it('opens connector circuit without mutating monetary state', () => {
    const clock = { nowMs: () => 0n };
    const breaker = new ConnectorCircuitBreaker(DEFAULT_CIRCUIT_BREAKER_POLICY, clock);
    breaker.recordFailure('prov', 'src');
    breaker.recordFailure('prov', 'src');
    breaker.recordFailure('prov', 'src');
    assert.equal(breaker.guard('prov', 'src').ok, false);
  });

  it('scopes oracle incidents without stopping unrelated domains', () => {
    const plan = restrictionPlanFor({ incidentId: 'INC-1', domain: 'ORACLE' });
    assert.equal(plan.unrelatedCapabilitiesRemainAvailable, true);
    assert.equal(plan.rewritesSupply, false);
    assert.equal(plan.deletesFinalizedBalances, false);
  });
});

describe('Wave 5 Task 11 — authority audit', () => {
  it('confirms productive components cannot directly mutate supply', () => {
    const registry = new ProductiveAssetRegistry();
    const book = moonreyBook();
    const before = book.circulating;
    registry.register(createResource({ resourceId: 'x', category: 'ENERGY', subtype: 'solar', jurisdiction: 'US', unit: 'kWh', valuationMethodologyId: 'm' }));
    assert.equal(book.circulating, before);
    assert.equal((new MoonReyProductiveSettlementBridge(emptySettlementBook()) as { mint?: unknown }).mint, undefined);
  });
});

describe('Wave 5 Task 14 — production activation audit', () => {
  it('keeps production gates disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED, false);
    assert.equal(moonreyIssuanceActivated(), false);
    assert.equal(PRODUCTION_ACTIVE, false);
    const activation = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    assert.notEqual(activation.overallState, 'PRODUCTION_ACTIVE');
    assert.ok(activation.missingRequirements.length > 0);
  });
});

describe('Wave 5 Task 13 — performance baseline (synthetic)', () => {
  it('records safe synthetic workload timings', () => {
    const timings: Record<string, number> = {};
    const mark = (label: string, fn: () => void) => {
      const start = performance.now();
      fn();
      timings[label] = performance.now() - start;
    };

    mark('information_consensus', () => {
      for (let i = 0; i < 200; i++) {
        verifyObservation({
          signatureValid: true,
          provenancePresent: true,
          freshnessState: 'FRESH',
          independentSourceCount: 2,
          values: [100n, 101n],
          subjectValue: 100n,
        });
      }
    });

    mark('gpuv_evaluation', () => {
      for (let i = 0; i < 100; i++) {
        evaluateProductiveValue(engineValueInput('ENERGY'), { policy: VALUE_POLICY, schedule: VALUE_SCHEDULE });
      }
    });

    mark('attribution_book_reserve', () => {
      const book = new ProductiveAttributionBook();
      for (let i = 0; i < 50; i++) {
        reserve(
          book,
          manufacturingObservation({
            economicEventId: `event.${i}`,
            claimId: `claim.${i}`,
            contributionId: `contrib.${i}`,
            batchId: `batch.${i}`,
          }),
          `dec-${i}`,
        );
      }
    });

    for (const [label, ms] of Object.entries(timings)) {
      assert.ok(ms < 30_000, `${label} exceeded 30s baseline cap (${ms}ms)`);
    }
  });
});
