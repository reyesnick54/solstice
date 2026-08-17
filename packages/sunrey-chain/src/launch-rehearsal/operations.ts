/**
 * Launch control room, operator roles, T-minus phases, pre-launch
 * checks, and Chunk 55 observability validation.
 */

import { CAPABILITIES } from '../../../config/src/flags.ts';
import { dashboardDefinitions, validateDashboardConfigs } from '../ops/dashboards.ts';
import { alertDefinitions } from '../ops/alerts.ts';
import { runFullCeremonyRehearsal } from '../../../security/src/ceremony/rehearsal.ts';
import type { LaunchControlRoomState, LaunchPhase, LaunchRole } from './types.ts';
import { LAUNCH_PHASES, LAUNCH_ROLES } from './types.ts';
import { REHEARSAL_ID } from './identity.ts';
import type { RehearsalReleaseVerification } from './artifacts.ts';
import type { RehearsalGenesisBundle } from './genesis.ts';
import type { RehearsalTopology } from './infrastructure.ts';

export const REHEARSAL_OPERATORS: Readonly<Record<LaunchRole, { readonly actorKind: 'HUMAN' | 'AI'; readonly mayAuthorize: boolean }>> = Object.freeze({
  LAUNCH_COORDINATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  PROTOCOL_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  SECURITY_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  VALIDATOR_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  INFRASTRUCTURE_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  DATABASE_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  ORACLE_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  EXCHANGE_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  CUSTODY_OPERATOR: { actorKind: 'HUMAN', mayAuthorize: true },
  INCIDENT_COMMANDER: { actorKind: 'HUMAN', mayAuthorize: true },
  OBSERVER: { actorKind: 'HUMAN', mayAuthorize: false },
});

export function aiMayImpersonateAuthorization(): false {
  return false;
}

export function advancePhase(current: LaunchPhase): LaunchPhase {
  const index = LAUNCH_PHASES.indexOf(current);
  return LAUNCH_PHASES[Math.min(index + 1, LAUNCH_PHASES.length - 1)]!;
}

export type PreLaunchCheck = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export function runPreLaunchChecks(input: {
  readonly release: RehearsalReleaseVerification;
  readonly genesis: RehearsalGenesisBundle;
  readonly topology: RehearsalTopology;
  readonly signersReady: boolean;
  readonly storageReady: boolean;
}): readonly PreLaunchCheck[] {
  const ceremony = runFullCeremonyRehearsal({
    ceremonyId: 'cerm_rehearsal_chunk70',
    fixtureEnv: { SUNREY_FIXTURE_ENV: 'test' },
  });
  return Object.freeze([
    { id: 'release-artifacts', ok: input.release.ok, detail: input.release.artifactDigest },
    { id: 'genesis', ok: input.genesis.verification.ok, detail: input.genesis.genesisHash },
    { id: 'ceremony-transcript', ok: ceremony.ok, detail: ceremony.ok ? ceremony.value.transcriptHash : 'ceremony failed' },
    { id: 'validator-public-keys', ok: input.genesis.input.validators.length === 7, detail: '7 rehearsal keys' },
    { id: 'signer-fencing', ok: input.signersReady, detail: 'active/passive' },
    { id: 'network-routes', ok: input.topology.sentries.length >= 14, detail: `${input.topology.sentries.length} sentries` },
    { id: 'dns-tls', ok: true, detail: 'rehearsal configuration only' },
    { id: 'storage-capacity', ok: input.storageReady, detail: 'production-candidate engine' },
    { id: 'snapshots', ok: input.storageReady, detail: 'verified snapshot' },
    { id: 'backups', ok: input.topology.services.some((row) => row.role === 'BACKUP'), detail: 'backup service' },
    { id: 'monitoring', ok: input.topology.services.some((row) => row.role === 'MONITORING'), detail: 'Chunk 55 dashboards' },
    { id: 'incident-channels', ok: true, detail: 'rehearsal incident commander' },
    { id: 'provider-readiness', ok: true, detail: 'sandbox adapters only' },
    { id: 'live-flags', ok: CAPABILITIES.ENVIRONMENT === 'simulation' && CAPABILITIES.LIVE_EXCHANGE_ENABLED === false, detail: 'simulation' },
  ]);
}

export function validateObservability(): {
  readonly dashboards: number;
  readonly alerts: number;
  readonly ok: boolean;
} {
  const dashboards = validateDashboardConfigs();
  const alerts = alertDefinitions();
  return Object.freeze({
    dashboards: dashboards.length,
    alerts: alerts.length,
    ok: dashboards.length === dashboardDefinitions().length && alerts.length > 0,
  });
}

export function controlRoomFromChecks(
  checks: readonly PreLaunchCheck[],
  phase: LaunchPhase,
  finalizedHeight: string,
  incidents: readonly string[] = [],
): LaunchControlRoomState {
  const ok = (id: string) => checks.find((row) => row.id === id)?.ok === true;
  return Object.freeze({
    schemaVersion: 1,
    rehearsalId: REHEARSAL_ID,
    phase,
    releaseVerified: ok('release-artifacts'),
    genesisVerified: ok('genesis'),
    validatorsReady: ok('validator-public-keys'),
    signersReady: ok('signer-fencing'),
    networkPathsReady: ok('network-routes'),
    storageReady: ok('storage-capacity'),
    rpcReady: true,
    explorerReady: true,
    oracleReady: true,
    backupReady: ok('backups'),
    monitoringReady: ok('monitoring'),
    incidents: Object.freeze([...incidents]),
    finalizedHeight,
    productionActivated: false,
    liveFlagsRemainDisabled: true,
  });
}

export function requiredHumanRoles(): readonly LaunchRole[] {
  return LAUNCH_ROLES.filter((role) => REHEARSAL_OPERATORS[role].mayAuthorize);
}
