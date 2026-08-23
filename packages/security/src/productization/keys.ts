/**
 * Key trust-domain separation. One compromised key must not authorize
 * every SunRey trust domain.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { isApplicationKeyPurpose, isChainKeyPurpose, type KeyPurpose } from '../purposes.ts';

export const KEY_TRUST_DOMAINS = [
  'SESSION_TOKEN_SIGNING',
  'PROVIDER_AUTH',
  'LEDGER_EVIDENCE_SIGNING',
  'CHAIN_VALIDATOR',
  'CHAIN_WALLET_CUSTODY',
  'TLS',
  'ENCRYPTION',
  'ADMINISTRATION',
] as const;

export type KeyTrustDomain = (typeof KEY_TRUST_DOMAINS)[number];

export const KEY_DOMAIN_PURPOSES: Readonly<Record<KeyTrustDomain, readonly KeyPurpose[] | readonly []>> =
  Object.freeze({
    SESSION_TOKEN_SIGNING: ['SESSION_SIGNING'],
    PROVIDER_AUTH: ['PROVIDER_AUTHENTICATION', 'SERVICE_AUTHENTICATION', 'WEBHOOK_SIGNING'],
    LEDGER_EVIDENCE_SIGNING: ['EXECUTION_AUTHORITY_SIGNING', 'EVIDENCE_INTEGRITY'],
    CHAIN_VALIDATOR: [
      'VALIDATOR_CONSENSUS_SIGNING',
      'BLOCK_PROPOSAL_SIGNING',
      'P2P_IDENTITY',
      'GENESIS_SIGNING',
      'GOVERNANCE_SIGNING',
    ],
    CHAIN_WALLET_CUSTODY: ['WALLET_SIGNING', 'PYRAMID_CUSTODY_FUTURE'],
    TLS: [],
    ENCRYPTION: ['DATA_ENCRYPTION', 'BACKUP_ENCRYPTION'],
    ADMINISTRATION: ['ADMINISTRATION_SIGNING'],
  });

export function domainForPurpose(purpose: KeyPurpose): KeyTrustDomain | null {
  for (const domain of KEY_TRUST_DOMAINS) {
    if ((KEY_DOMAIN_PURPOSES[domain] as readonly string[]).includes(purpose)) {
      return domain;
    }
  }
  return null;
}

export function assertKeyDomain(
  purpose: KeyPurpose,
  requestedDomain: KeyTrustDomain,
): SecurityResult<KeyPurpose> {
  const actual = domainForPurpose(purpose);
  if (actual !== requestedDomain) {
    return securityErr(
      'KEY_DOMAIN_CROSSING',
      `${purpose} belongs to ${actual ?? 'no domain'}, not ${requestedDomain}`,
    );
  }
  return securityOk(purpose);
}

export function assertNoKeyDomainCrossing(left: KeyPurpose, right: KeyPurpose): SecurityResult<true> {
  const leftDomain = domainForPurpose(left);
  const rightDomain = domainForPurpose(right);
  if (leftDomain === null || rightDomain === null || leftDomain !== rightDomain) {
    return securityErr(
      'KEY_DOMAIN_CROSSING',
      `${left} (${leftDomain}) cannot authorize ${right} (${rightDomain})`,
    );
  }
  return securityOk(true);
}

export function assertApplicationCannotSignChain(purpose: KeyPurpose): SecurityResult<true> {
  if (isChainKeyPurpose(purpose) && isApplicationKeyPurpose(purpose)) {
    return securityErr('PURPOSE_MISMATCH', `${purpose} cannot be both application and chain`);
  }
  if (isChainKeyPurpose(purpose)) {
    return securityErr(
      'PURPOSE_MISMATCH',
      `HMAC application KeyProvider cannot sign chain purpose ${purpose}`,
    );
  }
  return securityOk(true);
}
