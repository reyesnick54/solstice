import type { IncomingMessage } from 'node:http';

import type { PlatformApiConfig } from './config.ts';
import { PlatformApiError } from './errors.ts';

export const SECURITY_HEADERS = Object.freeze({
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'x-permitted-cross-domain-policies': 'none',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
});

export function assertContentType(req: IncomingMessage, method: string): void {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return;
  }
  const contentType = req.headers['content-type'];
  if (!contentType) {
    throw new PlatformApiError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'mutation requests must send application/json',
      category: 'VALIDATION',
      retryable: false,
      httpStatus: 400,
    });
  }
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new PlatformApiError({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'only application/json is accepted',
      category: 'VALIDATION',
      retryable: false,
      httpStatus: 400,
    });
  }
}

export function readBody(req: IncomingMessage, config: PlatformApiConfig): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    const timer = setTimeout(() => {
      reject(
        new PlatformApiError({
          code: 'REQUEST_TIMEOUT',
          message: 'request body timed out',
          category: 'TEMPORARY_UNAVAILABLE',
          retryable: true,
          httpStatus: 504,
        }),
      );
    }, config.requestTimeoutMs);
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > config.bodyLimitBytes) {
        oversized = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      clearTimeout(timer);
      if (oversized) {
        reject(
          new PlatformApiError({
            code: 'OVERSIZED_REQUEST',
            message: 'request body exceeds configured limit',
            category: 'VALIDATION',
            retryable: false,
            httpStatus: 413,
          }),
        );
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
