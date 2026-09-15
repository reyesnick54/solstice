import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EconomicWorkOrderId, HeliosTaskId } from './ids.ts';
import type { HeliosAuditEventKind } from './taxonomy.ts';
import type { HeliosAuditEvent } from './types.ts';

export function heliosAuditEvent(
  kind: HeliosAuditEventKind,
  occurredAt: UtcInstant,
  customerId: string,
  detail: string,
  ids: {
    readonly workOrderId?: EconomicWorkOrderId;
    readonly taskId?: HeliosTaskId;
  } = {},
): HeliosAuditEvent {
  return Object.freeze({
    kind,
    occurredAt,
    customerId,
    detail,
    ...ids,
  });
}
