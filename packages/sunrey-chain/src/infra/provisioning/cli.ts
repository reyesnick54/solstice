import { assertNoPrivateKeyMaterial } from '../../../../security/src/crypto-leakage.ts';
import { unwrapSecurity } from '../../../../security/src/errors.ts';
import { compareDeploymentDrift, descriptorFromPlan } from './drift.ts';
import { runLocalProvisioningHarness } from './harness.ts';
import { FORBIDDEN_PRODUCTION_NETWORK_IDS, targetForClass } from './identity.ts';
import { createProductionEnvironmentPlan, verifyProductionEnvironmentPlan } from './plan.ts';
import { consumeProviderAcceptance } from '../../production-ceremony/bindings.ts';
import type { ProductionEnvironmentClass } from './types.ts';

export type ProvisioningCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = ['plan', 'verify-plan', 'topology', 'services', 'providers', 'drift', 'rehearse', 'help'] as const;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)));
}

function parseClass(value: string | undefined): ProductionEnvironmentClass {
  if (value === 'TESTNET' || value === 'MAINNET_REHEARSAL' || value === 'PRODUCTION_CANDIDATE' || value === 'PRODUCTION' || value === 'LOCAL') {
    return value;
  }
  return 'LOCAL';
}

export function productionProvisioningUsage(): readonly string[] {
  return Object.freeze([
    'sunrey-ops production plan',
    'sunrey-ops production verify-plan',
    'sunrey-ops production topology',
    'sunrey-ops production services',
    'sunrey-ops production providers',
    'sunrey-ops production drift',
    'sunrey-ops production rehearse',
  ]);
}

export function runProductionProvisioningCommand(
  argv: readonly string[],
  root = process.cwd(),
): ProvisioningCliResult {
  const [command = 'help', extra] = argv;
  if (command === 'help' || !(COMMANDS as readonly string[]).includes(command as (typeof COMMANDS)[number])) {
    return {
      ok: true,
      command: 'help',
      payload: {
        usage: productionProvisioningUsage(),
        productionAuthorized: false,
        mainnetEnabled: false,
        mutationRequiresHumanAuthorization: true,
      },
    };
  }
  const environmentClass = parseClass(extra);
  if (command === 'rehearse') {
    const harness = runLocalProvisioningHarness(environmentClass === 'PRODUCTION' ? 'LOCAL' : environmentClass, root);
    const payload = jsonSafe({
      environmentClass: harness.environmentClass,
      planHash: harness.plan.planHash,
      operations: harness.results.length,
      mutated: false,
      productionAuthorized: false,
      mainnetEnabled: false,
    });
    unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
    return { ok: true, command, payload };
  }
  const plan = createProductionEnvironmentPlan({
    root,
    environmentClass: environmentClass === 'PRODUCTION' ? 'PRODUCTION_CANDIDATE' : environmentClass,
  });
  if (command === 'plan') {
    const payload = jsonSafe({
      plan,
      productionAuthorized: false,
      mainnetEnabled: false,
    });
    unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
    return { ok: true, command, payload };
  }
  if (command === 'verify-plan') {
    const report = verifyProductionEnvironmentPlan(plan, root);
    const payload = jsonSafe(report);
    unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
    return { ok: report.ok, command, payload };
  }
  if (command === 'topology') {
    const payload = jsonSafe({
      environment: plan.environment,
      validators: plan.validators.map((row) => ({
        validatorId: row.validatorId,
        zone: row.networkZone,
        sentries: row.sentryConnections,
        signer: row.remoteSignerReference,
      })),
      zones: plan.operations.map((row) => row.zone),
    });
    unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
    return { ok: true, command, payload };
  }
  if (command === 'services') {
    const payload = jsonSafe({ services: plan.services });
    unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
    return { ok: true, command, payload };
  }
  if (command === 'providers') {
    const provider = consumeProviderAcceptance(root);
    const payload = jsonSafe({
      provider,
      target: targetForClass(environmentClass),
      fixtureCannotQualifyProduction: true,
    });
    unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
    return { ok: true, command, payload };
  }
  const drift = compareDeploymentDrift(plan, descriptorFromPlan(plan));
  const payload = jsonSafe({
    ...drift,
    fixtureCannotQualifyProduction: true,
    forbiddenProductionNetworks: FORBIDDEN_PRODUCTION_NETWORK_IDS,
  });
  unwrapSecurity(assertNoPrivateKeyMaterial(payload, 'provisioning-cli'));
  return { ok: drift.classification === 'MATCH', command, payload };
}
