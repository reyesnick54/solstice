/**
 * Live-gate protection for financial provider adapters.
 *
 * Sandbox / simulation adapters cannot be invoked as production.
 * Missing credentials and missing webhook verification fail closed.
 */

import {
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_PAYMENTS_ENABLED,
} from '../../../config/src/flags.ts';
import type { SecretReference } from '../../../security/src/secrets.ts';
import { FINANCIAL_ADAPTER_FLAGS, type FinancialProviderDomain, type ProviderLifecycleState } from './types.ts';
import { canEnterProductionLifecycle } from './lifecycle.ts';

export type AdapterInvocationRequest = {
  readonly providerId: string;
  readonly domain: FinancialProviderDomain;
  readonly lifecycle: ProviderLifecycleState;
  readonly requestedAs: ProviderLifecycleState;
  readonly certified: boolean;
  readonly credentialRef: SecretReference | null;
  readonly webhookVerificationRef: SecretReference | null;
};

export type AdapterInvocationDecision =
  | { readonly allowed: true; readonly live: false }
  | { readonly allowed: false; readonly code: string; readonly message: string };

export function authorizeAdapterInvocation(request: AdapterInvocationRequest): AdapterInvocationDecision {
  if (LIVE_PAYMENTS_ENABLED !== false || LIVE_BANKING_RAILS !== false || LIVE_EXTERNAL_BANK_CONNECTION !== false) {
    return closed('LIVE_FLAGS_MUST_REMAIN_FALSE', 'live payment and banking flags must remain false');
  }
  if (FINANCIAL_ADAPTER_FLAGS.productionAuthorized !== false || FINANCIAL_ADAPTER_FLAGS.liveConnectivityEnabled !== false) {
    return closed('PRODUCTION_REMAINS_DISABLED', 'financial adapter production remains disabled');
  }
  if (request.requestedAs === 'PRODUCTION' && request.lifecycle !== 'PRODUCTION') {
    return closed(
      domainRefuseCode(request.domain),
      `${request.lifecycle.toLowerCase()} ${domainLabel(request.domain)} cannot be invoked as production`,
    );
  }
  if (request.lifecycle === 'SIMULATED' && canEnterProductionLifecycle(request.requestedAs)) {
    return closed(
      domainRefuseCode(request.domain),
      `simulation ${domainLabel(request.domain)} cannot produce a production result`,
    );
  }
  if (canEnterProductionLifecycle(request.requestedAs) && !request.certified) {
    return closed('UNCERTIFIED_ADAPTER', 'uncertified adapter cannot enter production lifecycle');
  }
  if (canEnterProductionLifecycle(request.requestedAs)) {
    return closed('PRODUCTION_AUTHORIZATION_REQUIRED', 'production invocation is not authorized');
  }
  if (!request.credentialRef) {
    return closed('MISSING_CREDENTIAL_REFERENCE', 'missing credential reference fails closed');
  }
  if (!request.webhookVerificationRef && request.requestedAs !== 'SIMULATED') {
    return closed('WEBHOOK_VERIFICATION_REQUIRED', 'missing webhook verification prevents callback processing');
  }
  return { allowed: true, live: false };
}

function domainRefuseCode(domain: FinancialProviderDomain): string {
  switch (domain) {
    case 'BANK_BAAS':
    case 'ACCOUNT_PROVIDER':
      return 'SANDBOX_BANK_NOT_PRODUCTION';
    case 'FX_LIQUIDITY':
      return 'SANDBOX_FX_NOT_PRODUCTION';
    case 'CARD_ISSUING':
    case 'CARD_PROCESSING':
    case 'DIGITAL_WALLET':
      return 'SIMULATION_CARD_NOT_PRODUCTION';
    default:
      return 'SANDBOX_PROVIDER_NOT_PRODUCTION';
  }
}

function domainLabel(domain: FinancialProviderDomain): string {
  switch (domain) {
    case 'BANK_BAAS':
    case 'ACCOUNT_PROVIDER':
      return 'bank';
    case 'FX_LIQUIDITY':
      return 'FX';
    case 'CARD_ISSUING':
    case 'CARD_PROCESSING':
      return 'card provider';
    case 'DIGITAL_WALLET':
      return 'wallet provider';
    default:
      return 'payment provider';
  }
}

function closed(code: string, message: string): AdapterInvocationDecision {
  return { allowed: false, code, message };
}
