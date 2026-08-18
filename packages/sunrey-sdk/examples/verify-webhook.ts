import { verifyWebhookSignature } from '../src/index.ts';

const result = verifyWebhookSignature({
  secret: process.env.SUNREY_WEBHOOK_SECRET ?? 'whsec_example_not_for_production',
  deliveryId: 'whd_example',
  eventId: 'evt_example',
  timestamp: new Date().toISOString(),
  attempt: 1,
  body: '{"event_version":"v1"}',
  signature: 'sunrey-webhook-v1=deadbeef',
});
console.log(JSON.stringify(result));
