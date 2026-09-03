import { probePostgresConnectivity } from '../../../../packages/persistence/src/index.ts';

export type ConsumerBffReadinessReport = {
  readonly ready: boolean;
  readonly service: 'sunrey-consumer-bff';
  readonly environment: 'simulation';
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly checks: readonly {
    readonly name: string;
    readonly required: boolean;
    readonly ok: boolean;
    readonly detail: string;
  }[];
};

export function persistenceRequiredForReady(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.SUNREY_FEATURE_REQUIRE_PERSISTENCE_FOR_READY === 'true' ||
    env.SUNREY_API_REQUIRE_PERSISTENCE === 'true'
  );
}

export function persistenceConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.SUNREY_PG_HOST ||
      env.SUNREY_DATABASE_URL ||
      env.SUNREY_API_DATABASE_CONFIGURED === 'true',
  );
}

export async function probePostgres(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  return probePostgresConnectivity(env);
}

export async function evaluateConsumerBffReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ConsumerBffReadinessReport> {
  const required = persistenceRequiredForReady(env);
  const configured = persistenceConfigured(env);
  let persistenceOk = true;
  let persistenceDetail = 'not required';

  if (required) {
    if (!configured) {
      persistenceOk = false;
      persistenceDetail = 'persistence is required and not configured';
    } else {
      try {
        persistenceOk = await probePostgres(env);
        persistenceDetail = persistenceOk ? 'reachable' : 'unreachable';
      } catch (error) {
        persistenceOk = false;
        persistenceDetail = error instanceof Error ? error.message : 'probe failed';
      }
    }
  } else if (configured) {
    try {
      persistenceOk = await probePostgres(env);
      persistenceDetail = persistenceOk ? 'reachable' : 'unreachable (non-blocking)';
    } catch (error) {
      persistenceDetail = error instanceof Error ? error.message : 'probe failed (non-blocking)';
    }
  }

  const checks = Object.freeze([
    Object.freeze({
      name: 'configuration',
      required: true,
      ok: env.ENVIRONMENT === 'simulation' || env.ENVIRONMENT === undefined,
      detail:
        env.ENVIRONMENT === 'simulation' || env.ENVIRONMENT === undefined
          ? 'simulation'
          : 'ENVIRONMENT must remain simulation',
    }),
    Object.freeze({
      name: 'persistence',
      required,
      ok: required ? persistenceOk : true,
      detail: persistenceDetail,
    }),
  ]);

  const ready = checks.every((row) => row.ok || !row.required);
  return Object.freeze({
    ready,
    service: 'sunrey-consumer-bff',
    environment: 'simulation',
    productionReady: false,
    productionActive: false,
    liveConnectivityEnabled: false,
    checks,
  });
}
