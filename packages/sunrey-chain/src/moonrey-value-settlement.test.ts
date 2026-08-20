import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { nativeAssetConstitution } from './economics/constitution.ts';
import { authorizeIssuance } from './economics/issuance.ts';
import { createIntegratedEconomicStack } from './economics/stack.ts';
import { emptyBook, supplyReconciles } from './economics/supply.ts';
import { evaluateIssuanceFormula, LEGACY_FORMULA_PATH_CLASS } from './productive/formula.ts';
import {
  AI_AUTHORIZED,
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  MoonReyProductiveSettlementBridge,
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTION_ACTIVE,
  containsRawProviderData,
  convertGpuvToMoonRey,
  createProductiveSettlementAuthorization,
  fixtureAttribution,
  fixtureContribution,
  fixtureEvent,
  fixtureProductiveValueResult,
  refuseStandaloneAttempt,
  simulationConversionPolicy,
  valueResultHasMintMethod,
} from './productive/policy-governance/value-settlement/index.ts';
import { WEIGHT_SCALE } from './productive/types.ts';

const ROOT = dirname(fileURLToPath(import.meta.url));

function constitution() {
  return nativeAssetConstitution('DEVELOPMENT_ACTIVE');
}

function book() {
  return emptyBook('MOONREY_COIN', constitution().assets[1]!.policyVersion.versionId);
}

function chain(overrides?: {
  readonly contribution?: ReturnType<typeof fixtureContribution>;
  readonly productiveValueQuantity?: bigint;
  readonly conversion?: ReturnType<typeof simulationConversionPolicy>;
  readonly authorizedBy?: string;
  readonly valueFunctionPolicyVersion?: number;
  readonly productiveValueId?: string;
}) {
  const contribution = overrides?.contribution ?? fixtureContribution();
  const event = fixtureEvent(contribution);
  const attribution = fixtureAttribution(contribution, event.eventId);
  const valueResult = fixtureProductiveValueResult({
    contribution,
    event,
    attribution,
    productiveValueQuantity: overrides?.productiveValueQuantity,
    valueFunctionPolicyVersion: overrides?.valueFunctionPolicyVersion,
    productiveValueId: overrides?.productiveValueId,
  });
  const conversionPolicy = overrides?.conversion ?? simulationConversionPolicy();
  return {
    contribution,
    event,
    attribution,
    valueResult,
    conversionPolicy,
    context: {
      contribution,
      event,
      attributionDecision: attribution,
      valueResult,
      conversionPolicy,
      authorizedBy: overrides?.authorizedBy ?? 'PROTOCOL',
    },
  };
}

describe('Chunk 125 productive value settlement bridge', () => {
  it('1. verified fact alone cannot issue', () => {
    assert.equal(refuseStandaloneAttempt({ kind: 'VERIFIED_ECONOMIC_FACT', factId: 'fact.1' }).code, 'VERIFIED_FACT_ALONE_CANNOT_ISSUE');
    assert.equal(refuseStandaloneAttempt({ kind: 'ORACLE_OBSERVATION', observationId: 'obs.1' }).code, 'ORACLE_OBSERVATION_ALONE_CANNOT_ISSUE');
  });

  it('2. contribution alone cannot issue', () => {
    assert.equal(
      refuseStandaloneAttempt({ kind: 'VERIFIED_PRODUCTIVE_CONTRIBUTION', contributionId: 'c.1' }).code,
      'CONTRIBUTION_ALONE_CANNOT_ISSUE',
    );
  });

  it('3. attribution alone cannot issue', () => {
    assert.equal(refuseStandaloneAttempt({ kind: 'ATTRIBUTION_DECISION', decisionId: 'attr.1' }).code, 'ATTRIBUTION_ALONE_CANNOT_ISSUE');
  });

  it('4. Productive Value alone cannot issue', () => {
    assert.equal(
      refuseStandaloneAttempt({ kind: 'PRODUCTIVE_VALUE_RESULT', productiveValueId: 'pvr.1' }).code,
      'PRODUCTIVE_VALUE_ALONE_CANNOT_ISSUE',
    );
    assert.equal(refuseStandaloneAttempt({ kind: 'GPUV_QUANTITY', quantity: 10n }).code, 'GPUV_ALONE_CANNOT_ISSUE');
  });

  it('5. valid Productive Value + conversion policy creates authorization', () => {
    const created = createProductiveSettlementAuthorization(chain().context);
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.authorization.productiveValueUnit, 'GPUV');
      assert.equal(created.authorization.authorizedMoonReyQuantity > 0n, true);
      assert.equal(created.authorization.productionActivated, false);
    }
  });

  it('6. GPUV does not equal MoonRey by definition', () => {
    const conversion = simulationConversionPolicy();
    assert.equal(GPUV_EQUALS_MOONREY_BY_DEFINITION, false);
    assert.equal(conversion.gpuvEqualsMoonReyByDefinition, false);
    assert.notEqual(conversion.conversionNumerator, conversion.conversionDenominator);
    assert.notEqual(convertGpuvToMoonRey(10n, conversion), 10n);
  });

  it('7. conversion exact arithmetic', () => {
    const conversion = simulationConversionPolicy({ conversionNumerator: 2n, conversionDenominator: 5n, roundingRule: 'FLOOR' });
    assert.equal(convertGpuvToMoonRey(10_000n, conversion), 4_000n);
    assert.equal(convertGpuvToMoonRey(11n, conversion), 4n);
  });

  it('8. conversion rounding governed', () => {
    const floor = simulationConversionPolicy({ conversionNumerator: 2n, conversionDenominator: 5n, roundingRule: 'FLOOR' });
    const ceiling = simulationConversionPolicy({ conversionNumerator: 2n, conversionDenominator: 5n, roundingRule: 'CEILING' });
    const even = simulationConversionPolicy({ conversionNumerator: 1n, conversionDenominator: 2n, roundingRule: 'NEAREST_EVEN' });
    assert.equal(convertGpuvToMoonRey(11n, floor), 4n);
    assert.equal(convertGpuvToMoonRey(11n, ceiling), 5n);
    assert.equal(convertGpuvToMoonRey(5n, even), 2n);
    assert.equal(convertGpuvToMoonRey(3n, even), 2n);
  });

  it('9. cap cascade', () => {
    const created = createProductiveSettlementAuthorization({
      ...chain({ conversion: simulationConversionPolicy({ perContributionCeiling: 100n }) }).context,
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'CAP_EXCEEDED');
    }
  });

  it('10. AI authorization rejected', () => {
    const created = createProductiveSettlementAuthorization(chain({ authorizedBy: 'AI' }).context);
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'AI_CANNOT_AUTHORIZE_ISSUANCE');
    }
    assert.equal(AI_AUTHORIZED, false);
  });

  it('11. S3M authorization rejected', () => {
    const created = createProductiveSettlementAuthorization(chain({ authorizedBy: 'S3M' }).context);
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'S3M_CANNOT_AUTHORIZE_ISSUANCE');
    }
  });

  it('12. Grok authorization rejected', () => {
    const created = createProductiveSettlementAuthorization(chain({ authorizedBy: 'GROK' }).context);
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'GROK_CANNOT_AUTHORIZE_ISSUANCE');
    }
  });

  it('13. controller self-authorization rejected', () => {
    const contribution = fixtureContribution();
    const created = createProductiveSettlementAuthorization(chain({ contribution, authorizedBy: contribution.controller }).context);
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'CONTROLLER_SELF_AUTHORIZATION_REJECTED');
    }
  });

  it('14. tampered value digest rejected', () => {
    const ready = chain();
    const tampered = { ...ready.valueResult, productiveValueDigest: '0'.repeat(64) };
    const created = createProductiveSettlementAuthorization({ ...ready.context, valueResult: tampered });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'VALUE_DIGEST_INVALID');
    }
  });

  it('15. wrong contribution rejected', () => {
    const ready = chain();
    const other = fixtureContribution({ contributionId: 'c.other', fingerprint: 'fp.other' });
    const created = createProductiveSettlementAuthorization({ ...ready.context, contribution: other });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'CONTRIBUTION_MISMATCH');
    }
  });

  it('16. wrong event rejected', () => {
    const ready = chain();
    const created = createProductiveSettlementAuthorization({
      ...ready.context,
      event: { ...ready.event, eventId: 'event.other', eventFingerprint: 'efp.other' },
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'EVENT_MISMATCH');
    }
  });

  it('17. wrong attribution decision rejected', () => {
    const ready = chain();
    const created = createProductiveSettlementAuthorization({
      ...ready.context,
      attributionDecision: { ...ready.attribution, decisionId: 'attr.other' },
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'ATTRIBUTION_DECISION_MISMATCH');
    }
  });

  it('18. wrong policy version rejected', () => {
    const ready = chain({ valueFunctionPolicyVersion: 1 });
    const created = createProductiveSettlementAuthorization(ready.context);
    if (!created.ok) {
      throw new Error('expected ok');
    }
    const mismatch = { ...ready.context, valueResult: { ...ready.valueResult, valueFunctionPolicyVersion: 9 } };
    const validated = createProductiveSettlementAuthorization(mismatch);
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.code, 'VALUE_DIGEST_INVALID');
    }
  });

  it('19. replay rejected', () => {
    const ready = chain();
    const bridge = new MoonReyProductiveSettlementBridge();
    const first = bridge.attempt(ready.context, constitution(), book());
    assert.equal(first.ok, true);
    const second = bridge.attempt(ready.context, constitution(), first.ok ? first.book : book());
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'REPLAY_REJECTED');
    }
  });

  it('20. revaluation does not auto-remint', () => {
    const ready = chain();
    const bridge = new MoonReyProductiveSettlementBridge();
    const first = bridge.attempt(ready.context, constitution(), book());
    assert.equal(first.ok, true);
    const revalued = chain({
      contribution: ready.contribution,
      productiveValueId: 'pvr.energy.v2.revalued',
      productiveValueQuantity: 12_000n,
    });
    const second = bridge.attempt(revalued.context, constitution(), first.ok ? first.book : book());
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'REVALUATION_SETTLEMENT_REVIEW');
      assert.equal(second.review?.remintForbidden, true);
      assert.equal(second.review?.clawbackForbidden, true);
    }
  });

  it('21. attribution correction does not auto-adjust money', () => {
    const ready = chain();
    const bridge = new MoonReyProductiveSettlementBridge();
    const first = bridge.attempt(ready.context, constitution(), book());
    assert.equal(first.ok, true);
    const changed = {
      ...ready.context,
      attributionDecision: { ...ready.attribution, decisionId: 'attr.corrected' },
      valueResult: { ...ready.valueResult, attributionDecisionId: 'attr.corrected' },
    };
    const second = bridge.attempt(changed, constitution(), first.ok ? first.book : book(), { attributionChanged: true });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'ATTRIBUTION_SETTLEMENT_ADJUSTMENT_REVIEW_REQUIRED');
      assert.equal(second.review?.customerBalanceUnmodified, true);
    }
  });

  it('22. valid V2 simulation passes Chunk 71', () => {
    const ready = chain();
    const issued = new MoonReyProductiveSettlementBridge().attempt(ready.context, constitution(), book());
    assert.equal(issued.ok, true);
    if (issued.ok) {
      assert.equal(issued.authority.authorizationSource, 'MOONREY_PRODUCTIVE_AUTHORIZATION');
      assert.equal(issued.authority.authorized, true);
      const replay = authorizeIssuance(constitution(), issued.book, issued.authority);
      assert.equal(replay.ok, false);
    }
  });

  it('23. canonical MoonRey supply reconciles', () => {
    const ready = chain();
    const issued = new MoonReyProductiveSettlementBridge().attempt(ready.context, constitution(), book());
    assert.equal(issued.ok, true);
    if (issued.ok) {
      assert.equal(supplyReconciles(issued.book), true);
      assert.equal(issued.book.issuedPostGenesis, issued.authorization.authorizedMoonReyQuantity);
      assert.equal(issued.book.circulating, issued.authorization.authorizedMoonReyQuantity);
    }
  });

  it('24. legacy V1 still works in simulation', () => {
    const formula = evaluateIssuanceFormula({
      eligibleQuantity: 1_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000n,
    });
    assert.equal(formula.formulaVersion, 'moonrey.issuance.formula.v1');
    assert.equal(formula.formulaPathClass, LEGACY_FORMULA_PATH_CLASS);
    const stack = createIntegratedEconomicStack();
    stack.registerProductiveObject({
      objectId: 'obj.energy.legacy',
      category: 'ENERGY',
      unit: 'kWh',
      owner: 'ctl.legacy',
    });
    const issued = stack.issueMoonReyFromClaim({
      claimId: 'claim.obj.energy.legacy.1',
      objectId: 'obj.energy.legacy',
      category: 'ENERGY',
      quantity: 100n,
      unit: 'kWh',
      controller: 'ctl.legacy',
      epoch: 1,
      providerCount: 3,
    });
    assert.equal(issued.ok, true);
    assert.equal(stack.moonreyV1Issued > 0n, true);
    assert.equal(stack.reconcile().ok, true);
  });

  it('25. production V2 rejected', () => {
    const stack = createIntegratedEconomicStack();
    stack.registerProductiveObject({
      objectId: 'obj.energy.prod',
      category: 'ENERGY',
      unit: 'kWh',
      owner: 'ctl.prod',
    });
    const issued = stack.issueMoonReyFromGovernedValue({
      claimId: 'claim.obj.energy.prod.1',
      objectId: 'obj.energy.prod',
      category: 'ENERGY',
      quantity: 100n,
      unit: 'kWh',
      controller: 'ctl.prod',
      epoch: 1,
      providerCount: 3,
      production: true,
    });
    assert.equal(issued.ok, false);
    if (!issued.ok) {
      assert.equal(issued.code, 'PRODUCTION_V2_UNAVAILABLE');
    }
    assert.equal(PRODUCTION_ACTIVE, false);
  });

  it('26. no raw provider data in receipt', () => {
    const ready = chain();
    const issued = new MoonReyProductiveSettlementBridge().attempt(ready.context, constitution(), book());
    assert.equal(issued.ok, true);
    if (issued.ok) {
      assert.equal(containsRawProviderData(issued.receipt), false);
      assert.equal(containsRawProviderData(issued.evidence), false);
      assert.equal(issued.evidence.sourcePayloadOmitted, true);
    }
  });

  it('ProductiveValueResult has no mint method and the engine cannot call MonetaryIssuanceAuthority', () => {
    const ready = chain();
    assert.equal(valueResultHasMintMethod(ready.valueResult), false);
    assert.equal(PRODUCTIVE_VALUE_ENGINE_CAN_MINT, false);
    const valueFunctionDir = join(ROOT, 'productive/policy-governance/value-function');
    for (const file of ['constitution.ts', 'invariants.ts', 'methods.ts', 'policy.ts', 'registry.ts', 'types.ts']) {
      const source = readFileSync(join(valueFunctionDir, file), 'utf8');
      assert.equal(source.includes('MonetaryIssuanceAuthority'), false);
      assert.equal(source.includes('authorizeIssuance'), false);
    }
    const engine = readFileSync(join(ROOT, 'productive/engine.ts'), 'utf8');
    assert.equal(engine.includes('MonetaryIssuanceAuthority'), false);
    assert.equal(engine.includes("from '../economics/issuance"), false);
  });

  it('integrated V2 stack issues through AssetSupplyBook without the local tracker', () => {
    const stack = createIntegratedEconomicStack();
    stack.registerProductiveObject({
      objectId: 'obj.energy.v2',
      category: 'ENERGY',
      unit: 'kWh',
      owner: 'ctl.v2',
    });
    const issued = stack.issueMoonReyFromGovernedValue({
      claimId: 'claim.obj.energy.v2.1',
      objectId: 'obj.energy.v2',
      category: 'ENERGY',
      quantity: 100n,
      unit: 'kWh',
      controller: 'ctl.v2',
      epoch: 1,
      providerCount: 3,
    });
    assert.equal(issued.ok, true);
    assert.equal(stack.moonreyV2Issued > 0n, true);
    assert.equal(stack.productive.currentSupply().issued, 0n);
    assert.equal(stack.moonrey.issuedPostGenesis, stack.moonreyV2Issued);
    assert.equal(stack.reconcile().canonicalMoonReyReconciles, true);
    assert.equal(stack.reconcile().ok, true);
  });
});
