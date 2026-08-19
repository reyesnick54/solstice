import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { createHumanContributionEconomicAssetAdapter } from './economic-asset-adapter.ts';
import { fixtureContribution, FIXTURE_NOW } from './fixtures.ts';
import { DEFAULT_VERIFICATION_POLICY_VERSION } from './fingerprint.ts';
import { HumanContributionRegistry } from './registry.ts';
import { evidenceBundleFromRecord } from './verification/evidence.ts';

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

describe('human contribution economic asset adapter', () => {
  it('projects a verified contribution without copying valuation amounts', () => {
    const contributionRegistry = new HumanContributionRegistry();
    const submitted = unwrap(contributionRegistry.submit(fixtureContribution('RESEARCH_PARTICIPATION', 'adapter-hec')));
    const verified = unwrap(
      contributionRegistry.verify({
        contributionId: submitted.contributionId,
        verificationTimestamp: FIXTURE_NOW,
        verificationPolicyVersion: DEFAULT_VERIFICATION_POLICY_VERSION,
      }),
    );
    const adapter = createHumanContributionEconomicAssetAdapter(new EconomicAssetRegistry());
    const evidence = unwrap(adapter.projectEvidence(evidenceBundleFromRecord(verified), FIXTURE_NOW));
    const record = unwrap(adapter.projectRecord(verified, FIXTURE_NOW, evidence.assetId));
    assert.equal(evidence.assetClass, 'HUMAN_CONTRIBUTION_EVIDENCE');
    assert.equal(record.assetClass, 'HUMAN_CONTRIBUTION_RECORD');
    assert.equal(record.automaticValue, null);
    assert.equal(record.issuanceEligible, false);
  });
});
