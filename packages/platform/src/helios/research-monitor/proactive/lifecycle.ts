import type { ResearchMonitorRuntimeStatus } from '../taxonomy.ts';
import type { ProactiveMonitorLifecycle } from './taxonomy.ts';
import type { ResearchMonitorState } from '../types.ts';

export function lifecycleFromMonitorState(
  lifecycle: ProactiveMonitorLifecycle,
  monitorState: ResearchMonitorState | null,
): ProactiveMonitorLifecycle {
  if (lifecycle === 'PAUSED' || lifecycle === 'DISABLED') {
    return lifecycle;
  }
  if (!monitorState) {
    return lifecycle === 'REGISTERED' ? 'REGISTERED' : 'WATCHING';
  }
  switch (monitorState.runtimeStatus) {
    case 'COOLDOWN':
      return 'COOLDOWN';
    case 'EXHAUSTED':
      return 'EXHAUSTED';
    case 'EXPIRED':
      return 'EXPIRED';
    default:
      return lifecycle === 'REGISTERED' ? 'WATCHING' : lifecycle;
  }
}

export function runtimeStatusToLifecycle(status: ResearchMonitorRuntimeStatus): ProactiveMonitorLifecycle {
  switch (status) {
    case 'COOLDOWN':
      return 'COOLDOWN';
    case 'EXHAUSTED':
      return 'EXHAUSTED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'NOT_STARTED':
      return 'REGISTERED';
    default:
      return 'WATCHING';
  }
}
