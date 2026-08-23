/**
 * Wallet key boundary.
 *
 * Frontend and Agent never receive server-controlled signing material.
 * Production signing stays disabled unless an external HSM/KMS/custody
 * activation record is present — which this simulation product path
 * never claims.
 */

import { PRODUCTION_SIGNING_AUTHORIZED } from './taxonomy.ts';

const FORBIDDEN_CLIENT_FIELDS = Object.freeze([
  'complianceApproved',
  'providerOverride',
  'signingKey',
  'privateKeyHex',
  'seedPhrase',
]);

export type KeyBoundaryRefusal = {
  readonly ok: false;
  readonly code: 'SIGNING_MATERIAL_FORBIDDEN' | 'PRODUCTION_SIGNING_DISABLED' | 'AGENT_CANNOT_RECEIVE_KEYS' | 'CLIENT_PRIVILEGED_FIELD';
  readonly message: string;
  readonly productionSigningAuthorized: false;
};

export function assertNoClientSigningMaterial(payload: unknown): KeyBoundaryRefusal | { readonly ok: true } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: true };
  }
  const record = payload as Record<string, unknown>;
  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (field in record && record[field] !== undefined) {
      return {
        ok: false,
        code: 'CLIENT_PRIVILEGED_FIELD',
        message: `client cannot select ${field}`,
        productionSigningAuthorized: false,
      };
    }
  }
  return { ok: true };
}

export function refuseSigningMaterial(audience: 'FRONTEND' | 'AGENT'): KeyBoundaryRefusal {
  return {
    ok: false,
    code: audience === 'AGENT' ? 'AGENT_CANNOT_RECEIVE_KEYS' : 'SIGNING_MATERIAL_FORBIDDEN',
    message:
      audience === 'AGENT'
        ? 'Agent runtime cannot receive wallet signing material'
        : 'client surfaces cannot receive server-controlled signing material',
    productionSigningAuthorized: false,
  };
}

export function productionSigningStatus(hsmReady: boolean): {
  readonly productionSigningAuthorized: false;
  readonly simulationSigningAvailable: boolean;
  readonly reason: string;
} {
  void hsmReady;
  return {
    productionSigningAuthorized: PRODUCTION_SIGNING_AUTHORIZED,
    simulationSigningAvailable: true,
    reason: 'production signing remains disabled without external key infrastructure',
  };
}

export function signingBoundarySnapshot(): {
  readonly frontendReceivesKeys: false;
  readonly agentReceivesKeys: false;
  readonly productionSigningAuthorized: false;
  readonly usesExistingHsmPort: true;
} {
  return {
    frontendReceivesKeys: false,
    agentReceivesKeys: false,
    productionSigningAuthorized: false,
    usesExistingHsmPort: true,
  };
}
