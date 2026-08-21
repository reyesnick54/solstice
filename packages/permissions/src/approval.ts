/**
 * Reusable approval state machine for regulated execution proposals.
 * Transitions are validated server-side. Agent proposal states remain
 * in packages/sunrey-agent and are not replaced.
 */
export const APPROVAL_STATES = [
  'DRAFT',
  'PROPOSED',
  'POLICY_REVIEW',
  'AWAITING_USER_APPROVAL',
  'AWAITING_STEP_UP_AUTH',
  'AWAITING_COMPLIANCE',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
] as const;

export type ApprovalState = (typeof APPROVAL_STATES)[number];

export const TERMINAL_APPROVAL_STATES: readonly ApprovalState[] = [
  'EXECUTED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
];

const ALLOWED_TRANSITIONS: Readonly<Record<ApprovalState, readonly ApprovalState[]>> = {
  DRAFT: ['PROPOSED', 'CANCELLED', 'EXPIRED'],
  PROPOSED: ['POLICY_REVIEW', 'CANCELLED', 'EXPIRED', 'REJECTED'],
  POLICY_REVIEW: [
    'AWAITING_USER_APPROVAL',
    'AWAITING_STEP_UP_AUTH',
    'AWAITING_COMPLIANCE',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED',
  ],
  AWAITING_USER_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'AWAITING_STEP_UP_AUTH'],
  AWAITING_STEP_UP_AUTH: ['POLICY_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  AWAITING_COMPLIANCE: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: ['EXECUTING', 'EXPIRED', 'CANCELLED'],
  EXECUTING: ['EXECUTED', 'FAILED'],
  EXECUTED: [],
  REJECTED: [],
  EXPIRED: [],
  FAILED: [],
  CANCELLED: [],
};

export type ApprovalTransitionFailure = {
  readonly code: 'ILLEGAL_APPROVAL_TRANSITION' | 'PROPOSAL_EXPIRED';
  readonly message: string;
};

export function isApprovalState(value: unknown): value is ApprovalState {
  return typeof value === 'string' && (APPROVAL_STATES as readonly string[]).includes(value);
}

export function isTerminalApprovalState(state: ApprovalState): boolean {
  return TERMINAL_APPROVAL_STATES.includes(state);
}

export function canTransitionApproval(from: ApprovalState, to: ApprovalState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transitionApproval(
  from: ApprovalState,
  to: ApprovalState,
): { readonly ok: true; readonly state: ApprovalState } | { readonly ok: false; readonly error: ApprovalTransitionFailure } {
  if (!canTransitionApproval(from, to)) {
    return {
      ok: false,
      error: {
        code: 'ILLEGAL_APPROVAL_TRANSITION',
        message: `cannot move approval from ${from} to ${to}`,
      },
    };
  }
  return { ok: true, state: to };
}
