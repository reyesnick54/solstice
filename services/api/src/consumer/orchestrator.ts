import { CAPABILITIES, ENVIRONMENT } from '../../../../packages/config/src/flags.ts';
import { ACCOUNT_CLASS_CATALOG } from '../../../../packages/domain/src/account-class.ts';
import type { UniversalProviderRuntime } from '../../../../packages/sunrey-chain/src/provider-runtime/universal/runtime.ts';
import { computeCapabilities } from './capabilities.ts';
import { mapIdentityVerificationClientState } from './session.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import { DEFAULT_PAGE_SIZE, paginate, type CursorPage } from './pagination.ts';
import { consumerAccountTypeOf } from './accounts-adapter.ts';
import { parseActivityFilter } from '../../../accounts/src/activity.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import type { ActionStatusResource } from './action-status.ts';
import type {
  AccountsReadPort,
  ActionPort,
  BffPrincipal,
  ConsumerPreferences,
  FeatureCapabilityMap,
  NotificationPort,
  CardsMutationPort,
  GrowCommandPort,
  OptionalDomainPort,
  PreferenceStore,
  SecurityPort,
} from './ports.ts';
import type { FxCommandPort } from './fx-adapter.ts';
import type { PresentationValuation } from '../../../../packages/payments/src/fx-valuation.ts';
import type { SupportedCurrency } from '../../../../packages/payments/src/fx-currency.ts';
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
  readonly activityId: string;
  readonly reference: string;
  readonly accountId: string;
  readonly type: string;
  readonly status: string;
  readonly direction: string;
  readonly amount: MoneyView;
  readonly currency: string;
  readonly description: string;
  readonly counterpartyDisplay: string | null;
  readonly category: string;
  readonly relatedActionId: string | null;
  readonly occurredAt: string;
  readonly completedAt: string | null;
  readonly fee: MoneyView | null;
};

export type ConsumerAccountResource = {
  readonly id: string;
  readonly type: ConsumerAccountType;
  readonly productType: string;
  readonly accountClass: string;
  readonly status: string;
  readonly domainStatus: string;
  readonly currency: string;
  readonly productId: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly jurisdiction: string;
  readonly owner: { readonly customerId: string; readonly ownershipKind: 'INDIVIDUAL' };
  readonly restrictions: readonly string[];
  readonly ledgerAccountReferences: readonly string[];
  readonly providerLink: { readonly providerId: string; readonly externalRef: string; readonly status: string } | null;
  readonly productConfiguration: {
    readonly licensingClaim: 'NOT_A_LICENSED_BANK_ACCOUNT';
    readonly environment: 'simulation';
    readonly liveBanking: false;
  };
  readonly balance: ResourceField<{
    readonly posted: MoneyView;
    readonly ledger: MoneyView;
    readonly available: MoneyView;
    readonly held: MoneyView;
    readonly pending: MoneyView;
    readonly currency: string;
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
  }> & {
    readonly valuation: {
      readonly currency: string;
      readonly status: 'AVAILABLE' | 'NOT_REQUIRED' | 'UNAVAILABLE';
      readonly currencies: readonly string[];
      readonly reason: string | null;
    };
  };
  readonly accounts: ResourceField<readonly ConsumerAccountResource[]>;
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
  readonly valuation: ResourceField<{
    readonly authority: 'PRESENTATION_ONLY_NOT_LEDGER';
    readonly ledgerAuthoritative: false;
    readonly targetCurrency: string;
    readonly asOf: string;
    readonly stale: boolean;
    readonly available: boolean;
    readonly reason: string | null;
    readonly aggregateMinorUnits: string | null;
    readonly rateTimestamp: string | null;
    readonly lines: PresentationValuation['lines'];
  }>;
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
  readonly accounts: ResourceField<readonly ConsumerAccountResource[]>;
};

export type ConsumerBffDeps = {
  readonly now: () => string;
  readonly accounts: AccountsReadPort;
  readonly preferences: PreferenceStore;
  readonly actions?: ActionPort;
  readonly notifications?: NotificationPort;
  readonly security?: SecurityPort;
  readonly grow?: OptionalDomainPort;
  readonly growCommands?: GrowCommandPort;
  readonly agent?: OptionalDomainPort;
  readonly exchange?: OptionalDomainPort;
  readonly payments?: OptionalDomainPort;
  readonly cards?: OptionalDomainPort;
  readonly cardFacade?: CardsMutationPort | undefined;
  readonly vault?: OptionalDomainPort;
  readonly fx?: OptionalDomainPort;
  readonly fxEngine?: FxCommandPort;
  readonly providerDown?: Readonly<Record<string, boolean>>;
  readonly providerRuntime?: UniversalProviderRuntime;
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
      ...(this.deps.providerRuntime ? { providerRuntime: this.deps.providerRuntime } : {}),
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
      identityVerification: mapIdentityVerificationClientState(principal.verification),
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
    const accounts = this.deps.accounts.listFinancialAccounts(principal.customerId);
    return Object.freeze({
      items: accounts
        .map((account) => this.accountResource(principal, account.accountId))
        .filter((row): row is ConsumerAccountResource => row !== null),
    });
  }

  getAccount(
    principal: BffPrincipal,
    accountId: string,
    requestId: string,
  ): ConsumerAccountResource | BffErrorEnvelope {
    const authorized = this.deps.accounts.authorizeRead(accountId, principal.customerId, principal.identityId);
    if ('error' in authorized) {
      return bffError({
        errorCode: authorized.error,
        category: authorized.error === 'NOT_FOUND' ? 'NOT_FOUND' : 'AUTHORIZATION',
        message:
          authorized.error === 'NOT_FOUND'
            ? 'account not found'
            : 'account is not owned by the authenticated customer',
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
    query: Readonly<Record<string, string>> = {},
  ): ResourceField<CursorPage<ConsumerActivityItem>> | BffErrorEnvelope {
    const owned = this.getAccount(principal, accountId, requestId);
    if ('errorCode' in owned) {
      return owned;
    }
    const filter = parseActivityFilter(query);
    if ('error' in filter) {
      return bffError({
        errorCode: 'INVALID_FILTER',
        category: 'VALIDATION',
        message: filter.error,
        retryable: false,
        requestId,
      });
    }
    const items = this.activityItems(principal, accountId, filter);
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

  accountStatement(
    principal: BffPrincipal,
    accountId: string,
    requestId: string,
    periodStart: string | undefined,
    periodEnd: string | undefined,
  ) {
    const owned = this.getAccount(principal, accountId, requestId);
    if ('errorCode' in owned) {
      return owned;
    }
    if (!periodStart || !periodEnd || Number.isNaN(Date.parse(periodStart)) || Number.isNaN(Date.parse(periodEnd))) {
      return bffError({
        errorCode: 'INVALID_PERIOD',
        category: 'VALIDATION',
        message: 'statement requires periodStart and periodEnd as ISO-8601 instants',
        retryable: false,
        requestId,
      });
    }
    const statement = this.deps.accounts.statement(accountId, asUtcInstant(periodStart), asUtcInstant(periodEnd));
    if ('error' in statement) {
      return bffError({
        errorCode: 'INVALID_PERIOD',
        category: 'VALIDATION',
        message: statement.error,
        retryable: false,
        requestId,
      });
    }
    return resourceField({
      state: 'READY',
      availability: 'AVAILABLE_SIMULATION',
      value: {
        statementId: statement.id,
        accountId: statement.accountId,
        currency: statement.currency,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        opening: moneyView(statement.currency, statement.openingMinorUnits),
        closing: moneyView(statement.currency, statement.closingMinorUnits),
        credits: moneyView(statement.currency, statement.creditsMinorUnits),
        debits: moneyView(statement.currency, statement.debitsMinorUnits),
        fees: moneyView(statement.currency, 0n),
        transactions: statement.lines.map((line) =>
          Object.freeze({
            postedAt: line.postedAt,
            direction: line.direction,
            amount: moneyView(line.currency, line.amountMinorUnits),
            description: line.description,
            reference: line.transactionReference,
          }),
        ),
        generatedAt: statement.generatedAt,
      },
    });
  }

  home(principal: BffPrincipal, requestId: string, valuationCurrency = 'USD'): HomeResource | BffErrorEnvelope {
    void requestId;
    const prefs = this.deps.preferences.get(principal.customerId);
    const wealth = this.deps.accounts.wealth(principal.customerId, valuationCurrency);
    const activity = paginate(this.activityItems(principal), `home:${principal.customerId}`, undefined, 5);
    const activityPage = 'error' in activity ? { items: [], nextCursor: null, hasMore: false } : activity;
    const accountItems = this.listAccounts(principal).items;

    const wealthField: HomeResource['wealth'] =
      wealth.kind !== 'POSITION'
        ? Object.freeze({
            ...resourceField<{
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
              state: wealth.currencies.length > 1 ? 'MIXED_CURRENCY_WITHOUT_CONVERSION' : 'VALUATION_UNAVAILABLE',
              availability: 'AVAILABLE_SIMULATION',
              reason: wealth.reason,
            }),
            valuation: Object.freeze({
              currency: wealth.valuationCurrency,
              status: wealth.valuationStatus,
              currencies: wealth.currencies,
              reason: wealth.reason,
            }),
          })
        : Object.freeze({
            ...resourceField({
              state: 'READY' as const,
              availability: 'AVAILABLE_SIMULATION' as const,
              value: {
                total: moneyView(wealth.position.grandTotal.currency, wealth.position.grandTotal.minorUnits),
                currency: wealth.position.grandTotal.currency,
                classBreakdown: {
                  cash: moneyView(wealth.position.breakdown.deposits.total.currency, wealth.position.breakdown.deposits.total.minorUnits),
                  investments: moneyView(wealth.position.breakdown.investments.total.currency, wealth.position.breakdown.investments.total.minorUnits),
                  digitalAssets: moneyView(wealth.position.breakdown.digital_assets.total.currency, wealth.position.breakdown.digital_assets.total.minorUnits),
                  rewards: moneyView(wealth.position.breakdown.rewards.total.currency, wealth.position.breakdown.rewards.total.minorUnits),
                  pending: moneyView(wealth.position.breakdown.pending.total.currency, wealth.position.breakdown.pending.total.minorUnits),
                },
              },
            }),
            valuation: Object.freeze({
              currency: wealth.valuationCurrency,
              status: wealth.valuationStatus,
              currencies: [wealth.valuationCurrency],
              reason: null,
            }),
          });

    const bucketField = (bucket: 'deposits' | 'investments' | 'digital_assets'): ResourceField<MoneyView> => {
      if (wealth.kind !== 'POSITION') {
        return resourceField({
          state: wealth.currencies.length > 1 ? 'MIXED_CURRENCY_WITHOUT_CONVERSION' : 'VALUATION_UNAVAILABLE',
          availability: 'AVAILABLE_SIMULATION',
          reason: wealth.reason,
        });
      }
      const money = wealth.position.breakdown[bucket].total;
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
          identityVerification: mapIdentityVerificationClientState(principal.verification),
          jurisdiction: principal.jurisdiction,
        },
      }),
      wealth: wealthField,
      accounts: resourceField({
        state: accountItems.length === 0 ? 'EMPTY' : 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: accountItems,
      }),
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
      valuation: this.valuationField(principal, 'USD'),
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
          identityVerification: mapIdentityVerificationClientState(principal.verification),
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
      accounts: resourceField({
        state: this.listAccounts(principal).items.length === 0 ? 'EMPTY' : 'READY',
        availability: 'AVAILABLE_SIMULATION',
        value: this.listAccounts(principal).items,
      }),
    });
  }

  listFxCurrencies(): { readonly items: readonly SupportedCurrency[]; readonly liveEnabled: false } {
    return Object.freeze({
      items: this.deps.fxEngine?.listCurrencies() ?? [],
      liveEnabled: false,
    });
  }

  getFxQuote(principal: BffPrincipal, quoteId: string, requestId: string) {
    void principal;
    const quote = this.deps.fxEngine?.getQuote(quoteId);
    if (!quote) {
      return bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: 'FX quote not found',
        retryable: false,
        requestId,
      });
    }
    return quote;
  }

  createFxQuote(principal: BffPrincipal, body: Record<string, unknown>, requestId: string) {
    if (!this.deps.fxEngine) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'FX engine is not attached to this BFF',
        retryable: false,
        requestId,
      });
    }
    const sourceAccountId = stringField(body, 'sourceAccountId') ?? stringField(body, 'accountId');
    const sourceCurrency = stringField(body, 'sourceCurrency');
    const destinationCurrency = stringField(body, 'destinationCurrency');
    const sourceAmountMinorUnits = stringField(body, 'sourceAmountMinorUnits');
    if (!sourceAccountId || !sourceCurrency || !destinationCurrency || !sourceAmountMinorUnits) {
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'sourceAccountId, sourceCurrency, destinationCurrency, and sourceAmountMinorUnits are required',
        retryable: false,
        requestId,
      });
    }
    if (!/^-?\d+$/.test(sourceAmountMinorUnits)) {
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'sourceAmountMinorUnits must be an integer string of minor units',
        retryable: false,
        requestId,
      });
    }
    const owned = this.getAccount(principal, sourceAccountId, requestId);
    if ('errorCode' in owned) {
      return owned;
    }
    const corridorId = stringField(body, 'corridorId') ?? defaultCorridor(sourceCurrency, destinationCurrency);
    const quoteId = stringField(body, 'quoteId') ?? `q_${requestId}`;
    return this.fxOutcome(
      this.deps.fxEngine.createQuote(principal, {
        quoteId,
        accountId: sourceAccountId,
        sourceCurrency,
        destinationCurrency,
        sourceAmountMinorUnits,
        corridorId,
      }),
      requestId,
    );
  }

  acceptFxQuote(principal: BffPrincipal, quoteId: string, body: Record<string, unknown>, requestId: string) {
    if (!this.deps.fxEngine) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'FX engine is not attached to this BFF',
        retryable: false,
        requestId,
      });
    }
    const accountId = stringField(body, 'accountId') ?? stringField(body, 'sourceAccountId');
    if (!accountId) {
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'accountId is required to approve a quote',
        retryable: false,
        requestId,
      });
    }
    return this.fxOutcome(this.deps.fxEngine.acceptQuote(principal, quoteId, accountId), requestId);
  }

  executeFxQuote(principal: BffPrincipal, quoteId: string, body: Record<string, unknown>, requestId: string) {
    if (!this.deps.fxEngine) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'POLICY',
        message: 'FX engine is not attached to this BFF',
        retryable: false,
        requestId,
      });
    }
    const sourceAccountId = stringField(body, 'sourceAccountId') ?? stringField(body, 'accountId');
    const destinationAccountId = stringField(body, 'destinationAccountId');
    if (!sourceAccountId || !destinationAccountId) {
      return bffError({
        errorCode: 'VALIDATION',
        category: 'VALIDATION',
        message: 'sourceAccountId and destinationAccountId are required',
        retryable: false,
        requestId,
      });
    }
    const source = this.getAccount(principal, sourceAccountId, requestId);
    if ('errorCode' in source) {
      return source;
    }
    const dest = this.getAccount(principal, destinationAccountId, requestId);
    if ('errorCode' in dest) {
      return dest;
    }
    return this.fxOutcome(this.deps.fxEngine.executeQuote(principal, quoteId, sourceAccountId, destinationAccountId), requestId);
  }

  valuation(principal: BffPrincipal, targetCurrency = 'USD') {
    return this.valuationField(principal, targetCurrency);
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

  growProfile(principal: BffPrincipal, valuationCurrency?: string): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('grow', principal);
    }
    return this.deps.growCommands.profile(principal, valuationCurrency);
  }

  growSnapshot(principal: BffPrincipal, valuationCurrency?: string): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('grow', principal);
    }
    return this.deps.growCommands.snapshot(principal, valuationCurrency);
  }

  growGoals(principal: BffPrincipal): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('goals', principal);
    }
    return this.deps.growCommands.listGoals(principal);
  }

  createGrowGoal(principal: BffPrincipal, body: Record<string, unknown>, requestId: string): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'VALIDATION',
        message: 'Grow goals are not attached',
        retryable: false,
        requestId,
      });
    }
    return this.deps.growCommands.createGoal(principal, body, requestId);
  }

  patchGrowGoal(
    principal: BffPrincipal,
    goalId: string,
    body: Record<string, unknown>,
    requestId: string,
  ): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'VALIDATION',
        message: 'Grow goals are not attached',
        retryable: false,
        requestId,
      });
    }
    return this.deps.growCommands.patchGoal(principal, goalId, body, requestId);
  }

  growInsights(principal: BffPrincipal): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('grow', principal);
    }
    return this.deps.growCommands.insights(principal);
  }

  growSuitability(principal: BffPrincipal): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('grow', principal);
    }
    return this.deps.growCommands.suitability(principal);
  }

  submitGrowSuitability(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'VALIDATION',
        message: 'Grow suitability is not attached',
        retryable: false,
        requestId,
      });
    }
    return this.deps.growCommands.submitSuitability(principal, body, requestId);
  }

  declareGrowAssumption(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'VALIDATION',
        message: 'Grow declarations are not attached',
        retryable: false,
        requestId,
      });
    }
    return this.deps.growCommands.declareAssumption(principal, body, requestId);
  }

  correctGrowClassification(
    principal: BffPrincipal,
    body: Record<string, unknown>,
    requestId: string,
  ): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return bffError({
        errorCode: 'FEATURE_UNAVAILABLE',
        category: 'VALIDATION',
        message: 'Grow corrections are not attached',
        retryable: false,
        requestId,
      });
    }
    return this.deps.growCommands.correctClassification(principal, body, requestId);
  }

  growHistory(principal: BffPrincipal, series?: string): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('grow', principal);
    }
    return this.deps.growCommands.history(principal, series);
  }

  growAgentProfile(principal: BffPrincipal): unknown | BffErrorEnvelope {
    if (!this.deps.growCommands) {
      return this.featureStub('agent', principal);
    }
    return this.deps.growCommands.agentProfile(principal);
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
    if (!this.deps.cardFacade || !detail || !detail.enabled) {
      return Object.freeze({
        group: 'cards',
        schema: 'sunrey.consumer.cards.v1',
        availability: detail?.availability ?? 'AVAILABLE_SIMULATION',
        state: detail?.state ?? 'FEATURE_DISABLED',
        reason: detail?.reason ?? 'cards are not connected',
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
    const financial = this.deps.accounts.financialAccount(accountId);
    const account = this.deps.accounts.getAccount(accountId);
    if (!financial || !account || account.ownerId !== principal.customerId) {
      return null;
    }
    const position = this.deps.accounts.positionOf(account);
    const type = consumerAccountTypeOf(account);
    void ACCOUNT_CLASS_CATALOG;
    const balance = 'unavailable' in position
      ? resourceField<{
          readonly posted: MoneyView;
          readonly ledger: MoneyView;
          readonly available: MoneyView;
          readonly held: MoneyView;
          readonly pending: MoneyView;
          readonly currency: string;
        }>({
          state: position.unavailable === 'MIXED_CURRENCY' ? 'MIXED_CURRENCY_WITHOUT_CONVERSION' : 'SERVICE_UNAVAILABLE',
          availability: 'AVAILABLE_SIMULATION',
          reason: 'authoritative ledger read could not produce a single-currency balance',
        })
      : resourceField({
          state: 'READY',
          availability: 'AVAILABLE_SIMULATION',
          value: {
            posted: moneyView(position.posted.currency, position.posted.minorUnits),
            ledger: moneyView(position.ledgerBalance.currency, position.ledgerBalance.minorUnits),
            available: moneyView(position.available.currency, position.available.minorUnits),
            held: moneyView(position.held.currency, position.held.minorUnits),
            pending: moneyView(position.pending.currency, position.pending.minorUnits),
            currency: position.currency,
          },
        });
    return Object.freeze({
      id: financial.accountId,
      type,
      productType: financial.productType,
      accountClass: financial.accountClass,
      status: financial.status,
      domainStatus: financial.domainStatus,
      currency: financial.currency,
      productId: financial.productId,
      openedAt: financial.openedAt,
      closedAt: financial.closedAt,
      jurisdiction: financial.jurisdiction,
      owner: financial.owner,
      restrictions: financial.restrictions.filter((row) => row.state === 'ACTIVE').map((row) => row.code),
      ledgerAccountReferences: financial.ledgerAccountReferences,
      providerLink: financial.providerLink,
      productConfiguration: financial.productConfiguration,
      balance,
    });
  }

  private activityItems(
    principal: BffPrincipal,
    accountId?: string,
    filter?: import('../../../accounts/src/activity.ts').ActivityFilter,
  ): readonly ConsumerActivityItem[] {
    return this.deps.accounts.activity(principal.customerId, accountId, filter).map((item) =>
      Object.freeze({
        activityId: item.activityId,
        reference: item.reference,
        accountId: item.accountId,
        type: item.type,
        status: item.status,
        direction: item.direction,
        amount: moneyView(item.currency, item.amountMinorUnits),
        currency: item.currency,
        description: item.description,
        counterpartyDisplay: item.counterpartyDisplay,
        category: item.category,
        relatedActionId: item.relatedActionId,
        occurredAt: item.occurredAt,
        completedAt: item.completedAt,
        fee: item.feeMinorUnits !== null && item.feeCurrency ? moneyView(item.feeCurrency, item.feeMinorUnits) : null,
      }),
    );
  }

  private valuationField(principal: BffPrincipal, targetCurrency: string) {
    if (!this.deps.fxEngine) {
      return resourceField<{
        readonly authority: 'PRESENTATION_ONLY_NOT_LEDGER';
        readonly ledgerAuthoritative: false;
        readonly targetCurrency: string;
        readonly asOf: string;
        readonly stale: boolean;
        readonly available: boolean;
        readonly reason: string | null;
        readonly aggregateMinorUnits: string | null;
        readonly rateTimestamp: string | null;
        readonly lines: PresentationValuation['lines'];
      }>({
        state: 'SERVICE_UNAVAILABLE',
        availability: 'AVAILABLE_SIMULATION',
        reason: 'presentation valuation requires the FX engine',
      });
    }
    const positions = this.deps.accounts.listAccounts(principal.customerId).flatMap((account) => {
      const position = this.deps.accounts.positionOf(account);
      if ('unavailable' in position) {
        return [];
      }
      return [{ currency: account.currency, minorUnits: position.ledgerBalance.minorUnits }];
    });
    const valuation = this.deps.fxEngine.valuePositions(positions, targetCurrency);
    const rateTimestamp = valuation.lines.find((line) => line.available)?.rateTimestamp ?? null;
    return resourceField({
      state: !valuation.available ? 'SERVICE_UNAVAILABLE' : valuation.stale ? 'SIMULATION_ONLY' : 'READY',
      availability: 'AVAILABLE_SIMULATION',
      reason: valuation.reason ?? 'presentation/reporting only; not Ledger accounting authority',
      value: {
        authority: 'PRESENTATION_ONLY_NOT_LEDGER' as const,
        ledgerAuthoritative: false as const,
        targetCurrency: valuation.targetCurrency,
        asOf: valuation.asOf,
        stale: valuation.stale,
        available: valuation.available,
        reason: valuation.reason,
        aggregateMinorUnits: valuation.aggregateMinorUnits,
        rateTimestamp,
        lines: valuation.lines,
      },
    });
  }

  private fxOutcome<T>(
    outcome: import('../../../../packages/payments/src/service.ts').PaymentsServiceOutcome<T>,
    requestId: string,
  ) {
    if (outcome.outcome === 'OK') {
      return outcome.value;
    }
    if (outcome.outcome === 'KERNEL_REFUSED') {
      return bffError({
        errorCode: 'KERNEL_DENIED',
        category: 'AUTHORIZATION',
        message: 'Compliance Kernel refused this FX action',
        retryable: false,
        requestId,
        detailsSafeForClient: { status: outcome.decision.status },
      });
    }
    return bffError({
      errorCode: 'VALIDATION',
      category: outcome.code === 'QUOTE_EXPIRED' || outcome.code === 'INSUFFICIENT_FUNDS' ? 'POLICY' : 'VALIDATION',
      message: outcome.message,
      retryable: false,
      requestId,
      detailsSafeForClient: { code: outcome.code },
    });
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

function stringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function defaultCorridor(source: string, destination: string): string {
  if (source === 'USD' && destination === 'SAR') {
    return 'GB-SA-USD-SAR';
  }
  if (source === 'SAR' && destination === 'USD') {
    return 'GB-US-SAR-USD';
  }
  return `${source}-${destination}`;
}

export { DEFAULT_PAGE_SIZE };
