import type { Account } from '../../../../packages/domain/src/account.ts';
import type { Customer } from '../../../../packages/domain/src/customer.ts';
import type { CustomerStatement } from '../../../../packages/domain/src/statement.ts';
import type { CustomerActivityItem } from '../../../../packages/domain/src/customer-activity.ts';
import type { UtcInstant } from '../../../../packages/domain/src/time.ts';
import type { BankingPosition } from '../../../accounts/src/available-funds.ts';
import type { CustomerFinancialAccount } from '../../../accounts/src/product-account.ts';
import type { ActivityFilter } from '../../../accounts/src/activity.ts';
import type { WealthValuation } from '../../../accounts/src/wealth.ts';
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
  financialAccount(accountId: string): CustomerFinancialAccount | null;
  listFinancialAccounts(customerId: string): readonly CustomerFinancialAccount[];
  authorizeRead(
    accountId: string,
    customerId: string,
    subjectId: string | null,
  ): CustomerFinancialAccount | { readonly error: 'NOT_FOUND' | 'RESOURCE_NOT_OWNED' };
  positionOf(account: Account): BankingPosition | { readonly unavailable: 'MIXED_CURRENCY' | 'SERVICE_UNAVAILABLE' };
  wealth(customerId: string, valuationCurrency: string): WealthValuation;
  activity(customerId: string, accountId?: string, filter?: ActivityFilter): readonly CustomerActivityItem[];
  statement(accountId: string, periodStart: UtcInstant, periodEnd: UtcInstant): CustomerStatement | { readonly error: string };
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
  list?(principal: BffPrincipal): unknown;
  get?(principal: BffPrincipal, id: string): unknown;
  dismiss?(principal: BffPrincipal, id: string): unknown;
  startProposal?(principal: BffPrincipal, id: string): unknown;
};

export type GrowCommandPort = {
  profile(principal: BffPrincipal, valuationCurrency?: string): unknown;
  snapshot(principal: BffPrincipal, valuationCurrency?: string): unknown;
  listGoals(principal: BffPrincipal): unknown;
  createGoal(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): unknown;
  patchGoal(principal: BffPrincipal, goalId: string, body: Record<string, unknown>, requestId: string): unknown;
  insights(principal: BffPrincipal): unknown;
  suitability(principal: BffPrincipal): unknown;
  submitSuitability(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): unknown;
  declareAssumption(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): unknown;
  correctClassification(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): unknown;
  history(principal: BffPrincipal, series?: string): unknown;
  agentProfile(principal: BffPrincipal): unknown;
};

export type CardsMutationPort = {
  list(customerId: string): readonly unknown[];
  detail(
    customerId: string,
    cardId: string,
  ):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };
  issue(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly accountId: string;
    readonly form: 'VIRTUAL' | 'PHYSICAL';
    readonly cardId: string;
    readonly idempotencyKey: string;
    readonly requestId: string;
  }):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };
  freeze(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly cardId: string;
    readonly requestId: string;
  }):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };
  unfreeze(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly cardId: string;
    readonly requestId: string;
  }):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };
  updateControls(input: {
    readonly actorId: string;
    readonly customerId: string;
    readonly cardId: string;
    readonly requestId: string;
    readonly patch: Record<string, unknown>;
  }):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };
  walletStatus(
    customerId: string,
    cardId: string,
  ):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number };
};
export type { FxCommandPort } from './fx-adapter.ts';

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
