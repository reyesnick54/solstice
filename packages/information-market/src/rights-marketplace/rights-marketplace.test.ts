import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { Money } from '../../../money/src/money.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { InformationRightsMarketplaceAgentSurface } from './agent.ts';
import { InformationRightsMarketplace, type ConsentPort, type NativeAssetTransferPort } from './service.ts';
import { MARKETPLACE_LEGAL_STATUS, PRODUCTION_ACTIVE } from './taxonomy.ts';
import { createSandboxRightsMarketplace } from './sandbox.ts';
import { simulationCompensationPolicyV1, simulationPricingPolicyV1 } from './policy.ts';

const NOW = asUtcInstant('2026-08-23T08:00:00.000Z');

function consentMap(active: Record<string, boolean> = { consent_ok: true }): ConsentPort {
  return {
    isActive(input) {
      return active[input.consentRef] === true;
    },
  };
}

function market(consent: ConsentPort = consentMap(), native?: NativeAssetTransferPort) {
  const clock = new FrozenClock(NOW);
  const instance = new InformationRightsMarketplace({
    clock,
    consent,
    evidence: new EvidenceVault(clock),
    events: new DomainEventLog(),
    fiat: {
      creditParticipant() {
        return { outcome: 'OK', intentId: 'intent_sim', journalId: 'jrnl_sim' };
      },
    },
    ...(native ? { nativeAsset: native } : {}),
  });
  instance.defaultSimulationPolicies();
  return instance;
}

function seedRight(instance: InformationRightsMarketplace, holder = 'subject_ada', extras: Partial<Parameters<InformationRightsMarketplace['registerRight']>[0]> = {}) {
  return unwrap(
    instance.registerRight({
      rightsHolder: holder,
      underlyingCategory: 'FINANCIAL_ACTIVITY_METADATA',
      scope: 'derived metadata',
      eligiblePurposes: ['RESEARCH', 'AGGREGATED_ANALYTICS'],
      prohibitedPurposes: ['MARKETING', 'CREDIT_DECISIONING'],
      jurisdiction: 'GB',
      privacyRequirements: ['NO_RAW_EXPORT'],
      consentDependency: 'canonical-consent',
      termsVersion: 'irm-terms-v1',
      ...extras,
    }),
  );
}

function seedProduct(instance: InformationRightsMarketplace, holder: string, rightId: string) {
  return unwrap(
    instance.createDataProduct(holder, {
      form: 'HIN_AGGREGATE',
      displayName: 'Research aggregate',
      rightIds: [rightId],
      classification: 'DERIVED_AGGREGATE',
      eligiblePurposes: ['RESEARCH'],
      purpose: 'RESEARCH',
      minimumAggregationThreshold: 10,
      jurisdiction: 'GB',
      retentionDays: 30,
      privacyPolicyVersion: 'irm-privacy-v1',
      consentRef: 'consent_ok',
      cohortSize: 20,
    }),
  );
}

function activateLicense(instance: InformationRightsMarketplace, productId: string, licenseeId = 'licensee_lab') {
  const request = unwrap(
    instance.requestLicense({
      licenseeId,
      productId,
      purpose: 'RESEARCH',
      scope: 'aggregate research',
      durationDays: 30,
      queryLimit: 3,
      downloadLimit: 0,
      jurisdiction: 'GB',
      consentRef: 'consent_ok',
    }),
  );
  const pricing = [...instance.store.pricing.values()][0]!;
  const policy = [...instance.store.policies.values()][0]!;
  return unwrap(
    instance.approveAndActivate({
      requestId: request.requestId,
      actorId: 'actor_lab',
      pricingPolicyId: pricing.policyId,
      compensationPolicyId: policy.policyId,
      termsVersion: 'irm-terms-v1',
      paid: true,
    }),
  );
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

describe('Information Rights Marketplace', () => {
  it('registers usage rights without transferring ownership', () => {
    const instance = market();
    const right = seedRight(instance);
    assert.equal(right.ownershipTransferred, false);
    assert.equal(right.usageRightOnly, true);
    assert.equal(right.rightsHolder, 'subject_ada');
    assert.equal(right.transferability, 'LICENSEABLE_ONLY');
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(MARKETPLACE_LEGAL_STATUS.unrestrictedPersonalDataSale, false);
  });

  it('refuses product creation without consent, rights, or aggregation', () => {
    const closed = market(consentMap({}));
    const right = seedRight(closed);
    const noConsent = closed.createDataProduct('subject_ada', {
      form: 'AGGREGATED_DATASET',
      displayName: 'Blocked',
      rightIds: [right.rightId],
      classification: 'DERIVED_AGGREGATE',
      eligiblePurposes: ['RESEARCH'],
      purpose: 'RESEARCH',
      minimumAggregationThreshold: 10,
      jurisdiction: 'GB',
      retentionDays: 30,
      privacyPolicyVersion: 'irm-privacy-v1',
      consentRef: 'missing',
      cohortSize: 20,
    });
    assert.equal(noConsent.ok, false);
    if (!noConsent.ok) assert.equal(noConsent.error.code, 'CONSENT_REQUIRED');

    const instance = market();
    const owned = seedRight(instance);
    const small = instance.createDataProduct('subject_ada', {
      form: 'HIN_AGGREGATE',
      displayName: 'Small cohort',
      rightIds: [owned.rightId],
      classification: 'DERIVED_AGGREGATE',
      eligiblePurposes: ['RESEARCH'],
      purpose: 'RESEARCH',
      minimumAggregationThreshold: 10,
      jurisdiction: 'GB',
      retentionDays: 30,
      privacyPolicyVersion: 'irm-privacy-v1',
      consentRef: 'consent_ok',
      cohortSize: 2,
    });
    assert.equal(small.ok, false);
    if (!small.ok) assert.equal(small.error.code, 'MIN_COHORT_NOT_MET');

    const cross = instance.createDataProduct('subject_other', {
      form: 'HIN_AGGREGATE',
      displayName: 'Cross',
      rightIds: [owned.rightId],
      classification: 'DERIVED_AGGREGATE',
      eligiblePurposes: ['RESEARCH'],
      purpose: 'RESEARCH',
      minimumAggregationThreshold: 10,
      jurisdiction: 'GB',
      retentionDays: 30,
      privacyPolicyVersion: 'irm-privacy-v1',
      consentRef: 'consent_ok',
      cohortSize: 20,
    });
    assert.equal(cross.ok, false);
    if (!cross.ok) assert.equal(cross.error.code, 'RIGHT_NOT_OWNED');
  });

  it('preserves purpose: RESEARCH does not authorize MARKETING or CREDIT_DECISIONING', () => {
    const instance = market();
    const right = seedRight(instance);
    const product = seedProduct(instance, 'subject_ada', right.rightId);
    const marketing = instance.requestLicense({
      licenseeId: 'licensee_lab',
      productId: product.productId,
      purpose: 'MARKETING',
      scope: 'ads',
      durationDays: 30,
      queryLimit: 1,
      downloadLimit: 0,
      jurisdiction: 'GB',
      consentRef: 'consent_ok',
    });
    assert.equal(marketing.ok, false);
    if (!marketing.ok) assert.equal(marketing.error.code, 'PURPOSE_MISMATCH');

    const license = activateLicense(instance, product.productId);
    const credit = instance.controlledAccess({
      licenseId: license.licenseId,
      licenseeId: 'licensee_lab',
      purpose: 'RESEARCH',
      requestedPurpose: 'CREDIT_DECISIONING',
      accessKind: 'AGGREGATE_OUTPUT',
      cohortSize: 20,
    });
    assert.equal(credit.ok, false);
    if (!credit.ok) assert.equal(credit.error.code, 'PURPOSE_MISMATCH');
    const expansion = instance.refusePurposeExpansion('RESEARCH', 'MARKETING');
    assert.equal(expansion.ok, false);
  });

  it('activates, meters, expires, and revokes licenses', () => {
    const instance = market();
    const right = seedRight(instance);
    const product = seedProduct(instance, 'subject_ada', right.rightId);
    const license = activateLicense(instance, product.productId);
    assert.equal(license.status, 'ACTIVE');
    const access = unwrap(
      instance.controlledAccess({
        licenseId: license.licenseId,
        licenseeId: 'licensee_lab',
        purpose: 'RESEARCH',
        accessKind: 'AGGREGATE_OUTPUT',
        cohortSize: 20,
      }),
    );
    assert.equal(access.rawDatabaseCredential, false);
    assert.equal(access.rawRows, false);
    assert.equal(instance.requestDatabaseCredential().ok, false);

    const expired = unwrap(instance.expireLicense(license.licenseId));
    assert.equal(expired.status, 'EXPIRED');
    const afterExpiry = instance.controlledAccess({
      licenseId: license.licenseId,
      licenseeId: 'licensee_lab',
      purpose: 'RESEARCH',
      accessKind: 'API',
      cohortSize: 20,
    });
    assert.equal(afterExpiry.ok, false);

    const second = activateLicense(instance, product.productId, 'licensee_two');
    const revoked = unwrap(instance.revokeLicense({ licenseId: second.licenseId, actorSubjectId: 'subject_ada', reason: 'withdraw' }));
    assert.equal(revoked.futureAccessStopped, true);
    assert.equal(revoked.historicalLawfulUsageRetained, true);
    const afterRevoke = instance.controlledAccess({
      licenseId: second.licenseId,
      licenseeId: 'licensee_two',
      purpose: 'RESEARCH',
      accessKind: 'API',
      cohortSize: 20,
    });
    assert.equal(afterRevoke.ok, false);
  });

  it('meters usage, refuses raw query logs, and does not settle duplicates', () => {
    const instance = market();
    const right = seedRight(instance);
    const product = seedProduct(instance, 'subject_ada', right.rightId);
    const license = activateLicense(instance, product.productId);
    const usage = unwrap(
      instance.recordUsageEvent({
        licenseId: license.licenseId,
        licenseeId: 'licensee_lab',
        accessKind: 'API',
        volume: 1,
      }),
    );
    assert.equal(usage.rawQueryOutput, false);
    const raw = instance.recordUsageEvent({
      licenseId: license.licenseId,
      licenseeId: 'licensee_lab',
      accessKind: 'API',
      volume: 1,
      rawQueryOutput: { rows: ['secret'] },
    });
    assert.equal(raw.ok, false);

    const settled = unwrap(
      instance.settleUsage({
        usageId: usage.usageId,
        actorId: 'actor_lab',
        sponsorCustomerId: 'cust_sponsor',
        rightsHolderCustomerId: 'cust_ada',
        rightsHolderAccountId: 'acct_ada',
      }),
    );
    assert.equal(settled.journalId, 'jrnl_sim');
    assert.ok(settled.allocations.some((row) => row.recipientClass === 'INDIVIDUAL_RIGHTS_HOLDER'));
    const duplicate = instance.settleUsage({
      usageId: usage.usageId,
      actorId: 'actor_lab',
      sponsorCustomerId: 'cust_sponsor',
      rightsHolderCustomerId: 'cust_ada',
      rightsHolderAccountId: 'acct_ada',
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.error.code, 'DUPLICATE_USAGE');
  });

  it('keeps native-asset compensation off the mint path', () => {
    const native: NativeAssetTransferPort = {
      transfer() {
        return { outcome: 'OK', transferId: 'xfer_sim' };
      },
      mint() {
        return { outcome: 'REJECTED', code: 'MARKETPLACE_CANNOT_MINT', message: 'marketplace cannot mint' };
      },
    };
    const instance = market(consentMap(), native);
    const policies = instance.defaultSimulationPolicies();
    instance.store.pricing.set(policies.pricing.policyId, {
      ...policies.pricing,
      model: 'FIXED',
    });
    const right = seedRight(instance);
    const product = seedProduct(instance, 'subject_ada', right.rightId);
    const license = activateLicense(instance, product.productId);
    instance.store.licenses.set(license.licenseId, {
      ...license,
      compensation: {
        asset: 'SUNREY_COIN',
        coin: AssetQuantity.fromScaledUnits(1000n, 'SUNREY_COIN'),
        pricingPolicyId: license.compensation.pricingPolicyId,
        compensationPolicyId: license.compensation.compensationPolicyId,
      },
    });
    const usage = unwrap(
      instance.recordUsageEvent({
        licenseId: license.licenseId,
        licenseeId: 'licensee_lab',
        accessKind: 'API',
        volume: 1,
      }),
    );
    const settled = unwrap(
      instance.settleUsage({
        usageId: usage.usageId,
        actorId: 'actor_lab',
        sponsorCustomerId: 'cust_sponsor',
        sponsorOwnerId: 'cust_sponsor',
        rightsHolderCustomerId: 'cust_ada',
        rightsHolderAccountId: 'acct_ada',
      }),
    );
    assert.equal(settled.nativeTransferId, 'xfer_sim');
    assert.equal(settled.journalId, null);
    assert.equal(instance.mintFromMarketplace().ok, false);
  });

  it('enforces licensee scope, kill switch, and cross-user denial', () => {
    const instance = market();
    const right = seedRight(instance);
    const product = seedProduct(instance, 'subject_ada', right.rightId);
    const license = activateLicense(instance, product.productId);
    const other = instance.controlledAccess({
      licenseId: license.licenseId,
      licenseeId: 'licensee_other',
      purpose: 'RESEARCH',
      accessKind: 'API',
      cohortSize: 20,
    });
    assert.equal(other.ok, false);
    if (!other.ok) assert.equal(other.error.code, 'LICENSEE_SCOPE');

    const credential = unwrap(
      instance.registerLicenseeCredential({
        licenseeId: 'licensee_lab',
        clientIdentity: 'app_lab',
        purposeRestrictions: ['RESEARCH'],
        rateLimitPerWindow: 8,
      }),
    );
    assert.equal(credential.secretMaterialIncluded, false);
    unwrap(instance.engageKillSwitch(credential.credentialId));
    const killed = instance.controlledAccess({
      licenseId: license.licenseId,
      licenseeId: 'licensee_lab',
      purpose: 'RESEARCH',
      accessKind: 'API',
      credentialId: credential.credentialId,
      cohortSize: 20,
    });
    assert.equal(killed.ok, false);
    if (!killed.ok) assert.equal(killed.error.code, 'KILL_SWITCH');

    const otherRights = instance.rightsFor('subject_other');
    assert.equal(otherRights.length, 0);
    const earnings = instance.earningsFor('subject_ada');
    assert.equal(earnings.guaranteed, false);
  });

  it('uses versioned compensation and configured pricing only', () => {
    const instance = market();
    const invalid = instance.registerPricingPolicy({
      ...simulationPricingPolicyV1(),
      auctionEnabled: true,
    });
    assert.equal(invalid.ok, false);
    const fixture = simulationCompensationPolicyV1();
    assert.equal(fixture.approvedEconomicPolicy, false);
    assert.equal(
      fixture.shares.reduce((sum, share) => sum + share.basisPoints, 0),
      10_000,
    );
    assert.ok(Money.fromMinorUnits(2500n, 'USD').equals(simulationPricingPolicyV1().fixedFiat!));
  });

  it('supports pause/withdraw and agent contract refusals', () => {
    const instance = createSandboxRightsMarketplace(new FrozenClock(NOW), 'cust_sandbox_basic');
    unwrap(instance.pauseParticipation('cust_sandbox_basic'));
    const paused = instance.requestLicense({
      licenseeId: 'licensee_lab',
      productId: [...instance.store.products.values()][0]!.productId,
      purpose: 'RESEARCH',
      scope: 'x',
      durationDays: 1,
      queryLimit: 1,
      downloadLimit: 0,
      jurisdiction: 'GB',
      consentRef: 'consent_ok',
    });
    assert.equal(paused.ok, true);
    const pricing = [...instance.store.pricing.values()][0]!;
    const policy = [...instance.store.policies.values()][0]!;
    const activatePaused = instance.approveAndActivate({
      requestId: paused.ok ? paused.value.requestId : '',
      actorId: 'actor',
      pricingPolicyId: pricing.policyId,
      compensationPolicyId: policy.policyId,
      termsVersion: 'irm-terms-v1',
      paid: true,
    });
    assert.equal(activatePaused.ok, false);

    unwrap(instance.withdrawParticipation('cust_sandbox_basic'));
    const agent = new InformationRightsMarketplaceAgentSurface(instance);
    assert.equal(agent.acceptMaterialTerms().ok, false);
    assert.equal(agent.changeCompensationPolicy().ok, false);
    assert.equal(agent.fabricateEarnings().ok, false);
    const earnings = unwrap(agent.showApprovedEarnings('cust_sandbox_basic'));
    assert.equal(earnings.guaranteed, false);
    assert.equal(earnings.fabricated, false);
  });

  it('does not claim formal differential privacy', () => {
    const instance = market();
    const right = seedRight(instance);
    const product = seedProduct(instance, 'subject_ada', right.rightId);
    const controls = unwrap(instance.privacyControls(product.productId, 8));
    assert.equal(controls.differentialPrivacyClaimed, false);
    assert.equal(controls.differentialPrivacyImplemented, false);
    assert.equal(product.differentialPrivacyClaimed, false);
    assert.equal(product.rawDatabaseAccess, false);
  });
});
