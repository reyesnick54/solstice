import { Client } from 'pg';

import { persistenceEnvFromProcess, type PersistenceEnv } from '../env.ts';

export async function probePostgresConnectivity(
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const databaseUrl = env.SUNREY_DATABASE_URL ?? env.DATABASE_URL;
  if (databaseUrl) {
    const client = new Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      const result = await client.query<{ ok: number }>('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  const persistence = persistenceEnvFromProcess(env);
  return probePersistenceEnv(persistence);
}

export async function probePersistenceEnv(persistence: PersistenceEnv): Promise<boolean> {
  const client = new Client({
    host: persistence.host,
    port: persistence.port,
    user: persistence.bootstrapUser,
    password: persistence.bootstrapPassword,
    database: 'postgres',
  });
  try {
    await client.connect();
    const result = await client.query<{ ok: number }>('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}
