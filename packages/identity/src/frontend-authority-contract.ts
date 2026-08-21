/**
 * Frontend approval contract. The client displays state. The server owns it.
 * Lovable must not treat these labels as authorization.
 */
export const FRONTEND_AUTHORITY_STATES = [
  'ALLOWED',
  'REQUIRES_APPROVAL',
  'REQUIRES_MFA',
  'PENDING_COMPLIANCE',
  'DENIED',
  'EXPIRED',
  'UNAVAILABLE',
  'PENDING',
] as const;

export type FrontendAuthorityState = (typeof FRONTEND_AUTHORITY_STATES)[number];

export type FrontendAuthorityView = {
  readonly displayState: FrontendAuthorityState;
  readonly proposalId: string | null;
  readonly clientCode: string | null;
  readonly message: string;
  readonly requestId: string | null;
  readonly expiresAt: string | null;
  readonly serverOwned: true;
};

export function frontendAuthorityView(input: {
  readonly displayState: FrontendAuthorityState;
  readonly proposalId?: string | null;
  readonly clientCode?: string | null;
  readonly message: string;
  readonly requestId?: string | null;
  readonly expiresAt?: string | null;
}): FrontendAuthorityView {
  return Object.freeze({
    displayState: input.displayState,
    proposalId: input.proposalId ?? null,
    clientCode: input.clientCode ?? null,
    message: input.message,
    requestId: input.requestId ?? null,
    expiresAt: input.expiresAt ?? null,
    serverOwned: true as const,
  });
}
