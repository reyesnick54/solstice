import { assertNoSensitiveCardData } from '../pci-boundary.ts';
import type { Card } from '../card.ts';
import type { CardControls } from '../controls.ts';
import type { CardTransactionActivity } from '../activity.ts';
import type { WalletProvisioningStatus } from '../wallet/provisioning.ts';

/**
 * PCI-minimized consumer card resource. Lovable / BFF may render this
 * without PAN, CVV, PIN, or provider credentials.
 */
export type ConsumerCardControls = {
  readonly frozen: boolean;
  readonly onlineTransactions: boolean;
  readonly internationalTransactions: boolean;
  readonly cashWithdrawal: boolean;
  readonly contactless: boolean;
  readonly blockedMerchantCategories: readonly string[];
  readonly blockedCountries: readonly string[];
  readonly transactionLimitMinor: string | null;
  readonly dailyLimitMinor: string | null;
};

export type ConsumerCardResource = {
  readonly schema: 'sunrey.consumer.card.v1';
  readonly cardId: string;
  readonly ownerCustomerId: string;
  readonly fundingAccountId: string;
  readonly type: 'DEBIT';
  readonly form: 'VIRTUAL' | 'PHYSICAL';
  readonly status: string;
  readonly last4: string | null;
  readonly expiry: { readonly month: number; readonly year: number } | null;
  readonly displayHint: 'SIM-CARD';
  readonly walletProvisioningStatus: WalletProvisioningStatus;
  readonly controls: ConsumerCardControls;
  readonly createdAt: string;
  readonly productionIssuing: false;
};

export function toConsumerCard(card: Card): ConsumerCardResource {
  assertNoSensitiveCardData(card, 'consumerCard');
  return Object.freeze({
    schema: 'sunrey.consumer.card.v1',
    cardId: card.cardId,
    ownerCustomerId: card.customerId,
    fundingAccountId: card.fundingAccountId,
    type: 'DEBIT',
    form: card.formFactor,
    status: card.status,
    last4: card.last4,
    expiry: card.expiry,
    displayHint: 'SIM-CARD',
    walletProvisioningStatus: card.walletProvisioningStatus,
    controls: toConsumerControls(card.controls),
    createdAt: card.createdAt,
    productionIssuing: false,
  });
}

export function toConsumerControls(controls: CardControls): ConsumerCardControls {
  return Object.freeze({
    frozen: controls.frozen,
    onlineTransactions: controls.ecommerceEnabled,
    internationalTransactions: controls.internationalEnabled,
    cashWithdrawal: controls.cashAtmEnabled,
    contactless: controls.contactlessEnabled,
    blockedMerchantCategories: Object.freeze([...controls.blockedMerchantCategories]),
    blockedCountries: Object.freeze([...controls.blockedCountries]),
    transactionLimitMinor:
      controls.transactionAmountLimitMinor === null ? null : controls.transactionAmountLimitMinor.toString(),
    dailyLimitMinor: controls.dailyAmountLimitMinor === null ? null : controls.dailyAmountLimitMinor.toString(),
  });
}

export function toConsumerActivity(items: readonly CardTransactionActivity[]): readonly {
  readonly id: string;
  readonly kind: string;
  readonly lifecycle: string;
  readonly merchant: string | null;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly occurredAt: string;
}[] {
  return Object.freeze(
    items.map((item) =>
      Object.freeze({
        id: item.id,
        kind: item.kind,
        lifecycle: item.lifecycle,
        merchant: item.merchant,
        amountMinorUnits: item.amountMinorUnits,
        currency: item.currency,
        occurredAt: item.occurredAt,
      }),
    ),
  );
}
