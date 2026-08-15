import type { UtcInstant } from '../../domain/src/time.ts';
import { isExpired } from '../../config/src/clock.ts';
import type { AuthenticationAssurance } from './assurance.ts';
import { assuranceAtLeast } from './assurance.ts';
import type { CapabilityGrantId, SolsticeIdentityId } from './ids.ts';
import { kycIsFresh, type KycRecord } from './kyc.ts';
import { isUsableIdentityStatus, type IdentityStatus } from './model.ts';
import type { IdentitySession } from './auth.ts';

/**
 * Authoritative capabilities. These are not ActionTypes.
 * Mapping onto Kernel action types is explicit and one-way.
 */
export const IDENTITY_CAPABILITIES = [
  'ACCOUNT_OPEN_REQUEST',
  'TRANSFER_REQUEST',
  'VIEW_ACCOUNT',
  'MANAGE_PROFILE',
  'MANAGE_BENEFICIARY',
  'POST_DEPOSIT_REQUEST',
  'POST_WITHDRAWAL_REQUEST',
  'PAYMENT_REQUEST',
  'FX_QUOTE_REQUEST',
  'HOLD_REQUEST',
  'FEE_ASSESS_REQUEST',
  'REVERSAL_REQUEST',
  'INTEREST_POST_REQUEST',
  'SETTLEMENT_REQUEST',
  'CARD_MANAGE_REQUEST',
  'CARD_AUTHORIZE_REQUEST',
  'CARD_CLEAR_REQUEST',
] as const;

export type IdentityCapability = (typeof IDENTITY_CAPABILITIES)[number];

export const ACTION_TYPE_FOR_CAPABILITY: Readonly<Record<IdentityCapability, readonly string[]>> = {
  ACCOUNT_OPEN_REQUEST: ['OPEN_ACCOUNT'],
  TRANSFER_REQUEST: ['INTERNAL_TRANSFER'],
  VIEW_ACCOUNT: [],
  MANAGE_PROFILE: [],
  MANAGE_BENEFICIARY: ['CREATE_BENEFICIARY'],
  POST_DEPOSIT_REQUEST: ['POST_DEPOSIT'],
  POST_WITHDRAWAL_REQUEST: ['POST_WITHDRAWAL'],
  PAYMENT_REQUEST: ['INITIATE_PAYMENT', 'CANCEL_PAYMENT', 'ACCEPT_INBOUND_PAYMENT'],
  FX_QUOTE_REQUEST: ['CREATE_FX_QUOTE', 'ACCEPT_FX_QUOTE'],
  HOLD_REQUEST: ['CREATE_HOLD', 'RELEASE_HOLD', 'CAPTURE_HOLD', 'CANCEL_HOLD'],
  FEE_ASSESS_REQUEST: ['POST_FEE'],
  REVERSAL_REQUEST: ['POST_REVERSAL'],
  INTEREST_POST_REQUEST: ['POST_INTEREST'],
  SETTLEMENT_REQUEST: ['INITIATE_PENDING_SETTLEMENT', 'SETTLE_PENDING', 'RETURN_PENDING'],
  CARD_MANAGE_REQUEST: [
    'REQUEST_CARD',
    'ACTIVATE_CARD',
    'FREEZE_CARD',
    'UNFREEZE_CARD',
    'CLOSE_CARD',
    'UPDATE_CARD_CONTROLS',
    'OPEN_CARD_DISPUTE',
    'DECIDE_CARD_DISPUTE',
  ],
  CARD_AUTHORIZE_REQUEST: ['AUTHORIZE_CARD_PURCHASE', 'REVERSE_CARD_AUTHORIZATION'],
  CARD_CLEAR_REQUEST: ['CLEAR_CARD_TRANSACTION', 'REFUND_CARD_TRANSACTION', 'ASSESS_CARD_FEE'],
};

export const ACTION_TYPES_FOR_CAPABILITY = ACTION_TYPE_FOR_CAPABILITY;

export type CapabilityGrant = {
  readonly grantId: CapabilityGrantId;
  readonly identityId: SolsticeIdentityId;
  readonly capability: IdentityCapability;
  readonly source: 'IDENTITY_SERVICE' | 'ROLE' | 'RELATIONSHIP';
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
};

export function isGrantActive(grant: CapabilityGrant, now: UtcInstant): boolean {
  return grant.revokedAt === null && !isExpired(grant.expiresAt, now);
}

export function actionTypesFromCapabilities(
  capabilities: readonly IdentityCapability[],
): readonly string[] {
  const types = new Set<string>();
  for (const capability of capabilities) {
    for (const actionType of ACTION_TYPE_FOR_CAPABILITY[capability]) {
      types.add(actionType);
    }
  }
  return Object.freeze([...types]);
}

export type CapabilityDerivationFacts = {
  readonly identityStatus: IdentityStatus;
  readonly session: IdentitySession | null;
  readonly kyc: KycRecord | null;
  readonly grants: readonly CapabilityGrant[];
  readonly now: UtcInstant;
};

const FINANCIAL_CAPABILITIES: readonly IdentityCapability[] = [
  'ACCOUNT_OPEN_REQUEST',
  'TRANSFER_REQUEST',
  'POST_DEPOSIT_REQUEST',
  'POST_WITHDRAWAL_REQUEST',
  'PAYMENT_REQUEST',
  'FX_QUOTE_REQUEST',
  'HOLD_REQUEST',
  'FEE_ASSESS_REQUEST',
  'REVERSAL_REQUEST',
  'INTEREST_POST_REQUEST',
  'SETTLEMENT_REQUEST',
  'CARD_MANAGE_REQUEST',
  'CARD_AUTHORIZE_REQUEST',
  'CARD_CLEAR_REQUEST',
];

/**
 * Capabilities derive from identity facts. An actor cannot add a grant
 * by asserting an ActionType. MANAGE_BENEFICIARY is never inferred.
 */
export function deriveCapabilities(facts: CapabilityDerivationFacts): readonly IdentityCapability[] {
  if (!isUsableIdentityStatus(facts.identityStatus)) {
    return Object.freeze([]);
  }
  if (!facts.session || facts.session.revocationState !== 'ACTIVE') {
    return Object.freeze([]);
  }
  if (isExpired(facts.session.expiresAt, facts.now)) {
    return Object.freeze([]);
  }
  if (facts.session.riskState === 'BLOCKED') {
    return Object.freeze([]);
  }

  const granted = new Set<IdentityCapability>();
  for (const grant of facts.grants) {
    if (!isGrantActive(grant, facts.now)) {
      continue;
    }
    if (grant.capability === 'MANAGE_BENEFICIARY') {
      granted.add('MANAGE_BENEFICIARY');
      continue;
    }
    granted.add(grant.capability);
  }

  if (assuranceAtLeast(facts.session.authenticationStrength, 'STANDARD')) {
    granted.add('VIEW_ACCOUNT');
    granted.add('MANAGE_PROFILE');
  }

  const kycFresh = facts.kyc !== null && kycIsFresh(facts.kyc, facts.now);
  if (!kycFresh || !assuranceAtLeast(facts.session.authenticationStrength, 'STRONG')) {
    for (const financial of FINANCIAL_CAPABILITIES) {
      granted.delete(financial);
    }
  }

  return Object.freeze([...granted]);
}

export function requiredAssuranceFor(capability: IdentityCapability): AuthenticationAssurance {
  if (FINANCIAL_CAPABILITIES.includes(capability) || capability === 'MANAGE_BENEFICIARY') {
    return 'STRONG';
  }
  return 'STANDARD';
}
