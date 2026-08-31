/**
 * ACCESS Wave 5 — Treasury kill switch and operational controls.
 *
 * Reuses operational state pattern; disables new funding commitments without
 * disabling existing entitlements, history, refunds, or reconciliation.
 */

import type { AccessTreasuryOperationalState } from './taxonomy.ts';
import type { AccessTreasuryPolicy } from './types.ts';

export type TreasuryOperationalCapability = {
  readonly newFundingCommitments: boolean;
  readonly newRedemptions: boolean;
  readonly providerSettlements: boolean;
  readonly refunds: boolean;
  readonly reconciliation: boolean;
  readonly existingEntitlementServicing: boolean;
  readonly historyRead: boolean;
};

const CAPABILITIES_BY_STATE: Record<AccessTreasuryOperationalState, TreasuryOperationalCapability> =
  {
    NORMAL: Object.freeze({
      newFundingCommitments: true,
      newRedemptions: true,
      providerSettlements: true,
      refunds: true,
      reconciliation: true,
      existingEntitlementServicing: true,
      historyRead: true,
    }),
    LIMITED: Object.freeze({
      newFundingCommitments: true,
      newRedemptions: true,
      providerSettlements: true,
      refunds: true,
      reconciliation: true,
      existingEntitlementServicing: true,
      historyRead: true,
    }),
    NEW_REDEMPTIONS_PAUSED: Object.freeze({
      newFundingCommitments: false,
      newRedemptions: false,
      providerSettlements: true,
      refunds: true,
      reconciliation: true,
      existingEntitlementServicing: true,
      historyRead: true,
    }),
    SETTLEMENTS_RESTRICTED: Object.freeze({
      newFundingCommitments: false,
      newRedemptions: false,
      providerSettlements: false,
      refunds: true,
      reconciliation: true,
      existingEntitlementServicing: true,
      historyRead: true,
    }),
    EMERGENCY_RECONCILIATION_ONLY: Object.freeze({
      newFundingCommitments: false,
      newRedemptions: false,
      providerSettlements: false,
      refunds: true,
      reconciliation: true,
      existingEntitlementServicing: true,
      historyRead: true,
    }),
  };

export class AccessTreasuryKillSwitch {
  private state: AccessTreasuryOperationalState = 'NORMAL';

  getState(): AccessTreasuryOperationalState {
    return this.state;
  }

  setState(state: AccessTreasuryOperationalState): AccessTreasuryOperationalState {
    this.state = state;
    return this.state;
  }

  capabilities(): TreasuryOperationalCapability {
    return CAPABILITIES_BY_STATE[this.state];
  }

  applyToPolicy(policy: AccessTreasuryPolicy): AccessTreasuryPolicy {
    return Object.freeze({
      ...policy,
      operationalState: this.state,
    });
  }

  assertCanCommitFunding(): void {
    if (!this.capabilities().newFundingCommitments) {
      throw new Error(
        `new Access funding commitments disabled; operational state=${this.state}`,
      );
    }
  }

  assertCanSettle(): void {
    if (!this.capabilities().providerSettlements) {
      throw new Error(`Access provider settlements restricted; operational state=${this.state}`);
    }
  }

  assertCanRedeem(): void {
    if (!this.capabilities().newRedemptions) {
      throw new Error(`new Access redemptions paused; operational state=${this.state}`);
    }
  }
}

export function treasuryCapabilitiesForState(
  state: AccessTreasuryOperationalState,
): TreasuryOperationalCapability {
  return CAPABILITIES_BY_STATE[state];
}
