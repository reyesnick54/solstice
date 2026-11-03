import type { UtcInstant } from '@solstice/domain';
import type { HeliosResearchMonitorTriggerRecord } from './types.ts';

/** Proactive market investigation request derived from a monitor trigger (Seris proactive/observe pattern). */
export type SerisProactiveInvestigation = {
  readonly investigationId: string;
  readonly monitorId: string;
  readonly triggerEventId: string;
  readonly researchTopic: string;
  readonly marketWatch: readonly string[];
  readonly priority: HeliosResearchMonitorTriggerRecord['priority'];
  readonly requestedAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

export function buildProactiveInvestigationFromTrigger(
  trigger: HeliosResearchMonitorTriggerRecord,
): SerisProactiveInvestigation {
  return Object.freeze({
    investigationId: `spi_${trigger.triggerEventId}`,
    monitorId: trigger.monitorId,
    triggerEventId: trigger.triggerEventId,
    researchTopic: trigger.researchTopic,
    marketWatch: Object.freeze([...trigger.watch]),
    priority: trigger.priority,
    requestedAt: trigger.triggeredAt,
    grantsExecutionAuthority: false,
    researchOnly: true,
  });
}
