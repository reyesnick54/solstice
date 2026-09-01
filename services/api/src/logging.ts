import type { RequestContext } from './context.ts';
import type { LogLevel, PlatformApiConfig } from './config.ts';

export type StructuredLog = {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: 'sunrey-platform-api';
  readonly environment: 'simulation';
  readonly message: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly route?: string;
  readonly method?: string;
  readonly status?: number;
  readonly latencyMs?: number;
  readonly [key: string]: unknown;
};

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_RE =
  /pass(word|wd)?|secret|token|refresh|authorization|private[_-]?key|seed|mnemonic|ssn|pan|card([_-]?number)?|cvv|cvc|api[_-]?key|hmac|cookie|iban|routing|account([_-]?number)?|hin([_-]?data)?|health([_-]?data)?|diagnosis|medical|phi|prompt([_-]?context)?/i;

const SENSITIVE_VALUE_RE =
  /bearer\s+[a-z0-9._~+/=-]+|eyj[a-z0-9_-]+\.[a-z0-9_-]+|sk_[a-z0-9]+|-----begin [a-z ]+private key-----/i;

export function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_RE.test(key)) {
    return REDACTED;
  }
  if (typeof value === 'string' && SENSITIVE_VALUE_RE.test(value)) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(String(index), item));
  }
  if (value && typeof value === 'object') {
    return redactRecord(value as Record<string, unknown>);
  }
  return value;
}

export function redactRecord(input: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(key, value);
  }
  return Object.freeze(out);
}

const LEVEL_RANK: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export type LogSink = (line: string) => void;

export function createLogger(config: PlatformApiConfig, sink: LogSink = defaultSink): {
  log: (level: LogLevel, message: string, fields?: Readonly<Record<string, unknown>>) => void;
  request: (ctx: RequestContext, status: number, latencyMs: number) => void;
} {
  const min = LEVEL_RANK[config.logLevel];
  return {
    log(level, message, fields = {}) {
      if (LEVEL_RANK[level] < min) {
        return;
      }
      const record = redactRecord({
        timestamp: new Date().toISOString(),
        level,
        service: 'sunrey-platform-api',
        environment: config.environment,
        deploymentTier: config.deploymentTier,
        message,
        ...fields,
      });
      sink(JSON.stringify(record));
    },
    request(ctx, status, latencyMs) {
      this.log('info', 'http_request', {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        route: ctx.route,
        method: ctx.method,
        status,
        latencyMs,
        authenticated: ctx.authorization.authenticated,
      });
    },
  };
}

function defaultSink(line: string): void {
  process.stdout.write(`${line}\n`);
}
