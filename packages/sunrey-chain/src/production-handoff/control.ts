/**
 * Operator acceptance, change management, maintenance, key rotation,
 * provider renewal, security-finding continuity, incidents, and backup.
 */

import { refreshEvidenceState, evidenceIsCurrent } from '../providers/evidence.ts';
import type { ExternalProviderEvidenceRecord } from '../providers/types.ts';
import { queryReleaseSecurityState } from '../audit/remediation/release-query.ts';
import type { ExternalSecurityFinding, ProductionSecurityPolicy, SecurityRiskAcceptance } from '../audit/remediation/types.ts';
import { incidentProcedure } from '../ops/incidents.ts';
import { generateJoinRecord, joinWorkflow, exitWorkflow, rotateWorkflow, developmentEpoch } from '../ops/workflows.ts';
import { fourValidatorDevelopmentSet } from '../validators/index.ts';
import { OperatorKeystore } from '../ops/keys.ts';
import { handoffHash } from './hash.ts';
import {
  HANDOFF_NOW_UTC,
  type BackupVerificationRecord,
  type BackupWorkflowClass,
  type EvidenceClass,
  type HandoffActorKind,
  type KeyRotationSchedule,
  type OperationalRole,
  type OperatorAcceptanceRecord,
  type ProductionChangeKind,
  type ProductionChangeRecord,
  type ProductionIncidentDomain,
  type ProductionIncidentRecord,
  type ProductionMaintenanceWindow,
  type ProductionProviderRenewalRecord,
  type ProviderRenewalKind,
  type RestoreDrillRecord,
} from './types.ts';

export function classifyEvidence(input: {
  readonly claimed: EvidenceClass;
  readonly sourceClass: EvidenceClass;
  readonly rehearsal?: boolean;
  readonly fixture?: boolean;
  readonly isolatedTest?: boolean;
}): EvidenceClass {
  if (input.sourceClass === 'REHEARSAL' && input.claimed === 'PRODUCTION_OBSERVED') {
    throw new TypeError('rehearsal cannot become observed production');
  }
  if (input.sourceClass === 'ENGINEERING' && input.claimed === 'PRODUCTION_OBSERVED') {
    throw new TypeError('engineering evidence cannot become observed production');
  }
  if ((input.rehearsal || input.fixture || input.isolatedTest) && input.claimed === 'PRODUCTION_OBSERVED') {
    throw new TypeError('internal tests cannot create observed production');
  }
  if (input.claimed === 'PRODUCTION_OBSERVED' && input.sourceClass !== 'PRODUCTION_OBSERVED') {
    throw new TypeError('do not convert rehearsal evidence into production-observed evidence');
  }
  return input.sourceClass;
}

export function rejectAiOperatorAcceptance(actorKind: HandoffActorKind): void {
  if (actorKind === 'AI' || actorKind === 'AGENT' || actorKind === 'AUTOMATION') {
    throw new TypeError('AI cannot satisfy required human accountability/approval roles');
  }
}

export function recordOperatorAcceptance(input: {
  readonly operatorId: string;
  readonly role: OperationalRole;
  readonly actorKind: HandoffActorKind;
  readonly systemsAccepted: readonly string[];
  readonly runbooksReviewed: readonly string[];
  readonly accessGranted: boolean;
  readonly accessVerified: boolean;
  readonly onCallResponsibility: boolean;
  readonly humanSignature?: string | null;
  readonly fixture?: boolean;
}): OperatorAcceptanceRecord {
  rejectAiOperatorAcceptance(input.actorKind);
  if (input.role === 'AI_ANALYST') {
    throw new TypeError('AI_ANALYST cannot satisfy required human accountability');
  }
  const fixture = input.fixture === true;
  const realHumanAcceptance = !fixture && input.actorKind === 'HUMAN' && Boolean(input.humanSignature);
  if (fixture && realHumanAcceptance) {
    throw new TypeError('fixture operator acceptance cannot become real human acceptance');
  }
  const draft = {
    acceptanceId: `acc_${input.operatorId}_${input.role}`,
    operatorId: input.operatorId,
    role: input.role,
    actorKind: input.actorKind,
    systemsAccepted: Object.freeze([...input.systemsAccepted]),
    runbooksReviewed: Object.freeze([...input.runbooksReviewed]),
    accessGranted: input.accessGranted,
    accessVerified: input.accessVerified,
    onCallResponsibility: input.onCallResponsibility,
    evidenceHash: '',
    humanSignature: fixture ? null : (input.humanSignature ?? null),
    evidenceClass: fixture ? ('REHEARSAL' as const) : ('HUMAN' as const),
    fixture,
    realHumanAcceptance,
  };
  return Object.freeze({ ...draft, evidenceHash: handoffHash({ ...draft, evidenceHash: '' }) });
}

export function rejectFixtureAsRealAcceptance(record: OperatorAcceptanceRecord): void {
  if (record.fixture && record.realHumanAcceptance) {
    throw new TypeError('fixture operator acceptance cannot become real human acceptance');
  }
  if (record.fixture && record.evidenceClass === 'HUMAN') {
    throw new TypeError('fixture acceptance remains rehearsal-only');
  }
}

export function recordChange(input: {
  readonly changeId: string;
  readonly kind: ProductionChangeKind;
  readonly reason: string;
  readonly affectedServices: readonly string[];
  readonly risk: ProductionChangeRecord['risk'];
  readonly releaseRef?: string | null;
  readonly policyOrGovernanceRef?: string | null;
  readonly approval?: string | null;
  readonly deploymentResult?: string | null;
  readonly verification?: string | null;
  readonly rollbackStrategy?: string | null;
}): ProductionChangeRecord {
  if (input.kind === 'PROTOCOL') {
    if (!input.policyOrGovernanceRef || !input.releaseRef) {
      throw new TypeError('protocol upgrades continue through canonical governance and release systems (Chunk 40/79)');
    }
  }
  if (input.kind === 'APPLICATION') {
    if (!input.releaseRef) {
      throw new TypeError('application deployments require a release artifact');
    }
    if (!input.rollbackStrategy) {
      throw new TypeError('application deployments require a rollback strategy where technically applicable');
    }
  }
  const approved = Boolean(input.approval);
  return Object.freeze({
    changeId: input.changeId,
    kind: input.kind,
    reason: input.reason,
    affectedServices: Object.freeze([...input.affectedServices]),
    risk: input.risk,
    releaseRef: input.releaseRef ?? null,
    policyOrGovernanceRef: input.policyOrGovernanceRef ?? null,
    approval: input.approval ?? null,
    approved,
    deploymentResult: input.deploymentResult ?? null,
    verification: input.verification ?? null,
    rollbackStrategy: input.rollbackStrategy ?? null,
    applicationRollbackIsChainHistoryRollback: false,
    state: approved ? 'APPROVED' : 'UNAPPROVED',
  });
}

export function rejectUnapprovedChange(change: ProductionChangeRecord): void {
  if (!change.approved || change.state === 'UNAPPROVED') {
    throw new TypeError('unapproved change detected');
  }
}

export function createMaintenanceWindow(input: {
  readonly windowId: string;
  readonly target: ProductionMaintenanceWindow['target'];
  readonly startsAtUtc: string;
  readonly endsAtUtc: string;
}): ProductionMaintenanceWindow {
  const validator = input.target === 'VALIDATOR';
  return Object.freeze({
    windowId: input.windowId,
    target: input.target,
    startsAtUtc: input.startsAtUtc,
    endsAtUtc: input.endsAtUtc,
    preservesConsensusSafety: validator,
    usesValidatorOpsWorkflows: validator,
    notes: validator
      ? 'Validator maintenance uses Chunk 54 join/exit/key rotation/fencing and preserves consensus safety'
      : 'Planned operational maintenance for an off-consensus surface',
  });
}

export function validatorMaintenanceProcedures(): readonly string[] {
  return Object.freeze([
    'joinWorkflow',
    'exitWorkflow',
    'rotateWorkflow',
    'replaceWorkflow',
    'site-fencing',
    'signer-lease-fencing',
  ]);
}

export function rehearsalValidatorWorkflows(nowUtc = HANDOFF_NOW_UTC): {
  readonly joinOk: boolean;
  readonly exitOk: boolean;
  readonly rotateOk: boolean;
} {
  const set = fourValidatorDevelopmentSet();
  const epoch = developmentEpoch(0n, 0n, 8n);
  const keystore = new OperatorKeystore();
  const record = generateJoinRecord(keystore, 'E', nowUtc);
  const joined = record.ok ? joinWorkflow({ set, epoch, queued: [] }, record.value, nowUtc) : { ok: false };
  const exited = exitWorkflow({ set, epoch, queued: [] }, set.validators[0]!.validatorId, nowUtc);
  const next = keystore.generate('CONSENSUS_VOTING_KEY', 'rotate', nowUtc);
  const descriptor = next.ok ? keystore.descriptor(next.value.keyId) : { ok: false as const };
  const rotated =
    descriptor.ok
      ? rotateWorkflow({ set, epoch, queued: [] }, set.validators[0]!.validatorId, descriptor.value, nowUtc)
      : { ok: false };
  return Object.freeze({
    joinOk: Boolean((joined as { ok?: boolean }).ok),
    exitOk: Boolean((exited as { ok?: boolean }).ok),
    rotateOk: Boolean((rotated as { ok?: boolean }).ok),
  });
}

export function keyRotationSchedules(): readonly KeyRotationSchedule[] {
  return Object.freeze([
    sched('SERVICE_CREDENTIAL', '90d'),
    sched('TLS', '90d'),
    sched('VALIDATOR_KEY', 'governed epoch boundary'),
    sched('GOVERNANCE_KEY', 'governed ceremony'),
    sched('ORACLE_SIGNING_KEY', 'provider capability'),
    sched('RELEASE_KEY', 'release authority rotation'),
    sched('BACKUP_ENCRYPTION', '180d'),
  ]);
}

function sched(purpose: KeyRotationSchedule['purpose'], cadence: string): KeyRotationSchedule {
  return Object.freeze({
    purpose,
    cadence,
    lastRotatedAtUtc: null,
    evidenceHash: null,
    usesActualProviderCapability: true,
  });
}

export function evaluateProviderRenewal(
  record: ExternalProviderEvidenceRecord,
  nowUtc: string,
  kind: ProviderRenewalKind,
): ProductionProviderRenewalRecord {
  const refreshed = refreshEvidenceState(record, nowUtc);
  const current = evidenceIsCurrent(refreshed, nowUtc);
  const expired = Boolean(record.expiresAtUtc && record.expiresAtUtc <= nowUtc);
  const reminderDue = Boolean(record.expiresAtUtc && record.expiresAtUtc > nowUtc && record.expiresAtUtc <= reminderHorizon(nowUtc));
  const state = expired ? 'EXPIRED' : reminderDue ? 'REMINDER_DUE' : current ? 'CURRENT' : 'REPLACEMENT_REQUIRED';
  return Object.freeze({
    recordId: `ren_${record.recordId}_${kind}`,
    providerId: record.providerId,
    kind,
    expiresAtUtc: record.expiresAtUtc,
    state,
    automaticRenewalClaim: false,
    notes: expired ? 'expired provider evidence reflected; no automatic renewal claim' : 'Chunk 82 evidence may expire',
  });
}

function reminderHorizon(nowUtc: string): string {
  const date = new Date(nowUtc);
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString();
}

export function carryForwardSecurityFindings(input: {
  readonly findings: readonly ExternalSecurityFinding[];
  readonly acceptedRisks: readonly SecurityRiskAcceptance[];
  readonly policy: ProductionSecurityPolicy;
}): {
  readonly openCritical: readonly string[];
  readonly openHigh: readonly string[];
  readonly acceptedRisks: readonly string[];
  readonly unresolvedCriticalReflected: boolean;
  readonly claimsExternalAuditCompleted: false;
} {
  const query = queryReleaseSecurityState(input);
  const openCritical = query.openCriticalFindings;
  return Object.freeze({
    openCritical,
    openHigh: query.openHighFindings,
    acceptedRisks: query.acceptedRisks,
    unresolvedCriticalReflected: openCritical.length > 0,
    claimsExternalAuditCompleted: false,
  });
}

export function createIncidentRecord(input: {
  readonly incidentId: string;
  readonly domain: ProductionIncidentDomain;
  readonly summary: string;
  readonly evidenceClass?: EvidenceClass;
}): ProductionIncidentRecord {
  if (input.domain === 'SIGNER') {
    incidentProcedure('SIGNER_COMPROMISE');
  }
  return Object.freeze({
    incidentId: input.incidentId,
    domain: input.domain,
    summary: input.summary,
    commandRole: 'INCIDENT_COMMAND',
    emergencyUsesChunk79BoundedAuthority: true,
    hiddenEmergencyPower: false,
    preserved: Object.freeze({
      logs: true,
      metrics: true,
      configHashes: true,
      releaseHashes: true,
      chainReferences: true,
      auditEvents: true,
      operatorActions: true,
    }),
    evidenceClass: input.evidenceClass ?? 'ENGINEERING',
  });
}

export function backupVerificationCatalog(nowUtc = HANDOFF_NOW_UTC): readonly BackupVerificationRecord[] {
  const classes: readonly BackupWorkflowClass[] = [
    'CHAIN_SNAPSHOT',
    'DATABASE_BACKUP',
    'CONFIGURATION_BACKUP',
    'SIGNER_SAFETY_DATA',
    'RELEASE_EVIDENCE_ARCHIVE',
  ];
  return Object.freeze(
    classes.map((item) =>
      Object.freeze({
        class: item,
        lastVerifiedAtUtc: nowUtc,
        verified: true,
        isolatedEnvironment: true,
      }),
    ),
  );
}

export function recordRestoreDrill(input: {
  readonly drillId: string;
  readonly class: BackupWorkflowClass;
  readonly executed: boolean;
  readonly executedAtUtc?: string | null;
}): RestoreDrillRecord {
  return Object.freeze({
    drillId: input.drillId,
    class: input.class,
    isolatedEnvironment: true,
    executed: input.executed,
    executedAtUtc: input.executed ? (input.executedAtUtc ?? HANDOFF_NOW_UTC) : null,
    evidenceClass: input.executed ? 'REHEARSAL' : 'ENGINEERING',
  });
}

export function assertTreasuryCannotMint(role: OperationalRole, action: string): void {
  if (role === 'TREASURY' && /mint/i.test(action)) {
    throw new TypeError('no operations role can mint treasury assets');
  }
}
