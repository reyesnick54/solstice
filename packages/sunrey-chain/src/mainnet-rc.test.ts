import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../../config/src/flags.ts';
import { runSunreyRelease } from './supply-chain/cli.ts';
import {
  FIRST_MAINNET_RC_ID,
  MAINNET_QUALIFICATION_CATEGORIES,
  compareMainnetReleaseCandidates,
  consumeMainnetRc,
  createMainnetReleaseCandidate,
  freezeProductionNetworkCandidateV2,
  invalidateMainnetBundle,
  isMainnetReleaseCandidateId,
  loadMainnetKnownLimitations,
  mainnetLimitationsHidden,
  nextMainnetReleaseCandidateId,
  rejectAiReleaseAuthorization,
  rejectFakeAuditResult,
  rejectFixtureHsmAsExternal,
  rejectFloatingImage,
  snapshotAuditRemediation,
  snapshotProviderAcceptance,
  supersedeMainnetReleaseCandidate,
  verifyMainnetReleaseCandidate,
} from './release-candidate/index.ts';
import { reportHsmState } from './release-candidate/mainnet/providers.ts';

process.env.SUNREY_FIXTURE_ENV ??= 'local';

const ROOT = join(import.meta.dirname, '../../..');

describe('Chunk 84 SunRey Mainnet release candidate', () => {
  it('issues versioned Mainnet RC ids without activating the network', () => {
    assert.equal(isMainnetReleaseCandidateId(FIRST_MAINNET_RC_ID), true);
    assert.equal(nextMainnetReleaseCandidateId(null), FIRST_MAINNET_RC_ID);
    assert.equal(nextMainnetReleaseCandidateId(FIRST_MAINNET_RC_ID), 'SUNREY_MAINNET_RC_2');
    const candidate = freezeProductionNetworkCandidateV2();
    assert.equal(candidate.candidateId, 'SUNREY_PRODUCTION_NETWORK_CANDIDATE_V2');
    assert.equal(candidate.mainnetEnabled, false);
    assert.equal(candidate.rootHash.length, 64);
    assert.equal(ENVIRONMENT, 'simulation');
  });

  it('creates, qualifies, verifies, and signs SUNREY_MAINNET_RC_1', () => {
    const created = createMainnetReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_MAINNET_RC_ID,
    });
    const manifest = created.bundle.manifest;
    assert.equal(manifest.mainnet_rc_id, FIRST_MAINNET_RC_ID);
    assert.equal(manifest.environment, 'simulation');
    assert.equal(manifest.ticker_status, 'NOT_ASSIGNED');
    assert.equal(manifest.mainnet_enabled, false);
    assert.equal(manifest.mainnet_ready, false);
    assert.equal(manifest.signing_activates_network, false);
    assert.equal(manifest.engineering_qualified_is_not_authorized_candidate, true);
    assert.equal(created.bundle.qualification.cells.length, MAINNET_QUALIFICATION_CATEGORIES.length);
    assert.equal(created.bundle.qualification.notLaunchAuthorization, true);
    assert.equal(created.bundle.qualification.cells.every((row) => row.sourceCommit === manifest.source_commit), true);
    assert.equal(mainnetLimitationsHidden(created.bundle.limitations), false);
    assert.ok(created.bundle.limitations.some((row) => row.id === 'NOT_MAINNET_LAUNCH'));
    assert.ok(created.bundle.limitations.some((row) => row.id === 'LEGAL_REGULATORY_INCOMPLETE'));
    assert.equal(created.evidence.economicStress.hiddenFailures, false);
    assert.equal(created.evidence.extended.claimedDurationCompleted, false);
    assert.equal(created.evidence.performance.productionTpsGuarantee, false);
    assert.equal(created.evidence.regulated.liveFlowsActivated, false);
    assert.equal(created.bundle.hsm.simulationSatisfiesExternalHardware, false);
    assert.equal(created.bundle.audit.claimsExternalAuditPassed, false);
    assert.equal(created.bundle.providers.productionEligible.length, 0);
    const verified = verifyMainnetReleaseCandidate(created.bundle, manifest.source_commit, ROOT);
    assert.equal(verified.ok, true, JSON.stringify(verified.checks.filter((row) => !row.ok)));
    assert.ok([
      'DRAFT',
      'ENGINEERING_QUALIFICATION',
      'ENGINEERING_QUALIFIED',
      'AWAITING_EXTERNAL_EVIDENCE',
      'AWAITING_HUMAN_AUTHORIZATION',
    ].includes(manifest.qualification_result));
    assert.notEqual(manifest.qualification_result, 'AUTHORIZED_CANDIDATE');
    assert.equal(created.report.mainnetEnabled, false);
    assert.equal(created.report.authorizedCandidate, false);
  });

  it('rejects wrong commit, wrong Candidate V2, modified economic RC, and tamper', () => {
    const created = createMainnetReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_MAINNET_RC_ID,
      sourceCommit: 'commit-a',
    });
    const wrongCommit = verifyMainnetReleaseCandidate(created.bundle, 'commit-other', ROOT);
    assert.equal(wrongCommit.ok, false);
    assert.equal(wrongCommit.checks.some((row) => row.id === 'commit' && row.ok === false), true);

    assert.throws(
      () => freezeProductionNetworkCandidateV2('0'.repeat(64)),
      /wrong Candidate V2/,
    );
    assert.throws(
      () => createMainnetReleaseCandidate({
        root: ROOT,
        profile: 'smoke',
        expectedCandidateV2Hash: '0'.repeat(64),
      }),
      /wrong Candidate V2/,
    );

    const economicTamper = invalidateMainnetBundle(created.bundle, 'policy');
    assert.equal(verifyMainnetReleaseCandidate(economicTamper, 'commit-a', ROOT).ok, false);

    const sbomTamper = invalidateMainnetBundle(created.bundle, 'sbom');
    assert.equal(verifyMainnetReleaseCandidate(sbomTamper, 'commit-a', ROOT).ok, false);

    for (const field of ['binary', 'container', 'candidate', 'provider', 'security', 'qualification', 'provenance'] as const) {
      const tampered = invalidateMainnetBundle(created.bundle, field);
      const report = verifyMainnetReleaseCandidate(tampered, 'commit-a', ROOT);
      assert.equal(report.ok, false, `tamper ${field} should fail verify`);
    }
  });

  it('rejects floating images, fixture HSM-as-external, fake audits, and AI authorization', () => {
    assert.throws(() => rejectFloatingImage('nginx:latest'), /floating image/);
    const hsm = reportHsmState();
    assert.throws(() => rejectFixtureHsmAsExternal(hsm.state, true), /test fixture HSM/);
    const audit = snapshotAuditRemediation();
    assert.throws(() => rejectFakeAuditResult(audit, true), /fake audit/);
    assert.equal(audit.claimsExternalAuditPassed, false);
    assert.ok(audit.openFindings.includes('LIM-NO-EXTERNAL-AUDIT'));
    assert.throws(() => rejectAiReleaseAuthorization('AI'), /AI release authorization/);
    const legal = loadMainnetKnownLimitations(ROOT).find((row) => row.id === 'LEGAL_REGULATORY_INCOMPLETE');
    assert.ok(legal);
    assert.equal(legal?.hiddenFromReleaseNotes, false);
    const providers = snapshotProviderAcceptance();
    assert.ok(providers.unconfigured.length > 0);
    assert.ok(providers.engineeringTested.length > 0);
    assert.equal(providers.externallyEvidenced.length, 0);
    assert.equal(providers.humanAccepted.length, 0);
    assert.equal(providers.productionEligible.length, 0);
  });

  it('supersedes a prior Mainnet RC and keeps ENGINEERING_QUALIFIED off AUTHORIZED_CANDIDATE', () => {
    const first = createMainnetReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: FIRST_MAINNET_RC_ID,
      sourceCommit: 'commit-a',
    });
    const second = createMainnetReleaseCandidate({
      root: ROOT,
      profile: 'smoke',
      rcId: 'SUNREY_MAINNET_RC_2',
      sourceCommit: 'commit-b',
    });
    const compared = compareMainnetReleaseCandidates(first.bundle, second.bundle);
    assert.equal(compared.materialChange, true);
    const pair = supersedeMainnetReleaseCandidate(first.bundle, second.bundle);
    assert.equal(pair.previous.manifest.qualification_result, 'SUPERSEDED');
    assert.equal(pair.previous.supersededBy, 'SUNREY_MAINNET_RC_2');
    assert.equal(pair.next.manifest.mainnet_rc_id, 'SUNREY_MAINNET_RC_2');
    assert.equal(pair.next.manifest.mainnet_enabled, false);
    assert.notEqual(pair.next.manifest.qualification_result, 'AUTHORIZED_CANDIDATE');
    const readiness = consumeMainnetRc({
      rcId: pair.next.manifest.mainnet_rc_id,
      status: pair.next.manifest.qualification_result,
    });
    assert.equal(readiness.authorizedCandidate, false);
    assert.equal(readiness.mainnetAuthorized, false);
  });

  it('runs sunrey-release mainnet commands without synthesizing launch authorization', () => {
    const help = runSunreyRelease(ROOT, ['mainnet', 'help']);
    assert.equal(help.ok, true);
    const created = runSunreyRelease(ROOT, ['mainnet', 'create', '--profile', 'smoke', '--id', FIRST_MAINNET_RC_ID]);
    assert.equal(created.ok, true, JSON.stringify(created.payload));
    const status = runSunreyRelease(ROOT, ['mainnet', 'status']);
    assert.equal(status.ok, true);
    const payload = status.payload as { readonly banner: string; readonly mainnetEnabled: boolean; readonly authorizedCandidate: boolean };
    assert.equal(payload.banner, 'SUNREY MAINNET RC');
    assert.equal(payload.mainnetEnabled, false);
    assert.equal(payload.authorizedCandidate, false);
    const verified = runSunreyRelease(ROOT, ['mainnet', 'verify']);
    assert.equal(verified.ok, true, JSON.stringify(verified.payload));
    const limitations = runSunreyRelease(ROOT, ['mainnet', 'limitations']);
    assert.equal(limitations.ok, true);
    const evidence = runSunreyRelease(ROOT, ['mainnet', 'evidence']);
    assert.equal(evidence.ok, true);
    assert.equal(existsSync(join(ROOT, 'dist/mainnet-rc/mainnet-rc-manifest.json')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-mainnet-rc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-rc')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mainnet-qualification')), false);
  });
});
