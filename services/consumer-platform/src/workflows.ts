/**
 * In-process jobs and webhook foundation for the consumer platform.
 * Simulation only. Destinations are SSRF-checked. No live providers.
 */

import { newSecurityToken } from '../../../packages/security/src/random.ts';
import type { JobDto, WebhookEndpointDto } from '../../../packages/sunrey-sdk/src/consumer-platform/index.ts';

const ALLOWED_WEBHOOK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function assertSimulationWebhookUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'WEBHOOK_URL_INVALID';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'WEBHOOK_SCHEME_REJECTED';
  }
  if (!ALLOWED_WEBHOOK_HOSTS.has(parsed.hostname)) {
    return 'WEBHOOK_HOST_REJECTED';
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return 'WEBHOOK_USERINFO_REJECTED';
  }
  return null;
}

export class ConsumerWorkflowStore {
  readonly jobs = new Map<string, JobDto>();
  readonly webhooks = new Map<string, WebhookEndpointDto & { readonly ownerActorId: string }>();

  createJob(kind: JobDto['kind'], now: string, resultSafe: string): JobDto {
    const job: JobDto = Object.freeze({
      job_id: `job_${newSecurityToken()}`,
      kind,
      status: 'SUCCEEDED',
      created_at: now,
      result_safe: resultSafe,
    });
    this.jobs.set(job.job_id, job);
    return job;
  }

  registerWebhook(input: {
    readonly ownerActorId: string;
    readonly url: string;
    readonly eventTypes: readonly string[];
    readonly now: string;
  }): WebhookEndpointDto {
    const endpoint: WebhookEndpointDto & { readonly ownerActorId: string } = Object.freeze({
      endpoint_id: `wh_${newSecurityToken()}`,
      url: input.url,
      event_types: Object.freeze([...input.eventTypes]),
      created_at: input.now,
      ownerActorId: input.ownerActorId,
    });
    this.webhooks.set(endpoint.endpoint_id, endpoint);
    return endpoint;
  }
}
