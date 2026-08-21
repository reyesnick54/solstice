/**
 * Client-safe denial codes. Internal rule, sanctions, and pack details
 * stay on the evidence record and are not returned to Lovable.
 */
export const CLIENT_DENIAL_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'RESOURCE_NOT_OWNED',
  'PERMISSION_DENIED',
  'POLICY_DENIED',
  'STEP_UP_REQUIRED',
  'APPROVAL_REQUIRED',
  'COMPLIANCE_REVIEW_REQUIRED',
  'PROPOSAL_EXPIRED',
  'AUTHORITY_REJECTED',
  'IDEMPOTENCY_CONFLICT',
  'CLIENT_PRIVILEGE_REJECTED',
  'AGENT_CANNOT_SELF_APPROVE',
  'UNAVAILABLE',
] as const;

export type ClientDenialCode = (typeof CLIENT_DENIAL_CODES)[number];

export const CLIENT_SAFE_DENIAL_MESSAGES: Readonly<Record<ClientDenialCode, string>> = {
  UNAUTHENTICATED: 'authentication is required',
  FORBIDDEN: 'this action is not permitted',
  RESOURCE_NOT_OWNED: 'the requested resource is not available',
  PERMISSION_DENIED: 'the requested capability is not granted',
  POLICY_DENIED: 'this action is not permitted',
  STEP_UP_REQUIRED: 'stronger authentication is required',
  APPROVAL_REQUIRED: 'this action requires approval',
  COMPLIANCE_REVIEW_REQUIRED: 'this action is pending review',
  PROPOSAL_EXPIRED: 'this proposal has expired',
  AUTHORITY_REJECTED: 'execution was refused',
  IDEMPOTENCY_CONFLICT: 'this request conflicts with a prior execution',
  CLIENT_PRIVILEGE_REJECTED: 'authorization claims cannot be supplied by the client',
  AGENT_CANNOT_SELF_APPROVE: 'an Agent cannot approve its own proposal',
  UNAVAILABLE: 'this action is temporarily unavailable',
};

export type ClientDenial = {
  readonly code: ClientDenialCode;
  readonly message: string;
  readonly evidenceId: string | null;
  readonly requestId: string | null;
};

export function clientDenial(
  code: ClientDenialCode,
  input: { readonly evidenceId?: string | null; readonly requestId?: string | null } = {},
): ClientDenial {
  return Object.freeze({
    code,
    message: CLIENT_SAFE_DENIAL_MESSAGES[code],
    evidenceId: input.evidenceId ?? null,
    requestId: input.requestId ?? null,
  });
}

export const PRIVILEGED_CLIENT_CLAIM_KEYS = [
  'executionAuthority',
  'execution_authority',
  'roles',
  'permissions',
  'authorizedCapabilities',
  'authorized_capabilities',
  'kycState',
  'kyc_state',
  'kernelDecision',
  'kernel_decision',
  'policyDecision',
  'policy_decision',
  'approvalState',
  'approval_state',
  'identityStatus',
  'identity_status',
  'authenticationStrength',
  'authentication_strength',
  'staffRole',
  'staff_role',
  'principalKind',
  'principal_kind',
] as const;

export function privilegedClientClaims(body: unknown): readonly string[] {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return Object.freeze([]);
  }
  const keys = Object.keys(body as Record<string, unknown>);
  return Object.freeze(
    PRIVILEGED_CLIENT_CLAIM_KEYS.filter((key) => keys.includes(key)),
  );
}
