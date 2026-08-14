import { inspect, type InspectOptions } from 'node:util';

const REDACTED = '[REDACTED]';

function redact(_kind: string): string {
  return REDACTED;
}

/**
 * Opaque holders for sensitive values. toString / toJSON / inspect never
 * expose plaintext. Use reveal() only inside the security boundary.
 */
export class SecretValue {
  readonly #bytes: Buffer;
  readonly kind = 'SecretValue' as const;

  constructor(value: string | Buffer) {
    this.#bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8');
    Object.freeze(this);
  }

  reveal(): Buffer {
    return Buffer.from(this.#bytes);
  }

  revealUtf8(): string {
    return this.#bytes.toString('utf8');
  }

  toString(): string {
    return redact(this.kind);
  }

  toJSON(): string {
    return redact(this.kind);
  }

  [inspect.custom](_depth: number, _opts: InspectOptions): string {
    return redact(this.kind);
  }

  get [Symbol.toStringTag](): string {
    return this.kind;
  }
}

export class PrivateKeyMaterial {
  readonly #bytes: Buffer;
  readonly kind = 'PrivateKeyMaterial' as const;

  constructor(value: string | Buffer) {
    this.#bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8');
    Object.freeze(this);
  }

  reveal(): Buffer {
    return Buffer.from(this.#bytes);
  }

  toString(): string {
    return redact(this.kind);
  }

  toJSON(): string {
    return redact(this.kind);
  }

  [inspect.custom](): string {
    return redact(this.kind);
  }
}

export class AccessToken {
  readonly #value: string;
  readonly kind = 'AccessToken' as const;

  constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  reveal(): string {
    return this.#value;
  }

  toString(): string {
    return redact(this.kind);
  }

  toJSON(): string {
    return redact(this.kind);
  }

  [inspect.custom](): string {
    return redact(this.kind);
  }
}

export class SessionSecret {
  readonly #bytes: Buffer;
  readonly kind = 'SessionSecret' as const;

  constructor(value: string | Buffer) {
    this.#bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8');
    Object.freeze(this);
  }

  reveal(): Buffer {
    return Buffer.from(this.#bytes);
  }

  toString(): string {
    return redact(this.kind);
  }

  toJSON(): string {
    return redact(this.kind);
  }

  [inspect.custom](): string {
    return redact(this.kind);
  }
}

export class WrappedCredential {
  readonly #bytes: Buffer;
  readonly kind = 'WrappedCredential' as const;

  constructor(value: string | Buffer) {
    this.#bytes = Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(value, 'utf8');
    Object.freeze(this);
  }

  reveal(): Buffer {
    return Buffer.from(this.#bytes);
  }

  toString(): string {
    return redact(this.kind);
  }

  toJSON(): string {
    return redact(this.kind);
  }

  [inspect.custom](): string {
    return redact(this.kind);
  }
}

export const SENSITIVE_TYPE_NAMES = [
  'SecretValue',
  'PrivateKeyMaterial',
  'AccessToken',
  'SessionSecret',
  'WrappedCredential',
] as const;
