import { CAPABILITIES, ENVIRONMENT } from '../../../../packages/config/src/flags.ts';
import { ACCOUNT_CLASS_CATALOG } from '../../../../packages/domain/src/account-class.ts';
import { computeCapabilities } from './capabilities.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import { DEFAULT_PAGE_SIZE, paginate, type CursorPage } from './pagination.ts';
import { consumerAccountTypeOf } from './accounts-adapter.ts';
import type { ActionStatusResource } from './action-status.ts';
import type {
  AccountsReadPort,
  ActionPort,
  BffPrincipal,
  ConsumerPreferences,
  FeatureCapabilityMap,
  NotificationPort,
  CardsMutationPort,
  OptionalDomainPort,
  PreferenceStore,
  SecurityPort,
} from './ports.ts';
import { EMPTY_PREFERENCES } from './ports.ts';
import { CONSUMER_RESOURCE_CATALOG } from './resources.ts';
import {
  moneyView,
  resourceField,
  type ClientResourceState,
  type ConsumerAccountType,
  type MoneyView,
  type ProductAvailability,
  type ResourceField,
} from './types.ts';

const FORBIDDEN_PROFILE_FIELDS = [
  'legalName',
  'dateOfBirth',
  'residency',
  'citizenships',
  'taxResidences',
  'jurisdiction',
  'kycState',
  'kyc',
  'identityDocument',
  'address',
  'customerStatus',
  'identityStatus',
] as const;

export type ConsumerActivityItem = {
  readonly reference: string;
  readonly accountId: string;
  readonly status: string;
  readonly direction: string;
  readonly amount: MoneyView;
  readonly description: string;
  readonly occurredAt: string;
};

export type ConsumerAccountResource = {
  readonly id: string;
  readonly type: ConsumerAccountType;
  readonly accountClass: string;
  readonly status: string;
  readonly currency: string;
  readonly productId: string;
  readonly balance: ResourceField<{
    readonly ledger: MoneyView;
    readonly available: MoneyView;
    readonly held: MoneyView;
    readonly pending: MoneyView;
  }>;
};

export type HomeResource = {
  readonly schema: 'sunrey.consumer.home.v1';
  readonly generatedAt: string;
  readonly user: ResourceField<{
    readonly customerId: string;
    readonly displayLabel: string | null;
    readonly verification: string;
    readonly jurisdiction: string;
  }>;
  readonly wealth: ResourceField<{
    readonly total: MoneyView;
    readonly currency: string;
    readonly classBreakdown: {
      readonly cash: MoneyView;
      readonly investments: MoneyView;
      readonly digitalAssets: MoneyView;
      readonly rewards: MoneyView;
      readonly pending: MoneyView;
    };
  }>;
  readonly cash: ResourceField<MoneyView>;
  readonly investments: ResourceField<MoneyView>;
  readonly digitalAssets: ResourceField<MoneyView>;
  readonly recentActivity: ResourceField<CursorPage<ConsumerActivityItem>>;
  readonly grow: ResourceField<{ readonly summary: string; readonly planCount: number }>;
  readonly agent: ResourceField<{ readonly recommendationCount: number }>;
  readonly pendingApprovals: ResourceField<readonly ActionStatusResource[]>;
  readonly notifications: ResourceField<{ readonly unreadCount: number }>;
  readonly securityAlerts: ResourceField<readonly { readonly alertId: string; readonly title: string; readonly severity: string }[]>;
  readonly cards: ResourceField<{ readonly count: number; readonly items: readonly unknown[] }>;
};

export type BootstrapResource = {
  readonly schema: 'sunrey.consumer.bootstrap.v1';
  readonly generatedAt: string;
  readonly profile: ResourceField<{
    readonly customerId: string;
    readonly identityId: string;
    readonly verification: string;
    readonly jurisdiction: string;
    readonly displayLabel: string | null;
  }>;
  readonly session: ResourceField<{
    readonly sessionId: string;
    readonly deviceId: string | null;
    readonly risk: string;
  }>;
  readonly capabilities: FeatureCapabilityMap;
  readonly pendingActions: ResourceField<readonly ActionStatusResource[]>;
  readonly notifications: ResourceField<{ readonly unreadCount: number }>;
  readonly application: {
    readonly environment: typeof ENVIRONMENT;
    readonly productionActivated: false;
    readonly liveMoneyEnabled: false;
    readonly productName: 'SunRey';
    readonly supportedCurrencies: readonly string[];
    readonly supportedAssets: readonly string[];
  };
};

export type ConsumerBffDeps = {
  readonly now: () => string;
  readonly accounts: AccountsReadPort;
  readonly preferences: PreferenceStore;
  readonly actions?: ActionPort;
  readonly notifications?: NotificationPort;
  readonly security?: SecurityPort;
  readonly grow?: OptionalDomainPort;
  readonly agent?: OptionalDomainPort;
  readonly exchange?: OptionalDomainPort;
  readonly payments?: OptionalDomainPort;
  readonly cards?: OptionalDomainPort;
  readonly cardFacade?: CardsMutationPort;
  readonly vault?: OptionalDomainPort;
  readonly fx?: OptionalDomainPort;
  readonly providerDown?: Readonly<Record<string, boolean>>;
};

export class ConsumerBff {
  private readonly deps: ConsumerBffDeps;

  constructor(deps: ConsumerBffDeps) {
    this.deps = deps;
  }

  capabilities(principal: BffPrincipal): FeatureCapabilityMap {
    return computeCapabilities({
      principal,
      ...(this.deps.grow ? { grow: this.deps.grow } : {}),
      ...(this.deps.agent ? { agent: this.deps.agent } : {}),
      ...(this.deps.exchange ? { exchange: this.deps.exchange } : {}),
      ...(this.deps.payments ? { payments: this.deps.payments } : {}),
      ...(this.deps.cards ? { cards: this.deps.cards } : {}),
      ...(this.deps.vault ? { vault: this.deps.vault } : {}),
      ...(this.deps.fx ? { fx: this.deps.fx } : {}),
      ...(this.deps.providerDown ? { providerDown: this.deps.providerDown } : {}),
    });
  }

  profile(principal: BffPrincipal) {
    const customer = this.deps.accounts.getCustomer(principal.customerId);
    const prefs = this.deps.preferences.get(principal.customerId);
    return Object.freeze({
      schema: 'sunrey.consumer.profile.v1' as const,
      customerId: principal.customerId,
      identityId: principal.identityId,
      status: customer?.status ?? principal.customerStatus,
      verification: principal.verification,
      jurisdiction: principal.jurisdiction,
      residency: customer?.residency ?? null,
      editable: Object.freeze({
        preferredLanguage: prefs.preferredLanguage,
        displayLabel: prefs.displayLabel,
        notificationEmailEnabled: prefs.notificationEmailEnabled,
        notificationPushEnabled: prefs.notificationPushEnabled,
      }),
      legalIdentityEditable: false,
    });
  }

  patchProfile(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): ReturnType<ConsumerBff['profile']> | BffErrorEnvelope {
    for (const field of FORBIDDEN_PROFILE_FIELDS) {
      if (field in body) {
        return bffError({
          errorCode: 'FORBIDDEN_PROFILE_FIELD',
          category: 'POLICY',
          message: 'KYC and legal-identity fields cannot be edited through the consumer BFF',
          retryable: false,
          requestId,
          detailsSafeForClient: { field },
        });
      }
    }
    const allowed = new Set([
      'preferredLanguage',
      'displayLabel',
      'notificationEmailEnabled',
      'notificationPushEnabled',
    ]);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) {
        return bffError({
          errorCode: 'VALIDATION',
          category: 'VALIDATION',
          message: 'unknown or unauthorized profile field',
          retryable: false,
          requestId,
          detailsSafeForClient: { field: key },
        });
      }
    }
    const patch: {
      preferredLanguage?: string | null;
      displayLabel?: string | null;
      notificationEmailEnabled?: boolean;
      notificationPushEnabled?: boolean;
    } = {};
    if (typeof body.preferredLanguage === 'string' || body.preferredLanguage === null) {
      patch.preferredLanguage = body.preferredLanguage;
    }
    if (typeof body.displayLabel === 'string' || body.displayLabel === null) {
      patch.displayLabel = body.displayLabel;
    }
    if (typeof body.notificationEmailEnabled === 'boolean') {
      patch.notificationEmailEnabled = body.notificationEmailEnabled;
    }
    if (typeof body.notificationPushEnabled === 'boolean') {
      patch.notificationPushEnabled = body.notificationPushEnabled;
    }
    this.deps.preferences.patch(principal.customerId, patch);
    return this.profile(principal);
  }

  listAccounts(principal: BffPrincipal): { readonly items: readonly ConsumerAccountResource[] } {
    const accounts = this.deps.accounts.listAccounts(principal.customerId);
    return Object.freeze({
      items: accounts.map((account) => this.accountResource(principal, account.id)).filter((row) => row !== null),
    });
  }

  getAccount(
    principal: BffPrincipal,
    accountId: string,
    requestId: string,
  ): ConsumerAccountResource | BffErrorEnvelope {
    const account = this.deps.accounts.getAccount(accountId);
    if (!account) {
      return bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: 'account not found',
        retryable: false,
        requestId,
      });
    }
    if (account.ownerId !== principal.customerId) {
      return bffError({
        errorCode: 'RESOURCE_NOT_OWNED',
        category: 'AUTHORIZATION',
        message: 'account is not owned by the authenticated customer',
        retryable: false,
        requestId,
      });
    }
    return this.accountResource(principal, accountId)!;
  }

  accountActivity(
    principal: BffPrincipal,
    accountId: string,
    requestId: string,
    cursor: string | undefined,
    pageSize: number,
  ): ResourceField<CursorPage<ConsumerActivityItem>> | BffErrorEnvelope {
    const owned = this.getAccount(principal, accountId, requestId);
    if ('errorCode' in owned) {
      return owned;
    }
    const items = this.activityItems(principal, accountId);
    const page = paginate(items, `activity:${accountId}`, cursor, pageSize);
    if ('error' in page) {
      return bffError({
        errorCode: 'INVALID_PAGINATION_CURSOR',
        category: 'VALIDATION',
        message: 'pagination cursor is opaque and invalid',
        retryable: false,
        requestId,
      });
    }
    return resourceField({
      state: page.items.length === 0 ? 'EMPTY' : 'READY',
      availability: 'AVAILABLE_SIMULATION',
      value: page,
    });
  }

  home(principal: BffPrincipal, requestId: string): HomeResource | BffErrorEnvelope {
    void requestId;
    const prefs = this.deps.preferences.get(principal.customerId);
    const position = this.deps.accounts.customerPosition(principal.customerId);
    const activity = paginate(this.activityItems(principal), `home:${principal.customerId}`, undefined, 5);
    const activityPage = 'error' in activity ? { items: [], nextCursor: null, hasMore: false } : activity;

    const wealthUnavailable =
      position.kind !== 'POSITION'
        ? resourceField<{
            readonly total: MoneyView;
            readonly currency: string;
            readonly classBreakdown: {
              readonly cash: MoneyView;
              readonly investments: MoneyView;
              readonly digitalAssets: MoneyView;
              readonly rewards: MoneyView;
              readonly pending: MoneyView;
            };
          }>({
            state: position.kind === 'CURRENCY_INDEXED' ? 'MIXED_CURRENCY_WITHOUT_CONVERSION' : 'SERVICE_UNAVAILABLE',
            availability: 'AVAILABLE_SIMULATION',
            reason:
              position.kind === 'CURRENCY_INDEXED'
                ? `mixed currencies ${position.currencies.join(',')} without an explicit conversion`
                : position.reason,
          })
        : resourceField({
            state: 'READY',
            availability: 'AVAILABLE_SIMULATION',
            value: {
              total: moneyView(position.position.grandTotal.currency, position.position.grandTotal.minorUnits),
              currency: position.position.grandTotal.currency,
              classBreakdown: {
                cash: moneyView(position.position.breakdown.deposits.total.currency, position.position.breakdown.deposits.total.minorUnits),
                investments: moneyView(position.position.breakdown.investments.total.currency, position.position.breakdown.investments.total.minorUnits),
                digitalAssets: moneyView(position.position.breakdown.digital_assets.total.currency, position.position.breakdown.digital_assets.total.minorUnits),
                rewards: moneyView(position.position.breakdown.rewards.total.currency, position.position.breakdown.rewards.total.minorUnits),
                pending: moneyView(position.position.breakdown.pending.total.currency, position.position.breakdown.pending.total.minorUnits),
              },
            },
          });

    const bucketField = (bucket: 'deposits' | 'investments' | 'digital_assets'): ResourceField<MoneyView> => {
      if (position.kind !== 'POSITION') {
        return resourceField({
          state: position.kind === 'CURRENCY_INDEXED' ? 'MIXED_CURRENCY_WITHOUT_CONVERSION' : 'SERVICE_UNAVAILABLE',
          availability: 'AVAILABLE_SIMULATION',
          reason: position.kind === 'CURRENCY_INDEXED' ? 'refusing a blended class total across currencies' : position.reason,
        });
      }
      const money = position.position.breakdown[bucket].total;
      return resourceField({
        state: 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: moneyView(money.currency, money.minorUnits),
      });
    };

    const grow = this.optionalSummary(this.deps.grow?.summarize(principal), 'Grow My Money is a simulation laboratory path');
    const agent = this.optionalSummary(this.deps.agent?.summarize(principal), 'agent recommendations are proposals only');
    const notifications = this.deps.notifications?.summarize(principal);
    const alerts = this.deps.security?.alerts(principal) ?? [];
    const actions = this.deps.actions?.list(principal) ?? [];

    return Object.freeze({
      schema: 'sunrey.consumer.home.v1',
      generatedAt: this.deps.now(),
      user: resourceField({
        state: 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: {
          customerId: principal.customerId,
          displayLabel: prefs.displayLabel,
          verification: principal.verification,
          jurisdiction: principal.jurisdiction,
        },
      }),
      wealth: wealthUnavailable,
      cash: bucketField('deposits'),
      investments: bucketField('investments'),
      digitalAssets: bucketField('digital_assets'),
      recentActivity: resourceField({
        state: activityPage.items.length === 0 ? 'EMPTY' : 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: activityPage,
      }),
      grow: resourceField({
        state: grow.state,
        availability: grow.availability,
        reason: grow.reason,
        value: grow.state === 'READY' || grow.state === 'SIMULATION_ONLY' ? { summary: grow.reason, planCount: grow.count ?? 0 } : null,
      }),
      agent: resourceField({
        state: agent.state,
        availability: agent.availability,
        reason: agent.reason,
        value:
          agent.state === 'READY' || agent.state === 'SIMULATION_ONLY' || agent.state === 'EMPTY'
            ? { recommendationCount: agent.count ?? 0 }
            : null,
      }),
      pendingApprovals: resourceField({
        state: actions.length === 0 ? 'EMPTY' : 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: actions,
      }),
      notifications: resourceField({
        state: notifications?.state ?? 'FEATURE_DISABLED',
        availability: notifications?.availability ?? 'NOT_YET_PRODUCTIZED',
        reason: notifications?.reason ?? 'notification store is not productized',
        value:
          notifications && (notifications.state === 'READY' || notifications.state === 'EMPTY' || notifications.state === 'SIMULATION_ONLY')
            ? { unreadCount: notifications.unreadCount ?? 0 }
            : null,
      }),
      securityAlerts: resourceField({
        state: alerts.length === 0 ? 'EMPTY' : 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: alerts,
      }),
      cards: this.cardsHomeField(principal),
    });
  }

  bootstrap(principal: BffPrincipal): BootstrapResource {
    const prefs = this.deps.preferences.get(principal.customerId);
    const actions = this.deps.actions?.list(principal) ?? [];
    const notifications = this.deps.notifications?.summarize(principal);
    return Object.freeze({
      schema: 'sunrey.consumer.bootstrap.v1',
      generatedAt: this.deps.now(),
      profile: resourceField({
        state: 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: {
          customerId: principal.customerId,
          identityId: principal.identityId,
          verification: principal.verification,
          jurisdiction: principal.jurisdiction,
          displayLabel: prefs.displayLabel,
        },
      }),
      session: resourceField({
        state: 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: {
          sessionId: principal.sessionId,
          deviceId: principal.deviceSummary.deviceId,
          risk: principal.risk,
        },
      }),
      capabilities: this.capabilities(principal),
      pendingActions: resourceField({
        state: actions.length === 0 ? 'EMPTY' : 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: actions,
      }),
      notifications: resourceField({
        state: notifications?.state ?? 'FEATURE_DISABLED',
        availability: notifications?.availability ?? 'NOT_YET_PRODUCTIZED',
        reason: notifications?.reason ?? 'notification store is not productized',
        value:
          notifications && (notifications.state === 'READY' || notifications.state === 'EMPTY' || notifications.state === 'SIMULATION_ONLY')
            ? { unreadCount: notifications.unreadCount ?? 0 }
            : null,
      }),
      application: Object.freeze({
        environment: ENVIRONMENT,
        productionActivated: false,
        liveMoneyEnabled: false,
        productName: 'SunRey',
        supportedCurrencies: Object.freeze(['USD', 'GBP', 'EUR', 'SAR', 'AED']),
        supportedAssets: Object.freeze(['FIAT', 'SUNREY_COIN', 'MOONREY_COIN']),
      }),
    });
  }

  catalog() {
    return Object.freeze({
      resources: CONSUMER_RESOURCE_CATALOG,
      environment: ENVIRONMENT,
      liveFlags: CAPABILITIES,
    });
  }

  featureStub(group: string, principal: BffPrincipal): {
    readonly group: string;
    readonly availability: ProductAvailability;
    readonly state: ClientResourceState;
    readonly reason: string;
    readonly items: readonly unknown[];
  } {
    const capabilities = this.capabilities(principal);
    if (group === 'cards') {
      return this.listCards(principal);
    }
    const mapped = stubAvailability(group, capabilities);
    return Object.freeze({
      group,
      availability: mapped.availability,
      state: mapped.state,
      reason: mapped.reason,
      items: Object.freeze([] as const),
    });
  }

  listCards(principal: BffPrincipal): {
    readonly group: 'cards';
    readonly schema: 'sunrey.consumer.cards.v1';
    readonly availability: ProductAvailability;
    readonly state: ClientResourceState;
    readonly reason: string;
    readonly productionIssuing: false;
    readonly items: readonly unknown[];
  } {
    const capabilities = this.capabilities(principal);
    const detail = capabilities.details.cards;
    if (!this.deps.cardFacade || !detail.enabled) {
      return Object.freeze({
        group: 'cards',
        schema: 'sunrey.consumer.cards.v1',
        availability: detail.availability,
        state: detail.state,
        reason: detail.reason,
        productionIssuing: false,
        items: Object.freeze([] as const),
      });
    }
    const items = this.deps.cardFacade.list(principal.customerId);
    return Object.freeze({
      group: 'cards',
      schema: 'sunrey.consumer.cards.v1',
      availability: 'AVAILABLE_SIMULATION',
      state: items.length === 0 ? 'EMPTY' : 'SIMULATION_ONLY',
      reason: 'simulated card issuing; live processors are not connected',
      productionIssuing: false,
      items,
    });
  }

  getCard(principal: BffPrincipal, cardId: string, requestId: string) {
    if (!this.deps.cardFacade) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'cards are not connected',
        retryable: false,
        requestId,
      });
    }
    const result = this.deps.cardFacade.detail(principal.customerId, cardId);
    return this.mutationResult(result, requestId);
  }

  issueCard(principal: BffPrincipal, body: Record<string, unknown>, requestId: string) {
    if (!this.deps.cardFacade) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'cards are not connected',
        retryable: false,
        requestId,
      });
    }
    const accountId = typeof body.fundingAccountId === 'string' ? body.fundingAccountId : '';
    const form = body.form === 'PHYSICAL' ? 'PHYSICAL' : 'VIRTUAL';
    if (!accountId) {
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'fundingAccountId is required',
        retryable: false,
        requestId,
      });
    }
    const owned = this.deps.accounts.getAccount(accountId);
    if (!owned || owned.ownerId !== principal.customerId) {
      return bffError({
        errorCode: 'RESOURCE_NOT_OWNED',
        category: 'AUTHORIZATION',
        message: 'funding account is not owned by the authenticated customer',
        retryable: false,
        requestId,
      });
    }
    return this.mutationResult(
      this.deps.cardFacade.issue({
        actorId: principal.actorId,
        customerId: principal.customerId,
        accountId,
        form,
        cardId: typeof body.cardId === 'string' && body.cardId.length > 0 ? body.cardId : `card_${requestId}`,
        idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : `issue_${requestId}`,
        requestId,
      }),
      requestId,
    );
  }

  freezeCard(principal: BffPrincipal, cardId: string, requestId: string) {
    return this.cardAction(principal, cardId, requestId, (facade) =>
      facade.freeze({ actorId: principal.actorId, customerId: principal.customerId, cardId, requestId }),
    );
  }

  unfreezeCard(principal: BffPrincipal, cardId: string, requestId: string) {
    return this.cardAction(principal, cardId, requestId, (facade) =>
      facade.unfreeze({ actorId: principal.actorId, customerId: principal.customerId, cardId, requestId }),
    );
  }

  patchCardControls(principal: BffPrincipal, cardId: string, body: Record<string, unknown>, requestId: string) {
    return this.cardAction(principal, cardId, requestId, (facade) =>
      facade.updateControls({
        actorId: principal.actorId,
        customerId: principal.customerId,
        cardId,
        requestId,
        patch: body,
      }),
    );
  }

  cardWallet(principal: BffPrincipal, cardId: string, requestId: string) {
    if (!this.deps.cardFacade) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'cards are not connected',
        retryable: false,
        requestId,
      });
    }
    return this.mutationResult(this.deps.cardFacade.walletStatus(principal.customerId, cardId), requestId);
  }

  private cardAction(
    principal: BffPrincipal,
    cardId: string,
    requestId: string,
    run: (facade: CardsMutationPort) =>
      | { readonly ok: true; readonly value: unknown }
      | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number },
  ) {
    if (!this.deps.cardFacade) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'cards are not connected',
        retryable: false,
        requestId,
      });
    }
    void cardId;
    return this.mutationResult(run(this.deps.cardFacade), requestId);
  }

  private mutationResult(
    result:
      | { readonly ok: true; readonly value: unknown }
      | { readonly ok: false; readonly code: string; readonly message: string; readonly httpStatus: number },
    requestId: string,
  ) {
    if (result.ok) {
      return result.value;
    }
    const errorCode =
      result.code === 'RESOURCE_NOT_OWNED'
        ? 'RESOURCE_NOT_OWNED'
        : result.code === 'STEP_UP_REQUIRED'
          ? 'STEP_UP_REQUIRED'
          : result.code === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : result.httpStatus === 403
              ? 'KERNEL_REFUSED'
              : 'VALIDATION';
    return bffError({
      errorCode,
      category:
        errorCode === 'RESOURCE_NOT_OWNED' || errorCode === 'STEP_UP_REQUIRED' || errorCode === 'KERNEL_REFUSED'
          ? 'AUTHORIZATION'
          : errorCode === 'NOT_FOUND'
            ? 'NOT_FOUND'
            : 'VALIDATION',
      message: result.message,
      retryable: false,
      requestId,
      detailsSafeForClient: { code: result.code },
    });
  }

  private cardsHomeField(principal: BffPrincipal) {
    const listed = this.listCards(principal);
    return resourceField({
      state: listed.state,
      availability: listed.availability,
      reason: listed.reason,
      value: { count: listed.items.length, items: listed.items },
    });
  }

  private accountResource(principal: BffPrincipal, accountId: string): ConsumerAccountResource | null {
    const account = this.deps.accounts.getAccount(accountId);
    if (!account || account.ownerId !== principal.customerId) {
      return null;
    }
    const position = this.deps.accounts.positionOf(account);
    const type = consumerAccountTypeOf(account);
    void ACCOUNT_CLASS_CATALOG;
    const balance = 'unavailable' in position
      ? resourceField<{
          readonly ledger: MoneyView;
          readonly available: MoneyView;
          readonly held: MoneyView;
          readonly pending: MoneyView;
        }>({
          state: position.unavailable === 'MIXED_CURRENCY' ? 'MIXED_CURRENCY_WITHOUT_CONVERSION' : 'SERVICE_UNAVAILABLE',
          availability: 'AVAILABLE_SIMULATION',
          reason: 'authoritative ledger read could not produce a single-currency balance',
        })
      : resourceField({
          state: 'READY',
          availability: 'AVAILABLE_SIMULATION',
          value: {
            ledger: moneyView(position.ledgerBalance.currency, position.ledgerBalance.minorUnits),
            available: moneyView(position.available.currency, position.available.minorUnits),
            held: moneyView(position.held.currency, position.held.minorUnits),
            pending: moneyView(position.pending.currency, position.pending.minorUnits),
          },
        });
    return Object.freeze({
      id: account.id,
      type,
      accountClass: account.accountClass,
      status: account.status,
      currency: account.currency,
      productId: account.productId,
      balance,
    });
  }

  private activityItems(principal: BffPrincipal, accountId?: string): readonly ConsumerActivityItem[] {
    return this.deps.accounts.activity(principal.customerId, accountId).map((item) =>
      Object.freeze({
        reference: item.reference,
        accountId: item.accountId,
        status: item.status,
        direction: item.direction,
        amount: moneyView(item.currency, item.amountMinorUnits),
        description: item.description,
        occurredAt: item.occurredAt,
      }),
    );
  }

  private optionalSummary(
    summary: ReturnType<NonNullable<OptionalDomainPort['summarize']>> | undefined,
    fallback: string,
  ) {
    return (
      summary ?? {
        availability: 'NOT_YET_PRODUCTIZED' as const,
        state: 'FEATURE_DISABLED' as const,
        provider: 'NOT_CONNECTED' as const,
        reason: fallback,
        count: 0,
      }
    );
  }
}

function stubAvailability(
  group: string,
  capabilities: FeatureCapabilityMap,
): { readonly availability: ProductAvailability; readonly state: ClientResourceState; readonly reason: string } {
  const key = group.toLowerCase();
  const detail =
    key === 'payments'
      ? capabilities.details.payments
      : key === 'fx'
        ? capabilities.details.fx
        : key === 'cards'
          ? capabilities.details.cards
          : key === 'grow'
            ? capabilities.details.grow
            : key === 'agent'
              ? capabilities.details.agent
              : key === 'exchange'
                ? capabilities.details.exchange
                : key === 'data'
                  ? capabilities.details.dataVault
                  : undefined;
  if (detail) {
    return { availability: detail.availability, state: detail.state, reason: detail.reason };
  }
  if (key === 'recipients' || key === 'goals' || key === 'wallets' || key === 'notifications') {
    return {
      availability: 'NOT_YET_PRODUCTIZED',
      state: 'FEATURE_DISABLED',
      reason: `${group} is not yet productized`,
    };
  }
  return {
    availability: 'AVAILABLE_SIMULATION',
    state: 'SIMULATION_ONLY',
    reason: `${group} is available as a simulation-only catalog`,
  };
}

export function memoryPreferenceStore(): PreferenceStore {
  const store = new Map<string, ConsumerPreferences>();
  return {
    get(customerId) {
      return store.get(customerId) ?? EMPTY_PREFERENCES;
    },
    patch(customerId, patch) {
      const current = store.get(customerId) ?? EMPTY_PREFERENCES;
      const next = Object.freeze({ ...current, ...patch });
      store.set(customerId, next);
      return next;
    },
  };
}

export { DEFAULT_PAGE_SIZE };
