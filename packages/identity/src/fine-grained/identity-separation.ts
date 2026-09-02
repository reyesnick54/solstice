import type { SolsticeIdentityId } from '../ids.ts';

/**
 * Login/authentication identity — OIDC subject, session, passkey binding.
 * Must not be conflated with economic or governance identity.
 */
export type AuthenticationIdentity = {
  readonly kind: 'AUTHENTICATION';
  readonly authenticationIdentityId: string;
  readonly subjectId: SolsticeIdentityId;
  readonly issuer: string;
  readonly assuranceLevel: string;
};

/**
 * Pseudonymous human economic identity — contribution, HIN, settlement.
 */
export type HumanEconomicIdentity = {
  readonly kind: 'HUMAN_ECONOMIC';
  readonly economicIdentityId: string;
  readonly pseudonymousRef: string;
  readonly contributionRegistryRef: string | null;
};

/**
 * Wallet / custody controller identity — on-chain or custody-bound.
 */
export type WalletIdentity = {
  readonly kind: 'WALLET';
  readonly walletIdentityId: string;
  readonly walletRef: string;
  readonly controllerSubjectId: SolsticeIdentityId | null;
};

/**
 * Human governance identity — ceremony-bound, distinct from login.
 */
export type GovernanceIdentity = {
  readonly kind: 'GOVERNANCE';
  readonly governanceIdentityId: string;
  readonly ceremonyParticipantRef: string | null;
};

/**
 * Validator operator identity — consensus participation.
 */
export type ValidatorIdentity = {
  readonly kind: 'VALIDATOR';
  readonly validatorIdentityId: string;
  readonly operatorRef: string;
  readonly keyRole: string;
};

export type SeparatedIdentity =
  | AuthenticationIdentity
  | HumanEconomicIdentity
  | WalletIdentity
  | GovernanceIdentity
  | ValidatorIdentity;

export type IdentityLinkKind =
  | 'AUTHENTICATES'
  | 'CONTROLS_WALLET'
  | 'BINDS_ECONOMIC'
  | 'GOVERNANCE_PARTICIPANT'
  | 'VALIDATOR_OPERATOR';

export type IdentityLink = {
  readonly linkId: string;
  readonly kind: IdentityLinkKind;
  readonly fromIdentityId: string;
  readonly toIdentityId: string;
  readonly establishedAt: string;
  readonly revokedAt: string | null;
};

/**
 * Controlled links among separated identity planes.
 * Changing authentication identity does not alter economic identity.
 */
export class IdentityLinkRegistry {
  readonly #links = new Map<string, IdentityLink>();

  link(entry: IdentityLink): IdentityLink {
    const frozen = Object.freeze({ ...entry });
    this.#links.set(entry.linkId, frozen);
    return frozen;
  }

  revoke(linkId: string, revokedAt: string): IdentityLink | undefined {
    const current = this.#links.get(linkId);
    if (!current) {
      return undefined;
    }
    const updated = Object.freeze({ ...current, revokedAt });
    this.#links.set(linkId, updated);
    return updated;
  }

  findActive(kind: IdentityLinkKind, fromIdentityId: string): readonly IdentityLink[] {
    return [...this.#links.values()].filter(
      (link) => link.kind === kind && link.fromIdentityId === fromIdentityId && link.revokedAt === null,
    );
  }

  resolveEconomicIdentity(authenticationIdentityId: string): HumanEconomicIdentity | null {
    const active = this.findActive('BINDS_ECONOMIC', authenticationIdentityId);
    if (active.length === 0) {
      return null;
    }
    return {
      kind: 'HUMAN_ECONOMIC',
      economicIdentityId: active[0]!.toIdentityId,
      pseudonymousRef: active[0]!.toIdentityId,
      contributionRegistryRef: null,
    };
  }
}

export function authenticationChangePreservesEconomicIdentity(
  beforeEconomicIdentityId: string | null,
  afterEconomicIdentityId: string | null,
): boolean {
  if (beforeEconomicIdentityId === null || afterEconomicIdentityId === null) {
    return false;
  }
  return beforeEconomicIdentityId === afterEconomicIdentityId;
}
