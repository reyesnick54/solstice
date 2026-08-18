import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { FIRST_ECONOMIC_RC_ID } from './release-candidate/economic/types.ts';
import { bindCanonicalEconomicReleaseCandidate } from './governance-ops/index.ts';
import { FIXTURE_KEY_MARKER } from './testnet/security.ts';
import {
  CANDIDATE_V2_CHAIN_ID,
  CANDIDATE_V2_ID,
  CANDIDATE_V2_NETWORK_ID,
  compareProductionCandidates,
  createProductionNetworkCandidateV2,
  resetProductionNetworkCandidateV2Cache,
  detectConfigurationDrift,
  rejectAiProductionAuthorization,
  rejectFixtureValidatorKey,
  rejectFloatingContainer,
  rejectInventedTicker,
  rejectRehearsalGenesis,
  rejectTamperedGovernancePackage,
  rejectTamperedStressReport,
  rejectTestnetNetworkId,
  rejectUnapprovedAllocationQuantity,
  rejectUnverifiedHsm,
  rejectWrongChainId,
  rejectWrongEconomicRc,
  runCandidateV2Command,
  runMainnetCommand,
  verifyProductionNetworkCandidateV2,
} from './mainnet/index.ts';
import { consumeExternalSecurityReview } from './mainnet/consumers.ts';
import { ECONOMIC_REHEARSAL_CHAIN_ID, ECONOMIC_REHEARSAL_NETWORK_ID } from './economic-rehearsal/identity.ts';

const ROOT = join(import.meta.dirname, '../../..');

let cached: ReturnType<typeof createProductionNetworkCandidateV2> | undefined;
function candidate() {
  cached ??= createProductionNetworkCandidateV2(ROOT);
  return cached;
}

describe('Chunk 81 production network candidate v2', () => {
  it('creates a deterministic CANDIDATE with mainnetEnabled=false', () => {
    const first = candidate();
    const second = createProductionNetworkCandidateV2(ROOT);
    assert.equal(first.candidateId, CANDIDATE_V2_ID);
    assert.equal(first.configuration.networkId, CANDIDATE_V2_NETWORK_ID);
    assert.equal(first.configuration.chainId, CANDIDATE_V2_CHAIN_ID);
    assert.equal(first.configuration.productionAddressHrp, 'srprd');
    assert.equal(first.status, 'CANDIDATE');
    assert.equal(first.mainnetEnabled, false);
    assert.equal(first.productionAuthorized, false);
    assert.equal(first.environment, 'simulation');
    assert.equal(first.configurationDigest, second.configurationDigest);
    assert.equal(first.networkManifestDigest, second.networkManifestDigest);
    assert.equal(first.protocolBundleDigest, second.protocolBundleDigest);
    assert.equal(first.economicBundleDigest, second.economicBundleDigest);
    assert.equal(first.candidateRootHash, second.candidateRootHash);
    resetProductionNetworkCandidateV2Cache();
    const recomputed = createProductionNetworkCandidateV2(ROOT);
    assert.equal(first.candidateRootHash, recomputed.candidateRootHash);
    cached = recomputed;
    assert.match(first.candidateRootHash, /^[0-9a-f]{64}$/);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
  });

  it('binds canonical 76-80 evidence and keeps capability independence', () => {
    const created = candidate();
    assert.equal(created.economic.economicRcId, FIRST_ECONOMIC_RC_ID);
    assert.match(created.evidence.chunk76StressReportHash, /^[0-9a-f]{64}$/);
    assert.match(created.evidence.chunk77TreasuryPolicyHash, /^[0-9a-f]{64}$/);
    assert.match(created.evidence.chunk77TreasuryFormalHash, /^[0-9a-f]{64}$/);
    assert.match(created.evidence.chunk77TreasuryStressHash, /^[0-9a-f]{64}$/);
    assert.match(created.evidence.chunk78EconomicRcHash, /^[0-9a-f]{64}$/);
    assert.match(created.evidence.chunk79GovernancePackageHash, /^[0-9a-f]{64}$/);
    assert.match(created.evidence.chunk80RehearsalEvidenceHash, /^[0-9a-f]{64}$/);
    assert.equal(created.capabilityInheritance, false);
    assert.equal(created.capabilities.every((row) => row.genesis_enabled === false && row.runtime_enabled === false), true);
    assert.equal(created.economic.tickerStatus, 'NOT_ASSIGNED');
    assert.equal(created.genesisInput.sunreyGenesisSupply, '0');
    assert.equal(created.genesisInput.finalized, false);
    assert.equal(created.concentration.organizationalIndependenceClaimed, false);
    assert.equal(created.validators.every((row) => row.productionEligible === false && row.fixtureKey === true), true);
    assert.equal(created.security.independentAuditCompleted, false);
    const binding = bindCanonicalEconomicReleaseCandidate({
      economicRcId: created.economic.economicRcId,
      sourceCommit: created.manifest.sourceCommit,
      releaseArtifactHash: created.manifest.releaseArtifactHash,
      formalReportHash: created.evidence.formalEvidenceHash,
      economicStressReportHash: created.evidence.chunk76StressReportHash,
      qualificationReportHash: created.evidence.chunk78EconomicRcHash,
      simulationEvidenceHash: created.evidence.chunk80RehearsalEvidenceHash,
      supplyInvariantHash: created.genesisInput.inputHash,
      schemaHash: created.protocol.stateSchemaHash,
    });
    assert.match(binding.economicReleaseCandidateHash, /^[0-9a-f]{64}$/);
  });

  it('rejects the mandatory negative production gates', () => {
    assert.throws(() => rejectFixtureValidatorKey(`SUNREY_${FIXTURE_KEY_MARKER}_KEY`), /fixture validator key rejected/);
    assert.throws(() => rejectRehearsalGenesis(ECONOMIC_REHEARSAL_NETWORK_ID, ECONOMIC_REHEARSAL_CHAIN_ID), /rehearsal genesis rejected/);
    assert.throws(() => rejectTestnetNetworkId('net_sunrey_testnet_1'), /testnet network ID rejected/);
    assert.throws(() => rejectWrongChainId('chn_sunrey_testnet_1'), /wrong chain ID rejected/);
    assert.throws(() => rejectFloatingContainer('sunrey/validator', 'latest'), /floating container rejected/);
    assert.throws(() => rejectUnverifiedHsm('SIMULATION_HSM'), /unverified HSM cannot satisfy production/);
    assert.throws(() => rejectInventedTicker('SUN'), /invented ticker rejected/);
    assert.throws(() => rejectUnapprovedAllocationQuantity(1n), /unapproved token allocation rejected/);
    assert.throws(() => rejectWrongEconomicRc('SUNREY_TESTNET_RC_1'), /wrong economic RC rejected/);
    assert.throws(() => rejectTamperedStressReport('aa', 'bb'), /tampered stress report rejected/);
    assert.throws(() => rejectTamperedGovernancePackage('aa', 'bb'), /tampered governance package rejected/);
    assert.throws(() => rejectAiProductionAuthorization(), /AI/);
    assert.equal(consumeExternalSecurityReview().status, 'NOT_PROVIDED');
  });

  it('detects tamper and unauthorized drift', () => {
    const created = candidate();
    const tampered = {
      ...created,
      candidateRootHash: 'ff'.repeat(32),
      economic: { ...created.economic, economicRcHash: 'ee'.repeat(32) },
    };
    assert.notEqual(created.candidateRootHash, tampered.candidateRootHash);
    assert.equal(
      detectConfigurationDrift(created, {
        networkId: created.configuration.networkId,
        chainId: created.configuration.chainId,
        releaseArtifactHash: created.manifest.releaseArtifactHash,
        economicRcHash: created.economic.economicRcHash,
      }),
      'MATCH',
    );
    assert.equal(
      detectConfigurationDrift(created, { networkId: 'net_sunrey_testnet_1' }),
      'UNAUTHORIZED_DRIFT',
    );
    assert.equal(detectConfigurationDrift(created, {}), 'EVIDENCE_UNAVAILABLE');
    assert.equal(
      detectConfigurationDrift(created, {
        networkId: created.configuration.networkId,
        chainId: created.configuration.chainId,
        releaseArtifactHash: created.manifest.releaseArtifactHash,
        economicRcHash: created.economic.economicRcHash,
        hsmState: 'SIMULATION_HSM',
      }),
      'AUTHORIZED_VARIANCE',
    );
    const report = verifyProductionNetworkCandidateV2(created, ROOT);
    assert.equal(report.ok, true, JSON.stringify(report.checks.filter((row) => !row.ok)));
    assert.equal(report.productionAuthorized, false);
    const compared = compareProductionCandidates(created, ROOT);
    assert.equal(compared.rightId, CANDIDATE_V2_ID);
    assert.ok(compared.economicAdditions.some((row) => row.includes('Chunk 78')));
    assert.ok(compared.remainingExternalGaps.includes('external audit'));
  });

  it('exposes candidate-v2 CLI commands', () => {
    for (const command of ['create', 'show', 'verify', 'compare', 'topology', 'services', 'evidence']) {
      const result = runMainnetCommand(['candidate-v2', command]);
      assert.equal(result.ok, true, command);
    }
    const help = runCandidateV2Command(['help'], ROOT);
    assert.equal(help.ok, true);
  });
});
