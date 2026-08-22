/**
 * Provider adapter integration template.
 *
 * Copy this skeleton when integrating a new bank, rail, or FX vendor.
 * Fill the placeholders. Do not add vendor-specific domain types to
 * packages/payments. Do not invent a second Ledger or Kernel.
 *
 * No fake vendor-specific code lives here.
 */

import type { SecretReference } from '../../../../security/src/secrets.ts';
import { adapterErr, type AdapterHealth, type AdapterResult, type ProviderLifecycleState } from '../types.ts';
import type { BankAdapter, BankAdapterCapabilities } from '../bank/port.ts';
import type { FinancialProviderReconciliationPort } from '../reconciliation/contract.ts';

export type FinancialProviderTemplateConfig = {
  readonly providerId: string;
  readonly lifecycle: Exclude<ProviderLifecycleState, 'PRODUCTION' | 'LIMITED_LIVE'>;
  readonly credentialRef: SecretReference | null;
  readonly webhookVerificationRef: SecretReference | null;
  readonly capabilities: BankAdapterCapabilities;
};

export const TEMPLATE_CAPABILITIES: BankAdapterCapabilities = Object.freeze({
  createCustomer: false,
  updateCustomer: false,
  createAccount: false,
  getAccount: false,
  getBalance: false,
  getTransactions: false,
  getStatement: false,
  closeOrRestrict: false,
  getAccountStatus: false,
});

/**
 * Skeleton only. Every method fails closed until a vendor adapter
 * implements the BankAdapter contract.
 */
export class FinancialProviderAdapterTemplate implements Pick<
  BankAdapter,
  'providerId' | 'domain' | 'lifecycle' | 'capabilities' | 'credentialRef' | 'canPostLedger' | 'canIssueExecutionAuthority' | 'health'
> {
  readonly providerId: string;
  readonly domain = 'BANK_BAAS' as const;
  readonly lifecycle: FinancialProviderTemplateConfig['lifecycle'];
  readonly capabilities: BankAdapterCapabilities;
  readonly credentialRef: SecretReference | null;
  readonly webhookVerificationRef: SecretReference | null;
  readonly canPostLedger = false as const;
  readonly canIssueExecutionAuthority = false as const;

  constructor(config: FinancialProviderTemplateConfig) {
    this.providerId = config.providerId;
    this.lifecycle = config.lifecycle;
    this.capabilities = config.capabilities;
    this.credentialRef = config.credentialRef;
    this.webhookVerificationRef = config.webhookVerificationRef;
  }

  // PLACEHOLDER: map vendor create-customer request/response here.
  notImplemented(operation: string): AdapterResult<never> {
    return adapterErr('ADAPTER_NOT_IMPLEMENTED', `${operation} is a template placeholder`, {
      submissionCertainty: 'DEFINITELY_NOT_SUBMITTED',
    });
  }

  // PLACEHOLDER: resolve SecretReference via packages/security credential plane.
  missingCredential(): AdapterResult<never> {
    if (!this.credentialRef) {
      return adapterErr('MISSING_CREDENTIAL_REFERENCE', 'missing credential reference fails closed');
    }
    return adapterErr('CREDENTIAL_NOT_RESOLVED', 'template does not resolve credentials');
  }

  // PLACEHOLDER: verify vendor webhook signatures with webhookVerificationRef.
  missingWebhookVerification(): AdapterResult<never> {
    if (!this.webhookVerificationRef) {
      return adapterErr('WEBHOOK_VERIFICATION_REQUIRED', 'missing webhook verification prevents callback processing');
    }
    return adapterErr('WEBHOOK_NOT_IMPLEMENTED', 'template does not verify vendor webhooks');
  }

  // PLACEHOLDER: implement FinancialProviderReconciliationPort.
  reconciliationPort(): FinancialProviderReconciliationPort | null {
    return null;
  }

  health(): AdapterHealth {
    return Object.freeze({
      providerId: this.providerId,
      domain: this.domain,
      lifecycle: this.lifecycle,
      healthy: false,
      connectivity: this.lifecycle === 'SANDBOX' ? 'SANDBOX' : 'SIMULATION',
      checkedAt: '1970-01-01T00:00:00.000Z' as never,
      live: false,
    });
  }
}

export const TEMPLATE_CHECKLIST = Object.freeze([
  'configuration',
  'credentials',
  'capabilities',
  'requests',
  'responses',
  'webhook verification',
  'health',
  'error normalization',
  'reconciliation',
  'tests',
] as const);
