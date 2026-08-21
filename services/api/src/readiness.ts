import type { PlatformApiConfig } from './config.ts';

export type ReadinessCheck = {
  readonly name: string;
  readonly required: boolean;
  check(): Promise<{ readonly ok: boolean; readonly detail: string }>;
};

export type ReadinessReport = {
  readonly ready: boolean;
  readonly productionReady: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly environment: 'simulation';
  readonly checks: readonly {
    readonly name: string;
    readonly required: boolean;
    readonly ok: boolean;
    readonly detail: string;
  }[];
};

export async function evaluateReadiness(
  config: PlatformApiConfig,
  checks: readonly ReadinessCheck[],
): Promise<ReadinessReport> {
  const results = [];
  for (const check of checks) {
    try {
      const result = await check.check();
      results.push({
        name: check.name,
        required: check.required,
        ok: result.ok,
        detail: result.detail,
      });
    } catch (error) {
      results.push({
        name: check.name,
        required: check.required,
        ok: false,
        detail: error instanceof Error ? error.message : 'check failed',
      });
    }
  }
  const ready = results.every((row) => row.ok || !row.required);
  return Object.freeze({
    ready,
    productionReady: false,
    productionActive: false,
    liveConnectivityEnabled: false,
    environment: config.environment,
    checks: Object.freeze(results),
  });
}

export function configurationCheck(config: PlatformApiConfig): ReadinessCheck {
  return {
    name: 'configuration',
    required: true,
    async check() {
      if (config.apiBasePath !== '/api/v1' || config.environment !== 'simulation') {
        return { ok: false, detail: 'runtime configuration is invalid' };
      }
      return { ok: true, detail: 'validated' };
    },
  };
}

export function persistenceCheck(input: {
  readonly configured: boolean;
  readonly required: boolean;
  readonly probe?: () => Promise<boolean>;
}): ReadinessCheck {
  return {
    name: 'persistence',
    required: input.required,
    async check() {
      if (!input.configured) {
        return {
          ok: !input.required,
          detail: input.required ? 'persistence is required and not configured' : 'persistence not configured',
        };
      }
      if (!input.probe) {
        return { ok: true, detail: 'configured; live probe not attached' };
      }
      const ok = await input.probe();
      return { ok, detail: ok ? 'reachable' : 'unreachable' };
    },
  };
}
