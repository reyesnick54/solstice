import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validatePlatformApiConfig } from './config.ts';
import { createLogger, redactRecord } from './logging.ts';

describe('structured logging redaction', () => {
  it('redacts tokens, passwords, and private keys', () => {
    const redacted = redactRecord({
      password: 'hunter2',
      authorization: 'Bearer abc.def',
      refreshToken: 'r1',
      access_token: 'a1',
      privateKey: '-----BEGIN ' + 'PRIVATE KEY-----',
      cardNumber: '4111111111111111',
      kycPayload: { ssn: '111-22-3333' },
      route: '/api/v1/version',
    });
    assert.equal(redacted.password, '[REDACTED]');
    assert.equal(redacted.authorization, '[REDACTED]');
    assert.equal(redacted.refreshToken, '[REDACTED]');
    assert.equal(redacted.access_token, '[REDACTED]');
    assert.equal(redacted.privateKey, '[REDACTED]');
    assert.equal(redacted.cardNumber, '[REDACTED]');
    assert.equal(redacted.route, '/api/v1/version');
    assert.equal((redacted.kycPayload as { ssn: string }).ssn, '[REDACTED]');
  });

  it('redacts HIN, health, and account identifiers', () => {
    const redacted = redactRecord({
      hinData: { recordId: 'hin_123', symptom: 'fatigue' },
      healthData: { diagnosis: 'example' },
      accountNumber: '1234567890',
      iban: 'GB00BARC20000012345678',
      aiPromptContext: 'private user context',
      route: '/api/v1/consumer/home',
    });
    assert.equal((redacted.hinData as unknown), '[REDACTED]');
    assert.equal((redacted.healthData as unknown), '[REDACTED]');
    assert.equal(redacted.accountNumber, '[REDACTED]');
    assert.equal(redacted.iban, '[REDACTED]');
    assert.equal(redacted.aiPromptContext, '[REDACTED]');
    assert.equal(redacted.route, '/api/v1/consumer/home');
  });

  it('redacts genetics, location, consent, and government identifiers', () => {
    const redacted = redactRecord({
      dna: 'ATCGATCG',
      geneticData: { variant: 'rs123' },
      locationHistory: [{ lat: 51.5, lon: -0.1 }],
      consentDocument: 'signed-consent.pdf',
      governmentId: 'AB1234567',
      communications: ['sms body'],
      route: '/api/v1/consumer/vault',
    });
    assert.equal(redacted.dna, '[REDACTED]');
    assert.equal((redacted.geneticData as unknown), '[REDACTED]');
    assert.equal((redacted.locationHistory as unknown), '[REDACTED]');
    assert.equal(redacted.consentDocument, '[REDACTED]');
    assert.equal(redacted.governmentId, '[REDACTED]');
    assert.equal((redacted.communications as unknown), '[REDACTED]');
    assert.equal(redacted.route, '/api/v1/consumer/vault');
  });

  it('emits machine-readable JSON with request fields', () => {
    const lines: string[] = [];
    const logger = createLogger(validatePlatformApiConfig({}), (line) => lines.push(line));
    logger.log('info', 'http_request', {
      requestId: 'r1',
      correlationId: 'c1',
      route: '/health',
      method: 'GET',
      status: 200,
      latencyMs: 3,
      authorization: 'Bearer secret',
    });
    const parsed = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    assert.equal(parsed.service, 'sunrey-platform-api');
    assert.equal(parsed.environment, 'simulation');
    assert.equal(parsed.requestId, 'r1');
    assert.equal(parsed.correlationId, 'c1');
    assert.equal(parsed.route, '/health');
    assert.equal(parsed.authorization, '[REDACTED]');
  });
});
