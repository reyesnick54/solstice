/**
 * Helm chart and OpenTofu module catalog for the preproduction platform.
 * Rendering proves manifests resolve without claiming a cloud apply.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { IAC_MODULES, type InfrastructureModule } from '../config.ts';
import { environmentBoundary } from './environments.ts';
import { databasePlan, objectStoragePlan, queuePlan, secretPlan } from './persistence.ts';
import { PLATFORM_SERVICE_CATALOG, replicasFor } from './platform.ts';
import { REHEARSAL_CONTAINER_DIGEST, tlsPlan } from './release.ts';
import { CANONICAL_PLATFORM_SERVICES, type PlatformDeploymentEnvironment } from './types.ts';

export const PREPRODUCTION_HELM_CHART = 'infra/sunrey-production/helm/sunrey-preproduction';
export const PREPRODUCTION_RELEASE_RECORD = 'infra/sunrey-production/releases/preproduction-release.json';

export const PREPRODUCTION_IAC_MODULES: readonly InfrastructureModule[] = IAC_MODULES;

export type RenderedManifest = {
  readonly path: string;
  readonly kind: string;
  readonly name: string;
  readonly yaml: string;
};

function lookup(values: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^\./, '').split('.');
  let current: unknown = values;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function renderHelmTemplate(template: string, values: Record<string, unknown>): string {
  let output = template;
  output = output.replace(/\{\{-?\s*range\s+\.Values\.(\S+?)\s*-?\}\}([\s\S]*?)\{\{-?\s*end\s*-?\}\}/g, (_m, key, body) => {
    const list = lookup(values, key);
    if (!Array.isArray(list)) {
      return '';
    }
    return list
      .map((item) => {
        const row = item as Record<string, unknown>;
        return String(body).replace(/\{\{-?\s*\.(\w+)\s*-?\}\}/g, (_inner, field) => String(row[field] ?? ''));
      })
      .join('');
  });
  output = output.replace(
    /\{\{-?\s*if\s+\.Values\.(\S+?)\s*-?\}\}([\s\S]*?)\{\{-?\s*end\s*-?\}\}/g,
    (_m, key, body) => (lookup(values, key) ? String(body) : ''),
  );
  output = output.replace(/\{\{-?\s*\.Values\.(\S+?)\s*-?\}\}/g, (_m, key) => {
    const value = lookup(values, key);
    return value === undefined || value === null ? '' : String(value);
  });
  return output;
}

export function chartValues(environment: PlatformDeploymentEnvironment): Record<string, unknown> {
  const boundary = environmentBoundary(environment);
  const tls = tlsPlan(environment);
  const secrets = secretPlan(environment);
  const db = databasePlan(environment);
  const queue = queuePlan(environment);
  const storage = objectStoragePlan(environment);
  const workloads = CANONICAL_PLATFORM_SERVICES.map((name) => {
    const spec = PLATFORM_SERVICE_CATALOG[name];
    return {
      name,
      zone: spec.zone,
      public: spec.public,
      replicas: replicasFor(name, environment),
      cpuRequest: spec.cpu.request,
      cpuLimit: spec.cpu.limit,
      memoryRequest: spec.memory.request,
      memoryLimit: spec.memory.limit,
      healthPath: spec.healthPath,
      readyPath: spec.readyPath,
      strategy: spec.strategy,
    };
  });
  return {
    platformEnvironment: environment,
    namespace: boundary.namespace,
    productionAuthorized: false,
    mainnetEnabled: false,
    mainnetActive: false,
    liveProviders: false,
    liveDataMarketplace: false,
    nativeIssuanceEnabled: false,
    environment: 'simulation',
    image: {
      repository: 'ghcr.io/sunrey/platform',
      digest: REHEARSAL_CONTAINER_DIGEST,
      digestKind: 'SIMULATION_REHEARSAL_PLACEHOLDER',
      tag: '',
    },
    postgresImage: {
      repository: 'docker.io/library/postgres',
      digest: REHEARSAL_CONTAINER_DIGEST,
      digestKind: 'SIMULATION_REHEARSAL_PLACEHOLDER',
    },
    tls,
    secrets,
    database: {
      tlsRequired: db.tlsRequired,
      replicaCount: db.replicaCount,
      haModel: db.haModel,
    },
    queue: {
      persistent: queue.persistent,
      deadLetterRequired: queue.deadLetterRequired,
    },
    storage: {
      encryption: storage.encryption,
      publicAccess: storage.publicAccess,
      versioning: storage.versioning,
    },
    workloads,
  };
}

export function renderPreproductionChart(
  environment: PlatformDeploymentEnvironment,
  root = process.cwd(),
): readonly RenderedManifest[] {
  const chartDir = join(root, PREPRODUCTION_HELM_CHART, 'templates');
  const values = chartValues(environment);
  if (!existsSync(chartDir)) {
    throw new TypeError(`helm chart missing at ${PREPRODUCTION_HELM_CHART}`);
  }
  const files = readdirSync(chartDir)
    .filter((name) => name.endsWith('.yaml'))
    .sort();
  const rendered: RenderedManifest[] = [];
  for (const file of files) {
    const template = readFileSync(join(chartDir, file), 'utf8');
    const yaml = renderHelmTemplate(template, values);
    const kindMatch = yaml.match(/^kind:\s+(\S+)/m);
    const nameMatch = yaml.match(/^ {2}name:\s+(\S+)/m) ?? yaml.match(/name:\s+(\S+)/);
    rendered.push(
      Object.freeze({
        path: `${PREPRODUCTION_HELM_CHART}/templates/${file}`,
        kind: kindMatch?.[1] ?? 'Unknown',
        name: nameMatch?.[1] ?? file.replace(/\.yaml$/, ''),
        yaml,
      }),
    );
  }
  return Object.freeze(rendered);
}

export function validateRenderedManifests(
  manifests: readonly RenderedManifest[],
  environment: PlatformDeploymentEnvironment,
): { readonly ok: boolean; readonly failures: readonly string[] } {
  const failures: string[] = [];
  const text = manifests.map((row) => row.yaml).join('\n');
  if (!text.includes('productionAuthorized: "false"') && !text.includes('production_authorized: "false"')) {
    if (!text.includes('productionAuthorized: false') && !/productionAuthorized:\s*"false"/.test(text)) {
      failures.push('rendered manifests must keep productionAuthorized false');
    }
  }
  if (text.includes('mainnetEnabled: true') || text.includes('mainnetActive: true')) {
    failures.push('mainnet must remain inactive');
  }
  if (/password:\s*[A-Za-z0-9+/=]{8,}/.test(text) && !text.includes('secret://')) {
    failures.push('raw password material found');
  }
  for (const service of CANONICAL_PLATFORM_SERVICES) {
    if (!text.includes(`name: ${service}`) && !text.includes(`app: ${service}`)) {
      failures.push(`missing workload ${service}`);
    }
  }
  if (!text.includes('NetworkPolicy')) {
    failures.push('network policies missing');
  }
  if (!text.includes('secret://')) {
    failures.push('secret references missing');
  }
  if (environment === 'PRODUCTION' && text.includes('fixture')) {
    failures.push('fixture secrets forbidden in production values');
  }
  if (manifests.length === 0) {
    failures.push('no manifests rendered');
  }
  return Object.freeze({ ok: failures.length === 0, failures: Object.freeze(failures) });
}

export function iacModulesPresent(root = process.cwd()): { readonly ok: boolean; readonly missing: readonly string[] } {
  const missing = PREPRODUCTION_IAC_MODULES.filter((row) => !existsSync(join(root, row.path))).map((row) => row.path);
  return Object.freeze({ ok: missing.length === 0, missing: Object.freeze(missing) });
}
