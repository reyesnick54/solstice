import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FIRST_ECONOMIC_RC_ID } from '../packages/sunrey-chain/src/release-candidate/economic/types.ts';
import { createEconomicReleaseCandidate } from '../packages/sunrey-chain/src/release-candidate/economic/index.ts';
import { bindCanonicalEconomicReleaseCandidate } from '../packages/sunrey-chain/src/governance-ops/index.ts';
import { FIRST_RC_ID } from '../packages/sunrey-chain/src/release-candidate/types.ts';
import { runEconomicRehearsal } from '../packages/sunrey-chain/src/economic-rehearsal/engine.ts';
import { createProductionNetworkCandidateV2 } from '../packages/sunrey-chain/src/mainnet/candidate-v2/assemble.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunks 76–80 reconciliation', () => {
  it('qualifies the economic RC from canonical treasury and stress implementations', () => {
    const created = createEconomicReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_ECONOMIC_RC_ID,
    });
    const treasury = created.bundle.qualification.cells.find((row) => row.category === 'PROTOCOL_TREASURY');
    const stress = created.bundle.qualification.cells.find((row) => row.category === 'ADVERSARIAL_STRESS');
    assert.ok(treasury);
    assert.ok(stress);
    assert.match(treasury.detail, /Chunk 77/);
    assert.notEqual(treasury.state, 'FAIL');
    assert.equal(created.evidence.stress.hiddenFailures, false);
    assert.match(created.bundle.manifest.stress_report_hash, /^[0-9a-f]{64}$/);
    assert.match(created.bundle.manifest.treasury_policy_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(created.bundle.manifest.economic_rc_id, FIRST_RC_ID);
  });

  it('binds governance operations to the Chunk 78 economic RC rather than Chunk 63', () => {
    const created = createEconomicReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_ECONOMIC_RC_ID,
    });
    const binding = bindCanonicalEconomicReleaseCandidate({
      economicRcId: created.bundle.manifest.economic_rc_id,
      sourceCommit: created.bundle.manifest.source_commit,
      releaseArtifactHash: created.bundle.manifest.release_provenance_digest,
      formalReportHash: created.bundle.manifest.formal_report_hash,
      economicStressReportHash: created.bundle.manifest.stress_report_hash,
      qualificationReportHash: created.bundle.qualification.combinedDigest,
      simulationEvidenceHash: created.bundle.manifest.simulation_report_hash,
      supplyInvariantHash: created.bundle.manifest.sbom_digest,
      schemaHash: created.bundle.schemaFreeze.combinedHash,
    });
    assert.equal(created.bundle.manifest.economic_rc_id, FIRST_ECONOMIC_RC_ID);
    assert.match(binding.economicReleaseCandidateHash, /^[0-9a-f]{64}$/);
    assert.notEqual(binding.economicReleaseCandidateHash, FIRST_RC_ID);
  });

  it('re-runs economic rehearsal against merged 76–79 and binds those hashes on candidate v2', () => {
    const rehearsal = runEconomicRehearsal(ROOT);
    const integrated = rehearsal.report.integratedEvidenceHashes;
    assert.ok(integrated);
    assert.match(integrated.chunk76StressReportHash, /^[0-9a-f]{64}$/);
    assert.match(integrated.chunk77TreasuryPolicyHash, /^[0-9a-f]{64}$/);
    assert.match(integrated.chunk77TreasuryFormalHash, /^[0-9a-f]{64}$/);
    assert.match(integrated.chunk77TreasuryStressHash, /^[0-9a-f]{64}$/);
    assert.match(integrated.chunk78EconomicRcHash, /^[0-9a-f]{64}$/);
    assert.match(integrated.chunk79GovernancePackageHash, /^[0-9a-f]{64}$/);
    assert.equal(rehearsal.report.economicRc.canonicalEconomicRcId, FIRST_ECONOMIC_RC_ID);
    assert.ok(rehearsal.report.stress.chunk76CampaignId);
    assert.equal(rehearsal.report.productionAuthorized, false);

    const candidate = createProductionNetworkCandidateV2(ROOT);
    assert.equal(candidate.evidence.chunk76StressReportHash, integrated.chunk76StressReportHash);
    assert.equal(candidate.evidence.chunk77TreasuryPolicyHash, integrated.chunk77TreasuryPolicyHash);
    assert.equal(candidate.evidence.chunk77TreasuryFormalHash, integrated.chunk77TreasuryFormalHash);
    assert.equal(candidate.evidence.chunk77TreasuryStressHash, integrated.chunk77TreasuryStressHash);
    assert.equal(candidate.evidence.chunk78EconomicRcHash, integrated.chunk78EconomicRcHash);
    assert.equal(candidate.evidence.chunk79GovernancePackageHash, integrated.chunk79GovernancePackageHash);
    assert.match(candidate.evidence.chunk80RehearsalEvidenceHash, /^[0-9a-f]{64}$/);
    assert.equal(candidate.productionAuthorized, false);
  });
});
