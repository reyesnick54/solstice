/**
 * Wave 7 — future mainnet activation ceremony design.
 *
 * DESIGN ONLY. This module evaluates prerequisites and records readiness.
 * It does NOT execute activation. No single environment variable may turn
 * all production monetary systems on.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { sha256Hex } from '../hash.ts';

export const MAINNET_CEREMONY_PREREQUISITES = [
  'approved_genesis',
  'validator_set',
  'governance_configuration',
  'production_keys',
  'backups',
  'monitoring',
  'security_audit',
  'regulatory_feature_gates',
  'economics_approval',
  'sunrey_activation_decision',
  'moonrey_activation_decision',
] as const;

export type MainnetCeremonyPrerequisite = (typeof MAINNET_CEREMONY_PREREQUISITES)[number];

export type PrerequisiteStatus = 'SATISFIED' | 'MISSING' | 'FIXTURE_ONLY';

export type MainnetCeremonyPrerequisiteRecord = {
  readonly prerequisite: MainnetCeremonyPrerequisite;
  readonly status: PrerequisiteStatus;
  readonly evidenceRef: string | null;
  readonly notes: string;
};

export type MainnetCeremonyReadiness = {
  readonly ceremonyId: string;
  readonly evaluatedAt: string;
  readonly prerequisites: readonly MainnetCeremonyPrerequisiteRecord[];
  readonly allSatisfied: boolean;
  readonly singleEnvActivationForbidden: true;
  readonly mainnetRemainsDisabled: true;
  readonly readinessHash: string;
};

export type MainnetCeremonyInput = {
  readonly ceremonyId: string;
  readonly evaluatedAt: string;
  readonly prerequisiteStates: Readonly<Partial<Record<MainnetCeremonyPrerequisite, PrerequisiteStatus>>>;
  readonly evidenceRefs?: Readonly<Partial<Record<MainnetCeremonyPrerequisite, string>>>;
};

const PREREQUISITE_NOTES: Readonly<Record<MainnetCeremonyPrerequisite, string>> = Object.freeze({
  approved_genesis: 'Chunk 164 launch freeze hash bound; genesis ceremony transcript verified',
  validator_set: 'Production validator dossiers accepted; set frozen at epoch boundary',
  governance_configuration: 'Multi-party governance thresholds configured and signed',
  production_keys: 'HSM/KMS connected; non-exportable handles for governance and validator keys',
  backups: 'Provider backup references recorded; no plaintext key bytes',
  monitoring: 'Control room, alerting, and evidence vault monitoring active',
  security_audit: 'External security audit complete with no unresolved critical findings',
  regulatory_feature_gates: 'Chunk 161 operating scope and corridor eligibility satisfied',
  economics_approval: 'Chunk 163 economic parameter authorization package signed',
  sunrey_activation_decision: 'SunRey issuance activation decision by authorized humans',
  moonrey_activation_decision: 'MoonRey issuance activation decision by authorized humans',
});

export function evaluateMainnetCeremonyReadiness(
  input: MainnetCeremonyInput,
): MainnetCeremonyReadiness {
  const prerequisites = MAINNET_CEREMONY_PREREQUISITES.map((prerequisite) => {
    const status = input.prerequisiteStates[prerequisite] ?? 'MISSING';
    return Object.freeze({
      prerequisite,
      status,
      evidenceRef: input.evidenceRefs?.[prerequisite] ?? null,
      notes: PREREQUISITE_NOTES[prerequisite],
    });
  });
  const allSatisfied = prerequisites.every((row) => row.status === 'SATISFIED');
  const readinessHash = sha256Hex(
    JSON.stringify({
      ceremonyId: input.ceremonyId,
      evaluatedAt: input.evaluatedAt,
      prerequisites: prerequisites.map((row) => `${row.prerequisite}:${row.status}`),
    }),
  );
  return Object.freeze({
    ceremonyId: input.ceremonyId,
    evaluatedAt: input.evaluatedAt,
    prerequisites,
    allSatisfied,
    singleEnvActivationForbidden: true,
    mainnetRemainsDisabled: true,
    readinessHash,
  });
}

/**
 * Refuses any attempt to activate mainnet via a single environment variable.
 */
export function refuseSingleEnvMainnetActivation(
  envVar: string,
  value: string,
): SecurityResult<true> {
  const forbidden = [
    'ENVIRONMENT',
    'LIVE_BANKING_ENABLED',
    'LIVE_PAYMENTS_ENABLED',
    'LIVE_CUSTODY_ENABLED',
    'LIVE_EXCHANGE_ENABLED',
    'LIVE_HIN_BASED_ISSUANCE_ENABLED',
    'LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED',
    'PRODUCTION_HSM_KMS_CONFIGURED',
    'MAINNET_ENABLED',
  ];
  if (forbidden.includes(envVar) && (value === 'true' || value === 'production' || value === 'mainnet')) {
    return securityErr(
      'PRODUCTION_CLAIM_FORBIDDEN',
      `single environment variable ${envVar} cannot activate production monetary systems`,
    );
  }
  return securityOk(true);
}

export function assertCeremonyNotExecuted(readiness: MainnetCeremonyReadiness): SecurityResult<true> {
  if (!readiness.mainnetRemainsDisabled) {
    return securityErr('PRODUCTION_CLAIM_FORBIDDEN', 'mainnet activation ceremony must not execute in simulation');
  }
  return securityOk(true);
}

export function assertMissingPrerequisiteBlocksActivation(
  readiness: MainnetCeremonyReadiness,
): SecurityResult<true> {
  if (!readiness.allSatisfied) {
    const missing = readiness.prerequisites
      .filter((row) => row.status !== 'SATISFIED')
      .map((row) => row.prerequisite);
    return securityErr(
      'CEREMONY_STATE_INVALID',
      `mainnet activation blocked: missing prerequisites: ${missing.join(', ')}`,
    );
  }
  return securityOk(true);
}
