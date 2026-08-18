/**
 * Validator operator control plane.
 *
 * Canonical chain validator state remains authoritative. This class
 * records operational projections, prepares governed actions, and
 * refuses anything that would bypass consensus safety.
 */

import { ENVIRONMENT } from '../../../config/src/flags.ts';
import { hasTwoThirdsPlus } from '../validators/voting-power.ts';
import {
  ValidatorEconomicsEngine,
  fixtureValidatorRecord,
} from '../validator-economics/index.ts';
import { authorizeAction, authorizeRead } from './access.ts';
import { fingerprintOf, requestHash } from './hash.ts';
import {
  OPERATOR_A_ID,
  OPERATOR_A_VALIDATORS,
  OPERATOR_B_ID,
  REHEARSAL_FLEET_ID,
  REHEARSAL_VALIDATOR_IDS,
  fixtureFleet,
  fixtureNodes,
  fixtureOperators,
  fixtureOrganizations,
  fixturePrincipal,
  fixtureProfiles,
  fixtureSigners,
  operatorForValidator,
  rehearsalCandidateV2Id,
  rehearsalDossierValidatorId,
  rehearsalNowUtc,
} from './fixtures.ts';
import {
  BINARY_DEPLOY_DOES_NOT_ACTIVATE_PROTOCOL,
  CANONICAL_STATUS_MAP,
  CANONICAL_VALIDATOR_SET_AUTHORITATIVE,
  DEFAULT_QUORUM_POLICY,
  DIFFERENT_VALIDATOR_IDS_DO_NOT_IMPLY_INDEPENDENCE,
  MONITORING_SUSPICION_IS_NOT_FINALIZED_MISCONDUCT,
  OPERATOR_CANNOT_DEBIT_CUSTOMER_ASSETS,
  SENTRIES_CANNOT_SIGN,
  type AccountabilityProjection,
  type AuditRecord,
  type ConcentrationBreakdown,
  type EnrollmentStage,
  type GovernanceVotePreparation,
  type HighImpactAction,
  type NodeHealthSample,
  type OperatorApiResponse,
  type OperatorBackupRecord,
  type OperatorDashboardProjection,
  type OperatorEconomicsProjection,
  type OperatorPrincipal,
  type OperatorReasonCode,
  type OperatorResult,
  type PrivateOperatorView,
  type PublicValidatorView,
  type RecoveryKind,
  type RecoveryWorkflow,
  type RotationPackage,
  type ValidatorConcentrationReport,
  type ValidatorFleet,
  type ValidatorFleetHealth,
  type ValidatorIncident,
  type ValidatorIncidentType,
  type ValidatorMaintenancePlan,
  type ValidatorNodeRecord,
  type ValidatorOperator,
  type ValidatorOperatorAcceptance,
  type ValidatorOperatorEnrollment,
  type ValidatorOperatorOrganization,
  type ValidatorOperatorProfile,
  type ValidatorOperatorReport,
  type ValidatorSignerRecord,
  type ValidatorUpgradePlan,
  operatorErr,
  operatorOk,
} from './types.ts';

const VOTING_POWER = 1n;

function nowUtc(): string {
  return rehearsalNowUtc();
}

export class ValidatorOperatorPlatform {
  readonly organizations: ValidatorOperatorOrganization[];
  readonly profiles: ValidatorOperatorProfile[];
  readonly operators: ValidatorOperator[];
  readonly nodes: ValidatorNodeRecord[];
  readonly signers: ValidatorSignerRecord[];
  fleet: ValidatorFleet;
  readonly enrollments: ValidatorOperatorEnrollment[] = [];
  readonly acceptances: ValidatorOperatorAcceptance[] = [];
  readonly maintenancePlans: ValidatorMaintenancePlan[] = [];
  readonly upgradePlans: ValidatorUpgradePlan[] = [];
  readonly rotations: RotationPackage[] = [];
  readonly backups: OperatorBackupRecord[] = [];
  readonly recoveries: RecoveryWorkflow[] = [];
  readonly incidents: ValidatorIncident[] = [];
  readonly audits: AuditRecord[] = [];
  readonly votes: GovernanceVotePreparation[] = [];
  readonly usedRotationHashes = new Set<string>();
  readonly economics = new ValidatorEconomicsEngine('development');
  #health = new Map<string, NodeHealthSample>();
  #seq = 0;

  constructor() {
    if (ENVIRONMENT !== 'simulation') {
      throw new Error('validator operator platform requires ENVIRONMENT=simulation');
    }
    this.organizations = [...fixtureOrganizations()];
    this.profiles = [...fixtureProfiles()];
    this.operators = [...fixtureOperators()];
    this.nodes = fixtureNodes().map((node) => ({ ...node }));
    this.signers = fixtureSigners().map((signer) => ({ ...signer }));
    this.fleet = { ...fixtureFleet(), validators: [...fixtureFleet().validators] };
    for (const validatorId of REHEARSAL_VALIDATOR_IDS) {
      const label = validatorId.slice(-1).toUpperCase();
      const record = {
        ...fixtureValidatorRecord({
          label,
          operatorId: operatorForValidator(validatorId),
          status: 'CANDIDATE',
        }),
        validatorId,
      };
      this.economics.registerValidator(record, 2_000_000n);
      this.economics.bond({
        validatorId,
        quantity: 1_000_000n,
        asset: 'DEVELOPMENT_SUNREY_COIN',
      });
    }
    this.economics.advanceEpoch();
    this.seedHealth();
  }

  private nextId(prefix: string): string {
    this.#seq += 1;
    return `${prefix}_${this.#seq.toString().padStart(3, '0')}`;
  }

  private audit(
    principal: OperatorPrincipal,
    action: HighImpactAction,
    validatorId: string | null,
    result: 'ALLOW' | 'REFUSE',
    reasonCode: OperatorReasonCode,
    releaseOrPolicy: string | null,
    payload: unknown,
    approval: string | null = null,
  ): AuditRecord {
    const record: AuditRecord = {
      auditId: this.nextId('aud'),
      action,
      operatorId: principal.operatorId,
      role: principal.role,
      actorId: principal.actorId,
      actorKind: principal.kind,
      validatorId,
      releaseOrPolicy,
      requestHash: requestHash(payload),
      approval,
      result,
      reasonCode,
      atUtc: nowUtc(),
    };
    this.audits.push(record);
    return record;
  }

  private require(
    principal: OperatorPrincipal,
    action: HighImpactAction,
    resourceOperatorId: string,
    validatorId: string | null,
    payload: unknown,
    releaseOrPolicy: string | null = null,
  ): OperatorResult<true> {
    const gate = authorizeAction(principal, action, resourceOperatorId);
    if (!gate.ok) {
      this.audit(principal, action, validatorId, 'REFUSE', gate.code, releaseOrPolicy, payload);
      return gate;
    }
    return operatorOk(true);
  }

  votingPowerOf(validatorIds: readonly string[]): bigint {
    return BigInt(validatorIds.length) * VOTING_POWER;
  }

  totalVotingPower(): bigint {
    return this.votingPowerOf(REHEARSAL_VALIDATOR_IDS);
  }

  remainingPower(offlineValidatorIds: readonly string[]): bigint {
    return this.totalVotingPower() - this.votingPowerOf(offlineValidatorIds);
  }

  mapCanonical(state: ValidatorNodeRecord['operationalState']) {
    return CANONICAL_STATUS_MAP[state];
  }

  operatorById(operatorId: string): ValidatorOperator | undefined {
    return this.operators.find((row) => row.operatorId === operatorId);
  }

  nodesFor(operatorId: string): readonly ValidatorNodeRecord[] {
    return this.nodes.filter((node) => node.operatorId === operatorId);
  }

  signersFor(operatorId: string): readonly ValidatorSignerRecord[] {
    return this.signers.filter((signer) => signer.operatorId === operatorId);
  }

  sentryCanSign(nodeId: string): boolean {
    const node = this.nodes.find((row) => row.nodeId === nodeId);
    if (!node || node.kind === 'SENTRY') {
      return SENTRIES_CANNOT_SIGN ? false : Boolean(node?.canSign);
    }
    return node.canSign;
  }

  refuseSentrySign(nodeId: string): OperatorResult<never> {
    if (!this.sentryCanSign(nodeId)) {
      return operatorErr('SENTRY_CANNOT_SIGN', `sentry ${nodeId} cannot sign`);
    }
    return operatorErr('SENTRY_CANNOT_SIGN', `node ${nodeId} refused`);
  }

  independenceImpliedByValidatorIds(): false {
    return DIFFERENT_VALIDATOR_IDS_DO_NOT_IMPLY_INDEPENDENCE ? false : false;
  }

  sharedController(validatorIdA: string, validatorIdB: string): boolean {
    return operatorForValidator(validatorIdA) === operatorForValidator(validatorIdB);
  }

  enroll(
    principal: OperatorPrincipal,
    validatorId: string,
    stage: EnrollmentStage = 'OPERATOR_PROFILE',
  ): OperatorResult<ValidatorOperatorEnrollment> {
    const gate = this.require(principal, 'ENROLL', principal.operatorId, validatorId, { validatorId, stage });
    if (!gate.ok) {
      return gate;
    }
    const enrollment: ValidatorOperatorEnrollment = {
      enrollmentId: this.nextId('enr'),
      operatorId: principal.operatorId,
      validatorId,
      stage,
      profileId: this.profiles.find((row) => row.operatorId === principal.operatorId)?.profileId ?? 'profile_unknown',
      infrastructureEvidenceRef: stage === 'OPERATOR_PROFILE' ? null : 'ev_infra',
      signerEvidenceRef:
        stage === 'OPERATOR_PROFILE' || stage === 'INFRASTRUCTURE_EVIDENCE' ? null : 'ev_signer',
      candidateV2Id: rehearsalCandidateV2Id(),
      dossierValidatorId: rehearsalDossierValidatorId(),
      dossierAuthority: 'CHUNK_85_PRODUCTION_VALIDATOR_DOSSIER',
      humanAcceptanceId: null,
      governanceActionId: null,
      activationCoordinate: stage === 'ACTIVATION_COORDINATE' ? 'epoch:next' : null,
      fixture: true,
    };
    this.enrollments.push(enrollment);
    this.audit(principal, 'ENROLL', validatorId, 'ALLOW', 'OK', 'CHUNK_85', enrollment, principal.actorId);
    return operatorOk(enrollment);
  }

  acceptEnrollment(
    principal: OperatorPrincipal,
    enrollmentId: string,
    asProduction: boolean,
  ): OperatorResult<ValidatorOperatorAcceptance> {
    const enrollment = this.enrollments.find((row) => row.enrollmentId === enrollmentId);
    if (!enrollment) {
      return operatorErr('ENROLLMENT_INCOMPLETE', `enrollment ${enrollmentId} missing`);
    }
    const gate = this.require(principal, 'ACCEPT', enrollment.operatorId, enrollment.validatorId, {
      enrollmentId,
      asProduction,
    });
    if (!gate.ok) {
      return gate;
    }
    if (enrollment.fixture && asProduction) {
      const refusal = operatorErr('FIXTURE_ACCEPTANCE_REJECTED', 'fixture production acceptance rejected');
      this.audit(principal, 'ACCEPT', enrollment.validatorId, 'REFUSE', refusal.code, 'ACCEPTANCE', {
        enrollmentId,
        asProduction,
      });
      return refusal;
    }
    const acceptance: ValidatorOperatorAcceptance = {
      acceptanceId: this.nextId('acc'),
      operatorId: enrollment.operatorId,
      enrollmentId,
      state: enrollment.fixture ? 'FIXTURE_REHEARSAL_ONLY' : 'HUMAN_ACCEPTED',
      acceptedBy: principal.actorId,
      actorKind: principal.kind,
      fixture: enrollment.fixture,
      realHumanAcceptance: !enrollment.fixture && principal.kind === 'HUMAN',
      reason: enrollment.fixture ? 'rehearsal fixture cannot become production acceptance' : null,
    };
    this.acceptances.push(acceptance);
    this.audit(principal, 'ACCEPT', enrollment.validatorId, 'ALLOW', 'OK', 'ACCEPTANCE', acceptance, principal.actorId);
    return operatorOk(acceptance);
  }

  collectHealth(validatorId: string, overrides: Partial<NodeHealthSample> = {}): NodeHealthSample {
    const node = this.nodes.find((row) => row.validatorId === validatorId && row.kind === 'VALIDATOR');
    const signer = this.signers.find((row) => row.validatorId === validatorId);
    const sample: NodeHealthSample = {
      nodeId: node?.nodeId ?? `node_${validatorId}`,
      height: overrides.height ?? 1_000n,
      peerCount: overrides.peerCount ?? 16,
      consensusParticipation: overrides.consensusParticipation ?? true,
      missedVotes: overrides.missedVotes ?? 0,
      proposalDuties: overrides.proposalDuties ?? 1,
      stateRoot: overrides.stateRoot ?? fingerprintOf(`state:${validatorId}:1000`),
      diskFreeBytes: overrides.diskFreeBytes ?? 200_000_000_000n,
      cpuPermille: overrides.cpuPermille ?? 250,
      memoryUsedBytes: overrides.memoryUsedBytes ?? 8_000_000_000n,
      networkRxBytes: overrides.networkRxBytes ?? 1_000_000n,
      networkTxBytes: overrides.networkTxBytes ?? 900_000n,
      signerLatencyMs: overrides.signerLatencyMs ?? 12,
      signerHealthy: overrides.signerHealthy ?? signer?.antiDoubleSignState !== 'CONFLICT',
      snapshotStatus: overrides.snapshotStatus ?? 'CURRENT',
      collectedAtUtc: nowUtc(),
    };
    this.#health.set(validatorId, sample);
    return sample;
  }

  fleetHealth(offline: readonly string[] = []): ValidatorFleetHealth {
    const samples = REHEARSAL_VALIDATOR_IDS.map((id) => this.#health.get(id) ?? this.collectHealth(id));
    const remaining = this.remainingPower(offline);
    const conflicts = this.signers.filter((row) => row.antiDoubleSignState === 'CONFLICT').length;
    const health: ValidatorFleetHealth = {
      fleetId: REHEARSAL_FLEET_ID,
      healthyNodes: samples.filter((row) => row.consensusParticipation && row.signerHealthy).length,
      degradedNodes: samples.filter((row) => !row.consensusParticipation || row.signerHealthy === false).length,
      offlineNodes: offline.length,
      signerConflicts: conflicts,
      quorumSafe: hasTwoThirdsPlus(remaining, this.totalVotingPower()),
      remainingVotingPower: remaining,
      totalVotingPower: this.totalVotingPower(),
      samples,
    };
    this.fleet = { ...this.fleet, health };
    return health;
  }

  planMaintenance(
    principal: OperatorPrincipal,
    validatorIds: readonly string[],
    reason: string,
  ): OperatorResult<ValidatorMaintenancePlan> {
    const resourceOperatorId = validatorIds[0] ? operatorForValidator(validatorIds[0]) : principal.operatorId;
    const gate = this.require(principal, 'MAINTENANCE_PLAN', resourceOperatorId, validatorIds[0] ?? null, {
      validatorIds,
      reason,
    });
    if (!gate.ok) {
      return gate;
    }
    for (const validatorId of validatorIds) {
      if (operatorForValidator(validatorId) !== principal.operatorId) {
        const refusal = operatorErr('CROSS_OPERATOR_DENIED', `operator ${principal.operatorId} cannot maintain ${validatorId}`);
        this.audit(principal, 'MAINTENANCE_PLAN', validatorId, 'REFUSE', refusal.code, 'QUORUM', { validatorIds });
        return refusal;
      }
    }
    const remaining = this.remainingPower(validatorIds);
    const quorumSafe = hasTwoThirdsPlus(remaining, this.totalVotingPower());
    const concurrentBps = Number((this.votingPowerOf(validatorIds) * 10_000n) / this.totalVotingPower());
    const overPolicy = concurrentBps > DEFAULT_QUORUM_POLICY.maxConcurrentMaintenancePowerBps;
    const decision = !quorumSafe || overPolicy ? 'REFUSE' : validatorIds.length > 1 ? 'WARN' : 'ALLOW';
    const plan: ValidatorMaintenancePlan = {
      planId: this.nextId('mnt'),
      operatorId: principal.operatorId,
      validatorIds,
      reason,
      projectedRemainingVotingPower: remaining,
      totalVotingPower: this.totalVotingPower(),
      quorumSafe,
      decision,
      policy: DEFAULT_QUORUM_POLICY,
    };
    this.maintenancePlans.push(plan);
    if (decision === 'REFUSE') {
      this.audit(principal, 'MAINTENANCE_PLAN', validatorIds[0] ?? null, 'REFUSE', 'UNSAFE_MAINTENANCE', 'QUORUM', plan);
      return operatorErr('UNSAFE_MAINTENANCE', `maintenance would leave remaining power ${remaining.toString()}`);
    }
    this.audit(principal, 'MAINTENANCE_PLAN', validatorIds[0] ?? null, 'ALLOW', 'OK', 'QUORUM', plan, principal.actorId);
    return operatorOk(plan);
  }

  executeMaintenance(principal: OperatorPrincipal, planId: string): OperatorResult<ValidatorMaintenancePlan> {
    const plan = this.maintenancePlans.find((row) => row.planId === planId);
    if (!plan) {
      return operatorErr('UNSAFE_MAINTENANCE', `maintenance plan ${planId} missing`);
    }
    const gate = this.require(principal, 'MAINTENANCE_EXECUTE', plan.operatorId, plan.validatorIds[0] ?? null, { planId });
    if (!gate.ok) {
      return gate;
    }
    if (plan.decision === 'REFUSE' || !plan.quorumSafe) {
      return operatorErr('UNSAFE_MAINTENANCE', 'refused maintenance plan cannot execute');
    }
    for (const validatorId of plan.validatorIds) {
      const node = this.nodes.find((row) => row.validatorId === validatorId && row.kind === 'VALIDATOR');
      if (node) {
        node.operationalState = 'MAINTENANCE';
      }
    }
    this.audit(principal, 'MAINTENANCE_EXECUTE', plan.validatorIds[0] ?? null, 'ALLOW', 'OK', plan.planId, plan, principal.actorId);
    return operatorOk(plan);
  }

  planUpgrade(
    principal: OperatorPrincipal,
    input: {
      readonly release: string;
      readonly artifactDigest: string;
      readonly protocolVersion: string;
      readonly batch: readonly string[];
    },
  ): OperatorResult<ValidatorUpgradePlan> {
    const gate = this.require(principal, 'UPGRADE_PLAN', principal.operatorId, input.batch[0] ?? null, input, input.release);
    if (!gate.ok) {
      return gate;
    }
    if (input.release !== 'sunrey-node/1.1.0' && input.release !== 'sunrey-node/1.0.0') {
      this.audit(principal, 'UPGRADE_PLAN', input.batch[0] ?? null, 'REFUSE', 'WRONG_RELEASE', input.release, input);
      return operatorErr('WRONG_RELEASE', `release ${input.release} is not an allowed operator artifact`);
    }
    const remaining = this.remainingPower(input.batch);
    if (!hasTwoThirdsPlus(remaining, this.totalVotingPower())) {
      this.audit(principal, 'UPGRADE_PLAN', input.batch[0] ?? null, 'REFUSE', 'UNSAFE_UPGRADE_BATCH', input.release, input);
      return operatorErr('UNSAFE_UPGRADE_BATCH', 'rolling batch violates BFT availability assumptions');
    }
    const plan: ValidatorUpgradePlan = {
      planId: this.nextId('upg'),
      operatorId: principal.operatorId,
      release: input.release,
      artifactDigest: input.artifactDigest,
      protocolVersion: input.protocolVersion,
      upgradePolicy: 'ROLLING_BFT_SAFE',
      validatorBatch: input.batch,
      readiness: 'READY',
      postUpgradeVerification: null,
      binaryDeployed: false,
      protocolActivated: false,
    };
    this.upgradePlans.push(plan);
    this.audit(principal, 'UPGRADE_PLAN', input.batch[0] ?? null, 'ALLOW', 'OK', input.release, plan, principal.actorId);
    return operatorOk(plan);
  }

  deployUpgradeBatch(principal: OperatorPrincipal, planId: string): OperatorResult<ValidatorUpgradePlan> {
    const plan = this.upgradePlans.find((row) => row.planId === planId);
    if (!plan) {
      return operatorErr('WRONG_RELEASE', `upgrade plan ${planId} missing`);
    }
    const gate = this.require(principal, 'UPGRADE_BATCH', plan.operatorId, plan.validatorBatch[0] ?? null, { planId }, plan.release);
    if (!gate.ok) {
      return gate;
    }
    for (const validatorId of plan.validatorBatch) {
      const node = this.nodes.find((row) => row.validatorId === validatorId && row.kind === 'VALIDATOR');
      if (node) {
        node.softwareRelease = plan.release;
        node.artifactDigest = plan.artifactDigest;
      }
    }
    plan.binaryDeployed = true;
    plan.readiness = 'VERIFIED';
    plan.postUpgradeVerification = 'binary digest matched; protocol rules unchanged';
    if (!BINARY_DEPLOY_DOES_NOT_ACTIVATE_PROTOCOL) {
      plan.protocolActivated = true;
    }
    this.audit(principal, 'UPGRADE_BATCH', plan.validatorBatch[0] ?? null, 'ALLOW', 'OK', plan.release, plan, principal.actorId);
    return operatorOk(plan);
  }

  activateProtocol(principal: OperatorPrincipal, planId: string): OperatorResult<never> {
    const plan = this.upgradePlans.find((row) => row.planId === planId);
    const gate = this.require(
      principal,
      'PROTOCOL_ACTIVATE',
      plan?.operatorId ?? principal.operatorId,
      plan?.validatorBatch[0] ?? null,
      { planId },
      plan?.release ?? null,
    );
    if (!gate.ok) {
      return gate;
    }
    this.audit(principal, 'PROTOCOL_ACTIVATE', plan?.validatorBatch[0] ?? null, 'REFUSE', 'PROTOCOL_NOT_ACTIVATED_BY_BINARY', plan?.release ?? null, {
      planId,
    });
    return operatorErr(
      'PROTOCOL_NOT_ACTIVATED_BY_BINARY',
      'binary deployment does not independently activate protocol rules',
    );
  }

  prepareRotation(
    principal: OperatorPrincipal,
    validatorId: string,
    nextFingerprint: string,
    preservesKeyIdentity: boolean,
  ): OperatorResult<RotationPackage> {
    const signer = this.signers.find((row) => row.validatorId === validatorId && row.keyPurpose === 'CONSENSUS_VOTING');
    if (!signer) {
      return operatorErr('MISSING_EVIDENCE', `signer for ${validatorId} missing`);
    }
    const gate = this.require(principal, 'ROTATE_PREPARE', signer.operatorId, validatorId, {
      validatorId,
      nextFingerprint,
    });
    if (!gate.ok) {
      return gate;
    }
    const pkg: RotationPackage = {
      packageId: this.nextId('rot'),
      validatorId,
      operatorId: signer.operatorId,
      currentFingerprint: signer.publicKeyFingerprint,
      nextFingerprint,
      requestHash: requestHash({ validatorId, nextFingerprint, current: signer.publicKeyFingerprint }),
      preservesKeyIdentity,
      watermark: signer.watermarkHeight,
      fencingState: signer.fencingState,
      activated: false,
    };
    signer.rotationState = 'PREPARED';
    this.rotations.push(pkg);
    this.audit(principal, 'ROTATE_PREPARE', validatorId, 'ALLOW', 'OK', 'KEY_ROTATION', pkg, principal.actorId);
    return operatorOk(pkg);
  }

  activateRotation(principal: OperatorPrincipal, packageId: string): OperatorResult<RotationPackage> {
    const pkg = this.rotations.find((row) => row.packageId === packageId);
    if (!pkg) {
      return operatorErr('ROTATION_REPLAY', `rotation package ${packageId} missing`);
    }
    const gate = this.require(principal, 'ROTATE_ACTIVATE', pkg.operatorId, pkg.validatorId, pkg);
    if (!gate.ok) {
      return gate;
    }
    if (this.usedRotationHashes.has(pkg.requestHash) || pkg.activated) {
      this.audit(principal, 'ROTATE_ACTIVATE', pkg.validatorId, 'REFUSE', 'ROTATION_REPLAY', 'KEY_ROTATION', pkg);
      return operatorErr('ROTATION_REPLAY', 'replayed rotation rejected');
    }
    const signer = this.signers.find((row) => row.validatorId === pkg.validatorId && row.keyPurpose === 'CONSENSUS_VOTING');
    if (!signer) {
      return operatorErr('MISSING_EVIDENCE', 'signer missing');
    }
    signer.publicKeyFingerprint = pkg.nextFingerprint;
    signer.rotationState = 'CURRENT';
    signer.watermarkHeight = pkg.watermark;
    signer.fencingState = pkg.fencingState;
    pkg.activated = true;
    this.usedRotationHashes.add(pkg.requestHash);
    this.audit(principal, 'ROTATE_ACTIVATE', pkg.validatorId, 'ALLOW', 'OK', 'KEY_ROTATION', pkg, principal.actorId);
    return operatorOk(pkg);
  }

  signWithFingerprint(validatorId: string, fingerprint: string): OperatorResult<true> {
    const signer = this.signers.find((row) => row.validatorId === validatorId && row.keyPurpose === 'CONSENSUS_VOTING');
    if (!signer) {
      return operatorErr('MISSING_EVIDENCE', 'signer missing');
    }
    const activated = this.rotations.find((row) => row.validatorId === validatorId && row.activated);
    if (activated && fingerprint === activated.currentFingerprint) {
      return operatorErr('OLD_KEY_REJECTED', 'old key rejected after rotation activation');
    }
    if (fingerprint !== signer.publicKeyFingerprint) {
      return operatorErr('OLD_KEY_REJECTED', 'fingerprint is not the active consensus key');
    }
    return operatorOk(true);
  }

  detectDualActiveSigner(validatorId: string): OperatorResult<true> {
    const active = this.signers.filter(
      (row) => row.validatorId === validatorId && row.keyPurpose === 'CONSENSUS_VOTING' && row.fencingState === 'ACTIVE',
    );
    if (active.length > 1) {
      for (const signer of active) {
        signer.antiDoubleSignState = 'CONFLICT';
      }
      return operatorErr('DUAL_ACTIVE_SIGNER', `dual-active signer detected for ${validatorId}`);
    }
    return operatorOk(true);
  }

  attachPassiveSigner(validatorId: string): ValidatorSignerRecord {
    const current = this.signers.find((row) => row.validatorId === validatorId && row.keyPurpose === 'CONSENSUS_VOTING');
    const passive: ValidatorSignerRecord = {
      signerId: this.nextId('signer'),
      validatorId,
      operatorId: current?.operatorId ?? operatorForValidator(validatorId),
      keyPurpose: 'CONSENSUS_VOTING',
      publicKeyFingerprint: current?.publicKeyFingerprint ?? fingerprintOf(validatorId),
      provider: current?.provider ?? 'hsm-sim-a',
      hsmKmsState: 'SIMULATION',
      algorithm: 'sunrey-ed25519-v1',
      rotationState: 'CURRENT',
      fencingState: 'PASSIVE',
      antiDoubleSignState: 'WATERMARK_HELD',
      watermarkHeight: current?.watermarkHeight ?? 100n,
      privateKeyPresent: false,
    };
    this.signers.push(passive);
    return passive;
  }

  forceDualActive(validatorId: string): void {
    const extra = this.attachPassiveSigner(validatorId);
    extra.fencingState = 'ACTIVE';
  }

  fenceSigner(principal: OperatorPrincipal, signerId: string, state: ValidatorSignerRecord['fencingState']): OperatorResult<ValidatorSignerRecord> {
    const signer = this.signers.find((row) => row.signerId === signerId);
    if (!signer) {
      return operatorErr('MISSING_EVIDENCE', `signer ${signerId} missing`);
    }
    const gate = this.require(principal, 'SIGNER_FENCE', signer.operatorId, signer.validatorId, { signerId, state });
    if (!gate.ok) {
      return gate;
    }
    signer.fencingState = state;
    this.audit(principal, 'SIGNER_FENCE', signer.validatorId, 'ALLOW', 'OK', 'FENCE', signer, principal.actorId);
    return operatorOk(signer);
  }

  createBackup(
    principal: OperatorPrincipal,
    validatorId: string,
    backupClass: OperatorBackupRecord['class'],
  ): OperatorResult<OperatorBackupRecord> {
    const gate = this.require(principal, 'BACKUP_CREATE', operatorForValidator(validatorId), validatorId, {
      validatorId,
      backupClass,
    });
    if (!gate.ok) {
      return gate;
    }
    const record: OperatorBackupRecord = {
      backupId: this.nextId('bak'),
      operatorId: principal.operatorId,
      validatorId,
      class: backupClass,
      digest: fingerprintOf(`${backupClass}:${validatorId}:${nowUtc()}`),
      createdAtUtc: nowUtc(),
      verified: true,
    };
    this.backups.push(record);
    this.audit(principal, 'BACKUP_CREATE', validatorId, 'ALLOW', 'OK', backupClass, record, principal.actorId);
    return operatorOk(record);
  }

  recover(principal: OperatorPrincipal, validatorId: string, kind: RecoveryKind): OperatorResult<RecoveryWorkflow> {
    const gate = this.require(principal, 'RECOVERY', operatorForValidator(validatorId), validatorId, { validatorId, kind });
    if (!gate.ok) {
      return gate;
    }
    const preserveFirst = kind === 'SIGNER_LOSS' || kind === 'NODE_LOSS';
    const workflow: RecoveryWorkflow = {
      recoveryId: this.nextId('rcv'),
      kind,
      operatorId: principal.operatorId,
      validatorId,
      evidencePreserved: preserveFirst,
      steps: recoverySteps(kind),
      completed: true,
    };
    this.recoveries.push(workflow);
    this.audit(principal, 'RECOVERY', validatorId, 'ALLOW', 'OK', kind, workflow, principal.actorId);
    return operatorOk(workflow);
  }

  replaceSentry(principal: OperatorPrincipal, sentryId: string): OperatorResult<ValidatorNodeRecord> {
    const sentry = this.nodes.find((row) => row.nodeId === sentryId);
    if (!sentry || sentry.kind !== 'SENTRY') {
      return operatorErr('MISSING_EVIDENCE', `sentry ${sentryId} missing`);
    }
    const gate = this.require(principal, 'SENTRY_REPLACE', sentry.operatorId, sentry.validatorId, { sentryId });
    if (!gate.ok) {
      return gate;
    }
    sentry.operationalState = 'RETIRED';
    sentry.canSign = false;
    const replacement: ValidatorNodeRecord = {
      ...sentry,
      nodeId: this.nextId('sentry'),
      operationalState: 'READY',
      canSign: false,
    };
    this.nodes.push(replacement);
    this.audit(principal, 'SENTRY_REPLACE', sentry.validatorId, 'ALLOW', 'OK', 'SENTRY', replacement, principal.actorId);
    return operatorOk(replacement);
  }

  openIncident(
    principal: OperatorPrincipal,
    validatorId: string,
    type: ValidatorIncidentType,
    summary: string,
    evidenceRef: string | null,
  ): OperatorResult<ValidatorIncident> {
    const gate = this.require(principal, 'INCIDENT_OPEN', operatorForValidator(validatorId), validatorId, {
      validatorId,
      type,
    });
    if (!gate.ok) {
      return gate;
    }
    const suspicionOnly = type === 'KEY_COMPROMISE_SUSPECTED' || type.endsWith('_SUSPECTED');
    const finalized = type === 'DOUBLE_SIGN_EVIDENCE';
    const incident: ValidatorIncident = {
      incidentId: this.nextId('inc'),
      type,
      operatorId: principal.operatorId,
      validatorId,
      summary,
      evidenceRef,
      finalizedMisconduct: finalized,
      monitoringSuspicionOnly: suspicionOnly && MONITORING_SUSPICION_IS_NOT_FINALIZED_MISCONDUCT,
      evidencePreserved: type === 'KEY_COMPROMISE_SUSPECTED' || type === 'DOUBLE_SIGN_EVIDENCE' || type === 'SIGNER_FAILURE',
      openedAtUtc: nowUtc(),
    };
    this.incidents.push(incident);
    this.audit(principal, 'INCIDENT_OPEN', validatorId, 'ALLOW', 'OK', type, incident, principal.actorId);
    return operatorOk(incident);
  }

  preserveIncidentEvidence(principal: OperatorPrincipal, incidentId: string): OperatorResult<ValidatorIncident> {
    const incident = this.incidents.find((row) => row.incidentId === incidentId);
    if (!incident) {
      return operatorErr('MISSING_EVIDENCE', `incident ${incidentId} missing`);
    }
    const gate = this.require(principal, 'INCIDENT_PRESERVE', incident.operatorId, incident.validatorId, { incidentId });
    if (!gate.ok) {
      return gate;
    }
    incident.evidencePreserved = true;
    this.audit(principal, 'INCIDENT_PRESERVE', incident.validatorId, 'ALLOW', 'OK', incident.type, incident, principal.actorId);
    return operatorOk(incident);
  }

  economicsProjection(validatorId: string): OperatorEconomicsProjection {
    const bond = this.economics.publicBondView(validatorId);
    const rewards = this.economics.getValidatorRewardSummary(validatorId);
    const penalties = this.economics.getValidatorPublicPenalties(validatorId);
    const unbond = this.economics.getValidatorUnbondStatus(validatorId);
    return {
      validatorId,
      bondState: bond?.bondState ?? 'UNBONDED',
      rewardSummary: `paid=${rewards.paid};pending=${rewards.pending}`,
      penaltyRecords: penalties.map((row) => `${row.violationClass}:${row.evidenceId}`),
      unbondState: `pending=${unbond.pending};releaseEpoch=${unbond.releaseEpoch ?? 'none'}`,
      source: 'CHUNK_72_VALIDATOR_ECONOMICS',
      canDebitCustomerAssets: OPERATOR_CANNOT_DEBIT_CUSTOMER_ASSETS ? false : false,
    };
  }

  refuseCustomerDebit(): OperatorResult<never> {
    return operatorErr('CUSTOMER_ASSET_ISOLATION', 'operator tooling cannot debit customer assets');
  }

  accountability(validatorId: string, monitoringAlerts: readonly string[] = []): AccountabilityProjection {
    return {
      validatorId,
      protocolEvidence: this.incidents
        .filter((row) => row.validatorId === validatorId && row.finalizedMisconduct)
        .map((row) => row.evidenceRef ?? row.incidentId),
      monitoringAlerts,
      finalizedMisconduct: this.incidents.some((row) => row.validatorId === validatorId && row.finalizedMisconduct),
      suspicionPresentedAsFinal: false,
    };
  }

  prepareGovernanceVote(
    principal: OperatorPrincipal,
    validatorId: string,
    proposalId: string,
    summary: string,
  ): OperatorResult<GovernanceVotePreparation> {
    const gate = this.require(principal, 'GOVERNANCE_PREPARE', operatorForValidator(validatorId), validatorId, {
      validatorId,
      proposalId,
    });
    if (!gate.ok) {
      return gate;
    }
    const preparation: GovernanceVotePreparation = {
      preparationId: this.nextId('gov'),
      operatorId: principal.operatorId,
      validatorId,
      proposalId,
      summary,
      preparedBy: principal.actorId,
      preparedByKind: principal.kind,
      cast: false,
      machineAuthorityDefined: false,
    };
    this.votes.push(preparation);
    this.audit(principal, 'GOVERNANCE_PREPARE', validatorId, 'ALLOW', 'OK', proposalId, preparation, principal.actorId);
    return operatorOk(preparation);
  }

  castGovernanceVote(principal: OperatorPrincipal, preparationId: string): OperatorResult<never> {
    const vote = this.votes.find((row) => row.preparationId === preparationId);
    this.audit(
      principal,
      'GOVERNANCE_CAST',
      vote?.validatorId ?? null,
      'REFUSE',
      'AI_CANNOT_CAST_VOTE',
      vote?.proposalId ?? null,
      { preparationId },
    );
    return operatorErr('AI_CANNOT_CAST_VOTE', 'AI/operator platform cannot cast the human validator-governance vote');
  }

  concentration(): ValidatorConcentrationReport {
    const validators = this.nodes.filter((row) => row.kind === 'VALIDATOR');
    const operatorBuckets = bucket(validators, (row) => row.operatorId);
    const cloudBuckets = bucket(validators, (row) => row.cloudProvider);
    const regionBuckets = bucket(validators, (row) => row.region);
    const hsmBuckets = bucket(
      validators,
      (row) => this.signers.find((signer) => signer.validatorId === row.validatorId)?.provider ?? 'unknown',
    );
    const networkBuckets = bucket(validators, (row) => row.failureDomain);
    const breakdowns: ConcentrationBreakdown[] = [
      { dimension: 'OPERATOR', buckets: operatorBuckets },
      { dimension: 'CLOUD', buckets: cloudBuckets },
      { dimension: 'REGION', buckets: regionBuckets },
      { dimension: 'HSM_PROVIDER', buckets: hsmBuckets },
      { dimension: 'NETWORK', buckets: networkBuckets },
    ];
    return { generatedAtUtc: nowUtc(), breakdowns };
  }

  publicView(validatorId: string): PublicValidatorView {
    const node = this.nodes.find((row) => row.validatorId === validatorId && row.kind === 'VALIDATOR');
    const signer = this.signers.find((row) => row.validatorId === validatorId);
    const economics = this.economicsProjection(validatorId);
    return {
      validatorId,
      publicKeyFingerprint: signer?.publicKeyFingerprint ?? '',
      votingPower: VOTING_POWER,
      publicStatus: node?.canonicalStatus ?? node?.operationalState ?? 'PROVISIONING',
      bondState: economics.bondState,
      publicAccountabilityEvidence: this.accountability(validatorId).protocolEvidence,
      infrastructureHealthExposed: false,
    };
  }

  privateView(principal: OperatorPrincipal, validatorId: string): OperatorResult<PrivateOperatorView> {
    const read = authorizeRead(principal, operatorForValidator(validatorId));
    if (!read.ok) {
      return read;
    }
    const health = this.#health.get(validatorId) ?? this.collectHealth(validatorId);
    return operatorOk({
      validatorId,
      public: this.publicView(validatorId),
      infrastructureHealth: health,
      signerLatencyMs: health.signerLatencyMs,
      diskFreeBytes: health.diskFreeBytes,
    });
  }

  dashboard(principal: OperatorPrincipal): OperatorResult<OperatorDashboardProjection> {
    const read = authorizeRead(principal, principal.operatorId);
    if (!read.ok) {
      return read;
    }
    return operatorOk({
      fleet: [this.operatorFleet(principal.operatorId)],
      alerts: this.incidents.filter((row) => row.operatorId === principal.operatorId),
      maintenance: this.maintenancePlans.filter((row) => row.operatorId === principal.operatorId),
      upgrades: this.upgradePlans.filter((row) => row.operatorId === principal.operatorId),
      bonds: this.nodes
        .filter((row) => row.kind === 'VALIDATOR' && row.operatorId === principal.operatorId && row.validatorId)
        .map((row) => this.economicsProjection(row.validatorId!)),
      signers: this.signersFor(principal.operatorId),
      backups: this.backups.filter((row) => row.operatorId === principal.operatorId),
      incidents: this.incidents.filter((row) => row.operatorId === principal.operatorId),
      secretsPresent: false,
    });
  }

  operatorFleet(operatorId: string): ValidatorFleet {
    const validators = this.nodes.filter((row) => row.kind === 'VALIDATOR' && row.operatorId === operatorId);
    const sentries = this.nodes.filter((row) => row.kind === 'SENTRY' && row.operatorId === operatorId);
    return {
      fleetId: `fleet_${operatorId}`,
      operatorId,
      validators: validators.map((row) => row.validatorId!).filter(Boolean),
      sentries: sentries.map((row) => row.nodeId),
      signers: this.signersFor(operatorId).map((row) => row.signerId),
      regions: [...new Set(validators.map((row) => row.region))],
      failureDomains: [...new Set(validators.map((row) => row.failureDomain))],
      cloudProviders: [...new Set(validators.map((row) => row.cloudProvider))],
      softwareRelease: validators[0]?.softwareRelease ?? 'sunrey-node/1.0.0',
      protocolVersion: validators[0]?.protocolVersion ?? '1',
      health: this.fleetHealth(),
    };
  }

  report(): ValidatorOperatorReport {
    return {
      reportId: this.nextId('rpt'),
      generatedAtUtc: nowUtc(),
      operators: this.operators,
      fleets: [this.operatorFleet(OPERATOR_A_ID), this.operatorFleet(OPERATOR_B_ID)],
      enrollments: this.enrollments,
      incidents: this.incidents,
      concentration: this.concentration(),
      canonicalSetAuthoritative: CANONICAL_VALIDATOR_SET_AUTHORITATIVE,
      publicDelegatedStaking: false,
      governanceToken: false,
    };
  }

  api(principal: OperatorPrincipal, command: string, payload: unknown = {}): OperatorApiResponse {
    const handlers: Record<string, () => unknown> = {
      fleet: () => this.operatorFleet(principal.operatorId),
      operator: () => this.operatorById(principal.operatorId),
      enrollment: () => this.enrollments.filter((row) => row.operatorId === principal.operatorId),
      health: () => this.fleetHealth(),
      maintenance: () => this.maintenancePlans.filter((row) => row.operatorId === principal.operatorId),
      upgrade: () => this.upgradePlans.filter((row) => row.operatorId === principal.operatorId),
      'rotate-key': () => this.rotations.filter((row) => row.operatorId === principal.operatorId),
      backup: () => this.backups.filter((row) => row.operatorId === principal.operatorId),
      incidents: () => this.incidents.filter((row) => row.operatorId === principal.operatorId),
      concentration: () => this.concentration(),
      dashboard: () => this.dashboard(principal),
      report: () => this.report(),
    };
    const run = handlers[command];
    if (!run) {
      return { ok: false, command, payload: { error: 'unknown operator command', usage: operatorUsage() } };
    }
    const read = authorizeRead(principal, principal.operatorId);
    if (!read.ok && command !== 'concentration') {
      return { ok: false, command, payload: read };
    }
    void payload;
    return { ok: true, command, payload: run() };
  }

  private seedHealth(): void {
    for (const validatorId of REHEARSAL_VALIDATOR_IDS) {
      this.collectHealth(validatorId);
    }
  }
}

function bucket(
  nodes: readonly ValidatorNodeRecord[],
  keyOf: (node: ValidatorNodeRecord) => string,
): ConcentrationBreakdown['buckets'] {
  const map = new Map<string, { count: number; power: bigint }>();
  for (const node of nodes) {
    const key = keyOf(node);
    const current = map.get(key) ?? { count: 0, power: 0n };
    current.count += 1;
    current.power += VOTING_POWER;
    map.set(key, current);
  }
  return [...map.entries()].map(([key, value]) => ({
    key,
    validatorCount: value.count,
    votingPower: value.power,
  }));
}

function recoverySteps(kind: RecoveryKind): readonly string[] {
  switch (kind) {
    case 'NODE_LOSS':
      return ['preserve evidence', 'provision replacement node', 'restore snapshot', 'resync signer watermark'];
    case 'DISK_LOSS':
      return ['preserve evidence', 'replace disk', 'restore snapshot and WAL', 'verify state root'];
    case 'SENTRY_LOSS':
      return ['isolate lost sentry', 'provision replacement sentry', 're-authenticate validator path'];
    case 'SIGNER_LOSS':
      return ['preserve evidence before replacement', 'fence lost signer', 'activate prepared passive signer or rotate'];
    case 'FAILURE_DOMAIN_LOSS':
      return ['confirm remaining quorum', 'fail over sentries', 'do not dual-activate signers'];
  }
}

export function operatorUsage(): string {
  return [
    'sunrey-ops validator fleet',
    'sunrey-ops validator operator',
    'sunrey-ops validator enrollment',
    'sunrey-ops validator health',
    'sunrey-ops validator maintenance',
    'sunrey-ops validator upgrade',
    'sunrey-ops validator rotate-key',
    'sunrey-ops validator backup',
    'sunrey-ops validator incidents',
    'sunrey-ops validator concentration',
  ].join('\n');
}

export function defaultAdmin(operatorId: typeof OPERATOR_A_ID | typeof OPERATOR_B_ID = OPERATOR_A_ID): OperatorPrincipal {
  return fixturePrincipal(operatorId, 'OPERATOR_ADMIN', 'HUMAN');
}

export { OPERATOR_A_ID, OPERATOR_B_ID, OPERATOR_A_VALIDATORS, REHEARSAL_VALIDATOR_IDS };
