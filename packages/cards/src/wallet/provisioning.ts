import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type { DevicePaymentTokenStatus } from './token.ts';

/**
 * Provider-neutral wallet provisioning status for Apple Wallet / Google Wallet.
 * This is not Apple Pay or Google Pay certification and does not claim
 * a live token requestor or network tokenization agreement.
 */
export const WALLET_PROVISIONING_STATUSES = [
  'NOT_ELIGIBLE',
  'ELIGIBLE',
  'PROVISIONING',
  'ACTIVE',
  'FAILED',
  'SUSPENDED',
] as const;
export type WalletProvisioningStatus = (typeof WALLET_PROVISIONING_STATUSES)[number];

export function walletStatusFromEligibility(
  outcome: 'ELIGIBLE' | 'STEP_UP_REQUIRED' | 'REVIEW' | 'INELIGIBLE',
): WalletProvisioningStatus {
  switch (outcome) {
    case 'ELIGIBLE':
      return 'ELIGIBLE';
    case 'STEP_UP_REQUIRED':
    case 'REVIEW':
    case 'INELIGIBLE':
      return 'NOT_ELIGIBLE';
  }
}

export function walletStatusFromDeviceToken(status: DevicePaymentTokenStatus): WalletProvisioningStatus {
  switch (status) {
    case 'REQUESTED':
    case 'PENDING_VERIFICATION':
      return 'PROVISIONING';
    case 'ACTIVE':
      return 'ACTIVE';
    case 'SUSPENDED':
      return 'SUSPENDED';
    case 'DEACTIVATED':
    case 'DELETED':
      return 'FAILED';
  }
}

export function summarizeWalletProvisioningStatus(input: {
  readonly eligibility: WalletProvisioningStatus | null;
  readonly tokens: readonly DevicePaymentTokenStatus[];
}): WalletProvisioningStatus {
  const tokenStatuses = input.tokens.map(walletStatusFromDeviceToken);
  if (tokenStatuses.includes('ACTIVE')) {
    return 'ACTIVE';
  }
  if (tokenStatuses.includes('PROVISIONING')) {
    return 'PROVISIONING';
  }
  if (tokenStatuses.includes('SUSPENDED')) {
    return 'SUSPENDED';
  }
  if (tokenStatuses.includes('FAILED')) {
    return 'FAILED';
  }
  return input.eligibility ?? 'NOT_ELIGIBLE';
}

export function freezeWalletProvisioningView(view: {
  readonly status: WalletProvisioningStatus;
  readonly apple: WalletProvisioningStatus;
  readonly google: WalletProvisioningStatus;
  readonly certification: 'NOT_CERTIFIED';
  readonly productionReady: false;
}): typeof view {
  assertNoSensitiveCardData(view, 'walletProvisioning');
  return Object.freeze({ ...view });
}
