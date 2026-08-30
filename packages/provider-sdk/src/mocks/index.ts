import type { SunReyProvider } from '../contract.ts';
import type {
  ProviderCapability,
  ProviderDescriptor,
  ProviderHealthState,
  ProviderHealthStatus,
  ProviderId,
  ProviderRuntimeContext,
  ProviderStatus,
} from '../types.ts';

export type MockProviderOptions = {
  readonly id: ProviderId;
  readonly descriptor: ProviderDescriptor;
  readonly capabilities?: readonly ProviderCapability[];
  readonly healthState?: ProviderHealthState;
  readonly status?: ProviderStatus;
  readonly initializeDelayMs?: number;
  readonly healthDelayMs?: number;
  readonly failInitialize?: boolean;
  readonly failHealth?: boolean;
  readonly failShutdown?: boolean;
  readonly malformedHealth?: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

abstract class BaseMockProvider implements SunReyProvider {
  readonly id: ProviderId;
  readonly descriptor: ProviderDescriptor;
  protected readonly capabilities: readonly ProviderCapability[];
  protected initialized = false;
  protected shutDown = false;

  constructor(options: MockProviderOptions) {
    this.id = options.id;
    this.descriptor = options.descriptor;
    this.capabilities = options.capabilities ?? options.descriptor.capabilities;
  }

  async initialize(_context: ProviderRuntimeContext): Promise<void> {
    this.initialized = true;
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    return Object.freeze({
      providerId: this.id,
      state: 'healthy',
      status: this.initialized ? 'ready' : 'registered',
      checkedAt: new Date().toISOString(),
      message: 'mock provider healthy',
      latencyMs: 1,
    });
  }

  getCapabilities(): readonly ProviderCapability[] {
    return this.capabilities;
  }

  async shutdown(): Promise<void> {
    this.shutDown = true;
    this.initialized = false;
  }
}

export class MockHealthyProvider extends BaseMockProvider {
  constructor(options: MockProviderOptions) {
    super(options);
  }
}

export class MockFailingProvider extends BaseMockProvider {
  readonly #failInitialize: boolean;
  readonly #failHealth: boolean;
  readonly #failShutdown: boolean;

  constructor(options: MockProviderOptions) {
    super(options);
    this.#failInitialize = options.failInitialize ?? true;
    this.#failHealth = options.failHealth ?? true;
    this.#failShutdown = options.failShutdown ?? false;
  }

  override async initialize(context: ProviderRuntimeContext): Promise<void> {
    if (this.#failInitialize) {
      throw new Error(`mock initialize failure for ${this.id}`);
    }
    await super.initialize(context);
  }

  override async healthCheck(): Promise<ProviderHealthStatus> {
    if (this.#failHealth) {
      return Object.freeze({
        providerId: this.id,
        state: 'unhealthy',
        status: 'unhealthy',
        checkedAt: new Date().toISOString(),
        message: 'mock provider failing health check',
        latencyMs: null,
      });
    }
    return super.healthCheck();
  }

  override async shutdown(): Promise<void> {
    if (this.#failShutdown) {
      throw new Error(`mock shutdown failure for ${this.id}`);
    }
    await super.shutdown();
  }
}

export class MockSlowProvider extends BaseMockProvider {
  readonly #initializeDelayMs: number;
  readonly #healthDelayMs: number;

  constructor(options: MockProviderOptions) {
    super(options);
    this.#initializeDelayMs = options.initializeDelayMs ?? 50;
    this.#healthDelayMs = options.healthDelayMs ?? 50;
  }

  override async initialize(context: ProviderRuntimeContext): Promise<void> {
    await delay(this.#initializeDelayMs);
    await super.initialize(context);
  }

  override async healthCheck(): Promise<ProviderHealthStatus> {
    const started = Date.now();
    await delay(this.#healthDelayMs);
    const result = await super.healthCheck();
    return Object.freeze({
      ...result,
      latencyMs: Date.now() - started,
      message: 'mock slow provider healthy',
    });
  }
}

export class MockMalformedProvider extends BaseMockProvider {
  override async healthCheck(): Promise<ProviderHealthStatus> {
    return Object.freeze({
      providerId: this.id,
      state: 'unknown',
      status: 'degraded',
      checkedAt: 'not-an-iso-timestamp',
      message: '{"unexpected":true}',
      latencyMs: -1,
    });
  }
}

export function createMockHealthyProvider(options: MockProviderOptions): MockHealthyProvider {
  return new MockHealthyProvider(options);
}

export function createMockFailingProvider(options: MockProviderOptions): MockFailingProvider {
  return new MockFailingProvider(options);
}

export function createMockSlowProvider(options: MockProviderOptions): MockSlowProvider {
  return new MockSlowProvider(options);
}
