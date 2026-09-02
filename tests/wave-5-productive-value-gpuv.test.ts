/**
 * Wave 5 — Productive Economic Value and GPUV tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GPUV_DEFINITION,
  GPUV_DOES_NOT_MEASURE,
  GPUV_MEASURES,
  MARKET_PRICE_COUPLING_FORBIDDEN,
  ProductiveValueEngine,
  acceptProductiveEconomicContribution,
  auditMarketPriceSeparation,
  createProductiveValueEngine,
  domainBindingForCategory,
  exchangeApiUnavailableDoesNotAlterGpuv,
  methodologyFromPolicy,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/wave5/index.ts';
import {
  developmentValueFunctionPolicy,
  evaluateProductiveValue,
  simulationBaseValueSchedule,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/index.ts';
import {
  engineAttribution,
  engineContribution,
  engineReferenceFact,
  engineValueInput,
} from '../packages/sunrey-chain/src/productive/policy-governance/value-function/fixtures.ts';
import { PRODUCTIVE_CATEGORIES } from '../packages/sunrey-chain/src/productive/types.ts';

const CALCULATED_AT = '2026-09-02T11:00:00.000Z';

function consensusReceipt() {
  return Object.freeze({
    receiptId: 'icr.energy.1',
    receiptVersion: '1',
    observationIds: ['obs.1', 'obs.2', 'obs.3'],
    sourceQuorumEvidence: ['oracle.1', 'oracle.2', 'oracle.3'],
    corroborationMethodologyId: 'wave5.information-consensus.v1',
    corroborationMethodologyVersion: '1',
    sealedAtUtc: CALCULATED_AT,
    independentlyCorroborated: true as const,
  });
}

function evidenceProof() {
  return Object.freeze({
    evidenceId: 'ev.energy.1',
    evidenceDigest: 'digest.ev.energy.1',
    verificationMethodologyId: 'wave5.productive-verification.v1',
    verificationMethodologyVersion: '1',
  });
}

function acceptInput(overrides: Partial<Parameters<typeof acceptProductiveEconomicContribution>[0]> = {}) {
  const contribution = engineContribution('ENERGY', overrides.verifiedContribution);
  const attribution = engineAttribution('ENERGY');
  return {
    verifiedContribution: contribution,
    canonicalEvent: {
      eventId: attribution.eventId,
      identityVersion: '1',
      category: 'ENERGY' as const,
      objectId: contribution.objectId,
      measurementPeriod: contribution.measurementPeriod,
      eventFingerprint: 'evfp.energy.1',
    },
    eventFingerprint: 'evfp.energy.1',
    reconciliationStatus: 'RECONCILED' as const,
    economicClaim: {
      economicClaimId: 'eclaim.energy.1',
      claimFingerprint: contribution.fingerprint,
      claimType: 'OUTPUT',
    },
    informationConsensusReceipt: consensusReceipt(),
    evidenceProofs: [evidenceProof()],
    rightsLicenseProof: {
      rightsId: 'right.1',
      licenseId: 'license.1',
      scopeDigest: 'scope.digest.1',
    },
    verificationMethodologyId: 'wave5.productive-verification.v1',
    verificationMethodologyVersion: '1',
    attributionDecision: attribution,
    acceptedAtUtc: CALCULATED_AT,
    ...overrides,
  };
}

describe('Wave 5 — ProductiveEconomicContribution', () => {
  it('accepts a verified productive event with required proofs', () => {
    const accepted = acceptProductiveEconomicContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.equal(accepted.contribution.hasMonetaryAuthority, false);
      assert.equal(accepted.contribution.simulation, true);
      assert.equal(accepted.contribution.informationConsensusReceipt.receiptId, 'icr.energy.1');
      assert.equal(accepted.contribution.economicClaim.economicClaimId, 'eclaim.energy.1');
    }
  });

  it('rejects stale or unverified contribution', () => {
    const stale = acceptProductiveEconomicContribution(acceptInput({
      verifiedContribution: engineContribution('ENERGY', { status: 'REVIEW_REQUIRED' }),
    }));
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.code, 'CONTRIBUTION_NOT_ELIGIBLE');
    }
  });

  it('rejects unresolved productive event', () => {
    const unresolved = acceptProductiveEconomicContribution(acceptInput({
      reconciliationStatus: 'UNRESOLVED',
    }));
    assert.equal(unresolved.ok, false);
    if (!unresolved.ok) {
      assert.equal(unresolved.code, 'EVENT_UNRESOLVED');
    }
  });

  it('rejects duplicate productive event valuation', () => {
    const engine = createProductiveValueEngine();
    const accepted = engine.acceptContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (!accepted.ok) {
      return;
    }
    const first = engine.evaluate({
      contribution: accepted.contribution,
      valueInput: engineValueInput('ENERGY'),
      calculatedAtUtc: CALCULATED_AT,
    }, {
      policy: developmentValueFunctionPolicy(),
      schedule: simulationBaseValueSchedule(),
    });
    assert.equal(first.ok, true);
    const second = engine.evaluate({
      contribution: accepted.contribution,
      valueInput: engineValueInput('ENERGY'),
      calculatedAtUtc: CALCULATED_AT,
    }, {
      policy: developmentValueFunctionPolicy(),
      schedule: simulationBaseValueSchedule(),
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'DUPLICATE_PRODUCTIVE_EVENT');
    }
  });

  it('rejects SunRey PEVE methodology substitution', () => {
    const peve = acceptProductiveEconomicContribution(acceptInput({ peveMethodologyRequested: true }));
    assert.equal(peve.ok, false);
    if (!peve.ok) {
      assert.equal(peve.code, 'PEVE_METHODOLOGY_FORBIDDEN');
    }
  });
});

describe('Wave 5 — GPUV definition', () => {
  it('documents what GPUV measures and does not measure', () => {
    assert.equal(GPUV_DEFINITION.unit.notMoonReyQuantity, true);
    assert.equal(GPUV_DEFINITION.unit.notMarketPrice, true);
    assert.equal(GPUV_DEFINITION.unit.notFiatValue, true);
    assert.equal(GPUV_MEASURES.governedProductiveEconomicValue, true);
    assert.equal(GPUV_DOES_NOT_MEASURE.moonReyQuantity, true);
    assert.equal(GPUV_DOES_NOT_MEASURE.exchangeMarketPrice, true);
    assert.equal(GPUV_DOES_NOT_MEASURE.peveHumanContributionScore, true);
  });
});

describe('Wave 5 — ProductiveValueEngine determinism', () => {
  it('produces the same GPUV for same inputs and methodology', () => {
    const accepted = acceptProductiveEconomicContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (!accepted.ok) {
      return;
    }
    const valueInput = engineValueInput('ENERGY');
    const policy = developmentValueFunctionPolicy();
    const schedule = simulationBaseValueSchedule();

    const engineA = createProductiveValueEngine();
    const engineB = createProductiveValueEngine();
    const first = engineA.evaluate({
      contribution: accepted.contribution,
      valueInput,
      calculatedAtUtc: CALCULATED_AT,
    }, { policy, schedule });
    const second = engineB.evaluate({
      contribution: accepted.contribution,
      valueInput,
      calculatedAtUtc: CALCULATED_AT,
    }, { policy, schedule });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.equal(first.valuation.gpuvQuantity, second.valuation.gpuvQuantity);
      assert.equal(first.valuation.resultHash, second.valuation.resultHash);
      assert.equal(first.receipt.gpuvQuantity, second.receipt.gpuvQuantity);
    }
  });

  it('produces explicitly different GPUV for different methodology versions', () => {
    const policyV1 = developmentValueFunctionPolicy(1, 1);
    const policyV2 = developmentValueFunctionPolicy(1, 2);
    const schedule = simulationBaseValueSchedule();
    const valueInputV1 = engineValueInput('ENERGY', {
      valueFunctionPolicyId: policyV1.policyId,
      valueFunctionPolicyVersion: 1,
    });
    const valueInputV2 = engineValueInput('ENERGY', {
      valueFunctionPolicyId: policyV2.policyId,
      valueFunctionPolicyVersion: 2,
    });

    const accepted = acceptProductiveEconomicContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (!accepted.ok) {
      return;
    }

    const engineA = createProductiveValueEngine();
    const engineB = createProductiveValueEngine();
    const v1 = engineA.evaluate({
      contribution: accepted.contribution,
      valueInput: valueInputV1,
      calculatedAtUtc: CALCULATED_AT,
    }, { policy: policyV1, schedule });
    const v2 = engineB.evaluate({
      contribution: accepted.contribution,
      valueInput: valueInputV2,
      calculatedAtUtc: CALCULATED_AT,
    }, { policy: policyV2, schedule });

    assert.equal(v1.ok, true);
    assert.equal(v2.ok, true);
    if (v1.ok && v2.ok) {
      assert.notEqual(v1.valuation.methodology.methodologyVersion, v2.valuation.methodology.methodologyVersion);
    }
  });

  it('replays historical valuation with the same methodology hash', () => {
    const engine = createProductiveValueEngine();
    const accepted = engine.acceptContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (!accepted.ok) {
      return;
    }
    const valueInput = engineValueInput('ENERGY');
    const policy = developmentValueFunctionPolicy();
    const schedule = simulationBaseValueSchedule();
    const evaluated = engine.evaluate({
      contribution: accepted.contribution,
      valueInput,
      calculatedAtUtc: CALCULATED_AT,
    }, { policy, schedule });
    assert.equal(evaluated.ok, true);
    if (!evaluated.ok) {
      return;
    }
    const replay = engine.replayValuation(
      evaluated.valuation.valuationId,
      valueInput,
      accepted.contribution,
      CALCULATED_AT,
      { policy, schedule },
    );
    assert.equal(replay.ok, true);
    if (replay.ok) {
      assert.equal(replay.valuation.resultHash, evaluated.valuation.resultHash);
    }
  });
});

describe('Wave 5 — market price separation', () => {
  it('does not let market price alter GPUV', () => {
    const policy = developmentValueFunctionPolicy();
    const schedule = simulationBaseValueSchedule();
    const baseline = evaluateProductiveValue(engineValueInput('ENERGY'), { policy, schedule });
    const withMarketPriceFact = evaluateProductiveValue(
      engineValueInput('ENERGY', {
        referenceFacts: [
          engineReferenceFact('QUALITY'),
          engineReferenceFact('FRESHNESS'),
          engineReferenceFact('UTILIZATION'),
          engineReferenceFact('CAPACITY'),
          engineReferenceFact('REGIONAL_SUPPLY'),
          engineReferenceFact('REFERENCE_PRICE', { moonreyMarketPrice: true }),
        ],
      }),
      { policy, schedule },
    );
    assert.equal(baseline.state, 'VALUED_SIMULATION');
    assert.equal(withMarketPriceFact.state, 'VALUE_REJECTED');
    assert.equal(
      auditMarketPriceSeparation({
        valueInput: engineValueInput('ENERGY', {
          referenceFacts: [engineReferenceFact('REFERENCE_PRICE', { moonreyMarketPrice: true })],
        }),
      }).ok,
      false,
    );
    assert.deepEqual(MARKET_PRICE_COUPLING_FORBIDDEN, {
      gpuvEqualsMoonReyPrice: false,
      gpuvDeterminesExchangeQuote: false,
      exchangeQuoteFeedsGpuv: false,
      marketCapDeterminesIssuance: false,
    });
  });

  it('keeps GPUV stable when Exchange API is unavailable', () => {
    const policy = developmentValueFunctionPolicy();
    const schedule = simulationBaseValueSchedule();
    const withApi = evaluateProductiveValue(engineValueInput('ENERGY'), { policy, schedule });
    const withoutApi = exchangeApiUnavailableDoesNotAlterGpuv(() =>
      evaluateProductiveValue(engineValueInput('ENERGY'), { policy, schedule }),
    );
    assert.equal(withApi.result?.finalProductiveValue, withoutApi.result?.finalProductiveValue);
  });

  it('rejects AI economic judgment from modifying deterministic result', () => {
    const engine = createProductiveValueEngine();
    const accepted = engine.acceptContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (!accepted.ok) {
      return;
    }
    const result = engine.evaluate({
      contribution: accepted.contribution,
      valueInput: engineValueInput('ENERGY', { aiEconomicJudgment: true }),
      calculatedAtUtc: CALCULATED_AT,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AI_ECONOMIC_JUDGMENT_FORBIDDEN');
    }
  });
});

describe('Wave 5 — cross-domain methodology', () => {
  it('binds every productive category to a versioned domain interface', () => {
    const methodology = methodologyFromPolicy(developmentValueFunctionPolicy());
    assert.equal(methodology.simulationOnly, true);
    assert.equal(methodology.productionActivated, false);
    for (const category of PRODUCTIVE_CATEGORIES) {
      const binding = domainBindingForCategory(methodology, category);
      assert.ok(binding, category);
      assert.equal(binding.simulationOnly, true);
      assert.ok(binding.measurementSemantic.length > 0);
      assert.ok(binding.canonicalUnitId.length > 0);
    }
  });
});

describe('Wave 5 — ProductiveValueReceipt', () => {
  it('emits an auditable receipt with required fields', () => {
    const engine = createProductiveValueEngine();
    const accepted = engine.acceptContribution(acceptInput());
    assert.equal(accepted.ok, true);
    if (!accepted.ok) {
      return;
    }
    const result = engine.evaluate({
      contribution: accepted.contribution,
      valueInput: engineValueInput('ENERGY'),
      calculatedAtUtc: CALCULATED_AT,
    }, {
      policy: developmentValueFunctionPolicy(),
      schedule: simulationBaseValueSchedule(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const receipt = result.receipt;
    assert.ok(receipt.valuationId.startsWith('pval.'));
    assert.equal(receipt.productiveContribution.eventFingerprint, 'evfp.energy.1');
    assert.equal(receipt.economicClaim.economicClaimId, 'eclaim.energy.1');
    assert.equal(receipt.methodologyId, 'moonrey.productive-value-function.simulation.v1');
    assert.equal(typeof receipt.methodologyVersion, 'number');
    assert.equal(receipt.simulationStatus, true);
    assert.equal(receipt.productionStatus, false);
    assert.ok(receipt.resultHash.length > 0);
    assert.ok(receipt.gpuvQuantity > 0n);
    assert.equal(receipt.gpuvDefinitionVersion, GPUV_DEFINITION.definitionVersion);
    assert.equal(engine.capabilities.mayChangeMoonReySupply, false);
    assert.equal(engine.capabilities.maySetMoonReyMarketPrice, false);
  });
});

describe('Wave 5 — ProductiveValueEngine boundary', () => {
  it('cannot mint, set market price, or approve governance', () => {
    const engine = new ProductiveValueEngine();
    assert.equal(engine.status.canMint, false);
    assert.equal(engine.capabilities.maySubmitDirectMintInstruction, false);
    assert.equal(engine.capabilities.mayApproveGovernance, false);
    assert.equal(engine.capabilities.mayCalculateEconomicValue, true);
  });
});
