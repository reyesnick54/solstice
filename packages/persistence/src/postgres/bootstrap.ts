import { Client } from 'pg';

import { DATABASES, type PersistenceEnv } from '../env.ts';
import { logPersistenceEvent } from '../logging.ts';

async function bootstrapClient(env: PersistenceEnv, database = 'postgres'): Promise<Client> {
  const client = new Client({
    host: env.host,
    port: env.port,
    user: env.bootstrapUser,
    password: env.bootstrapPassword,
    database,
  });
  await client.connect();
  return client;
}

async function roleExists(client: Client, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
    [name],
  );
  return result.rows[0]?.exists === true;
}

async function databaseExists(client: Client, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
    [name],
  );
  return result.rows[0]?.exists === true;
}

async function ensureRole(client: Client, name: string, password: string): Promise<void> {
  if (await roleExists(client, name)) {
    return;
  }
  await client.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password.replaceAll("'", "''")}'`);
}

async function waitForPostgres(env: PersistenceEnv): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const client = await bootstrapClient(env);
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  logPersistenceEvent({
    level: 'error',
    code: 'POSTGRES_UNREACHABLE',
    domain: 'bootstrap',
    message: 'bootstrap role could not connect to PostgreSQL',
  });
  throw lastError instanceof Error ? lastError : new Error('PostgreSQL is unreachable');
}

/**
 * Create the three bounded-domain databases and runtime roles.
 * Idempotent. Uses the local/simulated bootstrap role only.
 */
/**
 * Empty application tables while leaving schema_migration in place.
 * Used by integration tests so each case starts from applied migrations
 * and no leftover financial rows. Not a production wipe tool.
 */
export async function resetPersistedData(env: PersistenceEnv): Promise<void> {
  const statements: Array<{ database: string; sql: string }> = [
    {
      database: DATABASES.customer,
      sql: 'TRUNCATE TABLE customer.customer, customer.legal_entity',
    },
    {
      database: DATABASES.ledger,
      sql: `TRUNCATE TABLE
              ledger.dead_letter,
              ledger.inbox,
              ledger.outbox,
              ledger.posting,
              ledger.journal,
              ledger.action_intent,
              ledger.execution_authority_record,
              ledger.account_open_outcome,
              ledger.domain_event,
              ledger.account,
              ledger.ledger_account,
              ledger.product
            RESTART IDENTITY CASCADE`,
    },
    {
      database: DATABASES.evidence,
      sql: 'TRUNCATE TABLE evidence.evidence_record',
    },
  ];
  for (const statement of statements) {
    const client = await bootstrapClient(env, statement.database);
    try {
      await client.query(statement.sql);
    } finally {
      await client.end();
    }
  }
  logPersistenceEvent({
    level: 'info',
    code: 'PERSISTED_DATA_RESET',
    domain: 'bootstrap',
    message: 'truncated application tables; schema_migration retained',
  });
}

export async function bootstrapPersistence(env: PersistenceEnv): Promise<void> {
  await waitForPostgres(env);
  const client = await bootstrapClient(env);
  try {
    await ensureRole(client, env.migratorUser, env.migratorPassword);
    await ensureRole(client, env.customerUser, env.customerPassword);
    await ensureRole(client, env.ledgerUser, env.ledgerPassword);
    await ensureRole(client, 'ledger_reader', env.ledgerPassword);
    await ensureRole(client, env.evidenceUser, env.evidencePassword);

    for (const database of Object.values(DATABASES)) {
      if (!(await databaseExists(client, database))) {
        await client.query(`CREATE DATABASE ${database} OWNER ${env.migratorUser}`);
        logPersistenceEvent({
          level: 'info',
          code: 'DATABASE_CREATED',
          domain: 'bootstrap',
          message: `created bounded-domain database ${database}`,
        });
      }
    }
  } finally {
    await client.end();
  }

  for (const [domain, database] of Object.entries(DATABASES) as Array<
    [keyof typeof DATABASES, string]
  >) {
    const db = await bootstrapClient(env, database);
    try {
      await db.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
      await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.migratorUser}`);
      if (domain === 'customer') {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.customerUser}`);
      } else if (domain === 'ledger') {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.ledgerUser}`);
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ledger_reader`);
      } else {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.evidenceUser}`);
      }
      await db.query(`GRANT CREATE ON SCHEMA public TO ${env.migratorUser}`);
    } finally {
      await db.end();
    }
  }
}
