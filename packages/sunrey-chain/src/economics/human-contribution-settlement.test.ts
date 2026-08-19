import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  computeValuationDigest,
  simulationValuationPolicy,
  valueVerifiedContribution,
  type HumanContributionValuationResult,
  type VerifiedContributionValuationInput,
} from '../../../human-economic-contribution/src/valuation/index.ts';
import { nativeAssetConstitution } from './constitution.ts';
import {
  HumanContributionMonetaryBridge,
  PEVE_USED_AS_TOKEN_FORMULA,
  PRODUCTION_ACTIVATED,
  REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION,
  VALUATION_ENGINE_ENGINEERING_IMPLEMENTED,
  VALUATION_ENGINE_IMPLEMENTED,
  VALUATION_ENGINE_PRODUCTION_ACTIVATED,
  createDevelopmentSettlementAuthorization,
  createValuationSettlementAuthorization,
  fixtureVerifiedContribution,
  productionConversionPolicyUnconfigured,
  refuseStandaloneAttempt,
  simulationConversionPolicy,
  toHumanEconomicEvidence,
  toMonetaryEvidenceCandidate,
  type EngineValuationReference,
  type VerifiedHumanEconomicContribution,
} from './human-contribution-bridge/index.ts';
import { authorizeIssuance, developmentMoonReyAuthority } from './issuance.ts';
import { emptyBook, expectedTotal, observedTotal, supplyReconciles } from './supply.ts';

const BRIDGE_DIR = dirname(fileURLToPath(import.meta.url));

function book() {
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  return emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
}

function valuationInput(
  contribution: VerifiedHumanEconomicContribution,
  measurementQuantity = 5n,
): VerifiedContributionValuationInput {
  return {
    contributionId: contribution.contributionId,
    fingerprint: contribution.fingerprint,
    status: 'VERIFIED',
    verificationPolicyVersion: contribution.verificationPolicyVersion,
    measurementQuantity,
    measurementUnit: contribution.measurementUnit,
    jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
    containsRawPersonalData: false,
    peveScoreUsedAsValue: false,
    humanWorthScore: false,
  };
}

function engineValuation(
  contribution: VerifiedHumanEconomicContribution,
  measurementQuantity = 5n,
  policy = simulationValuationPolicy({
    jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
  }),
): HumanContributionValuationResult {
  const valued = valueVerifiedContribution({
    contribution: valuationInput(contribution, measurementQuantity),
    policy,
    actor: 'PROTOCOL',
  });
  if (!valued.ok) {
    throw new Error(valued.code);
  }
  return valued.result;
}

function asReference(result: HumanContributionValuationResult): EngineValuationReference {
  return result;
}

function authorizedPath(
  contribution: VerifiedHumanEconomicContribution,
  options?: {
    readonly measurementQuantity?: bigint;
    readonly authorizationId?: string;
    readonly conversion?: ReturnType<typeof simulationConversionPolicy>;
    readonly monetaryQuantityCeiling?: bigint;
  },
) {
  const valuation = engineValuation(contribution, options?.measurementQuantity ?? 5n);
  const conversionPolicy =
    options?.conversion ??
    simulationConversionPolicy({
      jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
      inputDenomination: valuation.referenceDenomination,
    });
  const created = createValuationSettlementAuthorization({
    contribution,
    valuation: asReference(valuation),
    conversionPolicy,
    authorizedBy: 'PROTOCOL',
    authorizationId: options?.authorizationId,
    monetaryQuantityCeiling: options?.monetaryQuantityCeiling,
  });
  return { valuation, conversionPolicy, created };
}

describe('Chunk 112 human contribution valuation settlement integration', () => {
  it('1. refuses a verified contribution without valuation or settlement authorization', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.1' });
    const candidate = toMonetaryEvidenceCandidate(contribution);
    assert.equal(candidate.ok, true);
    const result = bridge.attempt({ recipient: 'alice', contribution }, book());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'SETTLEMENT_AUTHORIZATION_REQUIRED');
    }
  });

  it('2. refuses a valuation without settlement authorization', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.2' });
    const valuation = engineValuation(contribution);
    const result = bridge.attempt(
      { recipient: 'alice', contribution, valuation: asReference(valuation) },
      book(),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'SETTLEMENT_AUTHORIZATION_REQUIRED');
    }
  });

  it('3. refuses a valuation result that tries to mint by itself', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const standalone = refuseStandaloneAttempt({ kind: 'VALUATION_RESULT', valuationId: 'hcv.alone' });
    assert.equal(standalone.code, 'VALUATION_RESULT_CANNOT_MINT');
    const result = bridge.attempt(
      { recipient: 'alice', standalone: { kind: 'VALUATION_RESULT', valuationId: 'hcv.alone' } },
      book(),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'VALUATION_RESULT_CANNOT_MINT');
    }
  });

  it('4-6. creates a simulation valuation authorization, evidence, and accepted issuance', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({
      contributionId: 'hec.112.ok',
      contributionClass: 'COMMUNITY_CONTRIBUTION',
    });
    const { valuation, conversionPolicy, created } = authorizedPath(contribution, {
      authorizationId: 'hcesa.112.ok',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    assert.equal(created.authorization.valuationPath, 'ENGINE_VALUATION_SIMULATION');
    assert.equal(created.authorization.referenceValue, 500n);
    assert.equal(created.authorization.authorizedSunReyQuantity, 200n);
    assert.equal(created.authorization.referenceValueEqualsSunReyByDefinition, false);
    assert.equal(created.authorization.peveUsedAsTokenFormula, false);
    assert.equal(created.authorization.aiAuthorized, false);
    assert.equal(created.authorization.productionActivated, false);
    assert.equal(REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION, false);
    const evidence = toHumanEconomicEvidence(contribution, created.authorization);
    assert.equal(evidence.ok, true);
    if (!evidence.ok) {
      throw new Error(evidence.code);
    }
    assert.equal(evidence.evidence.valuationId, valuation.valuationId);
    assert.equal(evidence.evidence.valuationDigest, valuation.valuationDigest);
    assert.equal(evidence.evidence.referenceValue, 500n);
    assert.equal(evidence.evidence.quantityBasis, 200n);
    assert.equal(evidence.evidence.conversionPolicyVersion, conversionPolicy.version);
    const issued = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: asReference(valuation),
        conversionPolicy,
        actorKind: 'PROTOCOL',
      },
      book(),
    );
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    assert.equal(issued.authority.issuanceClass, 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION');
    assert.equal(issued.book.issuedPostGenesis, 200n);
    assert.equal(supplyReconciles(issued.book), true);
  });

  it('7. refuses PEVE as quantity', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const peve = bridge.attempt(
      { recipient: 'alice', standalone: { kind: 'PEVE_SCORE', score: 99n } },
      book(),
    );
    assert.equal(peve.ok, false);
    if (!peve.ok) {
      assert.equal(peve.code, 'PEVE_SCORE_CANNOT_BECOME_ISSUANCE_QUANTITY');
    }
    assert.equal(PEVE_USED_AS_TOKEN_FORMULA, false);
  });

  it('8. refuses a human-worth score', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.worth' });
    const { created } = authorizedPath(contribution);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const worth = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        extra: { humanWorthScore: 1 },
      },
      book(),
    );
    assert.equal(worth.ok, false);
    if (!worth.ok) {
      assert.equal(worth.code, 'HUMAN_WORTH_SCORE_REJECTED');
    }
  });

  it('9-11. refuses AI, Financial Agent, S3M, and Grok authorization', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.ai' });
    const { created, valuation, conversionPolicy } = authorizedPath(contribution);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const ai = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: asReference(valuation),
        conversionPolicy,
        actorKind: 'AI',
      },
      book(),
    );
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.code, 'AI_CANNOT_AUTHORIZE_ISSUANCE');
    }
    const agent = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        actorKind: 'FINANCIAL_AGENT',
      },
      book(),
    );
    assert.equal(agent.ok, false);
    if (!agent.ok) {
      assert.equal(agent.code, 'FINANCIAL_AGENT_CANNOT_AUTHORIZE_ISSUANCE');
    }
    assert.equal(refuseStandaloneAttempt({ kind: 'S3M_OUTPUT', outputDigest: 's3m' }).code, 'S3M_CANNOT_AUTHORIZE_ISSUANCE');
    assert.equal(refuseStandaloneAttempt({ kind: 'GROK_OUTPUT', outputDigest: 'grok' }).code, 'GROK_CANNOT_AUTHORIZE_ISSUANCE');
    assert.equal(
      refuseStandaloneAttempt({ kind: 'MODEL_OUTPUT', outputDigest: 'model' }).code,
      'MODEL_OUTPUT_CANNOT_AUTHORIZE_ISSUANCE',
    );
    const s3mAuth = createValuationSettlementAuthorization({
      contribution,
      valuation: asReference(valuation),
      conversionPolicy,
      authorizedBy: 'S3M' as unknown as 'PROTOCOL',
    });
    assert.equal(s3mAuth.ok, false);
  });

  it('12. rejects a wrong contribution id', () => {
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.wrong-id' });
    const other = fixtureVerifiedContribution({ contributionId: 'hec.112.other' });
    const valuation = engineValuation(contribution);
    const created = createValuationSettlementAuthorization({
      contribution: other,
      valuation: asReference(valuation),
      conversionPolicy: simulationConversionPolicy({
        jurisdictionPolicyRef: other.jurisdictionPolicyRef,
        inputDenomination: valuation.referenceDenomination,
      }),
      authorizedBy: 'PROTOCOL',
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'VALUATION_CONTRIBUTION_MISMATCH');
    }
  });

  it('13. rejects a wrong fingerprint', () => {
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.fp' });
    const valuation = engineValuation(contribution);
    const created = createValuationSettlementAuthorization({
      contribution: { ...contribution, fingerprint: 'b'.repeat(64) },
      valuation: asReference(valuation),
      conversionPolicy: simulationConversionPolicy({
        jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
        inputDenomination: valuation.referenceDenomination,
      }),
      authorizedBy: 'PROTOCOL',
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'VALUATION_FINGERPRINT_MISMATCH');
    }
  });

  it('14. rejects a tampered valuation digest', () => {
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.digest' });
    const valuation = engineValuation(contribution);
    const tampered = {
      ...asReference(valuation),
      valuationDigest: 'c'.repeat(64),
    };
    const created = createValuationSettlementAuthorization({
      contribution,
      valuation: tampered,
      conversionPolicy: simulationConversionPolicy({
        jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
        inputDenomination: valuation.referenceDenomination,
      }),
      authorizedBy: 'PROTOCOL',
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'VALUATION_DIGEST_INVALID');
    }
    assert.notEqual(
      computeValuationDigest(valuation),
      'c'.repeat(64),
    );
  });

  it('15. rejects a mismatched policy version', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.policy' });
    const { created, valuation, conversionPolicy } = authorizedPath(contribution);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const result = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: { ...asReference(valuation), valuationPolicyVersion: '9' },
        conversionPolicy,
      },
      book(),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'VALUATION_POLICY_VERSION_MISMATCH');
    }
  });

  it('16. rejects an invalid conversion policy', () => {
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.conv' });
    const valuation = engineValuation(contribution);
    const created = createValuationSettlementAuthorization({
      contribution,
      valuation: asReference(valuation),
      conversionPolicy: {
        ...simulationConversionPolicy({
          jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
          inputDenomination: valuation.referenceDenomination,
        }),
        conversionDenominator: 0n,
      },
      authorizedBy: 'PROTOCOL',
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'CONVERSION_POLICY_INVALID');
    }
  });

  it('17. enforces the most restrictive applicable cap', () => {
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.cap' });
    const { created } = authorizedPath(contribution, {
      conversion: simulationConversionPolicy({
        jurisdictionPolicyRef: contribution.jurisdictionPolicyRef,
        inputDenomination: 'HUMAN_CONTRIBUTION_REFERENCE_UNIT',
        perContributionCeiling: 50n,
      }),
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'CAP_EXCEEDED');
    }
  });

  it('18. refuses replay of the same valuation authorization', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.replay' });
    const { created, valuation, conversionPolicy } = authorizedPath(contribution, {
      authorizationId: 'hcesa.112.replay',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const first = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: asReference(valuation),
        conversionPolicy,
      },
      book(),
    );
    assert.equal(first.ok, true);
    if (!first.ok) {
      throw new Error(first.code);
    }
    const replay = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: asReference(valuation),
        conversionPolicy,
      },
      first.book,
    );
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.code, 'DUPLICATE_CONTRIBUTION_SETTLEMENT');
    }
  });

  it('19. refuses remint from a revaluation alone', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.reval' });
    const firstPath = authorizedPath(contribution, { authorizationId: 'hcesa.112.reval.1' });
    assert.equal(firstPath.created.ok, true);
    if (!firstPath.created.ok) {
      throw new Error(firstPath.created.code);
    }
    const first = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: firstPath.created.authorization,
        valuation: asReference(firstPath.valuation),
        conversionPolicy: firstPath.conversionPolicy,
      },
      book(),
    );
    assert.equal(first.ok, true);
    if (!first.ok) {
      throw new Error(first.code);
    }
    const revalued = engineValuation(contribution, 8n);
    const second = createValuationSettlementAuthorization({
      contribution,
      valuation: asReference(revalued),
      conversionPolicy: firstPath.conversionPolicy,
      authorizedBy: 'PROTOCOL',
      authorizationId: 'hcesa.112.reval.2',
    });
    assert.equal(second.ok, true);
    if (!second.ok) {
      throw new Error(second.code);
    }
    const remint = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: second.authorization,
        valuation: asReference(revalued),
        conversionPolicy: firstPath.conversionPolicy,
      },
      first.book,
    );
    assert.equal(remint.ok, false);
    if (!remint.ok) {
      assert.ok(remint.code === 'REVALUATION_DOES_NOT_REMINT' || remint.code === 'DUPLICATE_CONTRIBUTION_SETTLEMENT');
    }
  });

  it('20. requires an explicit adjustment for a correction', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const original = fixtureVerifiedContribution({ contributionId: 'hec.112.corr' });
    const firstPath = authorizedPath(original, { authorizationId: 'hcesa.112.corr.1' });
    assert.equal(firstPath.created.ok, true);
    if (!firstPath.created.ok) {
      throw new Error(firstPath.created.code);
    }
    const first = bridge.attempt(
      {
        recipient: 'alice',
        contribution: original,
        authorization: firstPath.created.authorization,
        valuation: asReference(firstPath.valuation),
        conversionPolicy: firstPath.conversionPolicy,
      },
      book(),
    );
    assert.equal(first.ok, true);
    if (!first.ok) {
      throw new Error(first.code);
    }
    const superseded = fixtureVerifiedContribution({
      contributionId: 'hec.112.corr.adj',
      fingerprint: original.fingerprint,
      verificationState: 'SUPERSEDED',
      supersededContributionId: original.contributionId,
    });
    const silent = bridge.attempt(
      {
        recipient: 'alice',
        contribution: superseded,
        authorization: firstPath.created.authorization,
      },
      first.book,
    );
    assert.equal(silent.ok, false);
    const adjustment = authorizedPath(superseded, {
      authorizationId: 'hcesa.112.corr.2',
      measurementQuantity: 1n,
    });
    assert.equal(adjustment.created.ok, true);
    if (!adjustment.created.ok) {
      throw new Error(adjustment.created.code);
    }
    const adjusted = bridge.attempt(
      {
        recipient: 'alice',
        contribution: superseded,
        authorization: adjustment.created.authorization,
        valuation: asReference(adjustment.valuation),
        conversionPolicy: adjustment.conversionPolicy,
        correction: {
          kind: 'EXPLICIT_ADJUSTMENT',
          priorContributionId: original.contributionId,
          priorAuthorizationId: firstPath.created.authorization.authorizationId,
          supersededContributionId: superseded.contributionId,
          adjustmentQuantity: adjustment.created.authorization.authorizedSunReyQuantity,
          adjustmentAuthorizationId: adjustment.created.authorization.authorizationId,
          clawbackForbidden: true,
        },
      },
      first.book,
    );
    assert.equal(adjusted.ok, true);
    if (!adjusted.ok) {
      throw new Error(adjusted.code);
    }
  });

  it('21. refuses production settlement and keeps production inactive', () => {
    assert.equal(PRODUCTION_ACTIVATED, false);
    assert.equal(VALUATION_ENGINE_IMPLEMENTED, false);
    assert.equal(VALUATION_ENGINE_ENGINEERING_IMPLEMENTED, true);
    assert.equal(VALUATION_ENGINE_PRODUCTION_ACTIVATED, false);
    assert.equal(productionConversionPolicyUnconfigured().status, 'UNCONFIGURED');
    const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
    const bridge = new HumanContributionMonetaryBridge({ constitution });
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.prod' });
    const { created, valuation, conversionPolicy } = authorizedPath(contribution);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const result = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: asReference(valuation),
        conversionPolicy,
      },
      book(),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'PRODUCTION_ISSUANCE_UNCONFIGURED');
    }
    assert.equal(constitution.assets[0]?.supplyConstraints.productionIssuanceActivated, false);
  });

  it('22. rejects raw personal data', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.pii' });
    const { created } = authorizedPath(contribution);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const raw = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        extra: { email: 'ada@example.test' },
      },
      book(),
    );
    assert.equal(raw.ok, false);
    if (!raw.ok) {
      assert.equal(raw.code, 'RAW_PERSONAL_DATA_REJECTED');
    }
  });

  it('23-24. reconciles SunRey supply and leaves MoonRey issuance unchanged', () => {
    const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
    const bridge = new HumanContributionMonetaryBridge({ constitution });
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.supply' });
    const { created, valuation, conversionPolicy } = authorizedPath(contribution);
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error(created.code);
    }
    const issued = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: created.authorization,
        valuation: asReference(valuation),
        conversionPolicy,
      },
      book(),
    );
    assert.equal(issued.ok, true);
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    assert.equal(supplyReconciles(issued.book), true);
    assert.equal(expectedTotal(issued.book), observedTotal(issued.book));
    const moonrey = authorizeIssuance(
      constitution,
      emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId),
      developmentMoonReyAuthority({
        quantity: 12n,
        replayIdentifier: 'moonrey.unaffected.112',
        contributionId: 'moon.112',
        fingerprint: 'moon.fp.112',
        authorizationId: 'moon.auth.112',
      }),
    );
    assert.equal(moonrey.ok, true);
    if (moonrey.ok) {
      assert.equal(moonrey.book.issuedPostGenesis, 12n);
      assert.equal(issued.book.issuedPostGenesis, created.authorization.authorizedSunReyQuantity);
    }
  });

  it('25. keeps the legacy Chunk 108 fixture path fail-closed', () => {
    const bridge = new HumanContributionMonetaryBridge();
    const contribution = fixtureVerifiedContribution({ contributionId: 'hec.112.legacy' });
    const authorization = createDevelopmentSettlementAuthorization({
      contribution,
      authorizedSunReyQuantity: 40n,
    });
    assert.equal(authorization.valuationEngineImplemented, false);
    assert.equal(authorization.valuationPath, 'LEGACY_DEVELOPMENT_FIXTURE');
    const issued = bridge.attempt({ recipient: 'alice', contribution, authorization }, book());
    assert.equal(issued.ok, true);
    const engineFlip = {
      ...authorization,
      valuationEngineImplemented: true as const,
    };
    const refused = bridge.attempt(
      {
        recipient: 'alice',
        contribution,
        authorization: engineFlip as unknown as typeof authorization,
      },
      book(),
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'VALUATION_ENGINE_UNAVAILABLE');
    }
  });

  it('does not import PEVE formula logic into the settlement path', () => {
    const files = [
      'human-contribution-bridge/types.ts',
      'human-contribution-bridge/adapter.ts',
      'human-contribution-bridge/conversion.ts',
      'human-contribution-bridge/authorization.ts',
      'human-contribution-bridge/evidence.ts',
      'human-contribution-bridge/gate.ts',
      'human-contribution-bridge/index.ts',
    ];
    for (const rel of files) {
      const source = readFileSync(join(BRIDGE_DIR, rel), 'utf8');
      assert.equal(source.includes('packages/platform'), false, rel);
      assert.equal(/from ['"].*\/value\//.test(source), false, rel);
      assert.equal(source.includes('PersonalEconomicValueEngine'), false, rel);
      assert.equal(source.includes('computePeve'), false, rel);
    }
  });
});
