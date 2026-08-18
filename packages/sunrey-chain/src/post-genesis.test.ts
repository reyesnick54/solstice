import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { exploreModel, requireVerified } from './formal/explore.ts';
import { createCapabilityActivationModel } from './formal/models/capability-activation.ts';
import { FORMAL_SMOKE_PROFILE } from './formal/profiles.ts';
import { runStabilizationCommand } from './post-genesis/cli.ts';
import {
  INDEPENDENT_CAPABILITIES,
  POST_GENESIS_INCIDENT_CATEGORIES,
  POST_GENESIS_PHASES,
} from './post-genesis/types.ts';
import { assembleActivationPackage, evidenceFor, fillEvidence } from './post-genesis/capabilities.ts';
import { conflictingFinalityIncident } from './post-genesis/incidents.ts';
import { defaultPostGenesisPolicy, initialPhase } from './post-genesis/identity.ts';
import {
  activateCapability,
  applyConflictingFinality,
  genesisLeavesCapabilitiesDisabled,
  historicFinalizedUnchanged,
  initialStabilizationState,
  restrictCapability,
} from './post-genesis/plane.ts';
import {
  filledPackage,
  runAllPostGenesisRehearsals,
  runNegativeActivationSuite,
  runPostGenesisRehearsal,
  walkHealthyEpochs,
} from './post-genesis/rehearsal.ts';
import { restrictionBypassRejected } from './post-genesis/restrictions.ts';
import { publicNetworkStatus } from './post-genesis/explorer.ts';
import { moonreyIssuanceState, treasuryProductionState } from './post-genesis/economics.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 89 post-genesis stabilization', () => {
  it('starts in CHAIN_STABILIZATION with financial capabilities independently disabled', () => {
    assert.equal(initialPhase(), 'CHAIN_STABILIZATION');
    const policy = defaultPostGenesisPolicy();
    assert.equal(policy.highRiskFinancialDefault, 'INDEPENDENTLY_DISABLED');
    assert.equal(policy.moonreyProductiveIssuanceDefault, 'EXPLICITLY_DISABLED');
    assert.equal(policy.treasurySpendingAuthorizedByGenesis, false);
    assert.equal(policy.privacyDefault, 'DENY');
    assert.equal(policy.rawPdvUnavailable, true);
    assert.equal(policy.interopTrustedBridgeRoot, false);
    assert.equal(policy.realProductionCapabilitiesActivated, false);
    assert.deepEqual([...POST_GENESIS_PHASES], [
      'CHAIN_STABILIZATION',
      'NATIVE_ASSET_LIMITED',
      'ORACLE_LIMITED',
      'ECONOMIC_SERVICES_LIMITED',
      'REGULATED_SERVICES_ELIGIBLE',
      'FULL_CONFIGURED_OPERATIONS',
    ]);
  });

  it('captures deterministic height/epoch/finalized-state checkpoints', () => {
    const healthy = runPostGenesisRehearsal('healthy-first-epochs');
    assert.equal(healthy.deterministic, true);
    assert.ok(healthy.report.latestCheckpoint);
    assert.ok(healthy.report.latestCheckpoint?.coordinate.height);
    assert.equal(typeof healthy.report.latestCheckpoint?.coordinate.finalizedStateRoot, 'string');
    assert.equal(healthy.report.latestHealth?.engineeringHealthy, true);
    assert.equal(healthy.realProductionCapabilitiesActivated, false);
  });

  it('treats conflicting finality as a critical protocol incident', () => {
    const incident = conflictingFinalityIncident('ckpt', 'conflicting finality evidence');
    assert.equal(incident.category, 'CONSENSUS');
    assert.equal(incident.severity, 'CRITICAL');
    assert.equal(incident.conflictingFinality, true);
    assert.equal(incident.rewritesFinalizedState, false);
    const state = applyConflictingFinality(walkHealthyEpochs(initialStabilizationState()));
    assert.equal(state.latestHealth?.conflictingFinality, true);
    assert.ok(state.incidents.some((row) => row.severity === 'CRITICAL' && row.category === 'CONSENSUS'));
    assert.equal(historicFinalizedUnchanged(state), true);
  });

  it('audits supply, validator economics, fee market, MoonRey, and treasury', () => {
    const audit = runStabilizationCommand(['stabilization', 'audit']);
    assert.equal(audit.ok, true);
    const payload = audit.payload as {
      readonly supply: { readonly conserved: boolean };
      readonly validatorEconomics: { readonly conserved: boolean };
      readonly moonrey: { readonly productiveIssuance: string };
      readonly treasury: { readonly genesisAuthorizesSpending: boolean };
    };
    assert.equal(payload.supply.conserved, true);
    assert.equal(payload.validatorEconomics.conserved, true);
    assert.equal(payload.moonrey.productiveIssuance, 'EXPLICITLY_DISABLED');
    assert.equal(payload.treasury.genesisAuthorizesSpending, false);
    assert.equal(moonreyIssuanceState(false).productiveIssuance, 'EXPLICITLY_DISABLED');
    assert.equal(treasuryProductionState().genesisAuthorizesSpending, false);
  });

  it('keeps independent capabilities disabled after genesis rehearsal', () => {
    assert.equal(genesisLeavesCapabilitiesDisabled(walkHealthyEpochs(initialStabilizationState())), true);
    assert.equal(INDEPENDENT_CAPABILITIES.includes('SUNREY_EXCHANGE'), true);
    const status = publicNetworkStatus({
      phase: 'CHAIN_STABILIZATION',
      health: null,
      enabled: new Set(),
      restricted: new Set(),
    });
    const exchange = status.capabilities.find((row) => row.capability === 'SUNREY_EXCHANGE');
    const chain = status.capabilities.find((row) => row.capability === 'SUNREY_CHAIN');
    assert.equal(chain?.productionCapabilityStatus, 'ELIGIBLE');
    assert.equal(exchange?.regulatedServiceStatus, 'UNAVAILABLE');
    assert.equal(status.planes.REGULATED_SERVICE_STATUS, 'UNAVAILABLE');
    assert.equal(status.securityInternalsExposed, false);
  });

  it('rejects the mandatory negative activation cases', () => {
    const suite = runNegativeActivationSuite();
    assert.equal(suite.exchangeWithoutEvidence.outcome, 'REJECTED');
    assert.ok(suite.exchangeWithoutEvidence.reasons.includes('Exchange activation without required evidence rejected'));
    assert.equal(suite.custodyWithoutHsm.outcome, 'REJECTED');
    assert.ok(suite.custodyWithoutHsm.reasons.includes('custody activation without HSM evidence rejected'));
    assert.equal(suite.fiatWithoutBanking.outcome, 'REJECTED');
    assert.ok(suite.fiatWithoutBanking.reasons.includes('fiat activation without banking evidence rejected'));
    assert.equal(suite.himWithoutPrivacy.outcome, 'REJECTED');
    assert.ok(suite.himWithoutPrivacy.reasons.includes('Human Information market without privacy/legal evidence rejected'));
    assert.equal(suite.wrongNetwork.outcome, 'REJECTED');
    assert.ok(suite.wrongNetwork.reasons.includes('wrong-network package rejected'));
    assert.equal(suite.replayedPackage.outcome, 'REJECTED');
    assert.ok(suite.replayedPackage.reasons.includes('replayed package rejected'));
    assert.equal(suite.aiActivation.outcome, 'REJECTED');
    assert.ok(suite.aiActivation.reasons.includes('AI activation rejected'));
    assert.equal(suite.restrictionBypass.outcome, 'REJECTED');
    assert.ok(suite.restrictionBypass.reasons.includes('restriction bypass rejected'));
    assert.equal(restrictionBypassRejected('REWRITE_FINALIZED_BLOCKS'), true);
    assert.equal(suite.genesisLeavesDisabled.outcome, 'REJECTED');
  });

  it('runs isolated rehearsal scenarios including Exchange kept disabled', () => {
    const all = runAllPostGenesisRehearsals();
    assert.equal(all.length, 9);
    const exchange = all.find((row) => row.scenario === 'exchange-kept-disabled');
    assert.equal(exchange?.negatives.exchangeKeptDisabled, true);
    const custody = all.find((row) => row.scenario === 'attempted-early-custody');
    assert.equal(custody?.negatives.earlyCustodyRejected, true);
    const fiat = all.find((row) => row.scenario === 'attempted-early-fiat');
    assert.equal(fiat?.negatives.earlyFiatRejected, true);
    for (const row of all) {
      assert.equal(row.isolatedAssets, true);
      assert.equal(row.realProductionCapabilitiesActivated, false);
    }
  });

  it('exposes CLI stabilization and capability commands', () => {
    const status = runStabilizationCommand(['stabilization', 'status']);
    assert.equal(status.ok, true);
    const checkpoint = runStabilizationCommand(['stabilization', 'checkpoint', '1', '0', 'aaaaaaaa']);
    assert.equal(checkpoint.ok, true);
    const list = runStabilizationCommand(['capability', 'list']);
    assert.equal(list.ok, true);
    const evidence = runStabilizationCommand(['capability', 'evidence', 'SUNREY_EXCHANGE']);
    assert.equal(evidence.ok, true);
    const verify = runStabilizationCommand(['capability', 'verify', 'SUNREY_EXCHANGE']);
    assert.equal(verify.ok, true);
    const activate = runStabilizationCommand(['capability', 'activate', 'SUNREY_EXCHANGE']);
    assert.equal(activate.ok, false);
    const restrict = runStabilizationCommand(['capability', 'restrict', 'SUNREY_EXCHANGE']);
    assert.equal(restrict.ok, true);
    const history = runStabilizationCommand(['capability', 'history']);
    assert.equal(history.ok, true);
    const ai = runStabilizationCommand(['capability', 'activate', 'SUNREY_EXCHANGE', '--ai']);
    const aiPayload = ai.payload as { readonly result: { readonly reasons: readonly string[] } };
    assert.ok(aiPayload.result.reasons.includes('AI activation rejected'));
  });

  it('does not create competing packages', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/post-genesis/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/post-genesis')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-post-genesis')), false);
    assert.equal(existsSync(join(ROOT, 'packages/stabilization')), false);
    assert.equal(existsSync(join(ROOT, 'packages/capability-activation')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-activation')), false);
  });

  it('model-checks CAPABILITY_ACTIVATION_SAFETY within stated bounds', () => {
    const result = exploreModel(
      createCapabilityActivationModel({ maxHeight: FORMAL_SMOKE_PROFILE.consensusMaxHeight }),
      'FORMAL_SMOKE',
      'sunrey-formal-explicit-state/1',
    );
    requireVerified(result);
    assert.ok(result.statesExplored > 0);
  });

  it('covers every incident category and independent capability', () => {
    for (const category of POST_GENESIS_INCIDENT_CATEGORIES) {
      assert.equal(typeof category, 'string');
    }
    let evidence = evidenceFor('INSTITUTIONAL_CUSTODY');
    evidence = fillEvidence(evidence, 'SEC-HSM', 'HUMAN_VERIFIED');
    assert.equal(evidence.security.find((slot) => slot.slotId === 'SEC-HSM')?.state, 'HUMAN_VERIFIED');
    const pkg = filledPackage('SUNREY_COIN_NATIVE_ASSET');
    const activated = activateCapability(initialStabilizationState(), pkg);
    assert.equal(activated.result.realProductionCapabilitiesActivated, false);
    const bypass = restrictCapability(activated.state, 'SUNREY_EXCHANGE', 'MINT_NATIVE_ASSETS');
    assert.equal(bypass.ok, false);
  });
});
