import type { ExecutionTwinEnvironmentKind, ExecutionTwinProviderKind } from './taxonomy.ts';
import { defaultProviderKindForEnvironment } from './taxonomy.ts';
import type { ExecutionTwinAssumption, ExecutionTwinEnvironment } from './types.ts';

function baseAssumptions(
  environment: ExecutionTwinEnvironmentKind,
  providerKind: ExecutionTwinProviderKind,
): ExecutionTwinAssumption[] {
  const shared: ExecutionTwinAssumption[] = [
    Object.freeze({
      category: 'PROVIDER_POSTURE',
      label: 'live_trading',
      value: 'disabled',
    }),
    Object.freeze({
      category: 'PROVIDER_POSTURE',
      label: 'environment',
      value: environment,
    }),
    Object.freeze({
      category: 'PROVIDER_POSTURE',
      label: 'provider_kind',
      value: providerKind,
    }),
  ];

  switch (environment) {
    case 'HISTORICAL_REPLAY':
      return [
        ...shared,
        Object.freeze({
          category: 'MARKET_DATA',
          label: 'observation_source',
          value: 'recorded_transcript_only',
        }),
        Object.freeze({
          category: 'FILL_MODEL',
          label: 'fills',
          value: 'historical_transcript_replay',
        }),
        Object.freeze({
          category: 'LATENCY',
          label: 'network',
          value: 'none',
        }),
      ];
    case 'SHADOW':
      return [
        ...shared,
        Object.freeze({
          category: 'FILL_MODEL',
          label: 'fills',
          value: 'none_shadow_log_only',
        }),
        Object.freeze({
          category: 'LATENCY',
          label: 'submit',
          value: 'not_sent_to_provider',
        }),
      ];
    case 'PAPER':
      return [
        ...shared,
        Object.freeze({
          category: 'FILL_MODEL',
          label: 'fills',
          value: 'deterministic_paper_simulation',
        }),
        Object.freeze({
          category: 'FEES',
          label: 'fee_model',
          value: 'paper_fixture_schedule',
        }),
      ];
    case 'SANDBOX_LIVE_DATA':
      return [
        ...shared,
        Object.freeze({
          category: 'MARKET_DATA',
          label: 'observation_source',
          value: 'sandbox_live_data_feed_simulation',
        }),
        Object.freeze({
          category: 'FILL_MODEL',
          label: 'fills',
          value: 'sandbox_helios_provider_port',
        }),
        Object.freeze({
          category: 'SETTLEMENT',
          label: 'settlement',
          value: 'm24_simulated_settlement_semantics',
        }),
      ];
    case 'LIVE':
      return [
        ...shared,
        Object.freeze({
          category: 'PROVIDER_POSTURE',
          label: 'live_gate',
          value: 'blocked_os02',
        }),
      ];
  }
}

export function buildExecutionTwinEnvironment(input: {
  readonly environment: ExecutionTwinEnvironmentKind;
  readonly providerKind?: ExecutionTwinProviderKind;
}): ExecutionTwinEnvironment {
  const providerKind = input.providerKind ?? defaultProviderKindForEnvironment(input.environment);
  return Object.freeze({
    kind: input.environment,
    liveEnabled: false as const,
    simulationPosture: true as const,
    assumptions: Object.freeze(baseAssumptions(input.environment, providerKind)),
    providerKind,
  });
}
