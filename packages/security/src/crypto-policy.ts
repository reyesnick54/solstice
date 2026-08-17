import type { CryptoSuite, CryptoSuiteRegistry, SuiteLifecycleState } from './crypto-suite.ts';
import {
  HYBRID_REQUIRED_ROLES,
  type CryptoMigrationState,
} from './crypto-migration.ts';
import { isChainKeyPurpose, type KeyPurpose } from './purposes.ts';

export const CRYPTO_POLICY_OUTCOMES = ['ALLOW', 'VERIFY_ONLY', 'REQUIRE_HYBRID', 'REJECT'] as const;
export type CryptoPolicyOutcome = (typeof CRYPTO_POLICY_OUTCOMES)[number];

export const CRYPTO_POLICY_REASON_CODES = [
  'SUITE_REGISTERED_AND_PERMITTED',
  'UNKNOWN_SUITE',
  'UNKNOWN_ALGORITHM',
  'PURPOSE_NOT_IN_SUITE',
  'ENVIRONMENT_NOT_PERMITTED',
  'LIFECYCLE_DRAFT',
  'LIFECYCLE_TEST_ONLY',
  'LIFECYCLE_BLOCKED',
  'LIFECYCLE_RETIRED',
  'LIFECYCLE_VERIFY_ONLY',
  'LIFECYCLE_DEPRECATED_AFTER_CUTOFF',
  'ACTIVATION_NOT_REACHED',
  'MIGRATION_REQUIRES_HYBRID',
  'MIGRATION_LEGACY_VERIFY_ONLY',
  'MIGRATION_LEGACY_RETIRED',
  'DOWNGRADE_REJECTED',
  'HMAC_NOT_CONSENSUS',
  'AI_CANNOT_ALTER_POLICY',
] as const;

export type CryptoPolicyReasonCode = (typeof CRYPTO_POLICY_REASON_CODES)[number];

export type CryptoActorType =
  | 'USER'
  | 'VALIDATOR'
  | 'ORACLE'
  | 'GOVERNANCE'
  | 'OPERATOR'
  | 'WALLET'
  | 'P2P_PEER'
  | 'APPLICATION'
  | 'MACHINE';

export type CryptoPolicyInput = {
  readonly protocolVersion: string;
  readonly networkId: string;
  readonly epoch?: number;
  readonly height?: number;
  readonly actorType: CryptoActorType;
  readonly keyPurpose: KeyPurpose;
  readonly transactionType?: string;
  readonly suiteId: string;
  readonly securityProfile?: string;
  readonly environment: 'simulation' | 'test' | 'production';
  readonly migrationState: CryptoMigrationState;
  readonly operation: 'SIGN' | 'VERIFY';
};

export type CryptoPolicyDecision = {
  readonly outcome: CryptoPolicyOutcome;
  readonly reasonCode: CryptoPolicyReasonCode;
  readonly suiteLifecycle: SuiteLifecycleState | null;
};

function decision(
  outcome: CryptoPolicyOutcome,
  reasonCode: CryptoPolicyReasonCode,
  suiteLifecycle: SuiteLifecycleState | null,
): CryptoPolicyDecision {
  return Object.freeze({ outcome, reasonCode, suiteLifecycle });
}

function pastCutoff(suite: CryptoSuite, input: CryptoPolicyInput): boolean {
  if (suite.deprecationHeight !== null && input.height !== undefined) {
    return input.height >= suite.deprecationHeight;
  }
  if (suite.deprecationEpoch !== null && input.epoch !== undefined) {
    return input.epoch >= suite.deprecationEpoch;
  }
  return suite.verificationGracePolicy.rejectNewSignatures;
}

function activationReached(suite: CryptoSuite, input: CryptoPolicyInput): boolean {
  if (suite.lifecycleState === 'ACTIVATION_SCHEDULED') {
    if (suite.activationHeight !== null && input.height !== undefined) {
      return input.height >= suite.activationHeight;
    }
    if (suite.activationEpoch !== null && input.epoch !== undefined) {
      return input.epoch >= suite.activationEpoch;
    }
    return false;
  }
  return true;
}

function isHybridSuite(suite: CryptoSuite): boolean {
  return suite.parameterProfile.includes('classical-and-pq');
}

function isClassicalPublicKeySuite(suite: CryptoSuite): boolean {
  return suite.signatureAlgorithm === 'Ed25519' && !isHybridSuite(suite);
}

/**
 * Deterministic CryptoPolicy evaluator.
 *
 * Frozen tables only. There is no setter. AI cannot alter the result.
 */
export function evaluateCryptoPolicy(
  registry: CryptoSuiteRegistry,
  input: CryptoPolicyInput,
): CryptoPolicyDecision {
  const resolved = registry.get(input.suiteId);
  if (!resolved.ok) {
    return decision('REJECT', 'UNKNOWN_SUITE', null);
  }
  const suite = resolved.value;

  if (!suite.purposes.includes(input.keyPurpose)) {
    return decision('REJECT', 'PURPOSE_NOT_IN_SUITE', suite.lifecycleState);
  }

  if (!suite.permittedEnvironments.includes(input.environment)) {
    return decision('REJECT', 'ENVIRONMENT_NOT_PERMITTED', suite.lifecycleState);
  }

  if (input.keyPurpose === 'EXECUTION_AUTHORITY_SIGNING' && isChainKeyPurpose(input.keyPurpose)) {
    return decision('REJECT', 'HMAC_NOT_CONSENSUS', suite.lifecycleState);
  }

  if (suite.signatureAlgorithm === 'HMAC-SHA256' && isChainKeyPurpose(input.keyPurpose)) {
    return decision('REJECT', 'HMAC_NOT_CONSENSUS', suite.lifecycleState);
  }

  switch (suite.lifecycleState) {
    case 'DRAFT':
      return decision('REJECT', 'LIFECYCLE_DRAFT', suite.lifecycleState);
    case 'BLOCKED':
      return decision('REJECT', 'LIFECYCLE_BLOCKED', suite.lifecycleState);
    case 'RETIRED':
      return decision('REJECT', 'LIFECYCLE_RETIRED', suite.lifecycleState);
    case 'TEST_ONLY':
    case 'TESTNET_APPROVED':
      if (input.environment === 'production') {
        return decision('REJECT', 'LIFECYCLE_TEST_ONLY', suite.lifecycleState);
      }
      break;
    case 'VERIFY_ONLY':
      return decision('VERIFY_ONLY', 'LIFECYCLE_VERIFY_ONLY', suite.lifecycleState);
    case 'DEPRECATED':
      if (input.operation === 'SIGN' && pastCutoff(suite, input)) {
        return decision('REJECT', 'LIFECYCLE_DEPRECATED_AFTER_CUTOFF', suite.lifecycleState);
      }
      return decision('VERIFY_ONLY', 'LIFECYCLE_DEPRECATED_AFTER_CUTOFF', suite.lifecycleState);
    case 'ACTIVATION_SCHEDULED':
      if (!activationReached(suite, input)) {
        return decision('REJECT', 'ACTIVATION_NOT_REACHED', suite.lifecycleState);
      }
      break;
    case 'APPROVED_FOR_SIMULATION':
    case 'ACTIVE':
      break;
    default: {
      const _exhaustive: never = suite.lifecycleState;
      return decision('REJECT', 'UNKNOWN_SUITE', _exhaustive);
    }
  }

  if (input.migrationState === 'LEGACY_RETIRED' && isClassicalPublicKeySuite(suite)) {
    return decision('REJECT', 'MIGRATION_LEGACY_RETIRED', suite.lifecycleState);
  }

  if (input.migrationState === 'LEGACY_VERIFY_ONLY' && isClassicalPublicKeySuite(suite)) {
    return decision('VERIFY_ONLY', 'MIGRATION_LEGACY_VERIFY_ONLY', suite.lifecycleState);
  }

  if (
    input.migrationState === 'HYBRID_REQUIRED_SELECTED_ROLES' &&
    (HYBRID_REQUIRED_ROLES as readonly string[]).includes(input.keyPurpose) &&
    !isHybridSuite(suite)
  ) {
    if (input.operation === 'SIGN') {
      return decision('REQUIRE_HYBRID', 'MIGRATION_REQUIRES_HYBRID', suite.lifecycleState);
    }
    return decision('VERIFY_ONLY', 'MIGRATION_REQUIRES_HYBRID', suite.lifecycleState);
  }

  if (input.migrationState === 'PQ_PRIMARY' && isClassicalPublicKeySuite(suite)) {
    return decision('VERIFY_ONLY', 'MIGRATION_LEGACY_VERIFY_ONLY', suite.lifecycleState);
  }

  if (input.operation === 'SIGN' && suite.verificationGracePolicy.rejectNewSignatures) {
    return decision('REJECT', 'LIFECYCLE_DEPRECATED_AFTER_CUTOFF', suite.lifecycleState);
  }

  return decision('ALLOW', 'SUITE_REGISTERED_AND_PERMITTED', suite.lifecycleState);
}

export function canOriginate(decision: CryptoPolicyDecision): boolean {
  return decision.outcome === 'ALLOW' || decision.outcome === 'REQUIRE_HYBRID';
}

export const CRYPTO_POLICY_ENGINE_ID = 'packages/security/src/crypto-policy.ts' as const;
export const CRYPTO_POLICY_MUTATION_API = null;
