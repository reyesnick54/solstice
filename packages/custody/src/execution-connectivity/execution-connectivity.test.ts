import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../domain/src/legal-entity.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import {
  EXTERNAL_ACCOUNT_REPRESENTATION_MODELS,
  EXEC08_RECORD_TRUTH,
  HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED,
  asBeneficialOwnerBindingId,
  asExec08ReconciliationId,
  asExternalCustodyAccountId,
  asExternalDigitalPositionId,
  assetAvailabilityFromParts,
  defaultExec08QualificationChecksPass,
  evaluateExec08AssetSegregationQualification,
  freezeBeneficialOwnerBinding,
  freezeExternalCustodyAccount,
  freezeExternalDigitalAssetPosition,
  reconcileCustodyProviderToLedger,
} from './index.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec08_a');

describe('HELIOS EXEC08 custody execution connectivity', () => {
  it('models representation without legal suitability claims', () => {
    assert.equal(EXTERNAL_ACCOUNT_REPRESENTATION_MODELS.length, 5);
    const binding = freezeBeneficialOwnerBinding({
      bindingId: asBeneficialOwnerBindingId('bob_exec08_1'),
      externalAccountId: 'ext_cust_1',
      beneficialCustomerId: CUSTOMER,
      sunReyEconomicAccountRef: 'acct_grow_1',
      representationModel: 'SEGREGATED',
      status: 'ACTIVE',
      effectiveFrom: NOW,
      evidenceRefs: ['evidence:binding:1'],
      providerBalanceIsLedgerTruth: false,
    });
    const account = freezeExternalCustodyAccount({
      schema: 'sunrey.external-custody-account.v1',
      accountId: asExternalCustodyAccountId('ext_cust_acct_1'),
      provider: 'sandbox_custody_v1',
      providerAccountRef: 'prov_ref_1',
      representationModel: 'FULLY_DISCLOSED',
      legalOwner: Object.freeze({
        legalEntityId: asLegalEntityId('le_sunrey_sim'),
        providerLegalOwnerRef: 'prov_owner_1',
        registrationRef: 'reg_sim_1',
      }),
      beneficialOwnerBindings: Object.freeze([binding]),
      currency: 'USD',
      jurisdiction: asJurisdiction('US'),
      status: 'ACTIVE',
      permissions: Object.freeze(['READ_BALANCES', 'READ_POSITIONS']),
      evidenceRefs: Object.freeze(['evidence:account:1']),
      updatedAt: NOW,
      simulation: true,
      legalSuitabilityClaimed: false,
    });
    assert.equal(account.representationModel, 'FULLY_DISCLOSED');
    assert.equal(account.legalSuitabilityClaimed, false);
  });

  it('reconciles provider custody to ledger without auto synchronization', () => {
    const availability = assetAvailabilityFromParts('SUNREY_CHAIN_NATIVE', {
      AVAILABLE: 1000n,
      HELD: 0n,
      SETTLED: 0n,
    });
    const matched = reconcileCustodyProviderToLedger({
      reconciliationId: asExec08ReconciliationId('crec_exec08_match'),
      asOf: NOW,
      scopes: Object.freeze([
        Object.freeze({
          assetId: 'SUNREY_CHAIN_NATIVE',
          providerAvailability: availability,
          sunReyLedgerMinorUnits: 1000n,
          beneficialOwnerMapped: true,
        }),
      ]),
    });
    assert.equal(matched.matched, true);
    assert.equal(matched.silentBalanceSynchronization, false);

    const mismatched = reconcileCustodyProviderToLedger({
      reconciliationId: asExec08ReconciliationId('crec_exec08_mismatch'),
      asOf: NOW,
      scopes: Object.freeze([
        Object.freeze({
          assetId: 'SUNREY_CHAIN_NATIVE',
          providerAvailability: availability,
          sunReyLedgerMinorUnits: 900n,
          beneficialOwnerMapped: true,
        }),
      ]),
    });
    assert.equal(mismatched.matched, false);
    assert.equal(mismatched.breaks[0]?.autoSynchronized, false);
  });

  it('freezes digital asset positions with availability buckets', () => {
    const position = freezeExternalDigitalAssetPosition({
      positionId: asExternalDigitalPositionId('edp_1'),
      custodyAccountId: asExternalCustodyAccountId('ext_cust_acct_1'),
      provider: 'sandbox_custody_v1',
      assetId: 'SUNREY_CHAIN_NATIVE',
      availability: assetAvailabilityFromParts('SUNREY_CHAIN_NATIVE', {
        AVAILABLE: 500n,
        PENDING_TRANSFER: 100n,
      }),
      asOf: NOW,
      evidenceRefs: Object.freeze(['evidence:position:1']),
      simulation: true,
    });
    assert.equal(position.availability.providerReportedTotal, 600n);
    assert.equal(EXEC08_RECORD_TRUTH.providerBalanceIsSunReyLedgerTruth, false);
  });

  it('qualifies EXEC08 when checks pass', () => {
    const result = evaluateExec08AssetSegregationQualification(defaultExec08QualificationChecksPass());
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_EXEC08_ASSET_SEGREGATION_QUALIFIED);
  });
});
