import type { Clock } from '../../../../config/src/clock.ts';
import { isForbiddenAiTool } from '../../taxonomy.ts';
import type { AiFailureCode } from '../../taxonomy.ts';
import type { S3mCorrelationId, S3mSafetyEvent, S3mSafetyEventKind } from './types.ts';

export class S3mSafetyLog {
  private readonly clock: Clock;
  private readonly events: S3mSafetyEvent[] = [];

  constructor(clock: Clock) {
    this.clock = clock;
  }

  emit(
    kind: S3mSafetyEventKind,
    correlationId: S3mCorrelationId,
    detail: string,
    failureCode: AiFailureCode,
  ): S3mSafetyEvent {
    const event = Object.freeze({
      kind,
      correlationId,
      detail,
      failureCode,
      at: this.clock.now(),
    });
    this.events.push(event);
    return event;
  }

  snapshot(): readonly S3mSafetyEvent[] {
    return Object.freeze([...this.events]);
  }
}

export function firstProhibitedToolName(toolRequests: unknown): string | null {
  if (!Array.isArray(toolRequests)) {
    return null;
  }
  for (const item of toolRequests) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (isForbiddenAiTool(record.name) || record.executes === true) {
      return typeof record.name === 'string' ? record.name : 'UNKNOWN_PROHIBITED_TOOL';
    }
  }
  return null;
}
