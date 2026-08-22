import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { AssetQuantity } from '../../money/src/asset-quantity.ts';
import { travelRuleBlocksWithdrawal } from './regulated/travel-rule-port.ts';
import { TravelRuleAdapter } from './production-candidate/index.ts';
import { GB_SIMULATION_TRAVEL_RULE_PACK } from './travel-rule.ts';

const QTY = AssetQuantity.fromScaledUnits(10n, 'SUNREY_COIN');

describe('Phase D Travel Rule adapter', () => {
  it('does not require Travel Rule for every blockchain action', () => {
    const adapter = new TravelRuleAdapter();
    const notApplicable = adapter.evaluate({
      transferRef: 'wd-internal',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: QTY,
      counterpartyIsVasp: false,
      originatorRef: 'orig-1',
      beneficiaryRef: 'ben-1',
    });
    assert.equal(notApplicable.complianceStatus, 'NOT_APPLICABLE');
    assert.equal(notApplicable.requiredForEveryBlockchainAction, false);
    assert.equal(notApplicable.authorizesWithdrawal, false);
  });

  it('covers applicable pending, complete, rejected, and failed certification cases', () => {
    const adapter = new TravelRuleAdapter();
    const pending = adapter.evaluate({
      transferRef: 'wd-pending',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: QTY,
      counterpartyIsVasp: true,
      counterpartyVasp: 'vasp:sandbox',
      originatorRef: 'orig-1',
      beneficiaryRef: 'ben-1',
      scenario: 'pending',
    });
    assert.equal(pending.applicability, 'REQUIRED_BY_PACK');
    assert.equal(pending.complianceStatus, 'APPLICABLE_PENDING');
    assert.equal(pending.messageStatus, 'PENDING');

    const complete = adapter.evaluate({
      transferRef: 'wd-complete',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: QTY,
      counterpartyIsVasp: true,
      originatorRef: 'orig-1',
      beneficiaryRef: 'ben-1',
      scenario: 'complete',
    });
    assert.equal(complete.complianceStatus, 'COMPLETE');

    const rejected = adapter.evaluate({
      transferRef: 'wd-rejected',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: QTY,
      counterpartyIsVasp: true,
      originatorRef: 'orig-1',
      beneficiaryRef: 'ben-1',
      scenario: 'rejected',
    });
    assert.equal(rejected.complianceStatus, 'REJECTED');

    const failed = adapter.evaluate({
      transferRef: 'wd-failed',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: QTY,
      counterpartyIsVasp: true,
      originatorRef: 'orig-1',
      beneficiaryRef: 'ben-1',
      scenario: 'failed',
    });
    assert.equal(failed.complianceStatus, 'FAILED');
    assert.equal(adapter.flags().acknowledgementAuthorizesWithdrawal, false);
    assert.equal(adapter.retrieve(pending.messageId)?.transferRef, 'wd-pending');
  });

  it('leaves withdrawal gating to the existing custody authority layer', () => {
    const adapter = new TravelRuleAdapter();
    const pending = adapter.evaluate({
      transferRef: 'wd-gate',
      originatorJurisdiction: asJurisdiction('GB'),
      quantity: QTY,
      counterpartyIsVasp: true,
      originatorRef: 'orig-1',
      beneficiaryRef: 'ben-1',
      scenario: 'pending',
    });
    const blocked = travelRuleBlocksWithdrawal({
      decision: {
        applicability: pending.applicability,
        packId: GB_SIMULATION_TRAVEL_RULE_PACK.packId,
        packVersion: GB_SIMULATION_TRAVEL_RULE_PACK.packVersion,
        thresholdSource: 'SIMULATION_POLICY_PACK',
        legalStatus: 'RESEARCH_REQUIRED',
        notALegalConclusion: true,
      },
      record: {
        messageId: pending.messageId,
        withdrawalId: pending.transferRef,
        state: 'PENDING',
        providerTransactionRef: null,
        requiredOriginatorPresent: true,
        requiredBeneficiaryPresent: true,
        envelope: null,
        evidenceRefs: Object.freeze([]),
        publicChainContainsRawPii: false,
      },
    });
    assert.equal(blocked, true);
  });
});
