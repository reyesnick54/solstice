/**
 * sunrey-ops production commands.
 *
 * Isolated / rehearsal only. Never prints private key material.
 * Does not launch mainnet or claim observed production.
 */

import { assertNoPrivateKeyMaterial } from '../ops/logging.ts';
import { createAccessInventory, createResponsibilityMatrix, createSloPolicy, createSystemInventory } from './catalog.ts';
import {
  backupVerificationCatalog,
  createIncidentRecord,
  evaluateProviderRenewal,
  recordChange,
  recordRestoreDrill,
} from './control.ts';
import { createEvidenceRecord } from '../providers/evidence.ts';
import { HANDOFF_NOW_UTC } from './types.ts';
import {
  assembleHandoffPackage,
  createEvidenceSeal,
  createHandoffReport,
  createOperationalBaseline,
  createReadinessReport,
  rejectTamperedEvidenceSeal,
} from './handoff.ts';
import { createOperatorDashboard } from './dashboard.ts';
import { runProductionLifecycleRehearsal } from './rehearsal.ts';
import { fixtureOperatorAcceptances } from './handoff.ts';
import { fullPlatformUsage, runFullPlatformCommand } from './full-platform-candidate/cli.ts';
import { engineeringClosureUsage, runEngineeringClosureCommand } from './engineering-closure/cli.ts';

export type ProductionHandoffCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = [
  'inventory',
  'baseline',
  'access',
  'operators',
  'slo',
  'incidents',
  'backups',
  'restore-drill',
  'providers',
  'changes',
  'evidence-seal',
  'handoff',
  'readiness',
  'dashboard',
  'rehearse',
  'help',
] as const;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

export function productionUsage(): string {
  return [
    'sunrey-ops production inventory',
    'sunrey-ops production baseline',
    'sunrey-ops production access',
    'sunrey-ops production operators',
    'sunrey-ops production slo',
    'sunrey-ops production incidents',
    'sunrey-ops production backups',
    'sunrey-ops production restore-drill',
    'sunrey-ops production providers',
    'sunrey-ops production changes',
    'sunrey-ops production evidence-seal',
    'sunrey-ops production handoff',
    'sunrey-ops production readiness',
    ...fullPlatformUsage().split('\n'),
    ...engineeringClosureUsage().split('\n'),
  ].join('\n');
}

export function runProductionHandoffCommand(argv: readonly string[], root = process.cwd()): ProductionHandoffCliResult {
  const [command = 'help'] = argv;
  if (command === 'full-platform') {
    const result = runFullPlatformCommand(argv.slice(1), root);
    return { ok: result.ok, command: result.command, payload: result.payload };
  }
  if (command === 'engineering-closure') {
    const result = runEngineeringClosureCommand(argv.slice(1), root);
    return { ok: result.ok, command: result.command, payload: result.payload };
  }
  if (command === 'help' || !(COMMANDS as readonly string[]).includes(command as (typeof COMMANDS)[number])) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage: productionUsage(),
        simulation: true,
        observedProduction: false,
        mainnetEnabled: false,
      },
    };
  }

  if (command === 'inventory') {
    return ok('inventory', createSystemInventory());
  }
  if (command === 'baseline') {
    return ok('baseline', createOperationalBaseline(root));
  }
  if (command === 'access') {
    return ok('access', createAccessInventory());
  }
  if (command === 'operators') {
    return ok('operators', {
      responsibility: createResponsibilityMatrix(),
      acceptances: fixtureOperatorAcceptances(),
      realHumanAcceptance: false,
    });
  }
  if (command === 'slo') {
    return ok('slo', createSloPolicy());
  }
  if (command === 'incidents') {
    return ok('incidents', [
      createIncidentRecord({
        incidentId: 'inc_handoff_catalog',
        domain: 'INFRASTRUCTURE',
        summary: 'Incident-command catalog. No production incident fabricated.',
      }),
    ]);
  }
  if (command === 'backups') {
    return ok('backups', backupVerificationCatalog());
  }
  if (command === 'restore-drill') {
    return ok(
      'restore-drill',
      recordRestoreDrill({ drillId: 'restore_cli_1', class: 'DATABASE_BACKUP', executed: true }),
    );
  }
  if (command === 'providers') {
    const expired = createEvidenceRecord({
      recordId: 'ev_cli_expired',
      providerId: 'provider_cli',
      evidenceClass: 'SERVICE_CONTRACT',
      documentOrReferenceId: 'ref_expired',
      issuerOrSource: 'fixture',
      issuedAtUtc: '2025-01-01T00:00:00.000Z',
      expiresAtUtc: '2025-12-31T00:00:00.000Z',
      scope: 'cli',
    });
    return ok('providers', evaluateProviderRenewal(expired, HANDOFF_NOW_UTC, 'CONTRACT'));
  }
  if (command === 'changes') {
    return ok(
      'changes',
      recordChange({
        changeId: 'chg_cli_app',
        kind: 'APPLICATION',
        reason: 'catalog example',
        affectedServices: ['RPC'],
        risk: 'LOW',
        releaseRef: 'SUNREY_MAINNET_RC_1',
        approval: 'ops-authority-fixture',
        rollbackStrategy: 'redeploy prior release artifact; application rollback is not chain-history rollback',
      }),
    );
  }
  if (command === 'evidence-seal') {
    const report = createHandoffReport(root);
    rejectTamperedEvidenceSeal(report.seal);
    return ok('evidence-seal', report.seal);
  }
  if (command === 'handoff') {
    return ok('handoff', assembleHandoffPackage(root));
  }
  if (command === 'readiness') {
    return ok('readiness', createReadinessReport(root));
  }
  if (command === 'dashboard') {
    return ok('dashboard', createOperatorDashboard(root));
  }
  if (command === 'rehearse') {
    return ok('rehearse', runProductionLifecycleRehearsal(root));
  }
  return {
    ok: false,
    command,
    payload: { error: 'unknown production command', usage: productionUsage() },
  };
}

function ok(command: string, payload: unknown): ProductionHandoffCliResult {
  const safe = jsonSafe(payload);
  assertNoPrivateKeyMaterial(safe);
  return { ok: true, command, payload: safe };
}

export { createEvidenceSeal };
