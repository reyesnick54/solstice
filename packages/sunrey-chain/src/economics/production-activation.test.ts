import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { nativeAssetConstitution } from './constitution.ts';
import { emptyBook, supplyReconciles } from './supply.ts';
import {
  ProductionEconomicActivationFirewall,
  allConfiguredParameters,
  candidateReadySnapshot,
  configuredParameter,
  currentLiveFlags,
  currentRepositorySnapshot,
  domainState,
  evaluateProductionEconomicActivation,
  humanSlot,
  parameterManifestHash,
  simulationConversionParameter,
  withSnapshot,
  withUnconfigured,
} from './production-activation/index.ts';
import type { ProductionParameterId } from './production-activation/index.ts';

describe('Chunk 143 production economic activation firewall', () => {
  it('1. current main evaluates BLOCKED', () => {
    const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    assert.equal(decision.overallState, 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.equal(decision.productionActivated, false);
    for (const row of decision.domainDecisions) {
      assert.equal(row.state, 'ECONOMIC_ACTIVATION_BLOCKED');
      assert.equal(row.runtimeEnabled, false);
    }
  });

  it('2. unconfigured max supply blocks', () => {
    const decision = evaluateProductionEconomicActivation(withUnconfigured('SUNREY_MAXIMUM_SUPPLY'));
    assert.equal(decision.blockingRequirements.includes('SHARED.SUNREY_MAXIMUM_SUPPLY'), true);
    assert.ok(decision.domainDecisions.some((row) => row.blockers.includes('MAXIMUM_SUPPLY_UNCONFIGURED')));
  });

  it('3. unconfigured genesis supply blocks', () => {
    const decision = evaluateProductionEconomicActivation(withUnconfigured('MOONREY_GENESIS_SUPPLY'));
    assert.ok(decision.domainDecisions.some((row) => row.blockers.includes('GENESIS_SUPPLY_UNCONFIGURED')));
  });

  it('4. simulation conversion policy blocks', () => {
    const parameters = allConfiguredParameters().map((row) =>
      row.id === 'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION' || row.id === 'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION'
        ? simulationConversionParameter(row.id)
        : row,
    );
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), { parameters: Object.freeze(parameters) }),
    );
    assert.ok(decision.domainDecisions.some((row) => row.blockers.includes('CONVERSION_POLICY_NOT_PRODUCTION')));
    assert.equal(decision.productionActivated, false);
  });

  it('5. engineering Productive Value policy blocks production', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        moonreyValuePolicyClass: 'ENGINEERING_SIMULATION_PARAMETERS',
        moonreyV2EngineeringReady: true,
      }),
    );
    assert.equal(domainState(decision, 'MOONREY_COIN_ISSUANCE'), 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.ok(
      decision.requirements.some(
        (row) => row.requirementId === 'MOONREY.VALUE_POLICY' && row.blockerCode === 'VALUE_POLICY_NOT_PRODUCTION',
      ),
    );
  });

  it('6. sandbox oracle providers block', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        oracleEvidence: Object.freeze({
          ...candidateReadySnapshot().oracleEvidence,
          sandboxProvider: true,
          realProviderOnboarding: false,
        }),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY'));
    assert.equal(domainState(decision, 'PRODUCTIVE_ECONOMIC_DATA'), 'ECONOMIC_ACTIVATION_BLOCKED');
  });

  it('7. missing provider legal evidence blocks', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        oracleEvidence: Object.freeze({
          ...candidateReadySnapshot().oracleEvidence,
          dataLicense: false,
          usageRight: false,
        }),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'ORACLE_LICENSE_EVIDENCE_MISSING'));
  });

  it('8. HIN missing privacy review blocks', () => {
    const base = candidateReadySnapshot();
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(base, {
        hinGates: Object.freeze({ ...base.hinGates, privacyReview: false }),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'HIN_PRIVACY_REVIEW_MISSING'));
    assert.notEqual(domainState(decision, 'HUMAN_INFORMATION_MARKET'), 'PRODUCTION_CANDIDATE_READY');
    assert.ok(
      ['ECONOMIC_ACTIVATION_BLOCKED', 'AWAITING_EXTERNAL_EVIDENCE'].includes(
        domainState(decision, 'HUMAN_INFORMATION_MARKET'),
      ),
    );
  });

  it('9. HIN missing legal review blocks', () => {
    const base = candidateReadySnapshot();
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(base, {
        hinGates: Object.freeze({ ...base.hinGates, legalAnalysis: false }),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'HIN_LEGAL_REVIEW_MISSING'));
  });

  it('10. missing human authorization blocks', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), { humanAuthorizations: Object.freeze([]) }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'HUMAN_AUTHORIZATION_MISSING'));
  });

  it('11. fixture human signature does not satisfy human role', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        humanAuthorizations: Object.freeze([
          Object.freeze({
            role: 'PROTOCOL_AUTHORITY',
            actorKind: 'HUMAN',
            actorId: 'fixture-signer',
            accepted: true,
            fixtureSignature: true,
          }),
        ]),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'FIXTURE_EVIDENCE_NOT_PRODUCTION_AUTHORITY'));
  });

  it('12. AI cannot satisfy human role', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        humanAuthorizations: Object.freeze([
          humanSlot('PROTOCOL_AUTHORITY', 'AI'),
          humanSlot('SECURITY_AUTHORITY', 'AI'),
          humanSlot('RELEASE_AUTHORITY', 'AI'),
          humanSlot('LEGAL_AUTHORITY', 'AI'),
        ]),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'AI_CANNOT_AUTHORIZE_PRODUCTION'));
  });

  it('13. S3M cannot authorize', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        humanAuthorizations: Object.freeze([humanSlot('PROTOCOL_AUTHORITY', 'S3M')]),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'AI_CANNOT_AUTHORIZE_PRODUCTION'));
  });

  it('14. Grok cannot authorize', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        humanAuthorizations: Object.freeze([humanSlot('RELEASE_AUTHORITY', 'GROK')]),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'AI_CANNOT_AUTHORIZE_PRODUCTION'));
  });

  it('15. supply mismatch blocks', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        supply: Object.freeze({
          ...candidateReadySnapshot().supply,
          sunreyReconciles: false,
        }),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'SUPPLY_RECONCILIATION_FAILED'));
  });

  it('16. policy-version mismatch blocks', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        policyBindings: Object.freeze([
          {
            leftKey: 'moonreyProductiveValuePolicy',
            leftVersionId: 'moonrey.productive-value-function.v2',
            rightKey: 'moonreyGpuvConversionPolicy',
            rightVersionId: 'moonrey.productive-settlement.conversion.v1',
            compatible: false,
          },
        ]),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'POLICY_BINDING_MISMATCH'));
  });

  it('17. economic data coverage gap blocks relevant domain', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        intendedProductionCategories: Object.freeze(['WATER', 'GOODS']),
        coverageGaps: Object.freeze({
          unitExtensionRequired: Object.freeze([]),
          semanticReviewRequired: Object.freeze(['WATER']),
          missingProviderCoverage: Object.freeze(['GOODS']),
        }),
      }),
    );
    assert.equal(domainState(decision, 'PRODUCTIVE_ECONOMIC_DATA'), 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'ECONOMIC_DATA_COVERAGE_GAP'));
    assert.equal(
      decision.domainDecisions.find((row) => row.domain === 'SUNREY_COIN_ISSUANCE')!.blockers.includes('ECONOMIC_DATA_COVERAGE_GAP'),
      false,
    );
  });

  it('18. SunRey and MoonRey evaluated separately', () => {
    const sunreyBlocked = evaluateProductionEconomicActivation(withUnconfigured('SUNREY_MAXIMUM_SUPPLY'));
    const moonreyOnly = evaluateProductionEconomicActivation(withUnconfigured('MOONREY_MAXIMUM_SUPPLY'));
    const sunreyCodes = sunreyBlocked.domainDecisions.find((row) => row.domain === 'SUNREY_COIN_ISSUANCE')!.blockers;
    const moonreyCodes = moonreyOnly.domainDecisions.find((row) => row.domain === 'MOONREY_COIN_ISSUANCE')!.blockers;
    assert.ok(sunreyCodes.includes('MAXIMUM_SUPPLY_UNCONFIGURED'));
    assert.ok(moonreyCodes.includes('MAXIMUM_SUPPLY_UNCONFIGURED'));
    assert.notEqual(sunreyBlocked.decisionId, moonreyOnly.decisionId);
    assert.equal(sunreyBlocked.productionActivated, false);
    assert.equal(moonreyOnly.productionActivated, false);
  });

  it('19. HIN chain anchoring engineering-ready does not satisfy legal review', () => {
    const base = candidateReadySnapshot();
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(base, {
        hinGates: Object.freeze({ ...base.hinGates, legalAnalysis: false }),
      }),
    );
    assert.equal(
      decision.requirements.find((row) => row.requirementId === 'HIN.CHAIN_ANCHOR')?.satisfied,
      true,
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'HIN_LEGAL_REVIEW_MISSING'));
  });

  it('20. valid engineering evidence cannot satisfy external requirement', () => {
    const base = candidateReadySnapshot();
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(base, {
        evidence: Object.freeze(
          base.evidence.map((row) =>
            row.requirementId === 'SHARED.LEGAL_EVIDENCE' ? { ...row, evidenceClass: 'ENGINEERING' } : row,
          ),
        ),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.requirementId === 'SHARED.LEGAL_EVIDENCE' && !row.satisfied));
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'LEGAL_EVIDENCE_MISSING'));
  });

  it('21. valid external evidence cannot satisfy human authorization', () => {
    const base = candidateReadySnapshot();
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(base, {
        humanAuthorizations: Object.freeze([]),
        evidence: Object.freeze([
          ...base.evidence,
          {
            evidenceId: 'ev.human.external',
            requirementId: 'SHARED.HUMAN_AUTHORIZATION',
            evidenceClass: 'EXTERNAL',
            description: 'external attestation of authorization',
            fixture: false,
            fixtureKind: null,
            actorKind: null,
            actorId: null,
            reference: 'external-letter',
            contentHash: 'abc',
          },
        ]),
      }),
    );
    assert.ok(decision.requirements.some((row) => row.blockerCode === 'HUMAN_AUTHORIZATION_MISSING'));
  });

  it('22. manifest hash deterministic', () => {
    const first = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    const second = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    assert.equal(first.manifestHash, second.manifestHash);
    assert.equal(first.parameterManifestHash, second.parameterManifestHash);
    assert.equal(first.decisionId, second.decisionId);
  });

  it('23. parameter change changes hash', () => {
    const base = parameterManifestHash(allConfiguredParameters());
    const changed = parameterManifestHash(
      allConfiguredParameters({ SUNREY_MAXIMUM_SUPPLY: 'different-explicit-value' }),
    );
    assert.notEqual(base, changed);
  });

  it('24. legacy V1 MoonRey alone cannot qualify production', () => {
    const decision = evaluateProductionEconomicActivation(
      withSnapshot(candidateReadySnapshot(), {
        moonreyLegacyV1Only: true,
        moonreyV2EngineeringReady: false,
      }),
    );
    assert.equal(domainState(decision, 'MOONREY_COIN_ISSUANCE'), 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.ok(
      decision.requirements.some(
        (row) => row.requirementId === 'MOONREY.VALUE_POLICY' && row.blockerCode === 'VALUE_POLICY_NOT_PRODUCTION',
      ),
    );
  });

  it('25. Chunk 71 remains sole monetary authority', () => {
    const constitution = nativeAssetConstitution();
    assert.equal(constitution.constitutionId, 'sunrey.native-asset-constitution.v1');
    assert.equal(constitution.productionEconomicActivationUnavailable, true);
    const decision = ProductionEconomicActivationFirewall.evaluate(currentRepositorySnapshot());
    assert.equal(decision.monetaryAuthorityInvoked, false);
    const book = emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
    assert.equal(supplyReconciles(book), true);
  });

  it('26. no production activation function exists', () => {
    const source = [
      'firewall.ts',
      'types.ts',
      'invariants.ts',
      'index.ts',
      'parameters.ts',
      'bindings.ts',
      'report.ts',
    ]
      .map((name) => readFileSync(new URL(`./production-activation/${name}`, import.meta.url), 'utf8'))
      .join('\n');
    assert.equal(/function\s+activateProduction\s*\(/.test(source), false);
    assert.equal(/function\s+enableMainnetMoney\s*\(/.test(source), false);
    assert.equal(/function\s+turnOnMoonRey\s*\(/.test(source), false);
    assert.equal(/function\s+turnOnSunRey\s*\(/.test(source), false);
    assert.equal(/productionActivated\s*[:=]\s*true/.test(source), false);
  });

  it('27. all LIVE_* flags remain false', () => {
    const flags = currentLiveFlags();
    assert.equal(flags.LIVE_MONEY_ENABLED, false);
    assert.equal(flags.LIVE_PAYMENTS_ENABLED, false);
    assert.equal(flags.LIVE_BANKING_RAILS, false);
    assert.equal(flags.LIVE_EXTERNAL_KYC, false);
    assert.equal(flags.LIVE_EXTERNAL_BANK_CONNECTION, false);
    assert.equal(flags.REAL_MONEY_ENABLED, false);
    assert.equal(flags.LIVE_TRADING_ENABLED, false);
    assert.equal(flags.LIVE_CRYPTO_ENABLED, false);
    assert.equal(flags.LIVE_EXCHANGE_ENABLED, false);
    assert.equal(flags.LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(flags.LIVE_INVESTMENT_EXECUTION, false);
    const decision = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    assert.equal(decision.liveFlagsChanged, false);
  });

  it('28. ENVIRONMENT remains simulation', () => {
    assert.equal(currentLiveFlags().ENVIRONMENT, 'simulation');
  });

  it('29. productionActivated remains false', () => {
    const current = evaluateProductionEconomicActivation(currentRepositorySnapshot());
    const candidate = evaluateProductionEconomicActivation(candidateReadySnapshot());
    assert.equal(current.productionActivated, false);
    assert.equal(candidate.productionActivated, false);
    assert.equal(candidate.liveFlagsChanged, false);
    for (const row of candidate.domainDecisions) {
      assert.equal(row.runtimeEnabled, false);
    }
  });

  it('does not collapse domains into one boolean and never invents production parameters on main', () => {
    const current = currentRepositorySnapshot();
    assert.ok(current.parameters.every((row) => row.status === 'UNCONFIGURED'));
    const decision = evaluateProductionEconomicActivation(current);
    assert.equal(decision.domainDecisions.length, 5);
    const ids: ProductionParameterId[] = ['SUNREY_MAXIMUM_SUPPLY', 'MOONREY_MAXIMUM_SUPPLY'];
    for (const id of ids) {
      assert.equal(configuredParameter(id, '1').id, id);
    }
  });
});
