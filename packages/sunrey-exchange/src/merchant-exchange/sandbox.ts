import { systemClock } from '../../../config/src/clock.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { asMerchantExchangeMerchantId } from './ids.ts';
import type { MerchantRegistryPort } from './ports.ts';
import { SimulatedMerchantPaymentPort } from './ports.ts';
import { MerchantExchangeService } from './service.ts';
import { MerchantExchangeStore } from './store.ts';
import type { MerchantExchangeProfile } from './types.ts';

export const SANDBOX_MERCHANT_A = asMerchantExchangeMerchantId('merch_sandbox_electronics_us');
export const SANDBOX_MERCHANT_B = asMerchantExchangeMerchantId('merch_sandbox_home_us');
export const SANDBOX_MERCHANT_GB = asMerchantExchangeMerchantId('merch_sandbox_apparel_gb');
export const SANDBOX_MERCHANT_SUSPENDED = asMerchantExchangeMerchantId('merch_sandbox_suspended');
export const SANDBOX_MERCHANT_UNVERIFIED = asMerchantExchangeMerchantId('merch_sandbox_unverified');

export function sandboxMerchants(): readonly MerchantExchangeProfile[] {
  return Object.freeze([
    profile(SANDBOX_MERCHANT_A, 'Electronics Plus', ['ELECTRONICS', 'HOME_GOODS'], ['US'], 'PROVIDER_VERIFIED'),
    profile(SANDBOX_MERCHANT_B, 'Home Depot Sim', ['HOME_GOODS', 'GROCERIES'], ['US', 'CA'], 'PROVIDER_VERIFIED'),
    profile(SANDBOX_MERCHANT_GB, 'UK Fashion Co', ['APPAREL'], ['GB'], 'PROVIDER_VERIFIED'),
    profile(SANDBOX_MERCHANT_SUSPENDED, 'Suspended Shop', ['OTHER'], ['US'], 'PROVIDER_VERIFIED', 'SUSPENDED'),
    profile(SANDBOX_MERCHANT_UNVERIFIED, 'Unverified Shop', ['OTHER'], ['US'], 'UNVERIFIED'),
  ]);
}

function profile(
  merchantId: ReturnType<typeof asMerchantExchangeMerchantId>,
  displayName: string,
  categories: MerchantExchangeProfile['supportedCategories'],
  regions: readonly string[],
  verification: MerchantExchangeProfile['verificationState'],
  status: MerchantExchangeProfile['status'] = 'ACTIVE',
): MerchantExchangeProfile {
  return Object.freeze({
    merchantId,
    businessIdentityId: `biz_${merchantId}`,
    displayName,
    status,
    supportedCategories: categories,
    supportedRegions: regions,
    verificationState: verification,
    complianceRestricted: false,
    offerPermissions: Object.freeze(['SUBMIT_OFFER', 'WITHDRAW_OFFER']),
  });
}

export class InMemoryMerchantRegistry implements MerchantRegistryPort {
  private readonly merchants = new Map<string, ReturnType<typeof profile>>();

  constructor(merchants: readonly MerchantExchangeProfile[] = sandboxMerchants()) {
    for (const m of merchants) {
      this.merchants.set(m.merchantId, m);
    }
  }

  getMerchant(merchantId: ReturnType<typeof asMerchantExchangeMerchantId>) {
    return this.merchants.get(merchantId) ?? null;
  }

  listActiveMerchants() {
    return Object.freeze([...this.merchants.values()].filter((m) => m.status === 'ACTIVE'));
  }
}

export function createMerchantExchangeSandbox(input?: {
  readonly paymentAvailable?: boolean;
  readonly merchants?: readonly MerchantExchangeProfile[];
}) {
  const clock = systemClock;
  const events = new DomainEventLog();
  const store = new MerchantExchangeStore();
  const registry = new InMemoryMerchantRegistry(input?.merchants ?? sandboxMerchants());
  for (const m of input?.merchants ?? sandboxMerchants()) {
    store.registerMerchant(m);
  }
  const payment = new SimulatedMerchantPaymentPort(input?.paymentAvailable ?? false);
  const service = new MerchantExchangeService({ clock, events, payment, registry, store });
  return Object.freeze({ clock, events, store, registry, payment, service });
}
