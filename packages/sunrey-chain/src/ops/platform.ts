import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Clock } from '../../../config/src/clock.ts';
import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { alertDefinitions } from './alerts.ts';
import { assertBackupClassCatalog, encryptBackup } from './backup.ts';
import { validateDashboardConfigs } from './dashboards.ts';
import { runDrill } from './drills.ts';
import { createOpsEvidenceVault, sealIncidentEvidence } from './evidence.ts';
import { SignerFencingController } from './fencing.ts';
import { SimulatedResilienceNetwork } from './network.ts';
import { requiredMetricCatalog } from './observability.ts';
import { assertEngineeringLabel, engineeringRecoveryObjectives, engineeringSlos } from './slo.ts';
import { developmentMultiDomainProfile } from './topology.ts';
import type { DisasterRecoveryReport, DrillScenario } from './types.ts';

export class ResiliencePlatform {
  readonly clock: Clock;
  readonly keys = createSimulationKeyProvider();
  readonly topology = developmentMultiDomainProfile();
  readonly network = new SimulatedResilienceNetwork();
  readonly fencing = new SignerFencingController();
  readonly evidence;
  readonly reports: DisasterRecoveryReport[] = [];

  constructor(clock: Clock = new FrozenClock(asUtcInstant('2026-08-17T00:00:00.000Z'))) {
    this.clock = clock;
    this.evidence = createOpsEvidenceVault(clock);
    for (const validator of this.topology.validators) {
      this.fencing.register(validator.validatorId, `${validator.domainId}_active`, `${validator.domainId}_passive`);
    }
    assertEngineeringLabel();
    assertBackupClassCatalog();
  }

  health(): Record<string, unknown> {
    return {
      profileId: this.topology.profileId,
      chainId: this.topology.chainId,
      validators: this.network.validators.length,
      domains: this.topology.domains.length,
      finalizedHeight: this.network.finalized.at(-1)?.height.toString() ?? '0',
      rpcHealthy: this.network.healthyRpc().length,
      explorerInstances: this.network.explorers.length,
      faucet: this.network.faucetId,
      canFinalize: this.network.canFinalize(),
      stateRootsAgree: this.network.stateRootsAgree(),
    };
  }

  topologyView(): Record<string, unknown> {
    return {
      profileId: this.topology.profileId,
      domains: this.topology.domains,
      validators: this.topology.validators.map((row) => ({
        ...row,
        votingPower: row.votingPower.toString(),
      })),
      cells: this.topology.cells,
      votingPower: {
        totalPower: this.topology.votingPower.totalPower.toString(),
        finalizeThreshold: this.topology.votingPower.finalizeThreshold.toString(),
        valid: this.topology.votingPower.valid,
      },
    };
  }

  run(scenario: DrillScenario): DisasterRecoveryReport {
    const result = runDrill(scenario, this.clock.now());
    this.reports.push(result.report);
    if (result.report.finalState === 'FAILED') {
      sealIncidentEvidence(this.evidence, 'OPS_BACKUP_FAILURE', {
        drillId: result.report.drillId,
        scenario,
        failures: result.report.failures,
      });
    }
    return result.report;
  }

  latestReport(): DisasterRecoveryReport | undefined {
    return this.reports.at(-1);
  }

  validateObservabilityConfigs(): readonly string[] {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'ops');
    const collector = readFileSync(join(root, 'otel-collector.yaml'), 'utf8');
    if (!collector.includes('otlp') || !collector.includes('prometheus')) {
      throw new Error('otel collector config missing required exporters');
    }
    const alerts = JSON.parse(readFileSync(join(root, 'prometheus', 'alerts.json'), 'utf8')) as {
      readonly rules: readonly { readonly alert: string }[];
    };
    const defined = new Set(alertDefinitions().map((row) => row.code));
    for (const rule of alerts.rules) {
      if (!defined.has(rule.alert as never)) {
        throw new Error(`unknown alert rule ${rule.alert}`);
      }
    }
    validateDashboardConfigs();
    return ['otel-collector.yaml', 'prometheus/alerts.json', 'grafana/dashboards'];
  }

  encryptSensitiveBackup(plaintext: Buffer) {
    return encryptBackup(this.keys, plaintext);
  }
}

export function metricCatalogComplete(names: readonly string[]): boolean {
  return requiredMetricCatalog().every((name) => names.includes(name));
}

export { engineeringSlos, engineeringRecoveryObjectives };
