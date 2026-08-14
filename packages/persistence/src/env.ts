/**
 * Local/simulated PostgreSQL connection settings.
 * These passwords are development-only and must never be used for live money.
 */

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

export function persistenceEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): PersistenceEnv {
  const portRaw = env.SOLSTICE_PG_PORT ?? String(LOCAL_SIMULATION_PERSISTENCE_ENV.port);
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SOLSTICE_PG_PORT must be a positive integer');
  }
  return Object.freeze({
    host: env.SOLSTICE_PG_HOST ?? LOCAL_SIMULATION_PERSISTENCE_ENV.host,
    port,
    bootstrapUser: env.SOLSTICE_PG_BOOTSTRAP_USER ?? LOCAL_SIMULATION_PERSISTENCE_ENV.bootstrapUser,
    bootstrapPassword:
      env.SOLSTICE_PG_BOOTSTRAP_PASSWORD ?? LOCAL_SIMULATION_PERSISTENCE_ENV.bootstrapPassword,
    migratorUser: env.SOLSTICE_PG_MIGRATOR_USER ?? LOCAL_SIMULATION_PERSISTENCE_ENV.migratorUser,
    migratorPassword:
      env.SOLSTICE_PG_MIGRATOR_PASSWORD ?? LOCAL_SIMULATION_PERSISTENCE_ENV.migratorPassword,
    customerUser: env.SOLSTICE_PG_CUSTOMER_USER ?? LOCAL_SIMULATION_PERSISTENCE_ENV.customerUser,
    customerPassword:
      env.SOLSTICE_PG_CUSTOMER_PASSWORD ?? LOCAL_SIMULATION_PERSISTENCE_ENV.customerPassword,
    ledgerUser: env.SOLSTICE_PG_LEDGER_USER ?? LOCAL_SIMULATION_PERSISTENCE_ENV.ledgerUser,
    ledgerPassword: env.SOLSTICE_PG_LEDGER_PASSWORD ?? LOCAL_SIMULATION_PERSISTENCE_ENV.ledgerPassword,
    evidenceUser: env.SOLSTICE_PG_EVIDENCE_USER ?? LOCAL_SIMULATION_PERSISTENCE_ENV.evidenceUser,
    evidencePassword:
      env.SOLSTICE_PG_EVIDENCE_PASSWORD ?? LOCAL_SIMULATION_PERSISTENCE_ENV.evidencePassword,
    securityUser: env.SOLSTICE_PG_SECURITY_USER ?? LOCAL_SIMULATION_PERSISTENCE_ENV.securityUser,
    securityPassword:
      env.SOLSTICE_PG_SECURITY_PASSWORD ?? LOCAL_SIMULATION_PERSISTENCE_ENV.securityPassword,
  });
}

export function isPersistenceTestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SOLSTICE_PERSISTENCE_TEST === '1' || env.SOLSTICE_PG_HOST !== undefined;
}
