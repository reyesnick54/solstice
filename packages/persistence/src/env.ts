/**
 * Local/simulated PostgreSQL connection settings.
 * These passwords are development-only and must never be used for live money.
 *
 * Runtime names are SUNREY_*. Legacy SOLSTICE_* aliases resolve through the
 * single config-package authority. Database names and default role names stay
 * on the already-applied simulation identifiers.
 */

import {
  PERSISTENCE_ENV_ALIASES,
  resolveCanonicalEnv,
  type EnvResolution,
} from '../../config/src/env.ts';

export type PersistenceEnv = {
  readonly host: string;
  readonly port: number;
  readonly bootstrapUser: string;
  readonly bootstrapPassword: string;
  readonly migratorUser: string;
  readonly migratorPassword: string;
  readonly customerUser: string;
  readonly customerPassword: string;
  readonly ledgerUser: string;
  readonly ledgerPassword: string;
  readonly evidenceUser: string;
  readonly evidencePassword: string;
  readonly securityUser: string;
  readonly securityPassword: string;
};

export type PersistenceEnvResolution = {
  readonly env: PersistenceEnv;
  readonly resolutions: readonly EnvResolution[];
};

export const LOCAL_SIMULATION_PERSISTENCE_ENV: PersistenceEnv = Object.freeze({
  host: '127.0.0.1',
  port: 5432,
  bootstrapUser: 'solstice_bootstrap',
  bootstrapPassword: 'solstice_dev_only_not_for_production',
  migratorUser: 'solstice_migrator',
  migratorPassword: 'solstice_dev_only_migrator',
  customerUser: 'customer_app',
  customerPassword: 'solstice_dev_only_customer',
  ledgerUser: 'ledger_writer',
  ledgerPassword: 'solstice_dev_only_ledger',
  evidenceUser: 'evidence_app',
  evidencePassword: 'solstice_dev_only_evidence',
  securityUser: 'security_app',
  securityPassword: 'solstice_dev_only_security',
});

export const DATABASES = Object.freeze({
  customer: 'solstice_customer',
  ledger: 'solstice_ledger',
  evidence: 'solstice_evidence',
  security: 'solstice_security',
});

function alias(canonicalName: string) {
  const found = PERSISTENCE_ENV_ALIASES.find((item) => item.canonicalName === canonicalName);
  if (!found) {
    throw new Error(`unknown persistence env alias ${canonicalName}`);
  }
  return found;
}

export function resolvePersistenceEnv(
  env: NodeJS.ProcessEnv = process.env,
): PersistenceEnvResolution {
  const host = resolveCanonicalEnv(alias('SUNREY_PG_HOST'), env);
  const port = resolveCanonicalEnv(alias('SUNREY_PG_PORT'), env);
  const portNumber = Number.parseInt(port.value ?? '', 10);
  if (!Number.isInteger(portNumber) || portNumber <= 0) {
    throw new Error('SUNREY_PG_PORT must be a positive integer');
  }
  const bootstrapUser = resolveCanonicalEnv(alias('SUNREY_PG_BOOTSTRAP_USER'), env);
  const bootstrapPassword = resolveCanonicalEnv(alias('SUNREY_PG_BOOTSTRAP_PASSWORD'), env);
  const migratorUser = resolveCanonicalEnv(alias('SUNREY_PG_MIGRATOR_USER'), env);
  const migratorPassword = resolveCanonicalEnv(alias('SUNREY_PG_MIGRATOR_PASSWORD'), env);
  const customerUser = resolveCanonicalEnv(alias('SUNREY_PG_CUSTOMER_USER'), env);
  const customerPassword = resolveCanonicalEnv(alias('SUNREY_PG_CUSTOMER_PASSWORD'), env);
  const ledgerUser = resolveCanonicalEnv(alias('SUNREY_PG_LEDGER_USER'), env);
  const ledgerPassword = resolveCanonicalEnv(alias('SUNREY_PG_LEDGER_PASSWORD'), env);
  const evidenceUser = resolveCanonicalEnv(alias('SUNREY_PG_EVIDENCE_USER'), env);
  const evidencePassword = resolveCanonicalEnv(alias('SUNREY_PG_EVIDENCE_PASSWORD'), env);
  const securityUser = resolveCanonicalEnv(alias('SUNREY_PG_SECURITY_USER'), env);
  const securityPassword = resolveCanonicalEnv(alias('SUNREY_PG_SECURITY_PASSWORD'), env);

  return Object.freeze({
    env: Object.freeze({
      host: host.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.host,
      port: portNumber,
      bootstrapUser: bootstrapUser.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.bootstrapUser,
      bootstrapPassword: bootstrapPassword.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.bootstrapPassword,
      migratorUser: migratorUser.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.migratorUser,
      migratorPassword: migratorPassword.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.migratorPassword,
      customerUser: customerUser.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.customerUser,
      customerPassword: customerPassword.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.customerPassword,
      ledgerUser: ledgerUser.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.ledgerUser,
      ledgerPassword: ledgerPassword.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.ledgerPassword,
      evidenceUser: evidenceUser.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.evidenceUser,
      evidencePassword: evidencePassword.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.evidencePassword,
      securityUser: securityUser.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.securityUser,
      securityPassword: securityPassword.value ?? LOCAL_SIMULATION_PERSISTENCE_ENV.securityPassword,
    }),
    resolutions: Object.freeze([
      host,
      port,
      bootstrapUser,
      bootstrapPassword,
      migratorUser,
      migratorPassword,
      customerUser,
      customerPassword,
      ledgerUser,
      ledgerPassword,
      evidenceUser,
      evidencePassword,
      securityUser,
      securityPassword,
    ]),
  });
}

export function persistenceEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): PersistenceEnv {
  return resolvePersistenceEnv(env).env;
}

export function isPersistenceTestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = resolveCanonicalEnv(alias('SUNREY_PERSISTENCE_TEST'), env);
  const host = resolveCanonicalEnv(alias('SUNREY_PG_HOST'), env);
  return flag.value === '1' || host.source === 'CANONICAL' || host.source === 'LEGACY_ALIAS';
}
