/**
 * Consumer platform HTTP runtime.
 *
 * CLIENT → API/BFF → authentication → authorization context → domain
 * service → Kernel → Execution Authority → Ledger → Evidence → Events
 *
 * This service does not mint Execution Authority, write journals, or
 * calculate authoritative balances itself.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { ENVIRONMENT } from '../../../packages/config/src/flags.ts';
import { addMs } from '../../../packages/config/src/clock.ts';
import {
  asCustomerId,
  createProspect,
  notStartedVerification,
  transitionCustomerStatus,
} from '../../../packages/domain/src/customer.ts';
import { asAccountId } from '../../../packages/domain/src/account.ts';
import { asCurrencyCode } from '../../../packages/domain/src/currency.ts';
import { asJurisdiction, asResidency } from '../../../packages/domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../../packages/domain/src/legal-entity.ts';
import { asProductId } from '../../../packages/domain/src/product.ts';
import { asUtcInstant } from '../../../packages/domain/src/time.ts';
import { isOk } from '../../../packages/domain/src/result.ts';
import type { IdentitySession } from '../../../packages/identity/src/auth.ts';
import { asChallengeId, asSessionId, asDeviceId, asSolsticeIdentityId } from '../../../packages/identity/src/ids.ts';
import { ACTION_TYPES, type OpenAccountIntent } from '../../../packages/permissions/src/action-types.ts';
import { asIntentId } from '../../../packages/permissions/src/action-intent.ts';
import { newSecurityToken } from '../../../packages/security/src/random.ts';
import {
  CONSUMER_API_VERSION,
  CONSUMER_FEATURE_IDS,
  categoryForConsumerCode,
  consumerError,
  type AccountDto,
  type ActionDecisionDto,
  type ActivityItemDto,
  type ApprovalDto,
  type BootstrapDto,
  type CapabilityDto,
  type ConsumerErrorCode,
  type ConsumerErrorEnvelope,
  type CustomerPositionDto,
  type DeviceDto,
  type FeatureFlagDto,
  type IntegrationEnvironment,
  type MoneyDto,
  type SessionDto,
  type TokenResponse,
} from '../../../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { balanceOfAccount, projectCustomerPosition } from '../../accounts/src/balances.ts';
import { projectBankingPosition } from '../../accounts/src/available-funds.ts';
import { createSimulationRuntime, type SimulationRuntime } from '../../accounts/src/runtime.ts';
import { PERSONA_DEFINITIONS, personaById, sandboxPersonasAllowed } from './personas.ts';
import { ConsumerWorkflowStore, assertSimulationWebhookUrl } from './workflows.ts';

const ACTOR_CONTEXT_TTL_SEC = 15 * 60;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ENABLED_FEATURES = new Set(['home', 'accounts', 'activity', 'capabilities', 'approvals', 'webhooks']);

export type ConsumerPlatformOptions = {
  readonly host?: string;
  readonly port?: number;
  readonly runtime?: SimulationRuntime;
  readonly allowSandboxPersonas?: boolean;
  readonly integrationEnvironment?: IntegrationEnvironment;
};

export type RunningConsumerPlatform = {
  readonly url: string;
  readonly apiVersion: typeof CONSUMER_API_VERSION;
  readonly runtime: SimulationRuntime;
  readonly close: () => Promise<void>;
};

type TokenRecord = {
  readonly accessToken: string;
  readonly sessionId: string;
  readonly actorId: string;
};

type AuthContext = {
  readonly session: IdentitySession;
  readonly token: TokenRecord;
};

function moneyDto(minorUnits: bigint, currency: string): MoneyDto {
  return Object.freeze({ minor_units: minorUnits.toString(), currency });
}

function emptyMoney(currency = 'USD'): MoneyDto {
  return moneyDto(0n, currency);
}

function sendJson(res: ServerResponse, status: number, body: unknown, requestId: string): void {
  const json = JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
    'x-sunrey-api-version': CONSUMER_API_VERSION,
    'x-sunrey-surface': 'CONSUMER_PLATFORM',
    'x-request-id': requestId,
  });
  res.end(json);
}

function fail(
  res: ServerResponse,
  status: number,
  requestId: string,
  code: ConsumerErrorCode,
  message: string,
  extras?: {
    readonly retryable?: boolean;
    readonly user_action_required?: boolean;
    readonly safe_to_display?: boolean;
    readonly details?: Readonly<Record<string, string>>;
  },
): void {
  const envelope: ConsumerErrorEnvelope = consumerError({
    error_code: code,
    category: categoryForConsumerCode(code),
    message,
    retryable: extras?.retryable === true,
    user_action_required: extras?.user_action_required === true,
    safe_to_display: extras?.safe_to_display !== false,
    request_id: requestId,
    ...(extras?.details ? { details_safe_for_client: extras.details } : {}),
  });
  sendJson(res, status, envelope, requestId);
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        oversized = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (oversized) {
        reject(new Error('OVERSIZED_REQUEST'));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function parseJsonBody(raw: string): Record<string, unknown> {
  if (raw.trim() === '') {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('VALIDATION_FAILED');
  }
  return parsed as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function encodeCursor(namespace: string, offset: number): string {
  return Buffer.from(`${namespace}|${offset}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined, namespace: string): number | 'INVALID' {
  if (cursor === undefined || cursor === '') {
    return 0;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [ns, offsetRaw] = decoded.split('|');
    const offset = Number(offsetRaw);
    if (ns !== namespace || !Number.isInteger(offset) || offset < 0) {
      return 'INVALID';
    }
    return offset;
  } catch {
    return 'INVALID';
  }
}

function pageSizeOf(raw: string | undefined): number | 'INVALID' {
  if (raw === undefined || raw === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 'INVALID';
  }
  if (parsed > MAX_PAGE_SIZE) {
    return 'INVALID';
  }
  return parsed;
}

function activateCustomer(runtime: SimulationRuntime, id: string) {
  const now = runtime.clock.now();
  let customer = createProspect({
    id: asCustomerId(id),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2027-08-13T00:00:00.000Z')),
    createdAt: now,
  });
  const pending = transitionCustomerStatus(customer, 'PENDING_VERIFICATION', now);
  if (!isOk(pending)) {
    throw new Error('customer pending transition failed');
  }
  customer = {
    ...pending.value.customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
    }),
  };
  const active = transitionCustomerStatus(customer, 'ACTIVE', now);
  if (!isOk(active)) {
    throw new Error('customer active transition failed');
  }
  runtime.customers.put(active.value.customer.id, active.value.customer);
  return active.value.customer;
}

function sessionDto(session: IdentitySession): SessionDto {
  return Object.freeze({
    session_id: session.sessionId,
    actor_id: session.actorId,
    identity_id: session.subjectId,
    expires_at: session.expiresAt,
    device_id: session.deviceId,
    assurance: session.authenticationStrength,
    revocation_state: session.revocationState,
  });
}

function tokenResponse(accessToken: string, session: IdentitySession): TokenResponse {
  return Object.freeze({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACTOR_CONTEXT_TTL_SEC,
    session: sessionDto(session),
    api_version: CONSUMER_API_VERSION,
  });
}

function featureFlags(): readonly FeatureFlagDto[] {
  return Object.freeze(
    CONSUMER_FEATURE_IDS.map((featureId) =>
      Object.freeze({
        feature_id: featureId,
        available: ENABLED_FEATURES.has(featureId),
        reason_code: ENABLED_FEATURES.has(featureId) ? null : 'FEATURE_UNAVAILABLE',
      }),
    ),
  );
}

function positionDto(
  runtime: SimulationRuntime,
  customerId: string,
): CustomerPositionDto | null {
  const customer = runtime.customers.get(asCustomerId(customerId));
  if (!customer) {
    return null;
  }
  const accounts = runtime.accountsService.listAccounts().filter((account) => account.ownerId === customer.id);
  const projected = projectCustomerPosition(runtime.ledger, customer.id, accounts);
  if (!projected.ok) {
    return Object.freeze({
      customer_id: customer.id,
      grand_total: emptyMoney(),
      breakdown: Object.freeze({
        deposits: emptyMoney(),
        investments: emptyMoney(),
        digital_assets: emptyMoney(),
        rewards: emptyMoney(),
        pending: emptyMoney(),
      }),
    });
  }
  return Object.freeze({
    customer_id: projected.value.customerId,
    grand_total: moneyDto(projected.value.grandTotal.minorUnits, projected.value.grandTotal.currency),
    breakdown: Object.freeze({
      deposits: moneyDto(
        projected.value.breakdown.deposits.total.minorUnits,
        projected.value.breakdown.deposits.total.currency,
      ),
      investments: moneyDto(
        projected.value.breakdown.investments.total.minorUnits,
        projected.value.breakdown.investments.total.currency,
      ),
      digital_assets: moneyDto(
        projected.value.breakdown.digital_assets.total.minorUnits,
        projected.value.breakdown.digital_assets.total.currency,
      ),
      rewards: moneyDto(
        projected.value.breakdown.rewards.total.minorUnits,
        projected.value.breakdown.rewards.total.currency,
      ),
      pending: moneyDto(
        projected.value.breakdown.pending.total.minorUnits,
        projected.value.breakdown.pending.total.currency,
      ),
    }),
  });
}

function accountDto(runtime: SimulationRuntime, accountId: string): AccountDto | null {
  const account = runtime.accountsService.getAccount(asAccountId(accountId));
  if (!account) {
    return null;
  }
  const balance = balanceOfAccount(runtime.ledger, account);
  const amount = balance.ok ? balance.value : null;
  const banking = projectBankingPosition(runtime.ledger, account, runtime.holds, runtime.clock.now());
  const product = runtime.accountProduct.get(account.id);
  const posted = amount ? moneyDto(amount.minorUnits, amount.currency) : emptyMoney(account.currency);
  return Object.freeze({
    account_id: account.id,
    account_class: account.accountClass,
    status: product?.status ?? account.status,
    lifecycle: product?.status ?? account.status,
    product_type: product?.productType ?? 'CASH_ACCOUNT',
    currency: account.currency,
    jurisdiction: account.jurisdiction,
    opened_at: account.openedAt,
    closed_at: product?.closedAt ?? null,
    restrictions: product?.restrictions.filter((row) => row.state === 'ACTIVE').map((row) => row.code) ?? [],
    balance: posted,
    balances: banking.ok
      ? {
          posted: moneyDto(banking.value.posted.minorUnits, banking.value.posted.currency),
          pending: moneyDto(banking.value.pending.minorUnits, banking.value.pending.currency),
          held: moneyDto(banking.value.held.minorUnits, banking.value.held.currency),
          available: moneyDto(banking.value.available.minorUnits, banking.value.available.currency),
        }
      : {
          posted,
          pending: emptyMoney(account.currency),
          held: emptyMoney(account.currency),
          available: posted,
        },
  });
}

function seedPersonas(runtime: SimulationRuntime): void {
  for (const persona of PERSONA_DEFINITIONS) {
    const customer = activateCustomer(runtime, persona.customerId);
    const provisioned = runtime.identity.provisionSimulatedActor({
      actorId: persona.actorId,
      identityId: persona.identityId,
      customerId: customer.id,
      jurisdiction: asJurisdiction('GB'),
      capabilities: persona.capabilities,
      stepUp: persona.capabilities.includes('ACCOUNT_OPEN_REQUEST'),
    });
    if (!provisioned.ok) {
      throw new Error(`persona ${persona.personaId} failed: ${provisioned.error.message}`);
    }
    if (persona.seedAccount) {
      const opened = runtime.accountsService.open({
        id: asIntentId(`open_${persona.personaId}`),
        actionType: ACTION_TYPES.OPEN_ACCOUNT,
        idempotencyKey: `open_${persona.personaId}`,
        actorId: 'operator_1',
        requestedAt: runtime.clock.now(),
        purpose: 'CUSTOMER_ONBOARDING',
        payload: {
          accountId: asAccountId(`acct_${persona.personaId}`),
          ownerId: customer.id,
          productId: asProductId('prod_demand_usd_gb'),
          accountClass: 'DEMAND_DEPOSIT',
          legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
          jurisdiction: asJurisdiction('GB'),
          currency: asCurrencyCode('USD'),
        },
      });
      if (opened.outcome !== 'OPENED') {
        throw new Error(`persona account seed failed for ${persona.personaId}`);
      }
    }
  }
}

function seedActivity(persona: (typeof PERSONA_DEFINITIONS)[number], now: string): ActivityItemDto[] {
  const items: ActivityItemDto[] = [];
  for (let i = 0; i < persona.activityCount; i += 1) {
    items.push(
      Object.freeze({
        event_id: `evt_${persona.personaId}_${i}`,
        event_type: 'SandboxActivity',
        occurred_at: now,
        summary: `Sandbox activity ${i + 1} for ${persona.personaId}`,
      }),
    );
  }
  return items;
}

export const CONSUMER_PLATFORM_ROUTES = [
  'GET /health',
  'GET /ready',
  'GET /v1/consumer/health',
  'GET /v1/consumer/version',
  'POST /v1/consumer/auth/register',
  'POST /v1/consumer/auth/passkey/register/begin',
  'POST /v1/consumer/auth/passkey/register/complete',
  'POST /v1/consumer/auth/passkey/login/begin',
  'POST /v1/consumer/auth/passkey/login/complete',
  'POST /v1/consumer/auth/refresh',
  'POST /v1/consumer/auth/logout',
  'POST /v1/consumer/auth/recovery',
  'GET /v1/consumer/auth/mfa',
  'GET /v1/consumer/auth/sandbox/personas',
  'POST /v1/consumer/auth/sandbox/personas/{personaId}/session',
  'POST /v1/consumer/auth/sandbox/expire-session',
  'GET /v1/consumer/sessions',
  'DELETE /v1/consumer/sessions/{sessionId}',
  'GET /v1/consumer/devices',
  'POST /v1/consumer/devices/{deviceId}/trust',
  'GET /v1/consumer/me',
  'GET /v1/consumer/bootstrap',
  'GET /v1/consumer/home',
  'GET /v1/consumer/accounts',
  'GET /v1/consumer/accounts/{accountId}',
  'GET /v1/consumer/activity',
  'GET /v1/consumer/capabilities',
  'GET /v1/consumer/features/{featureId}',
  'POST /v1/consumer/actions',
  'GET /v1/consumer/actions/{actionId}',
  'GET /v1/consumer/approvals',
  'GET /v1/consumer/approvals/{approvalId}',
  'POST /v1/consumer/approvals/{approvalId}/acknowledge',
  'GET /v1/consumer/jobs/{jobId}',
  'POST /v1/consumer/webhooks',
  'GET /v1/consumer/webhooks',
  'POST /v1/consumer/webhooks/{endpointId}/test',
] as const;

export function createConsumerPlatformRuntime(options: ConsumerPlatformOptions = {}): SimulationRuntime {
  const runtime = options.runtime ?? createSimulationRuntime();
  if (sandboxPersonasAllowed(options.allowSandboxPersonas === true)) {
    seedPersonas(runtime);
  }
  return runtime;
}

export async function startConsumerPlatform(
  options: ConsumerPlatformOptions = {},
): Promise<RunningConsumerPlatform> {
  const integrationEnvironment = options.integrationEnvironment ?? 'TEST';
  const allowSandbox = options.allowSandboxPersonas === true;
  const runtime = createConsumerPlatformRuntime(options);
  const tokens = new Map<string, TokenRecord>();
  const actions = new Map<string, ActionDecisionDto>();
  const approvals = new Map<string, ApprovalDto>();
  const idempotency = new Map<string, ActionDecisionDto>();
  const workflows = new ConsumerWorkflowStore();
  const activityByActor = new Map<string, ActivityItemDto[]>();
  if (sandboxPersonasAllowed(allowSandbox)) {
    const now = runtime.clock.now();
    for (const persona of PERSONA_DEFINITIONS) {
      activityByActor.set(persona.actorId, seedActivity(persona, now));
    }
  }

  function issueToken(session: IdentitySession): TokenResponse {
    const accessToken = `tok_${newSecurityToken()}`;
    tokens.set(accessToken, {
      accessToken,
      sessionId: session.sessionId,
      actorId: session.actorId,
    });
    return tokenResponse(accessToken, session);
  }

  function resolveAuth(req: IncomingMessage): AuthContext | ConsumerErrorCode {
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return 'AUTH_REQUIRED';
    }
    const token = tokens.get(header.slice('Bearer '.length));
    if (!token) {
      return 'SESSION_EXPIRED';
    }
    const session = runtime.identity.service.store.sessions.get(asSessionId(token.sessionId));
    if (!session) {
      return 'SESSION_EXPIRED';
    }
    if (session.revocationState === 'REVOKED') {
      return 'SESSION_REVOKED';
    }
    if (session.revocationState === 'EXPIRED' || session.expiresAt <= runtime.clock.now()) {
      return 'SESSION_EXPIRED';
    }
    return { session, token };
  }

  function capabilitiesFor(actorId: string): readonly CapabilityDto[] {
    const facts = runtime.identity.service.identityFactsFor(actorId);
    return Object.freeze(
      facts.authorizedCapabilities.map((capability) =>
        Object.freeze({ capability, granted: true }),
      ),
    );
  }

  function requireAuth(
    req: IncomingMessage,
    res: ServerResponse,
    requestId: string,
  ): AuthContext | null {
    const resolved = resolveAuth(req);
    if (typeof resolved === 'string') {
      fail(res, 401, requestId, resolved, 'authentication is required', {
        user_action_required: true,
      });
      return null;
    }
    return resolved;
  }

  const server: Server = createServer(async (req, res) => {
    const requestId =
      (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) ||
      `req_${newSecurityToken()}`;
    const host = req.headers.host ?? '127.0.0.1';
    const url = new URL(req.url ?? '/', `http://${host}`);
    const method = (req.method ?? 'GET').toUpperCase();
    const path = url.pathname;

    try {
      if ((path === '/health' || path === '/ready' || path === '/v1/consumer/health') && method === 'GET') {
        sendJson(
          res,
          200,
          {
            status: 'ok',
            api_version: CONSUMER_API_VERSION,
            surface: 'CONSUMER_PLATFORM',
            environment: ENVIRONMENT,
            production_active: false,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/version' && method === 'GET') {
        sendJson(
          res,
          200,
          {
            api_version: CONSUMER_API_VERSION,
            product: 'SunRey consumer platform',
            integration_environment: integrationEnvironment,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/register' && method === 'POST') {
        const body = parseJsonBody(await readBody(req, 32_768));
        const jurisdiction = asString(body.home_jurisdiction) ?? 'GB';
        const identity = runtime.identity.service.createPersonIdentity({
          homeJurisdiction: asJurisdiction(jurisdiction),
        });
        const activated = runtime.identity.service.activateIdentity(identity.id);
        if (!activated.ok) {
          fail(res, 409, requestId, 'RESOURCE_CONFLICT', activated.error.message);
          return;
        }
        sendJson(
          res,
          200,
          { identity_id: identity.id, status: 'ACTIVE', next_step: 'PASSKEY_REGISTER' },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/passkey/register/begin' && method === 'POST') {
        const body = parseJsonBody(await readBody(req, 32_768));
        const identityId = asString(body.identity_id);
        if (!identityId) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'identity_id is required', {
            user_action_required: true,
          });
          return;
        }
        const challenge = runtime.identity.service.beginPasskeyRegistration(
          asSolsticeIdentityId(identityId),
        );
        sendJson(
          res,
          200,
          {
            challenge_id: challenge.challengeId,
            challenge: challenge.challenge,
            rp_id: challenge.rpId,
            origin: challenge.origin,
            expires_at: challenge.expiresAt,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/passkey/register/complete' && method === 'POST') {
        const body = parseJsonBody(await readBody(req, 32_768));
        const challengeId = asString(body.challenge_id);
        const credentialId = asString(body.credential_id);
        const publicKey = asString(body.public_key_material);
        if (!challengeId || !credentialId || !publicKey) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'passkey registration fields are required', {
            user_action_required: true,
          });
          return;
        }
        const registered = runtime.identity.service.completePasskeyRegistration(
          {
            challengeId: asChallengeId(challengeId),
            credentialId,
            publicKeyMaterial: publicKey,
            transports: ['internal'],
            attestationRef: null,
          },
          asString(body.device_ref),
        );
        if (!registered.ok) {
          fail(res, 401, requestId, 'PASSKEY_CHALLENGE_INVALID', registered.error.message, {
            user_action_required: true,
          });
          return;
        }
        sendJson(
          res,
          200,
          {
            device_id: registered.value.deviceId ?? 'unbound',
            identity_id: registered.value.identityId,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/passkey/login/begin' && method === 'POST') {
        const body = parseJsonBody(await readBody(req, 32_768));
        const identityId = asString(body.identity_id);
        if (!identityId) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'identity_id is required', {
            user_action_required: true,
          });
          return;
        }
        const challenge = runtime.identity.service.beginPasskeyAuthentication(
          asSolsticeIdentityId(identityId),
        );
        sendJson(
          res,
          200,
          {
            challenge_id: challenge.challengeId,
            challenge: challenge.challenge,
            rp_id: challenge.rpId,
            origin: challenge.origin,
            expires_at: challenge.expiresAt,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/passkey/login/complete' && method === 'POST') {
        const body = parseJsonBody(await readBody(req, 32_768));
        const actorId = asString(body.actor_id);
        if (!actorId || !asString(body.challenge_id) || !asString(body.credential_id)) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'passkey login fields are required', {
            user_action_required: true,
          });
          return;
        }
        const authenticated = runtime.identity.service.authenticatePasskey(
          {
            challengeId: asChallengeId(asString(body.challenge_id)!),
            credentialId: asString(body.credential_id)!,
            authenticatorData: asString(body.authenticator_data) ?? '',
            clientDataJSON: asString(body.client_data_json) ?? '',
            signature: asString(body.signature) ?? '',
            signCount: typeof body.sign_count === 'number' ? body.sign_count : 0,
          },
          actorId,
          asString(body.device_ref),
        );
        if (!authenticated.ok) {
          fail(res, 401, requestId, 'INVALID_CREDENTIALS', authenticated.error.message, {
            user_action_required: true,
          });
          return;
        }
        sendJson(res, 200, issueToken(authenticated.value.session), requestId);
        return;
      }

      if (path === '/v1/consumer/auth/sandbox/personas' && method === 'GET') {
        if (!sandboxPersonasAllowed(allowSandbox)) {
          fail(res, 403, requestId, 'SANDBOX_PERSONA_FORBIDDEN', 'sandbox personas are disabled');
          return;
        }
        sendJson(
          res,
          200,
          {
            items: PERSONA_DEFINITIONS.map((persona) => ({
              persona_id: persona.personaId,
              label: persona.label,
              capabilities: persona.capabilities,
            })),
          },
          requestId,
        );
        return;
      }

      const personaMatch = /^\/v1\/consumer\/auth\/sandbox\/personas\/([^/]+)\/session$/.exec(path);
      if (personaMatch && method === 'POST') {
        if (!sandboxPersonasAllowed(allowSandbox)) {
          fail(res, 403, requestId, 'SANDBOX_PERSONA_FORBIDDEN', 'sandbox personas are disabled');
          return;
        }
        const persona = personaById(decodeURIComponent(personaMatch[1] ?? ''));
        if (!persona) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'unknown sandbox persona');
          return;
        }
        const resolved = runtime.identity.service.resolveActorContext(persona.actorId);
        if (!resolved.ok) {
          fail(res, 401, requestId, 'INVALID_CREDENTIALS', resolved.error.message);
          return;
        }
        const session = runtime.identity.service.activeSessionForActor(persona.actorId);
        if (!session) {
          fail(res, 401, requestId, 'SESSION_EXPIRED', 'persona session is not active');
          return;
        }
        sendJson(res, 200, issueToken(session), requestId);
        return;
      }

      if (path === '/v1/consumer/auth/refresh' && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const refreshed = runtime.identity.service.resolveActorContext(auth.session.actorId);
        if (!refreshed.ok) {
          fail(res, 401, requestId, 'SESSION_EXPIRED', refreshed.error.message, {
            user_action_required: true,
          });
          return;
        }
        const session = runtime.identity.service.activeSessionForActor(auth.session.actorId);
        if (!session) {
          fail(res, 401, requestId, 'SESSION_EXPIRED', 'session is no longer active', {
            user_action_required: true,
          });
          return;
        }
        tokens.delete(auth.token.accessToken);
        sendJson(res, 200, issueToken(session), requestId);
        return;
      }

      if (path === '/v1/consumer/auth/logout' && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        runtime.identity.service.logout(auth.session.sessionId);
        tokens.delete(auth.token.accessToken);
        runtime.evidence.seal('CONSUMER_SESSION_LOGOUT', {
          sessionId: auth.session.sessionId,
          actorId: auth.session.actorId,
        });
        sendJson(res, 200, { revoked: true }, requestId);
        return;
      }

      if (path === '/v1/consumer/auth/recovery' && method === 'POST') {
        const body = parseJsonBody(await readBody(req, 32_768));
        const identityId = asString(body.identity_id);
        if (!identityId) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'identity_id is required', {
            user_action_required: true,
          });
          return;
        }
        const request = runtime.identity.service.requestRecovery(asSolsticeIdentityId(identityId));
        sendJson(
          res,
          200,
          { recovery_request_id: request.id, state: request.state },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/mfa' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        sendJson(
          res,
          200,
          {
            factors: auth.session.factors,
            totp_enrolled: false,
            passkey_available: auth.session.factors.includes('PASSKEY'),
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/auth/sandbox/expire-session' && method === 'POST') {
        if (!sandboxPersonasAllowed(allowSandbox)) {
          fail(res, 403, requestId, 'SANDBOX_PERSONA_FORBIDDEN', 'sandbox personas are disabled');
          return;
        }
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const expired = Object.freeze({
          ...auth.session,
          expiresAt: addMs(runtime.clock.now(), -1n),
          revocationState: 'EXPIRED' as const,
        });
        runtime.identity.service.store.sessions.set(auth.session.sessionId, expired);
        sendJson(res, 200, { expired: true }, requestId);
        return;
      }

      if (path === '/v1/consumer/sessions' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const items = [...runtime.identity.service.store.sessions.values()]
          .filter((session) => session.subjectId === auth.session.subjectId)
          .map(sessionDto);
        sendJson(res, 200, { items }, requestId);
        return;
      }

      const sessionRevoke = /^\/v1\/consumer\/sessions\/([^/]+)$/.exec(path);
      if (sessionRevoke && method === 'DELETE') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const sessionId = decodeURIComponent(sessionRevoke[1] ?? '');
        const target = runtime.identity.service.store.sessions.get(asSessionId(sessionId));
        if (!target || target.subjectId !== auth.session.subjectId) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'session was not found');
          return;
        }
        runtime.identity.service.revokeSession(target.sessionId, 'user_revoke');
        sendJson(res, 200, { revoked: true }, requestId);
        return;
      }

      if (path === '/v1/consumer/devices' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const items: DeviceDto[] = [...runtime.identity.service.store.devices.values()]
          .filter((device) => device.identityId === auth.session.subjectId)
          .map((device) =>
            Object.freeze({
              device_id: device.deviceId,
              device_ref: device.deviceRef,
              trust_state: device.trustState,
              last_seen_at: device.lastSeenAt,
            }),
          );
        sendJson(res, 200, { items }, requestId);
        return;
      }

      const deviceTrust = /^\/v1\/consumer\/devices\/([^/]+)\/trust$/.exec(path);
      if (deviceTrust && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const body = parseJsonBody(await readBody(req, 32_768));
        const trust = asString(body.trust_state);
        if (
          trust !== 'KNOWN' &&
          trust !== 'TRUSTED' &&
          trust !== 'REVIEW_REQUIRED' &&
          trust !== 'BLOCKED'
        ) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'trust_state is invalid', {
            user_action_required: true,
          });
          return;
        }
        const updated = runtime.identity.service.setDeviceTrust(asDeviceId(decodeURIComponent(deviceTrust[1] ?? '')), trust);
        if (!updated.ok) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', updated.error.message);
          return;
        }
        if (updated.value.identityId !== auth.session.subjectId) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'device was not found');
          return;
        }
        sendJson(
          res,
          200,
          {
            device_id: updated.value.deviceId,
            device_ref: updated.value.deviceRef,
            trust_state: updated.value.trustState,
            last_seen_at: updated.value.lastSeenAt,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/me' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const facts = runtime.identity.service.identityFactsFor(auth.session.actorId);
        sendJson(
          res,
          200,
          {
            actor_id: auth.session.actorId,
            identity_id: auth.session.subjectId,
            customer_id: facts.customerId,
            assurance: auth.session.authenticationStrength,
            jurisdiction: runtime.identity.service.store.identities.get(auth.session.subjectId)
              ?.homeJurisdiction ?? null,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/bootstrap' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const facts = runtime.identity.service.identityFactsFor(auth.session.actorId);
        const bootstrap: BootstrapDto = Object.freeze({
          api_version: CONSUMER_API_VERSION,
          integration_environment: integrationEnvironment,
          environment: 'simulation',
          production_ready: false,
          production_active: false,
          live_connectivity_enabled: false,
          me: {
            actor_id: auth.session.actorId,
            identity_id: auth.session.subjectId,
            customer_id: facts.customerId,
            assurance: auth.session.authenticationStrength,
            jurisdiction:
              runtime.identity.service.store.identities.get(auth.session.subjectId)?.homeJurisdiction ??
              null,
          },
          session: sessionDto(auth.session),
          capabilities: capabilitiesFor(auth.session.actorId),
          features: featureFlags(),
          degraded: Object.freeze([]),
        });
        sendJson(res, 200, bootstrap, requestId);
        return;
      }

      if (path === '/v1/consumer/home' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const facts = runtime.identity.service.identityFactsFor(auth.session.actorId);
        const accounts = facts.customerId
          ? runtime.accountsService.listAccounts().filter((account) => account.ownerId === facts.customerId)
          : [];
        const pending = [...approvals.values()];
        sendJson(
          res,
          200,
          {
            greeting: 'Welcome to SunRey',
            environment_banner: 'SIMULATION',
            account_count: accounts.length,
            position: facts.customerId ? positionDto(runtime, facts.customerId) : null,
            attention: Object.freeze(
              pending.length > 0
                ? [
                    {
                      kind: 'APPROVAL_REQUIRED' as const,
                      message: 'An action is waiting for review',
                      reference_id: pending[0]?.approval_id ?? null,
                    },
                  ]
                : [
                    {
                      kind: 'NONE' as const,
                      message: 'No attention items',
                      reference_id: null,
                    },
                  ],
            ),
            features: featureFlags(),
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/accounts' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const facts = runtime.identity.service.identityFactsFor(auth.session.actorId);
        if (!facts.authorizedCapabilities.includes('VIEW_ACCOUNT')) {
          fail(res, 403, requestId, 'CAPABILITY_DENIED', 'VIEW_ACCOUNT is required', {
            user_action_required: true,
          });
          return;
        }
        const pageSize = pageSizeOf(url.searchParams.get('page_size') ?? undefined);
        const offset = decodeCursor(url.searchParams.get('cursor') ?? undefined, 'accounts');
        if (pageSize === 'INVALID') {
          fail(res, 400, requestId, 'PAGE_SIZE_EXCEEDED', 'page_size is invalid');
          return;
        }
        if (offset === 'INVALID') {
          fail(res, 400, requestId, 'INVALID_PAGINATION_CURSOR', 'cursor is invalid');
          return;
        }
        const all = runtime.accountsService
          .listAccounts()
          .filter((account) => facts.customerId !== null && account.ownerId === facts.customerId)
          .map((account) => accountDto(runtime, account.id))
          .filter((row): row is AccountDto => row !== null);
        const items = all.slice(offset, offset + pageSize);
        sendJson(
          res,
          200,
          {
            items,
            next_cursor: offset + items.length < all.length ? encodeCursor('accounts', offset + items.length) : null,
            page_size: pageSize,
          },
          requestId,
        );
        return;
      }

      const accountMatch = /^\/v1\/consumer\/accounts\/([^/]+)$/.exec(path);
      if (accountMatch && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const facts = runtime.identity.service.identityFactsFor(auth.session.actorId);
        if (!facts.authorizedCapabilities.includes('VIEW_ACCOUNT')) {
          fail(res, 403, requestId, 'CAPABILITY_DENIED', 'VIEW_ACCOUNT is required', {
            user_action_required: true,
          });
          return;
        }
        const dto = accountDto(runtime, decodeURIComponent(accountMatch[1] ?? ''));
        if (!dto || (facts.customerId && runtime.accountsService.getAccount(asAccountId(dto.account_id))?.ownerId !== facts.customerId)) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'account was not found');
          return;
        }
        sendJson(res, 200, dto, requestId);
        return;
      }

      if (path === '/v1/consumer/activity' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const pageSize = pageSizeOf(url.searchParams.get('page_size') ?? undefined);
        const offset = decodeCursor(url.searchParams.get('cursor') ?? undefined, 'activity');
        if (pageSize === 'INVALID') {
          fail(res, 400, requestId, 'PAGE_SIZE_EXCEEDED', 'page_size is invalid');
          return;
        }
        if (offset === 'INVALID') {
          fail(res, 400, requestId, 'INVALID_PAGINATION_CURSOR', 'cursor is invalid');
          return;
        }
        const ledgerEvents: ActivityItemDto[] = runtime.events
          .list()
          .filter((event) => event.intentId?.includes(auth.session.actorId) || event.correlationId === auth.session.actorId)
          .map((event) =>
            Object.freeze({
              event_id: String(event.eventId),
              event_type: event.eventType,
              occurred_at: String(event.occurredAt),
              summary: event.eventType,
            }),
          );
        const all = [...(activityByActor.get(auth.session.actorId) ?? []), ...ledgerEvents];
        const items = all.slice(offset, offset + pageSize);
        sendJson(
          res,
          200,
          {
            items,
            next_cursor: offset + items.length < all.length ? encodeCursor('activity', offset + items.length) : null,
            page_size: pageSize,
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/capabilities' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        sendJson(res, 200, { items: capabilitiesFor(auth.session.actorId) }, requestId);
        return;
      }

      const featureMatch = /^\/v1\/consumer\/features\/([^/]+)$/.exec(path);
      if (featureMatch && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const featureId = decodeURIComponent(featureMatch[1] ?? '');
        if (!CONSUMER_FEATURE_IDS.includes(featureId as (typeof CONSUMER_FEATURE_IDS)[number])) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'feature was not found');
          return;
        }
        const available = ENABLED_FEATURES.has(featureId);
        if (!available) {
          fail(res, 403, requestId, 'FEATURE_UNAVAILABLE', `${featureId} is not enabled`, {
            details: { feature_id: featureId },
          });
          return;
        }
        sendJson(
          res,
          200,
          { feature_id: featureId, available: true, reason_code: null },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/actions' && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const body = parseJsonBody(await readBody(req, 32_768));
        const actionType = asString(body.action_type);
        const idempotencyKey =
          (typeof req.headers['idempotency-key'] === 'string' && req.headers['idempotency-key']) ||
          asString(body.idempotency_key);
        if (actionType !== 'OPEN_ACCOUNT' || !idempotencyKey) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'OPEN_ACCOUNT and idempotency_key are required', {
            user_action_required: true,
          });
          return;
        }
        const replay = idempotency.get(`${auth.session.actorId}:${idempotencyKey}`);
        if (replay) {
          sendJson(res, 200, replay, requestId);
          return;
        }
        const facts = runtime.identity.service.identityFactsFor(auth.session.actorId);
        if (!facts.authorizedCapabilities.includes('ACCOUNT_OPEN_REQUEST')) {
          const denied: ActionDecisionDto = Object.freeze({
            action_id: `act_${newSecurityToken()}`,
            action_type: 'OPEN_ACCOUNT',
            state: 'BLOCK',
            evidence_record_id: null,
            approval_id: null,
            account_id: null,
            message: 'ACCOUNT_OPEN_REQUEST is not granted',
          });
          actions.set(denied.action_id, denied);
          idempotency.set(`${auth.session.actorId}:${idempotencyKey}`, denied);
          runtime.evidence.seal('CONSUMER_ACTION_DENIED', {
            actorId: auth.session.actorId,
            actionType,
            requestId,
          });
          fail(res, 403, requestId, 'CAPABILITY_DENIED', denied.message, {
            user_action_required: true,
            details: { action_id: denied.action_id, state: denied.state },
          });
          return;
        }
        if (!facts.customerId) {
          fail(res, 409, requestId, 'RESOURCE_CONFLICT', 'identity is not linked to a customer');
          return;
        }
        const intent: OpenAccountIntent = {
          id: asIntentId(`open_${idempotencyKey}`),
          actionType: ACTION_TYPES.OPEN_ACCOUNT,
          idempotencyKey,
          actorId: auth.session.actorId,
          requestedAt: runtime.clock.now(),
          purpose: 'CUSTOMER_ONBOARDING',
          payload: {
            accountId: asAccountId(asString(body.account_id) ?? `acct_${newSecurityToken()}`),
            ownerId: asCustomerId(facts.customerId),
            productId: asProductId('prod_demand_usd_gb'),
            accountClass: 'DEMAND_DEPOSIT',
            legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
            jurisdiction: asJurisdiction('GB'),
            currency: asCurrencyCode('USD'),
          },
        };
        const outcome = runtime.accountsService.open(intent);
        if (outcome.outcome === 'KERNEL_REFUSED') {
          const state =
            outcome.decision.status === 'REQUIRE_MANUAL_REVIEW' || outcome.decision.status === 'DEFER'
              ? outcome.decision.status
              : 'BLOCK';
          const decision: ActionDecisionDto = Object.freeze({
            action_id: intent.id,
            action_type: 'OPEN_ACCOUNT',
            state,
            evidence_record_id: outcome.decision.evidenceRecordId,
            approval_id:
              state === 'REQUIRE_MANUAL_REVIEW' || state === 'DEFER' ? `apr_${intent.id}` : null,
            account_id: null,
            message: `Kernel ${outcome.decision.status}`,
          });
          actions.set(decision.action_id, decision);
          if (
            decision.approval_id &&
            (state === 'REQUIRE_MANUAL_REVIEW' || state === 'DEFER')
          ) {
            approvals.set(
              decision.approval_id,
              Object.freeze({
                approval_id: decision.approval_id,
                action_id: decision.action_id,
                state,
                created_at: runtime.clock.now(),
                message: decision.message,
              }),
            );
          }
          idempotency.set(`${auth.session.actorId}:${idempotencyKey}`, decision);
          if (state === 'REQUIRE_MANUAL_REVIEW' || state === 'DEFER') {
            fail(res, 409, requestId, 'APPROVAL_REQUIRED', decision.message, {
              user_action_required: true,
              details: { action_id: decision.action_id, state },
            });
            return;
          }
          fail(res, 403, requestId, 'KERNEL_REFUSED', decision.message, {
            details: { action_id: decision.action_id, state },
          });
          return;
        }
        if (outcome.outcome !== 'OPENED') {
          fail(res, 409, requestId, 'RESOURCE_CONFLICT', outcome.message);
          return;
        }
        const decision: ActionDecisionDto = Object.freeze({
          action_id: intent.id,
          action_type: 'OPEN_ACCOUNT',
          state: 'ALLOW',
          evidence_record_id: outcome.decision.evidenceRecordId,
          approval_id: null,
          account_id: outcome.account.id,
          message: 'Account opened after Kernel ALLOW and verified Execution Authority',
        });
        actions.set(decision.action_id, decision);
        idempotency.set(`${auth.session.actorId}:${idempotencyKey}`, decision);
        workflows.createJob('EVENT_DISPATCH', runtime.clock.now(), 'AccountOpened');
        const existing = activityByActor.get(auth.session.actorId) ?? [];
        activityByActor.set(auth.session.actorId, [
          ...existing,
          Object.freeze({
            event_id: `evt_${decision.action_id}`,
            event_type: 'AccountOpened',
            occurred_at: runtime.clock.now(),
            summary: 'Account opened',
          }),
        ]);
        sendJson(res, 200, decision, requestId);
        return;
      }

      const actionMatch = /^\/v1\/consumer\/actions\/([^/]+)$/.exec(path);
      if (actionMatch && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const found = actions.get(decodeURIComponent(actionMatch[1] ?? ''));
        if (!found) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'action was not found');
          return;
        }
        sendJson(res, 200, found, requestId);
        return;
      }

      if (path === '/v1/consumer/approvals' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        sendJson(res, 200, { items: [...approvals.values()] }, requestId);
        return;
      }

      const approvalMatch = /^\/v1\/consumer\/approvals\/([^/]+)$/.exec(path);
      if (approvalMatch && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const found = approvals.get(decodeURIComponent(approvalMatch[1] ?? ''));
        if (!found) {
          fail(res, 404, requestId, 'APPROVAL_NOT_FOUND', 'approval was not found');
          return;
        }
        sendJson(res, 200, found, requestId);
        return;
      }

      const approvalAck = /^\/v1\/consumer\/approvals\/([^/]+)\/acknowledge$/.exec(path);
      if (approvalAck && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const found = approvals.get(decodeURIComponent(approvalAck[1] ?? ''));
        if (!found) {
          fail(res, 404, requestId, 'APPROVAL_NOT_FOUND', 'approval was not found');
          return;
        }
        sendJson(res, 200, found, requestId);
        return;
      }

      const jobMatch = /^\/v1\/consumer\/jobs\/([^/]+)$/.exec(path);
      if (jobMatch && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const job = workflows.jobs.get(decodeURIComponent(jobMatch[1] ?? ''));
        if (!job) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'job was not found');
          return;
        }
        sendJson(res, 200, job, requestId);
        return;
      }

      if (path === '/v1/consumer/webhooks' && method === 'GET') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        sendJson(
          res,
          200,
          {
            items: [...workflows.webhooks.values()].filter((row) => row.ownerActorId === auth.session.actorId),
          },
          requestId,
        );
        return;
      }

      if (path === '/v1/consumer/webhooks' && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const body = parseJsonBody(await readBody(req, 32_768));
        const hookUrl = asString(body.url);
        if (!hookUrl) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'url is required', {
            user_action_required: true,
          });
          return;
        }
        const rejected = assertSimulationWebhookUrl(hookUrl);
        if (rejected) {
          fail(res, 400, requestId, 'VALIDATION_FAILED', 'webhook destination is not allowed', {
            details: { reason: rejected },
          });
          return;
        }
        const eventTypes = Array.isArray(body.event_types)
          ? body.event_types.filter((row): row is string => typeof row === 'string')
          : ['consumer.action.completed'];
        const endpoint = workflows.registerWebhook({
          ownerActorId: auth.session.actorId,
          url: hookUrl,
          eventTypes,
          now: runtime.clock.now(),
        });
        sendJson(res, 200, endpoint, requestId);
        return;
      }

      const webhookTest = /^\/v1\/consumer\/webhooks\/([^/]+)\/test$/.exec(path);
      if (webhookTest && method === 'POST') {
        const auth = requireAuth(req, res, requestId);
        if (!auth) return;
        const endpoint = workflows.webhooks.get(decodeURIComponent(webhookTest[1] ?? ''));
        if (!endpoint || endpoint.ownerActorId !== auth.session.actorId) {
          fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'webhook was not found');
          return;
        }
        const job = workflows.createJob('WEBHOOK_DELIVERY', runtime.clock.now(), 'test_enqueued');
        sendJson(res, 200, job, requestId);
        return;
      }

      fail(res, 404, requestId, 'RESOURCE_NOT_FOUND', 'route was not found');
    } catch (error) {
      if (error instanceof Error && error.message === 'OVERSIZED_REQUEST') {
        fail(res, 413, requestId, 'OVERSIZED_REQUEST', 'request body is too large');
        return;
      }
      fail(res, 500, requestId, 'INTERNAL_ERROR', 'request failed', {
        retryable: true,
        safe_to_display: false,
      });
    }
  });

  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('consumer platform failed to bind');
  }

  return {
    url: `http://${host}:${address.port}`,
    apiVersion: CONSUMER_API_VERSION,
    runtime,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
