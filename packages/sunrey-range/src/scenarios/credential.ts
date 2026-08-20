import {
  acceptWebhookVersion,
  authorizeCredentialBinding,
  credentialCannotIssueExecutionAuthority,
  credentialCannotMint,
  credentialCannotPostLedger,
  evaluateCredentialValidity,
  fixtureBankingCredential,
  fixtureHref,
  fixtureKycCredential,
  fixtureOracleCredential,
  fixtureSecretStore,
  fixtureWebhookCredential,
  FIXTURE_NOW,
  redactCredentialText,
  RegulatedSecretResolver,
  replaceProviderCredential,
  revokeCredential,
  startRotation,
} from '../../../security/src/regulated/credentials/index.ts';
import { createProviderCredentialDescriptor } from '../../../security/src/regulated/credentials/descriptor.ts';
import { runProductionAttack, safetyScenario, type ProductionAttackOutcome } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const CRED_INVARIANTS = [
  'NO_RAW_SECRET_EXPOSURE',
  'NO_CROSS_WORKLOAD_CREDENTIAL_USE',
  'RAW_SECRET_NOT_EXPOSED',
  'EXECUTION_AUTHORITY_REQUIRED',
  'PRODUCTION_NOT_ACTIVE',
] as const;

export const credentialScenarios: readonly AttackScenario[] = [
  safetyScenario({
    scenarioId: 'CRED-WRONG-WORKLOAD',
    seed: 15701,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'KYC credential used by banking workload',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_WORKLOAD_MISMATCH',
    recovery: 'CREDENTIAL_ROTATION',
  }),
  safetyScenario({
    scenarioId: 'CRED-WRONG-DOMAIN',
    seed: 15702,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'KYC credential used for oracle domain',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_DOMAIN_MISMATCH',
  }),
  safetyScenario({
    scenarioId: 'CRED-EXPIRED',
    seed: 15703,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'expired credential presented',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_EXPIRED',
  }),
  safetyScenario({
    scenarioId: 'CRED-REVOKED',
    seed: 15704,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'revoked credential presented',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_REVOKED',
  }),
  safetyScenario({
    scenarioId: 'CRED-ROTATION-OVERLAP-ABUSE',
    seed: 15705,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'old webhook key after rotation overlap',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_RETIRED',
    recovery: 'CREDENTIAL_ROTATION',
  }),
  safetyScenario({
    scenarioId: 'CRED-OLD-WEBHOOK-KEY',
    seed: 15706,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'old webhook signing version after overlap expires',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_RETIRED',
  }),
  safetyScenario({
    scenarioId: 'CRED-SECRET-PATH-LEAK',
    seed: 15707,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'secret path leakage attempt',
    invariants: CRED_INVARIANTS,
    detection: 'SECRET_PATH_REDACTED',
  }),
  safetyScenario({
    scenarioId: 'CRED-AUTHORIZATION-HEADER-LOG',
    seed: 15708,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'Authorization header logged',
    invariants: CRED_INVARIANTS,
    detection: 'AUTHORIZATION_REDACTED',
  }),
  safetyScenario({
    scenarioId: 'CRED-REPLAY',
    seed: 15709,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'credential handle replay after revoke',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_REVOKED',
  }),
  safetyScenario({
    scenarioId: 'CRED-PROVIDER-A-AT-B',
    seed: 15710,
    category: 'CREDENTIAL_ABUSE',
    subsystem: 'credential-plane',
    attack: 'provider A credential used at provider B',
    invariants: CRED_INVARIANTS,
    detection: 'CREDENTIAL_SCOPE_MISMATCH',
  }),
];

function expiredDescriptor() {
  const created = createProviderCredentialDescriptor({
    credentialId: 'expired-kyc',
    providerId: 'fixture-kyc',
    providerDomain: 'IDENTITY_KYC',
    credentialKind: 'API_KEY_REFERENCE',
    credentialHref: fixtureHref('kyc/api-key'),
    workloadIdentity: 'kyc_worker',
    allowedOperations: ['VERIFY_IDENTITY'],
    networkZone: 'DATA_PRIVATE',
    endpointProfileRef: 'profile:kyc:sandbox',
    issuedAt: '2020-01-01T00:00:00.000Z',
    notBefore: '2020-01-01T00:00:00.000Z',
    expiresAt: '2020-02-01T00:00:00.000Z',
  });
  if (!created.ok) {
    throw new Error(created.error.reason);
  }
  return created.value;
}

export function runCredential(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const sample = fixtureKycCredential();
    const authorityHeld =
      credentialCannotIssueExecutionAuthority(sample) &&
      credentialCannotMint(sample) &&
      credentialCannotPostLedger(sample);
    switch (scenario.scenarioId) {
      case 'CRED-WRONG-WORKLOAD': {
        const result = authorizeCredentialBinding({
          credential: fixtureKycCredential(),
          workload: 'banking_worker',
          providerDomain: 'IDENTITY_KYC',
          operation: 'VERIFY_IDENTITY',
          now: FIXTURE_NOW,
        });
        return closed(!result.ok && result.error.code === 'CREDENTIAL_WORKLOAD_MISMATCH' && authorityHeld, result);
      }
      case 'CRED-WRONG-DOMAIN': {
        const result = authorizeCredentialBinding({
          credential: fixtureKycCredential(),
          workload: 'kyc_worker',
          providerDomain: 'ORACLE_DATA_SOURCE',
          operation: 'VERIFY_IDENTITY',
          now: FIXTURE_NOW,
        });
        return closed(!result.ok && result.error.code === 'CREDENTIAL_DOMAIN_MISMATCH' && authorityHeld, result);
      }
      case 'CRED-EXPIRED': {
        const result = evaluateCredentialValidity(expiredDescriptor(), FIXTURE_NOW);
        return closed(!result.ok && result.error.code === 'CREDENTIAL_EXPIRED' && authorityHeld, result);
      }
      case 'CRED-REVOKED':
      case 'CRED-REPLAY': {
        const revoked = revokeCredential(fixtureKycCredential());
        const result = authorizeCredentialBinding({
          credential: revoked,
          workload: 'kyc_worker',
          providerDomain: 'IDENTITY_KYC',
          operation: 'VERIFY_IDENTITY',
          now: FIXTURE_NOW,
        });
        return closed(!result.ok && result.error.code === 'CREDENTIAL_REVOKED' && authorityHeld, result);
      }
      case 'CRED-ROTATION-OVERLAP-ABUSE':
      case 'CRED-OLD-WEBHOOK-KEY': {
        startRotation({
          current: fixtureWebhookCredential(1),
          nextVersion: 2,
          now: FIXTURE_NOW,
          overlapUntil: '2026-08-19T00:00:00.000Z',
          allowOverlap: true,
        });
        const result = acceptWebhookVersion({
          requestedVersion: 1,
          currentVersion: 2,
          previousVersion: 1,
          overlapUntil: '2026-08-19T00:00:00.000Z',
          now: FIXTURE_NOW,
        });
        return closed(!result.ok && result.error.code === 'CREDENTIAL_RETIRED' && authorityHeld, result);
      }
      case 'CRED-SECRET-PATH-LEAK': {
        const resolver = new RegulatedSecretResolver(fixtureSecretStore());
        const resolved = resolver.resolveForWorkload({
          credential: fixtureOracleCredential(),
          workload: 'oracle_collector',
          providerDomain: 'ORACLE_DATA_SOURCE',
          operation: 'READ_REFERENCE_DATA',
          now: FIXTURE_NOW,
        });
        const leaked = resolved.ok && String(resolved.value) === '[REDACTED]';
        return closed(leaked && authorityHeld, { ok: leaked, detail: 'handle redacted' });
      }
      case 'CRED-AUTHORIZATION-HEADER-LOG': {
        const redacted = redactCredentialText('Authorization: Bearer super-secret-token-value');
        return closed(!redacted.includes('super-secret') && authorityHeld, { ok: true, detail: redacted });
      }
      case 'CRED-PROVIDER-A-AT-B': {
        const result = replaceProviderCredential({
          from: fixtureKycCredential(),
          toProviderId: 'fixture-kyc-b',
          toDomain: 'IDENTITY_KYC',
          toHref: fixtureHref('kyc/api-key'),
        });
        return closed(!result.ok && authorityHeld, result);
      }
      default: {
        const unused = fixtureBankingCredential();
        return closed(unused.providerDomain === 'BANKING_REFERENCE' && authorityHeld, unused);
      }
    }
  });
}

function closed(held: boolean, result: unknown): ProductionAttackOutcome {
  return {
    blocked: held,
    safetyHeld: held,
    detail: stableDetail(result),
  };
}

function stableDetail(result: unknown): string {
  if (result && typeof result === 'object') {
    const record = result as { ok?: boolean; error?: { code?: string }; detail?: string };
    if (typeof record.error?.code === 'string') {
      return `ok=${String(record.ok)} code=${record.error.code}`;
    }
    if (typeof record.detail === 'string') {
      return `ok=${String(record.ok)} detail=${record.detail}`;
    }
    if ('ok' in record) {
      return `ok=${String(record.ok)}`;
    }
  }
  return String(result);
}
