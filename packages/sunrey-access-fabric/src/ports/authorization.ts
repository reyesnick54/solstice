import type { ExperienceBundle } from '../types/experience-bundle.ts';

export type AuthorizationDecision =
  | { readonly ok: true; readonly authorizationId: string; readonly evidenceId: string }
  | { readonly ok: false; readonly code: 'UNAUTHORIZED' | 'POLICY_DENIED' | 'QUOTE_EXPIRED'; readonly detail: string };

/**
 * Canonical authorization before consequential reservations.
 * AI proposals alone cannot pass this gate.
 */
export type BundleAuthorizationPort = {
  authorizeBundle(input: {
    readonly bundle: ExperienceBundle;
    readonly confirmedBy: string;
    readonly humanApproved: boolean;
  }): AuthorizationDecision;
};

export class SimulationBundleAuthorization implements BundleAuthorizationPort {
  private readonly evidenceVault: { seal(kind: string, payload: unknown): { evidenceId: string } };

  constructor(evidenceVault: { seal(kind: string, payload: unknown): { evidenceId: string } }) {
    this.evidenceVault = evidenceVault;
  }

  authorizeBundle(input: {
    readonly bundle: ExperienceBundle;
    readonly confirmedBy: string;
    readonly humanApproved: boolean;
  }): AuthorizationDecision {
    if (!input.humanApproved) {
      return {
        ok: false,
        code: 'UNAUTHORIZED',
        detail: 'human approval is required; AI cannot confirm bundles',
      };
    }
    if (input.bundle.proposedBy === 'AI' && !input.confirmedBy) {
      return { ok: false, code: 'UNAUTHORIZED', detail: 'AI-proposed bundles require explicit human confirmation' };
    }
    const now = input.bundle.updatedAt;
    if (now > input.bundle.quoteValidUntil) {
      return { ok: false, code: 'QUOTE_EXPIRED', detail: 'bundle quote has expired' };
    }
    const evidence = this.evidenceVault.seal('access.bundle.authorization', {
      bundleId: input.bundle.bundleId,
      confirmedBy: input.confirmedBy,
      failurePolicy: input.bundle.failurePolicy,
      totalConsideration: {
        minorUnits: input.bundle.totalConsideration.minorUnits.toString(),
        currency: input.bundle.totalConsideration.currency,
      },
    });
    return {
      ok: true,
      authorizationId: `auth_${input.bundle.bundleId}`,
      evidenceId: evidence.evidenceId,
    };
  }
}
