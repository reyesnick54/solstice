/**
 * Wave 8 — internal operations plane types.
 *
 * Read/operations surfaces only. Not consumer BFF. Not Lovable.
 */

export const SERVICE_PHASES = ['PROCESS_UP', 'READY_TO_SERVE'] as const;
export type ServicePhase = (typeof SERVICE_PHASES)[number];

export const OPERATIONS_PLANE = 'SUNREY_SANDBOX_OPERATIONS' as const;
export const OPERATIONS_SCHEMA_VERSION = 'sunrey.ops.plane.v1' as const;

export type ServiceHealthRecord = {
  readonly service: string;
  readonly phase: ServicePhase;
  readonly ready: boolean;
  readonly detail: string;
  readonly dependencies: readonly string[];
};

export type AggregateProductHealth = {
  readonly schema: typeof OPERATIONS_SCHEMA_VERSION;
  readonly plane: typeof OPERATIONS_PLANE;
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly productionReady: false;
  readonly liveConnectivityEnabled: false;
  readonly aggregatePhase: ServicePhase;
  readonly readyToServe: boolean;
  readonly services: readonly ServiceHealthRecord[];
  readonly observedAt: string;
};

export type DashboardMetricSection = {
  readonly section: string;
  readonly metrics: Readonly<Record<string, string | number | boolean>>;
};

export type OperationsDashboard = {
  readonly schema: 'sunrey.ops.dashboard.v1';
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly sections: readonly DashboardMetricSection[];
};

export type SandboxFeatureGate = {
  readonly gateId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly sandboxOnly: boolean;
  readonly blockedInProduction: boolean;
  readonly detail: string;
};

export type SandboxFeatureGateReport = {
  readonly schema: 'sunrey.ops.feature-gates.v1';
  readonly environment: 'simulation';
  readonly productionActive: false;
  readonly mainnetEnabled: false;
  readonly liveProviders: false;
  readonly gates: readonly SandboxFeatureGate[];
};
