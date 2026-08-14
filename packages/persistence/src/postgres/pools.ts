import { Pool, type PoolClient } from 'pg';

import { DATABASES, type PersistenceEnv } from '../env.ts';

export type PersistencePools = {
  readonly customer: Pool;
  readonly ledger: Pool;
  readonly evidence: Pool;
  readonly security: Pool;
};

export function createPersistencePools(env: PersistenceEnv): PersistencePools {
  return {
    customer: new Pool({
      host: env.host,
      port: env.port,
      user: env.customerUser,
      password: env.customerPassword,
      database: DATABASES.customer,
      max: 8,
    }),
    ledger: new Pool({
      host: env.host,
      port: env.port,
      user: env.ledgerUser,
      password: env.ledgerPassword,
      database: DATABASES.ledger,
      max: 8,
    }),
    evidence: new Pool({
      host: env.host,
      port: env.port,
      user: env.evidenceUser,
      password: env.evidencePassword,
      database: DATABASES.evidence,
      max: 8,
    }),
    security: new Pool({
      host: env.host,
      port: env.port,
      user: env.securityUser,
      password: env.securityPassword,
      database: DATABASES.security,
      max: 4,
    }),
  };
}

export async function closePersistencePools(pools: PersistencePools): Promise<void> {
  await Promise.all([
    pools.customer.end(),
    pools.ledger.end(),
    pools.evidence.end(),
    pools.security.end(),
  ]);
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
