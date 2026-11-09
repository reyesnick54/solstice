/**
 * HELIOS OPS01 — durable shadow lab runtime HTTP entry (simulation).
 */

import { systemClock } from '../packages/config/src/clock.ts';
import { HeliosDurableShadowLabRuntimeService } from '../packages/platform/src/helios/autonomous-shadow-lab/ops01/service.ts';
import { InMemoryShadowLabDurableStore } from '../packages/platform/src/helios/autonomous-shadow-lab/ops01/store.ts';
import { serveShadowLabHttpRuntime } from '../packages/platform/src/helios/autonomous-shadow-lab/ops01/http-runtime.ts';

const port = Number(process.env.SHADOW_LAB_HTTP_PORT ?? '8791');
const store = new InMemoryShadowLabDurableStore();
const service = new HeliosDurableShadowLabRuntimeService({ clock: systemClock, store });

const server = await serveShadowLabHttpRuntime({ service, port });

function shutdown(): void {
  service.requestGracefulShutdown();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(
  JSON.stringify({
    event: 'helios_shadow_lab_runtime_started',
    port,
    environment: 'simulation',
  }),
);
