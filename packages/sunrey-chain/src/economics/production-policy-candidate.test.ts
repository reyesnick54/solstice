import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nativeAssetConstitution } from './constitution.ts';
import { emptyBook } from './supply.ts';
import {
  configuredNumeric,
  createConversionPolicyCandidate,
  emptyCandidateSettlementBook,
  evaluateProductionCandidateConversion,
  fixtureConversionInput,
  rehearsalConversionPolicyCandidate,
  unconfiguredConversionPolicyCandidate,
  validateConversionPolicyCandidate,
} from './human-contribution-bridge/production-candidate/index.ts';
import {
  candidateReadySnapshot,
  currentRepositorySnapshot,
  evaluateProductionEconomicActivation,
  rehearsalSunReyIssuancePackage,
  unconfiguredSunReyIssuancePackage,
  validateSunReyProductionIssuanceParameterPackage,
  withSunReyIssuancePackage,
} from './production-activation/index.ts';
import { createSunReyProductionIssuanceParameterPackage } from './production-activation/sunrey-package/package.ts';
import { rehearsalValuationPolicyCandidate } from '../../../human-economic-contribution/src/valuation/production-candidate/fixtures.ts';
import { valueContributionUnderCandidatePolicy } from '../../../human-economic-contribution/src/valuation/production-candidate/receipt.ts';
import { fixtureVerifiedContribution } from '../../../human-economic-contribution/src/valuation/production-candidate/fixtures.ts';

describe('Chunk 145 SunRey production issuance policy candidate', () => {
  it('9. exact rational conversion uses bigint only', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ referenceValue: 68n }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, true);
    if (!converted.ok) {
      throw new Error(converted.code);
    }
    // 68 * 3 / 7 = 29 remainder 1 → FLOOR 29
    assert.equal(converted.value.authorizedSunReyQuantity, 29n);
    assert.equal(converted.value.referenceValueEqualsSunReyByDefinition, false);
    assert.equal(converted.value.mints, false);
    assert.equal(converted.value.mutatesSupplyBook, false);
  });

  it('10. denominator zero is rejected', () => {
    const policy = createConversionPolicyCandidate({
      inputReferenceDenomination: 'HUMAN_CONTRIBUTION_REFERENCE_UNIT',
      conversionNumerator: configuredNumeric(1n),
      conversionDenominator: configuredNumeric(0n),
      perContributionCeiling: configuredNumeric(10n),
      perContributionClassCeiling: configuredNumeric(10n),
      perEpochCeiling: configuredNumeric(10n),
      globalEpochCeiling: configuredNumeric(10n),
      jurisdictionPolicyRef: rehearsalConversionPolicyCandidate().jurisdictionPolicyRef,
      valuationPolicyRef: rehearsalConversionPolicyCandidate().valuationPolicyRef,
      verificationPolicyRef: rehearsalConversionPolicyCandidate().verificationPolicyRef,
      governanceReference: 'test',
      fixture: true,
      sourceClass: 'FIXTURE',
    });
    const validated = validateConversionPolicyCandidate(policy);
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.code, 'DENOMINATOR_ZERO');
    }
  });

  it('11. denomination mismatch is rejected', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ referenceDenomination: 'OTHER_UNIT' }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'DENOMINATION_MISMATCH');
    }
  });

  it('12. contribution mismatch is rejected', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      expectedContributionId: 'hec.other',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'CONTRIBUTION_MISMATCH');
    }
  });

  it('13. valuation mismatch is rejected', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      expectedValuationId: 'hcv.other',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'VALUATION_MISMATCH');
    }
  });

  it('14. rights evidence is required for Information Right contributions', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({
        contributionClass: 'INFORMATION_RIGHT_CONTRIBUTION',
        rightsEvidencePresent: false,
      }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'RIGHTS_EVIDENCE_REQUIRED');
    }
  });

  it('15. HIN consent alone is insufficient', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ consentOnly: true }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'HIN_CONSENT_ALONE_INSUFFICIENT');
    }
  });

  it('16. clean-room result alone is insufficient', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ cleanRoomOnly: true }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'CLEAN_ROOM_ALONE_INSUFFICIENT');
    }
  });

  it('17. contribution verification is required', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ verificationState: 'UNVERIFIED' }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'CONTRIBUTION_VERIFICATION_REQUIRED');
    }
  });

  it('18. conversion policy is required', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: null,
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'CONVERSION_POLICY_REQUIRED');
    }
  });

  it('19. per-contribution cap cannot be bypassed by a higher reference value', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ referenceValue: 10_000n }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'PER_CONTRIBUTION_CAP');
    }
  });

  it('20. per-class cap cannot be bypassed', () => {
    const book = emptyCandidateSettlementBook();
    const first = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'c1', valuationId: 'v1', referenceValue: 68n }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      book,
    });
    assert.equal(first.ok, true);
    const second = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'c2', valuationId: 'v2', referenceValue: 68n }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      book,
    });
    assert.equal(second.ok, true);
    const third = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'c3', valuationId: 'v3', referenceValue: 68n }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      book,
    });
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.code, 'PER_CLASS_CAP');
    }
  });

  it('21. epoch cap cannot be bypassed', () => {
    const tight = createConversionPolicyCandidate({
      ...rehearsalConversionPolicyCandidate(),
      conversionNumerator: configuredNumeric(1n),
      conversionDenominator: configuredNumeric(1n),
      perContributionCeiling: configuredNumeric(50n),
      perContributionClassCeiling: configuredNumeric(200n),
      perEpochCeiling: configuredNumeric(60n),
      globalEpochCeiling: configuredNumeric(400n),
      fixture: true,
      sourceClass: 'FIXTURE',
    });
    const book = emptyCandidateSettlementBook();
    const first = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'e1', valuationId: 'ev1', referenceValue: 50n }),
      policy: tight,
      actor: 'PROTOCOL',
      book,
      epochKey: 'epoch.1',
    });
    assert.equal(first.ok, true);
    const second = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'e2', valuationId: 'ev2', referenceValue: 50n }),
      policy: tight,
      actor: 'PROTOCOL',
      book,
      epochKey: 'epoch.1',
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'EPOCH_CAP');
    }
  });

  it('22. global cap cannot be bypassed by many valid contributions', () => {
    const tight = createConversionPolicyCandidate({
      ...rehearsalConversionPolicyCandidate(),
      conversionNumerator: configuredNumeric(1n),
      conversionDenominator: configuredNumeric(1n),
      perContributionCeiling: configuredNumeric(20n),
      perContributionClassCeiling: configuredNumeric(400n),
      perEpochCeiling: configuredNumeric(400n),
      globalEpochCeiling: configuredNumeric(30n),
      fixture: true,
      sourceClass: 'FIXTURE',
    });
    const book = emptyCandidateSettlementBook();
    const first = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'g1', valuationId: 'gv1', referenceValue: 20n }),
      policy: tight,
      actor: 'PROTOCOL',
      book,
    });
    assert.equal(first.ok, true);
    const second = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ contributionId: 'g2', valuationId: 'gv2', referenceValue: 20n }),
      policy: tight,
      actor: 'PROTOCOL',
      book,
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.code, 'GLOBAL_CAP');
    }
  });

  it('23. max supply guard cannot be bypassed', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ referenceValue: 68n }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      supplyGuards: { maximumSupply: 10n, genesisSupply: 0n, remainingPostGenesis: 10n },
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'MAX_SUPPLY_GUARD');
    }
  });

  it('24. replay of the same contribution, valuation, or authorization is rejected', () => {
    const book = emptyCandidateSettlementBook();
    const first = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      authorizationId: 'auth-1',
      book,
    });
    assert.equal(first.ok, true);
    const sameContribution = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ valuationId: 'other-val' }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      authorizationId: 'auth-2',
      book,
    });
    assert.equal(sameContribution.ok, false);
    if (!sameContribution.ok) {
      assert.equal(sameContribution.code, 'REPLAY_REJECTED');
    }
  });

  it('25. revaluation does not remint', () => {
    const book = emptyCandidateSettlementBook();
    const first = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      book,
    });
    assert.equal(first.ok, true);
    const revalued = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({
        contributionId: 'hec.candidate.reval',
        valuationId: 'hcv.reval',
      }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      book,
      revaluationOfSettledValuationId: fixtureConversionInput().valuationId,
    });
    assert.equal(revalued.ok, false);
    if (!revalued.ok) {
      assert.equal(revalued.code, 'REVALUATION_DOES_NOT_REMINT');
    }
  });

  it('26-28. AI, S3M, and Grok cannot authorize conversion', () => {
    for (const actor of ['AI', 'S3M', 'GROK'] as const) {
      const converted = evaluateProductionCandidateConversion({
        contribution: fixtureConversionInput(),
        policy: rehearsalConversionPolicyCandidate(),
        actor,
      });
      assert.equal(converted.ok, false);
    }
  });

  it('29. fixture cannot authorize production', () => {
    const pkg = rehearsalSunReyIssuancePackage();
    assert.equal(pkg.fixture, true);
    assert.equal(pkg.fixtureAuthorizesProduction, false);
    assert.equal(pkg.rehearsalFixtureLabel, 'REHEARSAL_FIXTURE');
    assert.equal(pkg.economicMeaning, 'NO_PRODUCTION_ECONOMIC_MEANING');
    const decision = evaluateProductionEconomicActivation(withSunReyIssuancePackage(candidateReadySnapshot(), pkg));
    assert.notEqual(
      decision.domainDecisions.find((row) => row.domain === 'SUNREY_COIN_ISSUANCE')?.state,
      'PRODUCTION_CANDIDATE_READY',
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY'));
  });

  it('30. Chunk 71 remains the only monetary authority', () => {
    const pkg = rehearsalSunReyIssuancePackage();
    assert.equal(pkg.chunk71RemainsMonetaryAuthority, true);
    assert.equal(nativeAssetConstitution().assets[0]?.supplyConstraints.productionIssuanceActivated, false);
    assert.equal(pkg.candidatePackageCanMint, false);
  });

  it('31. candidate package cannot mint or mutate AssetSupplyBook', () => {
    const book = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
    const before = book.issuedPostGenesis;
    const validated = validateSunReyProductionIssuanceParameterPackage(rehearsalSunReyIssuancePackage());
    assert.equal(validated.ok, true);
    if (validated.ok) {
      assert.equal(validated.mutatedSupplyBook, false);
    }
    assert.equal(book.issuedPostGenesis, before);
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, true);
    if (converted.ok) {
      assert.equal(converted.value.mints, false);
    }
  });

  it('32. current production remains blocked', () => {
    const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    assert.equal(decision.overallState, 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.equal(decision.productionActivated, false);
    const withFixture = evaluateProductionEconomicActivation(
      withSunReyIssuancePackage(currentRepositorySnapshot(), rehearsalSunReyIssuancePackage()),
    );
    assert.equal(withFixture.overallState, 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.equal(withFixture.productionActivated, false);
  });

  it('policy version mismatch rejects', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      expectedValuationPolicyVersion: 'other-version',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'VALUATION_POLICY_VERSION_MISMATCH');
    }
  });

  it('usage receipt or information asset alone cannot issue', () => {
    const usage = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ usageReceiptOnly: true }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(usage.ok, false);
    const asset = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({ informationAssetOnly: true }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(asset.ok, false);
  });

  it('unconfigured conversion values are reported', () => {
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: unconfiguredConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, false);
    if (!converted.ok) {
      assert.equal(converted.code, 'VALUES_UNCONFIGURED');
    }
  });

  it('PEVE cannot become conversion input or SunRey quantity', () => {
    const asInput = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput(),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
      extra: { peveScore: 12n },
    });
    assert.equal(asInput.ok, false);
    if (!asInput.ok) {
      assert.equal(asInput.code, 'PEVE_CANNOT_BECOME_CONVERSION_INPUT');
    }
  });

  it('supply invariants: genesis cannot exceed maximum', () => {
    const invalid = createSunReyProductionIssuanceParameterPackage({
      ...rehearsalSunReyIssuancePackage(),
      maximumSupply: configuredNumeric(10n),
      genesisSupply: configuredNumeric(100n),
      fixture: true,
      sourceClass: 'FIXTURE',
    });
    const validated = validateSunReyProductionIssuanceParameterPackage(invalid);
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.code, 'GENESIS_EXCEEDS_MAXIMUM_SUPPLY');
    }
  });

  it('unconfigured package remains structurally incomplete', () => {
    const pkg = unconfiguredSunReyIssuancePackage();
    const validated = validateSunReyProductionIssuanceParameterPackage(pkg);
    assert.equal(validated.ok, true);
    if (validated.ok) {
      assert.equal(validated.readiness.valuationValuesConfigured, false);
      assert.equal(validated.readiness.conversionValuesConfigured, false);
      assert.equal(validated.readiness.supplyParametersConfigured, false);
      assert.equal(validated.readiness.productionActivated, false);
    }
  });

  it('end-to-end fixture path stops before issuance', () => {
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureVerifiedContribution(),
      policy: rehearsalValuationPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(valued.ok, true);
    if (!valued.ok) {
      throw new Error(valued.code);
    }
    const converted = evaluateProductionCandidateConversion({
      contribution: fixtureConversionInput({
        referenceValue: valued.receipt.referenceValue,
        valuationId: valued.receipt.valuationId,
      }),
      policy: rehearsalConversionPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(converted.ok, true);
    if (!converted.ok) {
      throw new Error(converted.code);
    }
    assert.equal(converted.value.productionActivated, false);
    assert.equal(converted.value.mints, false);
  });
});
