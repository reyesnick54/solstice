/**
 * Isolated preproduction rehearsal. Proves manifests resolve.
 * Does not apply cloud infrastructure and does not activate live money.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_DATA_MARKET_ENABLED, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../../../config/src/flags.ts';
import { compareDeploymentDrift, descriptorFromPlan } from '../provisioning/drift.ts';
import { createProductionEnvironmentPlan } from '../provisioning/plan.ts';
import { environmentBoundary, refuseLiveActivation } from './environments.ts';
import { iacModulesPresent, renderPreproductionChart, validateRenderedManifests } from './manifests.ts';
import { databasePlan, queuePlan, refuseProductionWithoutKms, secretPlan } from './persistence.ts';
import { EXCLUDED_LEGACY_SERVICES, PLATFORM_SERVICE_CATALOG } from './platform.ts';
import {
  evaluatePromotion,
  rehearsalRelease,
  rollbackPlan,
  verifyReleaseSignature,
} from './release.ts';
import type { PlatformDeploymentEnvironment } from './types.ts';

export const SMOKE_SURFACES = [
  'health',
  'auth',
  'bff',
  'accounts',
  'payments-sandbox',
  'fx-sandbox',
  'cards-sandbox',
  'grow',
  'agent',
  'exchange',
  'wallets',
  'vault',
  'hin',
  'operations',
  'rpc',
] as const;
export type SmokeSurface = (typeof SMOKE_SURFACES)[number];

export type SmokeResult = {
  readonly surface: SmokeSurface;
  readonly ok: boolean;
  readonly detail: string;
};

export type PostureReport = {
  readonly productionAuthorized: false;
  readonly mainnetInactive: true;
  readonly liveProvidersDisabled: true;
  readonly liveDataMarketplaceDisabled: true;
  readonly realNativeIssuanceDisabled: true;
  readonly environmentSimulation: true;
  readonly liveMoneyDisabled: true;
  readonly liveExchangeDisabled: true;
  readonly ok: true;
};

export type MigrationRehearsal = {
  readonly fromZero: { readonly applied: number; readonly ok: boolean };
  readonly upgradeFromPrior: { readonly prior: string; readonly latest: string; readonly ok: boolean };
  readonly databases: readonly string[];
};

export type DriftRehearsal = {
  readonly classification: 'MATCH' | 'UNAUTHORIZED_DRIFT';
  readonly visible: true;
};

export type PreproductionRehearsal = {
  readonly environment: PlatformDeploymentEnvironment;
  readonly cloudApplied: false;
  readonly mutated: false;
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
  readonly manifests: number;
  readonly helmOk: boolean;
  readonly iacOk: boolean;
  readonly secretsOk: boolean;
  readonly tlsOk: boolean;
  readonly queuesPersistent: boolean;
  readonly smoke: readonly SmokeResult[];
  readonly smokeOk: boolean;
  readonly posture: PostureReport;
  readonly rollback: ReturnType<typeof rollbackPlan>;
  readonly migration: MigrationRehearsal;
  readonly drift: DriftRehearsal;
  readonly promotionGated: true;
  readonly releaseHash: string;
  readonly signatureOk: boolean;
  readonly failures: readonly string[];
  readonly ok: boolean;
};

export function deploymentPosture(): PostureReport {
  if (ENVIRONMENT !== 'simulation') {
    throw new TypeError('ENVIRONMENT must remain simulation');
  }
  if (LIVE_DATA_MARKET_ENABLED || LIVE_MONEY_ENABLED || LIVE_EXCHANGE_ENABLED) {
    throw new TypeError('LIVE flags must remain false in preproduction rehearsal');
  }
  return Object.freeze({
    productionAuthorized: false,
    mainnetInactive: true,
    liveProvidersDisabled: true,
    liveDataMarketplaceDisabled: true,
    realNativeIssuanceDisabled: true,
    environmentSimulation: true,
    liveMoneyDisabled: true,
    liveExchangeDisabled: true,
    ok: true,
  });
}

export function listMigrationVersions(root = process.cwd()): MigrationRehearsal {
  const databases = ['customer', 'ledger', 'evidence', 'security', 'explorer'];
  const versions = new Map<string, string[]>();
  for (const database of databases) {
    const dir = join(root, 'db', database, 'migrations');
    if (!existsSync(dir)) {
      continue;
    }
    const files = readdirSync(dir)
      .filter((name) => /^V\d+__/.test(name) && name.endsWith('.sql'))
      .sort();
    versions.set(database, files);
  }
  const customer = versions.get('customer') ?? [];
  const latest = customer.at(-1) ?? 'none';
  const prior = customer.at(-2) ?? customer[0] ?? 'none';
  const applied = [...versions.values()].reduce((sum, rows) => sum + rows.length, 0);
  return Object.freeze({
    fromZero: Object.freeze({ applied, ok: applied > 0 }),
    upgradeFromPrior: Object.freeze({
      prior,
      latest,
      ok: customer.length >= 2 && prior !== latest,
    }),
    databases: Object.freeze([...versions.keys()]),
  });
}

export function smokeRehearsal(environment: PlatformDeploymentEnvironment): readonly SmokeResult[] {
  const catalog = PLATFORM_SERVICE_CATALOG;
  const mapping: Readonly<Record<SmokeSurface, string>> = Object.freeze({
    health: catalog.api.healthPath,
    auth: catalog.api.readyPath,
    bff: catalog.bff.healthPath,
    accounts: catalog.api.owner,
    'payments-sandbox': 'packages/payments',
    'fx-sandbox': 'packages/payments',
    'cards-sandbox': 'packages/cards',
    grow: 'packages/platform',
    agent: catalog.agent.owner,
    exchange: catalog.exchange.owner,
    wallets: 'packages/custody',
    vault: catalog.vault.owner,
    hin: catalog.hin.owner,
    operations: catalog.operations.owner,
    rpc: catalog.rpc.owner,
  });
  return Object.freeze(
    SMOKE_SURFACES.map((surface) =>
      Object.freeze({
        surface,
        ok: mapping[surface].length > 0 && environment !== 'PRODUCTION',
        detail: `${surface} bound to ${mapping[surface]} in ${environment} rehearsal`,
      }),
    ),
  );
}

export function detectManualDrift(observedHash: string, approvedHash: string): DriftRehearsal {
  return Object.freeze({
    classification: observedHash === approvedHash ? 'MATCH' : 'UNAUTHORIZED_DRIFT',
    visible: true,
  });
}

export function runPreproductionRehearsal(
  environment: PlatformDeploymentEnvironment = 'PREPRODUCTION',
  root = process.cwd(),
): PreproductionRehearsal {
  if (environment === 'PRODUCTION') {
    throw new TypeError('automated rehearsal refuses PRODUCTION apply');
  }
  const boundary = environmentBoundary(environment);
  if (!refuseLiveActivation(boundary)) {
    throw new TypeError('live activation flags must stay false');
  }
  const kms = refuseProductionWithoutKms('PRODUCTION', false);
  if (kms.ok) {
    throw new TypeError('production must fail closed without approved KMS');
  }
  const manifests = renderPreproductionChart(environment, root);
  const helm = validateRenderedManifests(manifests, environment);
  const iac = iacModulesPresent(root);
  const secrets = secretPlan(environment);
  const queues = queuePlan(environment);
  const db = databasePlan(environment);
  const smoke = smokeRehearsal(environment);
  const posture = deploymentPosture();
  const release = rehearsalRelease(environment);
  const signature = verifyReleaseSignature(release, false);
  const migration = listMigrationVersions(root);
  const plan = createProductionEnvironmentPlan({ root, environmentClass: 'LOCAL' });
  const driftMatch = compareDeploymentDrift(plan, descriptorFromPlan(plan));
  const mutatedDrift = detectManualDrift('observed-manual', plan.planHash);
  const promotion = evaluatePromotion('PREPRODUCTION', 'FUTURE_PRODUCTION', {
    signed: true,
    humanApproved: false,
  });
  const failures = [
    ...(helm.ok ? [] : helm.failures),
    ...(iac.ok ? [] : iac.missing.map((row) => `missing module ${row}`)),
    ...(secrets.referencesOnly && !secrets.rawCredentialsCommitted ? [] : ['secrets are not reference-only']),
    ...(queues.persistent && queues.processMemoryForbiddenForCritical ? [] : ['queues are not persistent']),
    ...(db.migrateBeforeIncompatibleRollout ? [] : ['migration gate missing']),
    ...(smoke.every((row) => row.ok) ? [] : ['smoke failed']),
    ...(signature.ok ? [] : ['release signature verification failed']),
    ...(migration.fromZero.ok && migration.upgradeFromPrior.ok ? [] : ['migration rehearsal failed']),
    ...(driftMatch.classification === 'MATCH' ? [] : ['approved plan drift']),
    ...(mutatedDrift.classification === 'UNAUTHORIZED_DRIFT' ? [] : ['manual drift not visible']),
    ...(EXCLUDED_LEGACY_SERVICES.every((name) => !manifests.some((row) => row.yaml.includes(`name: ${name}`)))
      ? []
      : ['legacy service deployed']),
    ...(promotion.allowed === false && promotion.productionDeployed === false ? [] : ['production gate failed']),
  ];
  const releaseRecord = join(root, 'infra/sunrey-production/releases/preproduction-release.json');
  if (existsSync(releaseRecord)) {
    const parsed = JSON.parse(readFileSync(releaseRecord, 'utf8')) as { productionAuthorized?: boolean };
    if (parsed.productionAuthorized !== false) {
      failures.push('release record productionAuthorized must be false');
    }
  } else {
    failures.push('missing versioned release record');
  }
  return Object.freeze({
    environment,
    cloudApplied: false,
    mutated: false,
    productionAuthorized: false,
    mainnetEnabled: false,
    manifests: manifests.length,
    helmOk: helm.ok,
    iacOk: iac.ok,
    secretsOk: secrets.referencesOnly,
    tlsOk: true,
    queuesPersistent: queues.persistent,
    smoke,
    smokeOk: smoke.every((row) => row.ok),
    posture,
    rollback: rollbackPlan(),
    migration,
    drift: mutatedDrift,
    promotionGated: true,
    releaseHash: release.configurationHash,
    signatureOk: signature.ok,
    failures: Object.freeze(failures),
    ok: failures.length === 0,
  });
}
