import type { Account } from '../../../../packages/domain/src/account.ts';
import type { Customer } from '../../../../packages/domain/src/customer.ts';
import type { TransactionHistoryItem } from '../../../../packages/domain/src/transaction-history.ts';
import type { CustomerPosition } from '../../../accounts/src/balances.ts';
import type { BankingPosition } from '../../../accounts/src/available-funds.ts';
import type { ActionStatusResource } from './action-status.ts';
import type {
  ClientResourceState,
  ProductAvailability,
  ProviderAvailability,
  RiskDisplayLevel,
  VerificationDisplayState,
} from './types.ts';

export type BffPrincipal = {
  readonly actorId: string;
  readonly customerId: string;
  readonly identityId: string;
  readonly sessionId: string;
  readonly jurisdiction: string;
  readonly verification: VerificationDisplayState;
  readonly customerStatus: string;
  readonly identityStatus: string;
  readonly capabilities: readonly string[];
  readonly risk: RiskDisplayLevel;
  readonly restricted: boolean;
  readonly sandboxPersona: string | null;
  readonly deviceSummary: {
    readonly deviceId: string | null;
    readonly trustState: string | null;
  };
};

export type FeatureCapability = {
  readonly key: string;
  readonly enabled: boolean;
  readonly availability: ProductAvailability;
  readonly state: ClientResourceState;
  readonly provider: ProviderAvailability;
  readonly reason: string;
};

export type FeatureCapabilityMap = {
  readonly paymentsEnabled: boolean;
  readonly fxEnabled: boolean;
  readonly cardsEnabled: boolean;
  readonly growEnabled: boolean;
  readonly agentEnabled: boolean;
  readonly exchangeEnabled: boolean;
  readonly withdrawalsEnabled: boolean;
  readonly dataVaultEnabled: boolean;
  readonly details: Readonly<Record<string, FeatureCapability>>;
};

export type AccountsReadPort = {
  getCustomer(customerId: string): Customer | null;
  listAccounts(customerId: string): readonly Account[];
  getAccount(accountId: string): Account | null;
  positionOf(account: Account): BankingPosition | { readonly unavailable: 'MIXED_CURRENCY' | 'SERVICE_UNAVAILABLE' };
  customerPosition(customerId: string):
    | { readonly kind: 'POSITION'; readonly position: CustomerPosition }
    | { readonly kind: 'CURRENCY_INDEXED'; readonly currencies: readonly string[] }
    | { readonly kind: 'UNAVAILABLE'; readonly reason: string };
  activity(customerId: string, accountId?: string): readonly TransactionHistoryItem[];
};

export type OptionalDomainSummary = {
  readonly availability: ProductAvailability;
  readonly state: ClientResourceState;
  readonly provider: ProviderAvailability;
  readonly reason: string;
  readonly count?: number;
};

export type OptionalDomainPort = {
  summarize(principal: BffPrincipal): OptionalDomainSummary;
};

export type ActionPort = {
  list(principal: BffPrincipal): readonly ActionStatusResource[];
};

export type NotificationPort = {
  summarize(principal: BffPrincipal): OptionalDomainSummary & { readonly unreadCount?: number };
};

export type SecurityPort = {
  alerts(principal: BffPrincipal): readonly {
    readonly alertId: string;
    readonly severity: RiskDisplayLevel;
    readonly title: string;
    readonly detail: string;
  }[];
};

export type PreferenceStore = {
  get(customerId: string): ConsumerPreferences;
  patch(customerId: string, patch: Partial<ConsumerPreferences>): ConsumerPreferences;
};

export type ConsumerPreferences = {
  readonly preferredLanguage: string | null;
  readonly displayLabel: string | null;
  readonly notificationEmailEnabled: boolean;
  readonly notificationPushEnabled: boolean;
};

export const EMPTY_PREFERENCES: ConsumerPreferences = Object.freeze({
  preferredLanguage: null,
  displayLabel: null,
  notificationEmailEnabled: true,
  notificationPushEnabled: false,
});
