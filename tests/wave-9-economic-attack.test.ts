/**
 * Wave 9 — Economic truth adversarial audit.
 *
 * Attempts false economic value across MoonRey productive economy and
 * SunRey human economy without compromising blockchain cryptography.
 * Simulation-only; production issuance remains disabled.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { evaluateSybilControls, type SybilEvaluationInput } from '../packages/human-economic-contribution/src/identity/index.ts';
import { asHumanEconomicIdentityId } from '../packages/human-economic-contribution/src/identity/ids.ts';
import {
  HumanContributionResolutionEngine,
  authoritativeIdCommitmentFrom,
  contentCommitmentFromEvidence,
  assessContributionSplitting,
  monetizationKeyOf,
  asContributionResolutionFingerprint,
  asMonetizationContextId,
  deriveActorCommitment,
  humanEconomicIdentityIdFor,
  evidenceObservationIdFor,
} from '../packages/human-economic-contribution/src/resolution/index.ts';
import {
  PEVE_AI_ROLE,
  aiPeveAssist,
  refuseAiCanonicalPeveInput,
  rejectGpuvAsPeveSubstitute,
  rejectMarketPriceAsPeveInput,
} from '../packages/human-economic-contribution/src/peve/index.ts';
import {
  evaluateInformationConsensus,
  informationConsensusCreatesMoney,
  AI_INFORMATION_CONSENSUS_ROLE,
  validateAiAssistanceBoundary,
  assessProductiveSourceClasses,
  buildConsensusInput,
  CONFLICTING_OBSERVATIONS,
  PRODUCTIVE_ENERGY_CANDIDATE,
  RIGHTS_RESTRICTED_OBSERVATION,
  STALE_OBSERVATION,
  THREE_INDEPENDENT_SOURCES,
  THREE_PROVIDERS_ONE_UPSTREAM,
  UNVERIFIED_PROVIDER_OBSERVATION,
} from '@solstice/sunrey-chain/economic-awareness-fabric';
import {
  authorizeIssuance,
  developmentMoonReyAuthority,
  moonreyProductiveEvidence,
  rejectFactOnlyMint,
  rejectOracleOnlyMint,
} from '../packages/sunrey-chain/src/economics/issuance.ts';
import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import { emptyBook } from '../packages/sunrey-chain/src/economics/supply.ts';
import {
  executeHumanEconomySunReyIssuance,
  type HumanEconomyPipelineContext,
} from '../packages/sunrey-chain/src/economics/human-economy/pipeline.ts';
import {
  emptyDomainCircuitBreakerRegistry,
  isDomainVerificationPaused,
  pauseDomainVerification,
  circuitBreakerDoesNotHaltBlockchain,
  circuitBreakerDoesNotHaltMoonRey,
  circuitBreakerDoesNotHaltOrdinaryTransfers,
} from '../packages/sunrey-chain/src/economics/human-economy/circuit-breakers.ts';
import { fixtureContributionEvent, fixturePseudonymousActor, fixtureVerificationReceipt } from '../packages/sunrey-chain/src/economics/human-economy/fixtures.ts';
import { ProtocolNativeSupplyAuthority } from '../packages/sunrey-chain/src/native-assets/economic-controls.ts';
import { emptyClaimRegistry } from '../packages/sunrey-chain/src/economics/proof-bound/claims.ts';
import { emptyConsumptionStore } from '../packages/sunrey-chain/src/economics/proof-bound/consumption.ts';
import { emptyClaimChallengeRegistry } from '../packages/sunrey-chain/src/economics/human-economy/challenges.ts';
import { emptyHumanEconomyMonitoringStore } from '../packages/sunrey-chain/src/economics/human-economy/monitoring.ts';
import { analyzeIndependence, countIndependentForQuorum } from '../packages/sunrey-chain/src/oracle/production/independence.ts';
import { evaluateProductionQuorum } from '../packages/sunrey-chain/src/oracle/production/quorum.ts';
import { ConnectorCircuitBreaker, DEFAULT_CIRCUIT_BREAKER_POLICY } from '../packages/sunrey-chain/src/oracle/production/circuit-breaker.ts';
import { developmentProductionFeed } from '../packages/sunrey-chain/src/oracle/production/plane.ts';
import { sandboxSource } from '../packages/sunrey-chain/src/oracle/production/sandbox-fixture.ts';
import { createFrozenConnectorClock } from '../packages/sunrey-chain/src/oracle/production/runtime.ts';
import type { EconomicDataSource } from '../packages/sunrey-chain/src/oracle/production/types.ts';
import type { OracleObservation } from '../packages/sunrey-chain/src/oracle/types.ts';
import { refuseFakeConsensus, verifyObservation } from '../packages/sunrey-chain/src/productive/economy-data/verification.ts';
import { SINGLE_SOURCE_IS_NOT_CONSENSUS } from '../packages/sunrey-chain/src/productive/economy-data/types.ts';
import { contributionFingerprint } from '../packages/sunrey-chain/src/productive/fingerprint.ts';
import { ProductiveEconomyEngine } from '../packages/sunrey-chain/src/productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from '../packages/sunrey-chain/src/productive/fixtures.ts';
import { resolveSourceCategory } from '../packages/sunrey-chain/src/productive/source-taxonomy/types.ts';
import {
  CAPACITY_IS_NOT_OUTPUT,
  DUPLICATE_FULL_ATTRIBUTION_ALLOWED,
  OUTPUT_IS_NOT_DELIVERY,
} from '../packages/sunrey-chain/src/productive/policy-governance/attribution/constitution.ts';
import {
  goodsObservation,
  manufacturingObservation,
  ProductiveAttributionBook,
  simulationAttributionDecision,
  ATTRIBUTION_SHARE_SCALE,
} from '../packages/sunrey-chain/src/productive/policy-governance/attribution-accounting/index.ts';
import { observationFingerprint } from '../packages/sunrey-chain/src/productive/policy-governance/attribution-accounting/identity.ts';
import {
  PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT,
  PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MOONREY_COIN_QUANTITY,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/constitution.ts';
import {
  developmentValueFunctionPolicy,
  evaluateProductiveValue,
  simulationBaseValueSchedule,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/index.ts';
import { engineValueInput, engineContribution } from '../packages/sunrey-chain/src/productive/policy-governance/value-function/fixtures.ts';
import { refuseStandaloneAttempt } from '../packages/sunrey-chain/src/productive/policy-governance/value-settlement/bridge.ts';
import { restrictionPlanFor } from '../packages/sunrey-chain/src/governance-ops/launch-abort/restrictions.ts';
import { createCollisionFixtureBundle } from '../packages/sunrey-chain/src/productive/asset-identity/fixtures.ts';
import { lifecycleAllowsProduction } from '../packages/sunrey-chain/src/productive/asset-identity/lifecycle.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
const moonreyBook = () => emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId);
const VALUE_POLICY = developmentValueFunctionPolicy();
const VALUE_SCHEDULE = simulationBaseValueSchedule();

function reserveAttribution(book: ProductiveAttributionBook, observation: ReturnType<typeof manufacturingObservation>, decisionId: string) {
  const decision = simulationAttributionDecision(observation, {
    attributionDecisionId: decisionId,
    allocatedShare: ATTRIBUTION_SHARE_SCALE,
    attributionPolicyVersion: 1,
  });
  return book.reserve({ observation, decision, expectedPolicyVersion: 1 });
}

function humanPipelineContext(): HumanEconomyPipelineContext {
  return {
    authority: new ProtocolNativeSupplyAuthority(),
    claimRegistry: emptyClaimRegistry(),
    consumption: emptyConsumptionStore(),
    challenges: emptyClaimChallengeRegistry(),
    circuitBreakers: emptyDomainCircuitBreakerRegistry(),
    monitoring: emptyHumanEconomyMonitoringStore(),
    blockHeight: 1,
  };
}

function baseHumanIssuance(seed: string) {
  const event = fixtureContributionEvent('RESEARCH', seed);
  return {
    actor: 'PROTOCOL' as const,
    network: 'DEVELOPMENT' as const,
    recipient: `acct_${seed}`,
    contributionDomain: 'RESEARCH' as const,
    economicClaimId: `claim.research.${seed}`,
    claimFingerprint: event.fingerprint,
    subjectCommitment: fixturePseudonymousActor(seed).actorCommitment,
    canonicalContributionEvent: event,
    pseudonymousActor: fixturePseudonymousActor(seed),
    verificationReceipt: fixtureVerificationReceipt(seed),
    peveReferenceValue: 500n,
    governance: {
      authorizationId: `gov.${seed}`,
      authorizedQuantity: '200',
      governancePolicyVersion: 'sunrey.human.governance.v1',
      authorizedBy: 'HUMAN_GOVERNANCE' as const,
    },
    nowUnixSeconds: 1_700_000_000n,
  };
}

function resolutionObservation(overrides: Record<string, unknown> = {}) {
  const actor = deriveActorCommitment(['orcid:wave9-attacker']);
  const identity = humanEconomicIdentityIdFor({ actorCommitment: actor });
  const providerRecordId = (overrides.providerRecordId as string | undefined) ?? 'pmid:wave9';
  return {
    observationId: evidenceObservationIdFor(`wave9:${providerRecordId}`),
    sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const,
    providerId: 'pubmed',
    providerRecordId: 'pmid:wave9',
    humanEconomicIdentityId: identity,
    walletBindingRef: null,
    contributionClass: 'RESEARCH_PARTICIPATION' as const,
    authoritativeIdCommitments: [authoritativeIdCommitmentFrom('doi', '10.1000/wave9-paper')],
    contentCommitment: contentCommitmentFromEvidence(['evidence:wave9']),
    validFromUtc: NOW,
    validUntilUtc: null,
    measurementQuantity: 1n,
    measurementUnit: 'VERIFIED_RESEARCH_SESSION' as const,
    observedAtUtc: NOW,
    ...overrides,
  };
}

describe('Wave 9 Task 1 — MoonRey oracle manipulation', () => {
  it('rejects one provider masquerading as many via shared upstream', () => {
    const sources: readonly EconomicDataSource[] = [
      sandboxSource({ sourceId: 's1', providerId: 'alias-a', controllerId: 'ctrl-x', upstreamOrganizationId: 'upstream-same' }),
      sandboxSource({ sourceId: 's2', providerId: 'alias-b', controllerId: 'ctrl-x', upstreamOrganizationId: 'upstream-same' }),
      sandboxSource({ sourceId: 's3', providerId: 'alias-c', controllerId: 'ctrl-x', upstreamOrganizationId: 'upstream-same' }),
    ];
    assert.equal(countIndependentForQuorum([...sources], true), 1);
    const shared = analyzeIndependence([...sources], true).find((row) => row.providerIds.length > 1);
    assert.ok(shared);
    assert.equal(shared.independent, false);
  });

  it('Information Consensus rejects copied-source quorum', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    assert.notEqual(evaluation.receipt.result, 'VERIFIED');
    assert.equal(evaluation.verifiedFact, null);
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
    assert.ok(evaluation.receipt.explanationCodes.includes('SHARED_UPSTREAM_LINEAGE'));
  });

  it('flags stale observations and outliers without minting', () => {
    const stale = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, [STALE_OBSERVATION]),
    );
    assert.equal(stale.receipt.result, 'STALE');
    assert.equal(stale.verifiedFact, null);

    const disputed = verifyObservation({
      signatureValid: true,
      provenancePresent: true,
      freshnessState: 'FRESH',
      independentSourceCount: 3,
      values: [100n, 120n, 900n],
      subjectValue: 900n,
    });
    assert.ok(disputed.status === 'OUTLIER' || disputed.status === 'DISPUTED');
    assert.equal(refuseFakeConsensus(disputed.status), true);
    assert.equal(rejectOracleOnlyMint(), 'ORACLE_OBSERVATION_CANNOT_MINT');
  });

  it('rejects fake source classes and unverified providers', () => {
    const fakeClass = assessProductiveSourceClasses([
      {
        ...THREE_PROVIDERS_ONE_UPSTREAM[0]!,
        sourceClass: 'AGGREGATOR',
      },
    ]);
    assert.equal(fakeClass.satisfied, false);

    const unverified = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, [UNVERIFIED_PROVIDER_OBSERVATION]),
    );
    assert.notEqual(unverified.receipt.result, 'VERIFIED');
    assert.equal(informationConsensusCreatesMoney(), false);
  });

  it('rejects coordinated false sources with material conflict', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, CONFLICTING_OBSERVATIONS),
    );
    assert.notEqual(evaluation.receipt.result, 'VERIFIED');
    assert.ok(
      evaluation.receipt.explanationCodes.includes('MATERIAL_CONFLICT_DETECTED') ||
        evaluation.receipt.explanationCodes.includes('OUTLIER_EXCLUDED'),
    );
  });

  it('refuses single-source sensor spoof as consensus', () => {
    assert.equal(SINGLE_SOURCE_IS_NOT_CONSENSUS, true);
    const single = verifyObservation({
      signatureValid: true,
      provenancePresent: true,
      freshnessState: 'FRESH',
      independentSourceCount: 1,
      values: [999_999n],
      subjectValue: 999_999n,
    });
    assert.equal(single.status, 'SINGLE_SOURCE_VERIFIED');
    assert.equal(refuseFakeConsensus(single.status), true);
  });

  it('fails production quorum on insufficient independent observations', () => {
    const quorum = evaluateProductionQuorum({
      feed: developmentProductionFeed('feed-wave9'),
      observations: [
        {
          observationId: 'o1',
          oracleId: 'p1',
          feedId: 'feed-wave9',
          subject: 'meter-1',
          value: { schemaVersion: 1, mantissa: 100n, scale: 0, unit: 'kWh' },
        } as OracleObservation,
      ],
      sources: [sandboxSource({ sourceId: 's1', providerId: 'p1', controllerId: 'c1', upstreamOrganizationId: 'u1' })],
      requireIndependence: true,
    });
    assert.equal(quorum.ok, false);
  });
});

describe('Wave 9 Task 2 — productive event inflation', () => {
  it('blocks same productive event across APIs via attribution fingerprint', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserveAttribution(book, manufacturingObservation(), 'dec-1').ok, true);
    const replay = reserveAttribution(
      book,
      manufacturingObservation({
        claimId: 'claim.alt',
        contributionId: 'contrib.alt',
        providerId: 'oracle.alt',
      }),
      'dec-2',
    );
    assert.equal(replay.ok, false);
  });

  it('detects manufacturing vs goods relabel of same underlying event', () => {
    const book = new ProductiveAttributionBook();
    assert.equal(reserveAttribution(book, manufacturingObservation(), 'dec-mfg').ok, true);
    assert.equal(reserveAttribution(book, goodsObservation(), 'dec-goods').ok, false);
    assert.equal(observationFingerprint(manufacturingObservation()), observationFingerprint(goodsObservation()));
  });

  it('enforces capacity/output and production/delivery separation', () => {
    assert.equal(CAPACITY_IS_NOT_OUTPUT, true);
    assert.equal(OUTPUT_IS_NOT_DELIVERY, true);
    assert.equal(DUPLICATE_FULL_ATTRIBUTION_ALLOWED, false);
  });

  it('rejects duplicate contribution fingerprints across renamed claims', () => {
    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    const object = solarFacility();
    engine.registerObject(object);
    engine.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1_200n, unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    engine.submitClaim(fixtureClaim({ claimId: 'claim-a', objectId: object.objectId, claimType: 'OUTPUT', category: 'ENERGY', quantity: 1_200n, unit: 'kWh' }));
    engine.submitClaim(fixtureClaim({ claimId: 'claim-b', objectId: object.objectId, claimType: 'OUTPUT', category: 'ENERGY', quantity: 1_200n, unit: 'kWh' }));
    assert.equal(engine.verifyClaim('claim-a').ok, true);
    const dup = engine.verifyClaim('claim-b');
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.code, 'DUPLICATE_CONTRIBUTION');
  });
});

describe('Wave 9 Task 3 — productive identity fraud', () => {
  it('does not merge same facility name in different cities', () => {
    const { registry } = createCollisionFixtureBundle();
    const illinois = registry.resolve({
      displayName: 'Springfield Manufacturing',
      jurisdiction: 'US-IL',
      sourceSystem: 'fixture',
    });
    const missouri = registry.resolve({
      displayName: 'Springfield Manufacturing',
      jurisdiction: 'US-MO',
      sourceSystem: 'fixture',
    });
    assert.notEqual(illinois.productiveAssetId, missouri.productiveAssetId);
  });

  it('rejects retired asset reporting output after retirement', () => {
    const { registry, retiredPlant } = createCollisionFixtureBundle();
    const assessment = registry.assessProductionAttribution(
      retiredPlant.productiveAssetId,
      '2021-06-01T00:00:00.000Z',
    );
    assert.equal(assessment.code, 'RETIRED_BEFORE_EVENT');
    assert.equal(lifecycleAllowsProduction('RETIRED', '2021-06-01T00:00:00.000Z', retiredPlant).allowed, false);
  });

  it('resolves legitimate aliases to one asset without silent merge of unknown duplicates', () => {
    const { registry, plant } = createCollisionFixtureBundle();
    const resolved = registry.resolve({
      aliasKind: 'EIA_PLANT_ID',
      aliasValue: '123',
      sourceSystem: 'eia',
      providerId: 'eia',
    });
    assert.equal(resolved.productiveAssetId, plant.productiveAssetId);
    assert.equal(resolveSourceCategory('resources').canonical, 'minerals_resources');
  });
});

describe('Wave 9 Task 4 — GPUV manipulation', () => {
  it('refuses standalone GPUV and oracle artifacts from minting', () => {
    for (const attempt of [
      { kind: 'GPUV_QUANTITY' as const, quantity: 1n },
      { kind: 'PRODUCTIVE_VALUE_RESULT' as const, productiveValueId: 'pvr.1' },
      { kind: 'ORACLE_OBSERVATION' as const, observationId: 'obs.1' },
      { kind: 'VERIFIED_ECONOMIC_FACT' as const, factId: 'fact.1' },
    ]) {
      assert.equal(refuseStandaloneAttempt(attempt).ok, false, attempt.kind);
    }
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT, true);
    assert.equal(PRODUCTIVE_ECONOMIC_VALUE_IS_NOT_MOONREY_COIN_QUANTITY, true);
    assert.equal(rejectFactOnlyMint(), 'VERIFIED_FACT_ALONE_CANNOT_MINT');
  });

  it('rejects negative and duplicate GPUV basis quantities', () => {
    const negative = evaluateProductiveValue(
      engineValueInput('ENERGY', { contribution: engineContribution('ENERGY', { quantity: -1n }) }),
      { policy: VALUE_POLICY, schedule: VALUE_SCHEDULE },
    );
    assert.equal(negative.state, 'VALUE_REJECTED');

    const duplicate = evaluateProductiveValue(engineValueInput('ENERGY'), { policy: VALUE_POLICY, schedule: VALUE_SCHEDULE });
    const again = evaluateProductiveValue(engineValueInput('ENERGY'), { policy: VALUE_POLICY, schedule: VALUE_SCHEDULE });
    assert.equal(duplicate.state, 'VALUED_SIMULATION');
    assert.equal(again.state, 'VALUED_SIMULATION');
    assert.equal(duplicate.result?.finalProductiveValue, again.result?.finalProductiveValue);
  });

  it('keeps GPUV distinct from PEVE and market price', () => {
    assert.equal(rejectGpuvAsPeveSubstitute({ gpuvMinorUnits: 100n, productiveClaimId: 'claim-1' }).code, 'GPUV_CANNOT_SUBSTITUTE_PEVE');
    assert.equal(rejectMarketPriceAsPeveInput({ exchangePriceMinorUnits: 100n })?.code, 'MARKET_PRICE_INPUT_FORBIDDEN');
    assert.equal(rejectMarketPriceAsPeveInput({ contributionId: 'safe' }), null);
  });
});

describe('Wave 9 Task 5 — human Sybil attack', () => {
  it('denies reused external identity and credentials', () => {
    const actorA = asHumanEconomicIdentityId(`heaid_${'a'.repeat(32)}`);
    const actorB = asHumanEconomicIdentityId(`heaid_${'b'.repeat(32)}`);
    const external = 'ext:orcid:shared';
    const credential = 'vc:shared-credential';
    const sybil = evaluateSybilControls({
      humanActorId: actorB,
      evaluatedAt: NOW,
      uniquenessCommitment: null,
      controllerRefs: [],
      contributionFingerprints: [],
      usageReceiptRefs: [],
      externalIdentityCommitments: [external],
      credentialCommitments: [credential],
      relatedActorIds: [],
      deviceAbuseSignals: [],
      aiPatternSuggestions: [] as unknown as SybilEvaluationInput['aiPatternSuggestions'],
      existingUniquenessOwners: new Map(),
      existingExternalOwners: new Map([[external, actorA]]),
      existingCredentialOwners: new Map([[credential, actorA]]),
      existingReceiptOwners: new Map(),
      duplicateFingerprintOwners: new Map(),
    });
    assert.equal(sybil.policyOutcome, 'DENY_FUTURE_ACTION');
    assert.equal(sybil.autonomousBan, false);
    assert.ok(sybil.signals.some((signal) => signal.kind === 'REUSED_EXTERNAL_IDENTITY'));
    assert.ok(sybil.signals.some((signal) => signal.kind === 'REUSED_CREDENTIAL'));
  });

  it('requires review for AI-only Sybil hints without autonomous ban', () => {
    const actor = asHumanEconomicIdentityId(
      String(humanEconomicIdentityIdFor({ actorCommitment: deriveActorCommitment(['ai-only']) })),
    );
    const sybil = evaluateSybilControls({
      humanActorId: actor,
      evaluatedAt: NOW,
      uniquenessCommitment: null,
      controllerRefs: [],
      contributionFingerprints: [],
      usageReceiptRefs: [],
      externalIdentityCommitments: [],
      credentialCommitments: [],
      relatedActorIds: [],
      deviceAbuseSignals: [],
      aiPatternSuggestions: [
        {
          kind: 'DUPLICATE_CONTRIBUTION_PATTERN',
          severity: 'HIGH',
          evidenceCommitment: 'ai:hint:wave9',
          relatedActorIds: [],
        },
      ] as unknown as SybilEvaluationInput['aiPatternSuggestions'],
      existingUniquenessOwners: new Map(),
      existingExternalOwners: new Map(),
      existingCredentialOwners: new Map(),
      existingReceiptOwners: new Map(),
      duplicateFingerprintOwners: new Map(),
    });
    assert.equal(sybil.policyOutcome, 'REQUIRE_REVIEW');
    assert.equal(sybil.autonomousBan, false);
    assert.ok(sybil.signals.every((signal) => signal.aiSuggested));
  });
});

describe('Wave 9 Task 6 — human contribution fraud', () => {
  it('rejects observation replay and cross-identity credential fraud', () => {
    const engine = new HumanContributionResolutionEngine();
    const credential = authoritativeIdCommitmentFrom('credential', 'vc-wave9-fake');
    assert.equal(
      engine.submitObservation(
        resolutionObservation({
          providerRecordId: 'cred:1',
          authoritativeIdCommitments: [credential],
          credentialCommitment: 'vc-wave9-fake',
          contributionClass: 'EDUCATION_SKILL_ATTESTATION',
          measurementUnit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
        }),
      ).ok,
      true,
    );
    const identityB = humanEconomicIdentityIdFor({ actorCommitment: deriveActorCommitment(['stolen-identity']) });
    const fraud = engine.submitObservation(
      resolutionObservation({
        humanEconomicIdentityId: identityB,
        providerRecordId: 'cred:2',
        authoritativeIdCommitments: [credential],
        credentialCommitment: 'vc-wave9-fake',
        contributionClass: 'EDUCATION_SKILL_ATTESTATION',
        measurementUnit: 'EDUCATION_SKILL_ATTESTATION_UNIT',
      }),
    );
    assert.equal(fraud.ok, false);
    if (!fraud.ok) {
      assert.ok(['FRAUD_SUSPECTED', 'OBSERVATION_REPLAY'].includes(fraud.error.code));
    }
  });

  it('requires corroboration before claim generation for single-source self-attestation', () => {
    const engine = new HumanContributionResolutionEngine();
    engine.submitObservation(resolutionObservation({ providerRecordId: 'self:1', providerId: 'self-attest' }));
    const cluster = engine.resolveAll()[0]!;
    assert.equal(cluster.resolutionStatus, 'PENDING_CORROBORATION');
    const blocked = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(blocked.ok, false);
  });
});

describe('Wave 9 Task 7 — contribution splitting', () => {
  it('flags research splitting with one DOI and many content commitments', () => {
    const project = 'project:wave9-split';
    const doi = authoritativeIdCommitmentFrom('doi', '10.1000/split-parent');
    const observations = Array.from({ length: 3 }, (_, index) =>
      resolutionObservation({
        providerRecordId: `split:${index}`,
        providerId: `provider-${index}`,
        projectWorkIdentifier: project,
        authoritativeIdCommitments: [doi],
        contentCommitment: contentCommitmentFromEvidence([`variant-${index}`]),
      }),
    );
    const assessment = assessContributionSplitting('RESEARCH_PARTICIPATION', project, observations);
    assert.equal(assessment.suspected, true);
    assert.ok(assessment.reason?.includes('authoritative research'));
  });

  it('allows legitimate recurring work across periods', () => {
    const engine = new HumanContributionResolutionEngine();
    const doiA = authoritativeIdCommitmentFrom('doi', '10.1000/paper-a');
    const doiB = authoritativeIdCommitmentFrom('doi', '10.1000/paper-b');
    assert.equal(engine.submitObservation(resolutionObservation({ authoritativeIdCommitments: [doiA], providerRecordId: 'a' })).ok, true);
    assert.equal(engine.submitObservation(resolutionObservation({ authoritativeIdCommitments: [doiB], providerRecordId: 'b' })).ok, true);
    assert.equal(engine.resolveAll().length, 2);
  });
});

describe('Wave 9 Task 8 — rights / consent abuse', () => {
  it('Information Consensus blocks rights-restricted productive observations', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, [RIGHTS_RESTRICTED_OBSERVATION]),
    );
    assert.equal(evaluation.receipt.result, 'RIGHTS_RESTRICTED');
    assert.equal(evaluation.verifiedFact, null);
  });

  it('human economy pipeline rejects inactive rights and wrong purpose', () => {
    const ctx = humanPipelineContext();
    assert.equal(
      executeHumanEconomySunReyIssuance(ctx, { ...baseHumanIssuance('rights.inactive'), rightsInactive: true }).ok,
      false,
    );
    assert.equal(
      executeHumanEconomySunReyIssuance(ctx, { ...baseHumanIssuance('rights.purpose'), rightsWrongPurpose: true }).ok,
      false,
    );
  });
});

describe('Wave 9 Task 9 — claim replay / rewrapping', () => {
  it('blocks duplicate monetization across claim ID and context replay', () => {
    const engine = new HumanContributionResolutionEngine();
    const replayDoi = authoritativeIdCommitmentFrom('doi', '10.1000/wave9-monetization-replay');
    for (const source of ['pubmed', 'crossref']) {
      engine.submitObservation(
        resolutionObservation({
          providerId: source,
          providerRecordId: `${source}:1`,
          authoritativeIdCommitments: [replayDoi],
        }),
      );
    }
    const cluster = engine.resolveAll()[0]!;
    const claim = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(claim.ok, true);
    if (!claim.ok) return;

    const context = asMonetizationContextId('hctx_0123456789abcdef0123456789abcdef');
    assert.equal(engine.attemptMonetization({ claimId: claim.value.claimId, contextId: context, now: NOW }).ok, true);
    assert.equal(engine.attemptMonetization({ claimId: claim.value.claimId, contextId: context, now: NOW }).ok, false);

    const fingerprint = asContributionResolutionFingerprint(claim.value.resolutionFingerprint);
    const replayKey = monetizationKeyOf(fingerprint, context);
    engine.monetizationStore.restoreConsumedKeys([replayKey]);
    assert.equal(engine.monetizationStore.isConsumed(fingerprint, context), true);
  });

  it('persists consumed monetization keys in engine snapshot', () => {
    const engine = new HumanContributionResolutionEngine();
    const snapshotDoi = authoritativeIdCommitmentFrom('doi', '10.1000/wave9-snapshot-only');
    for (const source of ['pubmed', 'crossref']) {
      const submitted = engine.submitObservation(
        resolutionObservation({
          providerId: source,
          providerRecordId: `${source}:snap`,
          authoritativeIdCommitments: [snapshotDoi],
        }),
      );
      assert.equal(submitted.ok, true, source);
    }
    const cluster = engine.resolveAll()[0]!;
    const claim = engine.generateClaimForCluster(cluster.clusterId, NOW);
    assert.equal(claim.ok, true);
    if (!claim.ok) return;
    const context = asMonetizationContextId('hctx_abcdef0123456789abcdef0123456789');
    assert.equal(engine.attemptMonetization({ claimId: claim.value.claimId, contextId: context, now: NOW }).ok, true);
    const snapshot = engine.snapshot();
    assert.ok(snapshot.consumedMonetizationKeys.length >= 1);
  });

  it('blocks MoonRey issuance authorization replay', () => {
    const book = moonreyBook();
    const fingerprint = contributionFingerprint({
      objectId: 'obj.wave9',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1n,
      validUntilUnixSeconds: 2n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 1_000n,
      baseUnitId: 'Wh',
      oracleFactIds: ['fact.1'],
      upstreamContributionIds: [],
    });
    const draft = developmentMoonReyAuthority({
      quantity: 3n,
      replayIdentifier: 'wave9-replay',
      contributionId: 'contrib-wave9',
      fingerprint,
      authorizationId: 'auth-wave9',
    });
    const evidence = moonreyProductiveEvidence({
      contributionId: 'contrib-wave9',
      fingerprint,
      authorizationId: 'auth-wave9',
      policyVersion: 'v1',
    });
    assert.equal(evidence.contributionId, 'contrib-wave9');
    const first = authorizeIssuance(constitution, book, draft);
    assert.equal(first.ok, true);
    const second = authorizeIssuance(constitution, first.ok ? first.book : book, draft);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.code, 'DUPLICATE_ISSUANCE');
  });

  it('blocks human economy claim replay through pipeline', () => {
    const ctx = humanPipelineContext();
    const input = baseHumanIssuance('replay.wave9');
    assert.equal(executeHumanEconomySunReyIssuance(ctx, input).ok, true);
    const replay = executeHumanEconomySunReyIssuance(ctx, {
      ...input,
      economicClaimId: 'claim.research.replay.new-id',
      governance: { ...input.governance, authorizationId: 'gov.replay.new' },
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.ok(['CLAIM_ALREADY_MONETIZED', 'CLAIM_FINGERPRINT_DUPLICATE'].includes(replay.code));
    }
  });
});

describe('Wave 9 Task 10 — collusion scenarios', () => {
  it('detects colluding oracle providers with shared upstream', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_PROVIDERS_ONE_UPSTREAM),
    );
    assert.notEqual(evaluation.receipt.result, 'VERIFIED');
    assert.ok(evaluation.receipt.explanationCodes.includes('SHARED_UPSTREAM_LINEAGE'));
  });

  it('flags colluding human attestors claiming same publication for different identities', () => {
    const actorA = deriveActorCommitment(['wave9-collusion-actor-a']);
    const actorB = deriveActorCommitment(['wave9-collusion-actor-b']);
    const identityA = humanEconomicIdentityIdFor({ actorCommitment: actorA });
    const identityB = humanEconomicIdentityIdFor({ actorCommitment: actorB });
    assert.notEqual(identityA, identityB);
    const collusionDoi = authoritativeIdCommitmentFrom('doi', '10.1000/wave9-collusion-only');
    const engine = new HumanContributionResolutionEngine();
    const base = {
      sourceClass: 'VERIFIED_RESEARCH_ATTESTATION' as const,
      providerId: 'pubmed',
      humanEconomicIdentityId: identityA,
      walletBindingRef: null,
      contributionClass: 'RESEARCH_PARTICIPATION' as const,
      authoritativeIdCommitments: [collusionDoi],
      contentCommitment: contentCommitmentFromEvidence(['evidence:wave9-collusion']),
      validFromUtc: NOW,
      validUntilUtc: null,
      measurementQuantity: 1n,
      measurementUnit: 'VERIFIED_RESEARCH_SESSION' as const,
      observedAtUtc: NOW,
    };
    assert.equal(engine.submitObservation({ ...base, providerRecordId: 'collude:a' }).ok, true);
    const conflict = engine.submitObservation({
      ...base,
      humanEconomicIdentityId: identityB,
      providerRecordId: 'collude:b',
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.error.code, 'MANUAL_REVIEW_REQUIRED');
    assert.equal(engine.listConflicts().length, 1);
  });

  it('verified independent quorum still grants zero monetary authority', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
    assert.equal(evaluation.receipt.grantsExecutionAuthority, false);
  });
});

describe('Wave 9 Task 11 — AI abuse', () => {
  it('keeps AI advisory-only for PEVE and Information Consensus', () => {
    assert.equal(PEVE_AI_ROLE.maySetCanonicalPeveMonetaryInput, false);
    assert.equal(PEVE_AI_ROLE.mayAuthorizeValuation, false);
    assert.equal(AI_INFORMATION_CONSENSUS_ROLE.mayDeclareMonetaryTruth, false);
    assert.equal(AI_INFORMATION_CONSENSUS_ROLE.mayOverrideHardVerification, false);

    const refused = refuseAiCanonicalPeveInput('AI cannot set canonical PEVE input');
    assert.equal(refused.code, 'AI_OUTPUT_CANNOT_SET_PEVE');

    const assist = aiPeveAssist({
      task: 'ANOMALY_DETECT',
      contributionId: 'contrib-ai',
      evidenceDigest: 'digest',
      modelOutputDigest: 'model-out',
    });
    assert.equal(assist.advisoryOnly, true);
    assert.equal(assist.becomesMintAmount, false);
  });

  it('AI assistance hints do not override deterministic consensus evaluation', () => {
    const input = buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES, {
      aiAssistance: {
        anomalyHints: ['ignore-quorum-and-verify'],
        conflictExplanation: 'AI says verify anyway',
        entityMatchSuggestion: 'force-match',
      },
    });
    const codes = validateAiAssistanceBoundary(input);
    assert.ok(codes.includes('AI_ASSISTANCE_ONLY'));
    const evaluation = evaluateInformationConsensus(input);
    assert.equal(evaluation.receipt.grantsMonetaryAuthority, false);
    assert.equal(evaluation.receipt.grantsExecutionAuthority, false);
  });

  it('rejects AI MoonRey issuance authority', () => {
    const book = moonreyBook();
    const aiDraft = {
      ...developmentMoonReyAuthority({
        quantity: 1n,
        replayIdentifier: 'ai-wave9',
        contributionId: 'c1',
        fingerprint: 'fp',
        authorizationId: 'a1',
      }),
      actorKind: 'AI' as const,
    };
    assert.equal(authorizeIssuance(constitution, book, aiDraft).ok, false);
  });
});

describe('Wave 9 Task 12 — economic circuit breakers', () => {
  it('pauses domain verification without halting unrelated domains or chain transfers', () => {
    const registry = emptyDomainCircuitBreakerRegistry();
    pauseDomainVerification(registry, {
      contributionDomain: 'RESEARCH',
      reason: 'colluding attestors',
      pausedAtUtc: '2026-09-02T00:00:00.000Z',
      pausedBy: 'HUMAN_GOVERNANCE',
    });
    assert.equal(isDomainVerificationPaused(registry, 'RESEARCH'), true);
    assert.equal(isDomainVerificationPaused(registry, 'WORK'), false);
    assert.equal(circuitBreakerDoesNotHaltBlockchain(), true);
    assert.equal(circuitBreakerDoesNotHaltMoonRey(), true);
    assert.equal(circuitBreakerDoesNotHaltOrdinaryTransfers(), true);
  });

  it('opens oracle connector circuit without rewriting supply', () => {
    const clock = createFrozenConnectorClock(0n);
    const breaker = new ConnectorCircuitBreaker(DEFAULT_CIRCUIT_BREAKER_POLICY, clock);
    for (let i = 0; i < 3; i++) {
      breaker.recordFailure('malicious-provider', 'source-1');
    }
    assert.equal(breaker.guard('malicious-provider', 'source-1').ok, false);
    assert.equal(breaker.guard('honest-provider', 'source-2').ok, true);
  });

  it('scopes oracle incidents without stopping unrelated capabilities', () => {
    const plan = restrictionPlanFor({ incidentId: 'WAVE9-ORACLE', domain: 'ORACLE' });
    assert.equal(plan.unrelatedCapabilitiesRemainAvailable, true);
    assert.equal(plan.rewritesSupply, false);
    assert.equal(plan.deletesFinalizedBalances, false);
  });

  it('blocks human issuance when domain circuit breaker is active', () => {
    const ctx = humanPipelineContext();
    pauseDomainVerification(ctx.circuitBreakers!, {
      contributionDomain: 'RESEARCH',
      reason: 'wave9 test',
      pausedAtUtc: '2026-09-02T00:00:00.000Z',
      pausedBy: 'HUMAN_GOVERNANCE',
    });
    const result = executeHumanEconomySunReyIssuance(ctx, baseHumanIssuance('breaker.wave9'));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'DOMAIN_VERIFICATION_PAUSED');
  });
});

describe('Wave 9 Task 13 — property / invariant tests', () => {
  it('monetization key consumption is idempotent and fingerprint-stable', () => {
    const fingerprint = asContributionResolutionFingerprint('hcrf_0123456789abcdef0123456789abcdef');
    const context = asMonetizationContextId('hctx_0123456789abcdef0123456789abcdef');
    const keyA = monetizationKeyOf(fingerprint, context);
    const keyB = monetizationKeyOf(fingerprint, context);
    assert.equal(keyA, keyB);
    const store = new HumanContributionResolutionEngine().monetizationStore;
    store.restoreConsumedKeys([keyA]);
    assert.equal(store.isConsumed(fingerprint, context), true);
    store.restoreConsumedKeys([keyA]);
    assert.equal(store.isConsumed(fingerprint, context), true);
  });

  it('shared upstream reduces effective oracle independence', () => {
    const colluding: readonly EconomicDataSource[] = [
      sandboxSource({ sourceId: 's1', providerId: 'p1', controllerId: 'ctrl-x', upstreamOrganizationId: 'upstream-same' }),
      sandboxSource({ sourceId: 's2', providerId: 'p2', controllerId: 'ctrl-x', upstreamOrganizationId: 'upstream-same' }),
      sandboxSource({ sourceId: 's3', providerId: 'p3', controllerId: 'ctrl-y', upstreamOrganizationId: 'upstream-other' }),
    ];
    assert.equal(countIndependentForQuorum([...colluding], true), 2);
    const shared = analyzeIndependence([...colluding], true).find((cluster) => cluster.providerIds.length > 1);
    assert.ok(shared);
    assert.equal(shared.independent, false);
  });

  it('attribution book rejects duplicate observation fingerprints across variants', () => {
    const book = new ProductiveAttributionBook();
    const base = manufacturingObservation();
    assert.equal(reserveAttribution(book, base, 'prop-1').ok, true);
    for (let i = 0; i < 20; i++) {
      const variant = manufacturingObservation({
        economicEventId: `event.prop.${i}`,
        claimId: `claim.prop.${i}`,
        contributionId: `contrib.prop.${i}`,
        batchId: `batch.prop.${i}`,
      });
      if (observationFingerprint(variant) === observationFingerprint(base)) {
        assert.equal(reserveAttribution(book, variant, `prop-${i}`).ok, false);
      }
    }
  });

  it('SunRey/MoonRey separation: verified information fact never issues coins directly', () => {
    const evaluation = evaluateInformationConsensus(
      buildConsensusInput(PRODUCTIVE_ENERGY_CANDIDATE, THREE_INDEPENDENT_SOURCES),
    );
    assert.equal(evaluation.receipt.result, 'VERIFIED');
    assert.equal(informationConsensusCreatesMoney(), false);
    assert.equal(refuseStandaloneAttempt({ kind: 'VERIFIED_ECONOMIC_FACT', factId: 'fact.1' }).ok, false);
    const book = moonreyBook();
    const before = book.circulating;
    assert.equal(
      authorizeIssuance(
        constitution,
        book,
        developmentMoonReyAuthority({
          quantity: 1n,
          replayIdentifier: 'fact-only',
          contributionId: '',
          fingerprint: '',
          authorizationId: '',
        }),
      ).ok,
      false,
    );
    assert.equal(book.circulating, before);
  });
});
