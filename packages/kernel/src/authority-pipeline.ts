import { addMs, type Clock } from '../../config/src/clock.ts';
import { assertSimulationOnly, ENVIRONMENT } from '../../config/src/flags.ts';
import type { Customer } from '../../domain/src/customer.ts';
import type { LegalEntity } from '../../domain/src/legal-entity.ts';
import type { Product } from '../../domain/src/product.ts';
import { err, isOk, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import {
  actionTypesFromCapabilities,
  asSessionId,
  assertCapability,
  clientDenial,
  deriveAuthorizationContext,
  frontendAuthorityView,
  privilegedClientClaims,
  type AuthorizationContext,
  type ClientDenial,
  type FrontendAuthorityView,
  type PrincipalKind,
  type ProductCapability,
  type ResourceOwnershipRegistry,
} from '../../identity/src/index.ts';
import type { IdentityService } from '../../identity/src/service.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { requiredAssuranceFor } from '../../identity/src/capability.ts';
import { assuranceAtLeast } from '../../identity/src/assurance.ts';
import {
  advanceProposal,
  createExecutionProposal,
  InMemoryProposalStore,
  type ExecutionProposal,
} from '../../permissions/src/proposal.ts';
import { submitRegulatedCommand } from '../../permissions/src/execution-gate.ts';
import type { AuthorityIssuer } from '../../permissions/src/execution-authority.ts';
import { evaluateThroughKernel, type ProductPolicyOutcome } from './middleware.ts';
import type { ComplianceKernel } from './kernel.ts';
import type { KernelFacts } from './proofs.ts';

const PROPOSAL_TTL_MS = 15n * 60n * 1000n;

export type AuthorityHttpRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: unknown;
};

export type AuthorityHttpResponse = {
  readonly status: number;
  readonly body: {
    readonly ok: boolean;
    readonly frontend: FrontendAuthorityView;
    readonly authorization: AuthorizationContext | null;
    readonly proposal: ExecutionProposal | null;
    readonly evidenceId: string | null;
    readonly error: ClientDenial | null;
  };
};

export type AuthorityPipelineCatalog = {
  readonly customerFor: (customerId: string) => Customer | undefined;
  readonly product: Product | undefined;
  readonly legalEntity: LegalEntity | undefined;
};

export class AuthorityPipeline {
  private readonly identity: IdentityService;
  private readonly kernel: ComplianceKernel;
  private readonly issuer: AuthorityIssuer;
  private readonly evidence: EvidenceVault;
  private readonly clock: Clock;
  private readonly ownership: ResourceOwnershipRegistry;
  private readonly proposals: InMemoryProposalStore;
  private readonly catalog: AuthorityPipelineCatalog;
  private readonly executedKeys = new Map<string, string>();

  constructor(input: {
    readonly identity: IdentityService;
    readonly kernel: ComplianceKernel;
    readonly issuer: AuthorityIssuer;
    readonly evidence: EvidenceVault;
    readonly clock: Clock;
    readonly ownership: ResourceOwnershipRegistry;
    readonly catalog: AuthorityPipelineCatalog;
    readonly proposals?: InMemoryProposalStore;
  }) {
    this.identity = input.identity;
    this.kernel = input.kernel;
    this.issuer = input.issuer;
    this.evidence = input.evidence;
    this.clock = input.clock;
    this.ownership = input.ownership;
    this.catalog = input.catalog;
    this.proposals = input.proposals ?? new InMemoryProposalStore();
  }

  handle(request: AuthorityHttpRequest): AuthorityHttpResponse {
    assertSimulationOnly();
    const requestId = request.headers['x-sunrey-request-id'] ?? `req_${this.clock.now()}`;
    const privileged = privilegedClientClaims(request.body);
    if (privileged.length > 0) {
      const evidence = this.sealDenial('AUTHORITY_CLIENT_PRIVILEGE_REJECTED', {
        requestId,
        keys: privileged,
      });
      return this.respond(403, 'DENIED', clientDenial('CLIENT_PRIVILEGE_REJECTED', {
        evidenceId: evidence,
        requestId,
      }), null, null, evidence, requestId);
    }
    if (request.path === '/v1/authority/context' && request.method === 'GET') {
      return this.handleContext(request, requestId);
    }
    if (request.path === '/v1/authority/rehearsal' && request.method === 'POST') {
      return this.handleRehearsal(request, requestId);
    }
    const evidence = this.sealDenial('AUTHORITY_UNAVAILABLE', { requestId, path: request.path });
    return this.respond(404, 'UNAVAILABLE', clientDenial('UNAVAILABLE', {
      evidenceId: evidence,
      requestId,
    }), null, null, evidence, requestId);
  }

  private handleContext(request: AuthorityHttpRequest, requestId: string): AuthorityHttpResponse {
    const resolved = this.resolveContext(request, requestId, 'ACCOUNT_READ', null);
    if (!resolved.ok) {
      return this.deny(resolved.error);
    }
    const capable = assertCapability(resolved.value, 'ACCOUNT_READ');
    if (!capable.ok) {
      const evidence = this.sealDenial('AUTHORITY_PERMISSION_DENIED', {
        requestId,
        code: capable.error.code,
      });
      return this.deny({ ...capable.error, evidenceId: evidence });
    }
    this.evidence.seal('AUTHORITY_CONTEXT_ISSUED', {
      requestId,
      actorId: resolved.value.user.actorId,
      subjectId: resolved.value.user.subjectId,
      capabilities: resolved.value.permissions,
    });
    return this.respond(200, 'ALLOWED', null, resolved.value, null, null, requestId);
  }

  private handleRehearsal(request: AuthorityHttpRequest, requestId: string): AuthorityHttpResponse {
    const body = asRecord(request.body);
    const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '';
    if (!resourceId || !idempotencyKey) {
      const evidence = this.sealDenial('AUTHORITY_UNAVAILABLE', { requestId, reason: 'missing_fields' });
      return this.deny(clientDenial('UNAVAILABLE', { evidenceId: evidence, requestId }));
    }
    const resolved = this.resolveContext(request, requestId, 'AUTHORITY_PATH_REHEARSE', {
      kind: 'account',
      id: resourceId,
    });
    if (!resolved.ok) {
      return this.deny(resolved.error);
    }
    const context = resolved.value;
    const owned = this.ownership.assertOwnedBySubject('account', resourceId, context.user.subjectId);
    if (!owned.ok) {
      const evidence = this.sealDenial('AUTHORITY_RESOURCE_NOT_OWNED', {
        requestId,
        resourceId,
        subjectId: context.user.subjectId,
      });
      return this.deny({ ...owned.error, evidenceId: evidence, requestId });
    }
    const capable = assertCapability(context, 'AUTHORITY_PATH_REHEARSE');
    if (!capable.ok) {
      const display = capable.error.code === 'STEP_UP_REQUIRED' ? 'REQUIRES_MFA' : 'DENIED';
      const evidence = this.sealDenial(
        capable.error.code === 'STEP_UP_REQUIRED'
          ? 'AUTHORITY_STEP_UP_REQUIRED'
          : 'AUTHORITY_PERMISSION_DENIED',
        { requestId, code: capable.error.code },
      );
      return this.respond(
        capable.error.code === 'STEP_UP_REQUIRED' ? 401 : 403,
        display,
        { ...capable.error, evidenceId: evidence },
        context,
        null,
        evidence,
        requestId,
      );
    }

    const existing = this.proposals.getByIdempotency(idempotencyKey);
    if (existing && this.executedKeys.get(idempotencyKey) === existing.proposalId) {
      if (existing.requesterActorId !== context.user.actorId) {
        const evidence = this.sealDenial('AUTHORITY_IDEMPOTENCY_CONFLICT', { requestId, idempotencyKey });
        return this.deny(clientDenial('IDEMPOTENCY_CONFLICT', { evidenceId: evidence, requestId }));
      }
      return this.respond(200, 'ALLOWED', null, context, existing, null, requestId);
    }

    let proposal = createExecutionProposal({
      requesterSubjectId: context.user.subjectId,
      requesterActorId: context.user.actorId,
      humanRequesterId: context.agent?.humanSubjectId ?? context.user.subjectId,
      agentActorId: context.agent?.agentId ?? null,
      agentMandateId: context.agent?.mandateId ?? null,
      actionType: ACTION_TYPES.REHEARSE_AUTHORITY_PATH,
      capability: 'AUTHORITY_PATH_REHEARSE',
      resources: [{ kind: 'account', id: resourceId }],
      createdAt: this.clock.now(),
      expiresAt: addMs(this.clock.now(), PROPOSAL_TTL_MS),
      requiredApprovals: context.principalKind === 'AGENT' ? ['HUMAN'] : [],
      authenticationRequirement: requiredAssuranceFor('AUTHORITY_PATH_REHEARSE'),
      idempotencyKey,
      requestId,
      correlationId: request.headers['x-sunrey-correlation-id'] ?? null,
    });
    this.proposals.put(proposal);

    const proposed = advanceProposal(proposal, 'PROPOSED', this.clock);
    if (!proposed.ok) {
      return this.failProposal(context, proposal, proposed.error.code === 'PROPOSAL_EXPIRED' ? 'EXPIRED' : 'DENIED', requestId);
    }
    proposal = proposed.value;
    const reviewing = advanceProposal(proposal, 'POLICY_REVIEW', this.clock);
    if (!reviewing.ok) {
      return this.failProposal(context, proposal, 'DENIED', requestId);
    }
    proposal = reviewing.value;

    if (context.principalKind === 'AGENT') {
      const awaiting = advanceProposal(proposal, 'AWAITING_USER_APPROVAL', this.clock);
      if (!awaiting.ok) {
        return this.failProposal(context, proposal, 'DENIED', requestId);
      }
      this.proposals.put(awaiting.value);
      const evidence = this.evidence.seal('AUTHORITY_APPROVAL_REQUIRED', {
        requestId,
        proposalId: awaiting.value.proposalId,
        agentActorId: context.agent?.agentId ?? null,
      }).evidenceId;
      return this.respond(
        202,
        'REQUIRES_APPROVAL',
        clientDenial('APPROVAL_REQUIRED', { evidenceId: evidence, requestId }),
        context,
        awaiting.value,
        evidence,
        requestId,
      );
    }

    const customer = context.user.customerId
      ? this.catalog.customerFor(context.user.customerId)
      : undefined;
    const facts: KernelFacts = {
      actor: {
        id: context.user.actorId,
        capabilities: actionTypesFromCapabilities(context.permissions),
      },
      identity: this.identity.identityFactsFor(context.user.actorId),
      ...(customer ? { customer } : {}),
      ...(this.catalog.legalEntity ? { legalEntity: this.catalog.legalEntity } : {}),
      ...(this.catalog.product ? { product: this.catalog.product } : {}),
      ...(customer ? { jurisdiction: customer.jurisdiction } : {}),
    };
    const intent = {
      id: asIntentId(`agi_${proposal.proposalId.slice(0, 24)}`),
      actionType: ACTION_TYPES.REHEARSE_AUTHORITY_PATH,
      payload: Object.freeze({
        accountId: resourceId,
        rehearsalId: proposal.proposalId,
      }),
      idempotencyKey,
      actorId: context.user.actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_ONBOARDING' as const,
    };
    const evaluated = evaluateThroughKernel(this.kernel, intent, facts);
    proposal = this.recordPolicy(proposal, evaluated.kernel?.policySnapshot ?? null);

    if (evaluated.outcome !== 'ALLOW' || !evaluated.kernel?.executionAuthority) {
      const nextState =
        evaluated.outcome === 'REQUIRE_COMPLIANCE_REVIEW'
          ? 'AWAITING_COMPLIANCE'
          : evaluated.outcome === 'UNAVAILABLE'
            ? 'REJECTED'
            : 'REJECTED';
      const moved = advanceProposal(proposal, nextState, this.clock, {
        policyDecisionRef: evaluated.kernel?.policySnapshot ?? null,
      });
      if (moved.ok) {
        this.proposals.put(moved.value);
        proposal = moved.value;
      }
      const display =
        evaluated.outcome === 'REQUIRE_COMPLIANCE_REVIEW'
          ? 'PENDING_COMPLIANCE'
          : evaluated.outcome === 'UNAVAILABLE'
            ? 'UNAVAILABLE'
            : 'DENIED';
      const code =
        evaluated.outcome === 'REQUIRE_COMPLIANCE_REVIEW'
          ? 'COMPLIANCE_REVIEW_REQUIRED'
          : evaluated.outcome === 'UNAVAILABLE'
            ? 'UNAVAILABLE'
            : 'POLICY_DENIED';
      const evidence = this.sealDenial('AUTHORITY_KERNEL_DENIED', {
        requestId,
        proposalId: proposal.proposalId,
        outcome: evaluated.outcome,
        kernelStatus: evaluated.kernel?.status ?? null,
        kernelEvidenceId: evaluated.kernel?.evidenceRecordId ?? null,
      });
      return this.respond(
        display === 'PENDING_COMPLIANCE' ? 202 : display === 'UNAVAILABLE' ? 503 : 403,
        display,
        clientDenial(code, { evidenceId: evidence, requestId }),
        context,
        proposal,
        evidence,
        requestId,
      );
    }

    const approved = advanceProposal(proposal, 'APPROVED', this.clock, {
      policyDecisionRef: evaluated.kernel.policySnapshot ?? null,
    });
    if (!approved.ok) {
      return this.failProposal(context, proposal, 'DENIED', requestId);
    }
    proposal = approved.value;
    this.proposals.put(proposal);

    const executing = advanceProposal(proposal, 'EXECUTING', this.clock);
    if (!executing.ok) {
      return this.failProposal(context, proposal, 'DENIED', requestId);
    }
    proposal = executing.value;

    const prior = this.executedKeys.get(idempotencyKey) ?? null;
    const gated = submitRegulatedCommand(
      {
        proposal,
        authority: evaluated.kernel.executionAuthority,
        issuer: this.issuer,
        clock: this.clock,
        expectedActorId: context.user.actorId,
        clientSuppliedAuthority: false,
        authenticationMeetsRequirement: assuranceAtLeast(
          context.authenticationStrength,
          requiredAssuranceFor('AUTHORITY_PATH_REHEARSE'),
        ),
        priorExecutionKey: prior,
      },
      (verified) => {
        const record = this.evidence.seal('AUTHORITY_REHEARSAL_EXECUTED', {
          requestId,
          proposalId: proposal.proposalId,
          authorityId: verified.authorityId,
          actorId: context.user.actorId,
          resourceId,
          environment: ENVIRONMENT,
        });
        return ok({ evidenceId: record.evidenceId });
      },
    );
    if (!gated.ok) {
      const failed = advanceProposal(proposal, 'FAILED', this.clock);
      if (failed.ok) {
        this.proposals.put(failed.value);
        proposal = failed.value;
      }
      const evidence = this.sealDenial('AUTHORITY_EXECUTION_REJECTED', {
        requestId,
        proposalId: proposal.proposalId,
        code: gated.error.code,
      });
      return this.respond(
        403,
        'DENIED',
        clientDenial('AUTHORITY_REJECTED', { evidenceId: evidence, requestId }),
        context,
        proposal,
        evidence,
        requestId,
      );
    }

    const executed = advanceProposal(proposal, 'EXECUTED', this.clock, {
      executionAuthorityId: gated.value.verified.authorityId,
      policyDecisionRef: evaluated.kernel.policySnapshot ?? null,
    });
    if (executed.ok) {
      proposal = executed.value;
      this.proposals.put(proposal);
    }
    this.executedKeys.set(idempotencyKey, proposal.proposalId);
    return this.respond(200, 'ALLOWED', null, context, proposal, gated.value.value.evidenceId, requestId);
  }

  approveProposal(input: {
    readonly proposalId: string;
    readonly approverContext: AuthorizationContext;
  }): Result<ExecutionProposal, ClientDenial> {
    const proposal = this.proposals.get(input.proposalId);
    if (!proposal) {
      return err(clientDenial('UNAVAILABLE', { requestId: input.approverContext.request.requestId }));
    }
    if (input.approverContext.principalKind === 'AGENT') {
      const evidence = this.sealDenial('AUTHORITY_AGENT_SELF_APPROVE', {
        proposalId,
        agentActorId: input.approverContext.user.actorId,
      });
      return err(clientDenial('AGENT_CANNOT_SELF_APPROVE', {
        evidenceId: evidence,
        requestId: input.approverContext.request.requestId,
      }));
    }
    if (input.approverContext.user.subjectId !== proposal.humanRequesterId) {
      return err(clientDenial('FORBIDDEN', { requestId: input.approverContext.request.requestId }));
    }
    const capable = assertCapability(input.approverContext, 'AGENT_ACTION_APPROVE');
    if (!capable.ok) {
      return capable;
    }
    const approved = advanceProposal(proposal, 'APPROVED', this.clock);
    if (!approved.ok) {
      return err(clientDenial(
        approved.error.code === 'PROPOSAL_EXPIRED' ? 'PROPOSAL_EXPIRED' : 'FORBIDDEN',
        { requestId: input.approverContext.request.requestId },
      ));
    }
    this.proposals.put(approved.value);
    this.evidence.seal('AUTHORITY_HUMAN_APPROVED', {
      proposalId: approved.value.proposalId,
      approverSubjectId: input.approverContext.user.subjectId,
    });
    return ok(approved.value);
  }

  expireProposal(proposalId: string): Result<ExecutionProposal, ClientDenial> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return err(clientDenial('UNAVAILABLE'));
    }
    const expired = advanceProposal(proposal, 'EXPIRED', this.clock);
    if (!expired.ok) {
      return err(clientDenial('PROPOSAL_EXPIRED'));
    }
    this.proposals.put(expired.value);
    this.evidence.seal('AUTHORITY_PROPOSAL_EXPIRED', { proposalId });
    return ok(expired.value);
  }

  private resolveContext(
    request: AuthorityHttpRequest,
    requestId: string,
    capability: ProductCapability,
    resource: { readonly kind: 'account'; readonly id: string } | null,
  ): Result<AuthorizationContext, ClientDenial> {
    const sessionId = request.headers['x-sunrey-session-id'];
    const actorIdHeader = request.headers['x-sunrey-actor-id'];
    const principalKind = parsePrincipal(request.headers['x-sunrey-principal-kind']);
    if (!sessionId && !actorIdHeader) {
      const evidence = this.sealDenial('AUTHORITY_UNAUTHENTICATED', { requestId });
      return err(clientDenial('UNAUTHENTICATED', { evidenceId: evidence, requestId }));
    }
    const resolved = sessionId
      ? this.identity.resolveFromSession(asSessionId(sessionId))
      : this.identity.resolveActorContext(actorIdHeader ?? '');
    if (!resolved.ok) {
      const evidence = this.sealDenial('AUTHORITY_UNAUTHENTICATED', {
        requestId,
        code: resolved.error.code,
      });
      return err(clientDenial('UNAUTHENTICATED', { evidenceId: evidence, requestId }));
    }
    const session = this.identity.getSession(resolved.value.sessionId);
    if (!session) {
      const evidence = this.sealDenial('AUTHORITY_UNAUTHENTICATED', { requestId });
      return err(clientDenial('UNAUTHENTICATED', { evidenceId: evidence, requestId }));
    }
    const identity = this.identity.getIdentity(session.subjectId);
    if (!identity) {
      return err(clientDenial('UNAUTHENTICATED', { requestId }));
    }
    const device = session.deviceId ? this.identity.getDevice(session.deviceId) ?? null : null;
    const facts = this.identity.identityFactsFor(session.actorId);
    const agent = parseAgent(request.headers, session.subjectId);
    return ok(
      deriveAuthorizationContext({
        identityStatus: identity.status,
        session,
        device,
        kyc: this.identity.latestKyc(identity.id) ?? null,
        customerId: facts.customerId,
        jurisdiction: identity.homeJurisdiction,
        capabilities: facts.authorizedCapabilities,
        actorContext: resolved.value,
        requestedCapability: capability,
        requestedResource: resource,
        ownedResource: resource ? this.ownership.get(resource.kind, resource.id) ?? null : null,
        request: {
          requestId,
          correlationId: request.headers['x-sunrey-correlation-id'] ?? null,
          method: request.method,
          path: request.path,
        },
        principalKind,
        agent,
      }),
    );
  }

  private recordPolicy(
    proposal: ExecutionProposal,
    snapshot: ExecutionProposal['policyDecisionRef'],
  ): ExecutionProposal {
    const next = Object.freeze({ ...proposal, policyDecisionRef: snapshot });
    this.proposals.put(next);
    return next;
  }

  private failProposal(
    context: AuthorizationContext,
    proposal: ExecutionProposal,
    display: 'DENIED' | 'EXPIRED',
    requestId: string,
  ): AuthorityHttpResponse {
    const evidence = this.sealDenial('AUTHORITY_PROPOSAL_FAILED', {
      requestId,
      proposalId: proposal.proposalId,
      display,
    });
    return this.respond(
      display === 'EXPIRED' ? 410 : 403,
      display,
      clientDenial(display === 'EXPIRED' ? 'PROPOSAL_EXPIRED' : 'FORBIDDEN', {
        evidenceId: evidence,
        requestId,
      }),
      context,
      proposal,
      evidence,
      requestId,
    );
  }

  private sealDenial(kind: string, payload: Record<string, unknown>): string {
    return this.evidence.seal(kind, sanitizeEvidence(payload)).evidenceId;
  }

  private deny(denial: ClientDenial): AuthorityHttpResponse {
    const display =
      denial.code === 'STEP_UP_REQUIRED'
        ? 'REQUIRES_MFA'
        : denial.code === 'APPROVAL_REQUIRED'
          ? 'REQUIRES_APPROVAL'
          : denial.code === 'COMPLIANCE_REVIEW_REQUIRED'
            ? 'PENDING_COMPLIANCE'
            : denial.code === 'PROPOSAL_EXPIRED'
              ? 'EXPIRED'
              : denial.code === 'UNAVAILABLE'
                ? 'UNAVAILABLE'
                : denial.code === 'UNAUTHENTICATED'
                  ? 'DENIED'
                  : 'DENIED';
    const status =
      denial.code === 'UNAUTHENTICATED' || denial.code === 'STEP_UP_REQUIRED'
        ? 401
        : denial.code === 'UNAVAILABLE'
          ? 503
          : denial.code === 'PROPOSAL_EXPIRED'
            ? 410
            : 403;
    return this.respond(status, display, denial, null, null, denial.evidenceId, denial.requestId);
  }

  private respond(
    status: number,
    display: FrontendAuthorityView['displayState'],
    error: ClientDenial | null,
    authorization: AuthorizationContext | null,
    proposal: ExecutionProposal | null,
    evidenceId: string | null,
    requestId: string | null,
  ): AuthorityHttpResponse {
    return Object.freeze({
      status,
      body: Object.freeze({
        ok: error === null && status < 400,
        frontend: frontendAuthorityView({
          displayState: display,
          proposalId: proposal?.proposalId ?? null,
          clientCode: error?.code ?? null,
          message: error?.message ?? frontendMessage(display),
          requestId,
          expiresAt: proposal?.expiresAt ?? null,
        }),
        authorization,
        proposal,
        evidenceId,
        error,
      }),
    });
  }
}

function frontendMessage(display: FrontendAuthorityView['displayState']): string {
  switch (display) {
    case 'ALLOWED':
      return 'this action is allowed';
    case 'REQUIRES_APPROVAL':
      return 'this action requires approval';
    case 'REQUIRES_MFA':
      return 'this action requires step-up authentication';
    case 'PENDING_COMPLIANCE':
      return 'this action is pending compliance review';
    case 'DENIED':
      return 'this action is denied';
    case 'EXPIRED':
      return 'this action has expired';
    case 'UNAVAILABLE':
      return 'this action is unavailable';
    default:
      return 'this action is pending';
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

function parsePrincipal(value: string | undefined): PrincipalKind {
  if (value === 'AGENT' || value === 'STAFF' || value === 'HUMAN') {
    return value;
  }
  return 'HUMAN';
}

function parseAgent(
  headers: Readonly<Record<string, string | undefined>>,
  humanSubjectId: AuthorizationContext['user']['subjectId'],
): AuthorizationContext['agent'] {
  const agentId = headers['x-sunrey-agent-id'];
  const mandateId = headers['x-sunrey-agent-mandate-id'];
  if (!agentId || !mandateId) {
    return null;
  }
  return Object.freeze({ agentId, mandateId, humanSubjectId });
}

function sanitizeEvidence(payload: Record<string, unknown>): Record<string, unknown> {
  const blocked = /secret|password|privateKey|rawDocument|sessionSecret|signature/i;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (blocked.test(key)) {
      continue;
    }
    if (typeof value === 'string' && blocked.test(value)) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function productOutcomeToFrontend(outcome: ProductPolicyOutcome): FrontendAuthorityView['displayState'] {
  switch (outcome) {
    case 'ALLOW':
      return 'ALLOWED';
    case 'DENY':
      return 'DENIED';
    case 'REQUIRE_APPROVAL':
      return 'REQUIRES_APPROVAL';
    case 'REQUIRE_STEP_UP_AUTH':
      return 'REQUIRES_MFA';
    case 'REQUIRE_COMPLIANCE_REVIEW':
      return 'PENDING_COMPLIANCE';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
    default:
      return 'DENIED';
  }
}
