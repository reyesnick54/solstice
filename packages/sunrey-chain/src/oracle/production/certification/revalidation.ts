import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { OracleIncidentControl } from '../incident.ts';
import type { ProductionOracleRejection } from '../types.ts';
import type {
  CertificationPolicy,
  CertificationSubject,
  EconomicDataSourceCertificationRecord,
  ExpiryReason,
  RevalidationTrigger,
} from './types.ts';

export type RevalidationDecision = {
  readonly required: boolean;
  readonly suspend: boolean;
  readonly triggers: readonly RevalidationTrigger[];
  readonly expiryReasons: readonly ExpiryReason[];
  readonly nextStatus: 'REVALIDATION_REQUIRED' | 'SUSPENDED' | 'UNCHANGED';
};

export function evaluateCertificationExpiry(
  subject: CertificationSubject,
  policy: CertificationPolicy,
): readonly ExpiryReason[] {
  const reasons: ExpiryReason[] = [];
  const prior = subject.prior;
  if (!prior) {
    return Object.freeze(reasons);
  }
  if (subject.schemaVersion !== prior.schemaVersion || subject.schemaId !== prior.schemaId) {
    reasons.push('SCHEMA_VERSION_CHANGE');
  }
  if (subject.unit !== prior.unit) {
    reasons.push('UNIT_CHANGE');
  }
  if (subject.connector.endpointUrl !== prior.endpointUrl) {
    reasons.push('ENDPOINT_CHANGE');
  }
  if (subject.connector.authenticationClass !== prior.authenticationClass) {
    reasons.push('AUTH_METHOD_CHANGE');
  }
  if (subject.connector.runtimeMajorVersion !== prior.connectorRuntimeMajorVersion) {
    reasons.push('CONNECTOR_RUNTIME_MAJOR_CHANGE');
  }
  if (policy.securityPolicyVersion !== prior.securityPolicyVersion) {
    reasons.push('SECURITY_POLICY_CHANGE');
  }
  if (subject.controllerId !== prior.controllerId) {
    reasons.push('SOURCE_CONTROLLER_CHANGE');
  }
  if (subject.nowUnix >= prior.expiresAtUnix || subject.nowUnix - prior.createdAtUnix >= BigInt(policy.certificationTtlSeconds)) {
    reasons.push('ELAPSED_PERIOD');
  }
  return Object.freeze(reasons);
}

export function evaluateRevalidation(
  subject: CertificationSubject,
  policy: CertificationPolicy,
  current?: EconomicDataSourceCertificationRecord,
): RevalidationDecision {
  const expiryReasons = evaluateCertificationExpiry(subject, policy);
  const triggers: RevalidationTrigger[] = [];
  const schemaDrift =
    current?.schemaResults.driftKinds.length ||
    subject.observations.some((row) => row.schemaId !== subject.schemaId || row.schemaVersion !== subject.schemaVersion);
  if (schemaDrift) {
    triggers.push('SCHEMA_DRIFT');
  }
  const staleCount = subject.observations.filter((row) => {
    const age = Number(subject.nowUnix) - Number(row.sourceTimestampUnix);
    return !Number.isFinite(age) || age > policy.maximumObservationAgeSeconds;
  }).length;
  if (staleCount >= Math.max(1, subject.observations.length)) {
    triggers.push('PERSISTENT_STALENESS');
  }
  if (subject.connector.authenticationSucceeded === false) {
    triggers.push('AUTH_FAILURES');
  }
  if ((current?.reliabilityResults.conflictBps ?? 0) > 2_500 || subject.relatedFeeds.length > 8) {
    triggers.push('PROVIDER_CONCENTRATION_CHANGE');
  }
  if ((current?.qualityScoreBps ?? 10_000) < policy.minimumQualityBps) {
    triggers.push('QUALITY_COLLAPSE');
  }
  if (subject.observations.some((row) => row.extras?.signatureFailure === true)) {
    triggers.push('SIGNATURE_FAILURES');
  }

  const uniqueTriggers = [...new Set(triggers)];
  const suspend =
    uniqueTriggers.includes('AUTH_FAILURES') ||
    uniqueTriggers.includes('SIGNATURE_FAILURES') ||
    uniqueTriggers.includes('QUALITY_COLLAPSE');
  const required = uniqueTriggers.length > 0 || expiryReasons.length > 0;
  return Object.freeze({
    required,
    suspend,
    triggers: Object.freeze(uniqueTriggers),
    expiryReasons,
    nextStatus: suspend ? 'SUSPENDED' : required ? 'REVALIDATION_REQUIRED' : 'UNCHANGED',
  });
}

export function recommendProviderSuspension(
  incidents: OracleIncidentControl,
  input: {
    readonly incidentId: string;
    readonly providerId: string;
    readonly evidenceRef: string;
    readonly atUnix: bigint;
    readonly actorKind?: 'HUMAN' | 'AI' | 'AGENT' | 'AUTOMATION';
  },
): Result<{ readonly recommended: true; readonly applied: boolean }, ProductionOracleRejection> {
  const applied = incidents.apply({
    incidentId: input.incidentId,
    providerId: input.providerId,
    action: 'PROVIDER_SUSPENSION',
    actorKind: input.actorKind ?? 'AUTOMATION',
    actorId: 'certification.revalidation',
    evidenceRef: input.evidenceRef,
    atUnix: input.atUnix,
  });
  if (!applied.ok) {
    return applied;
  }
  return ok(Object.freeze({ recommended: true as const, applied: true }));
}

export function refuseAiProviderRestore(
  incidents: OracleIncidentControl,
  input: {
    readonly incidentId: string;
    readonly providerId: string;
    readonly evidenceRef: string;
    readonly atUnix: bigint;
  },
): Result<never, ProductionOracleRejection> {
  const restored = incidents.apply({
    incidentId: input.incidentId,
    providerId: input.providerId,
    action: 'RESUMPTION_APPROVAL',
    actorKind: 'AI',
    actorId: 'certification.ai',
    evidenceRef: input.evidenceRef,
    atUnix: input.atUnix,
  });
  if (restored.ok) {
    return err({
      code: 'AI_CANNOT_RESTORE_PROVIDER',
      detail: 'AI cannot independently restore a suspended provider',
    });
  }
  return restored as Result<never, ProductionOracleRejection>;
}
