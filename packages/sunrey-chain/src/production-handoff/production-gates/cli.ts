import { assertNoPrivateKeyMaterial } from '../../ops/logging.ts';
import { prepareLaunchCeremonyChecklist } from './ceremony.ts';
import { currentRepositoryGateSnapshot } from './evaluate.ts';
import {
  formatExternalAssuranceHandoff,
  formatLaunchCeremonyChecklistMarkdown,
  formatProductionGateReport,
  writeProductionGateDocuments,
} from './report.ts';

export type ProductionGateCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

export function productionGateUsage(): string {
  return [
    'sunrey-ops production gates evaluate',
    'sunrey-ops production gates report',
    'sunrey-ops production gates write',
    'sunrey-ops production gates ceremony',
    'sunrey-ops production gates assurance',
  ].join('\n');
}

export function runProductionGateCommand(argv: readonly string[], root = process.cwd()): ProductionGateCliResult {
  const [command = 'help'] = argv;
  if (command === 'help') {
    return { ok: true, command: 'help', payload: { usage: productionGateUsage(), productionActive: false } };
  }
  const snapshot = currentRepositoryGateSnapshot();
  if (command === 'write') {
    writeProductionGateDocuments(root, snapshot);
  }
  if (command === 'evaluate') {
    const payload = {
      releaseDecision: snapshot.releaseDecision,
      backendSoftwareReady: snapshot.backendSoftwareReady,
      externalGatesMissing: snapshot.externalGatesMissing,
      productionActive: snapshot.productionActive,
      totalGates: snapshot.inputs.length,
      satisfiedInternal: snapshot.satisfiedInternalGateIds.length,
      missingExternal: snapshot.missingExternalGateIds.length,
      registryHash: snapshot.registryHash,
    };
    assertNoPrivateKeyMaterial(payload);
    return { ok: snapshot.productionActive === false, command, payload };
  }
  if (command === 'ceremony') {
    const payload = prepareLaunchCeremonyChecklist(snapshot);
    assertNoPrivateKeyMaterial(payload);
    return { ok: payload.executed === false, command, payload };
  }
  if (command === 'assurance') {
    const payload = { text: formatExternalAssuranceHandoff() };
    assertNoPrivateKeyMaterial(payload);
    return { ok: true, command, payload };
  }
  if (command === 'report' || command === 'write') {
    const payload = {
      snapshot,
      text: formatProductionGateReport(snapshot),
      ceremony: formatLaunchCeremonyChecklistMarkdown(),
    };
    assertNoPrivateKeyMaterial(payload);
    return {
      ok: snapshot.releaseDecision === 'BLOCKED' && snapshot.productionActive === false,
      command,
      payload,
    };
  }
  return { ok: false, command, payload: { error: 'unknown production gates command', usage: productionGateUsage() } };
}
