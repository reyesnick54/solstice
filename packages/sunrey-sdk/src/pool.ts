import { SunReyClient } from './clients.ts';
import { createHttpTransport, SdkHttpError, type HttpTransport } from './http.ts';
import { DEFAULT_RETRY_POLICY, shouldRetryRead, submissionRetrySafe } from './retry.ts';
import type { SubmissionResponse, TransactionReceipt } from './types.ts';

export type SdkPoolEndpoint = {
  readonly url: string;
  readonly archive?: boolean;
};

export class SdkRpcEndpointPool {
  readonly endpoints: readonly SdkPoolEndpoint[];
  readonly clients: readonly SunReyClient[];
  private cursor = 0;

  constructor(endpoints: readonly SdkPoolEndpoint[]) {
    if (endpoints.length === 0) {
      throw new Error('SDK endpoint pool requires at least one URL');
    }
    this.endpoints = endpoints;
    this.clients = endpoints.map((endpoint) => new SunReyClient(createHttpTransport(endpoint.url)));
  }

  nextReadClient(): SunReyClient {
    const client = this.clients[this.cursor % this.clients.length]!;
    this.cursor += 1;
    return client;
  }

  async readWithFailover<T>(operation: (client: SunReyClient) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < this.clients.length; attempt += 1) {
      const client = this.nextReadClient();
      try {
        return await operation(client);
      } catch (error) {
        lastError = error;
        const status = error instanceof SdkHttpError ? error.status : 503;
        if (!shouldRetryRead(status, DEFAULT_RETRY_POLICY)) {
          throw error;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('all RPC endpoints failed');
  }

  /**
   * Failover must not blindly resubmit. Canonical transaction ID is checked
   * first so a lost HTTP response cannot create a second economic mutation.
   */
  async submitIdempotent(input: {
    readonly signed_envelope_hex: string;
    readonly transaction_id: string;
    readonly network_id?: string;
  }): Promise<SubmissionResponse | TransactionReceipt> {
    const known = await this.readWithFailover(async (client) => {
      try {
        return await client.transaction(input.transaction_id);
      } catch (error) {
        if (error instanceof SdkHttpError && error.status === 404) {
          return null;
        }
        throw error;
      }
    });
    if (known && (known.finalized || known.status === 'MEMPOOL' || known.status === 'INCLUDED' || known.status === 'FINALIZED')) {
      return known;
    }
    const client = this.clients[0]!;
    const submitted = await client.submitTransaction({
      signed_envelope_hex: input.signed_envelope_hex,
      network_id: input.network_id,
      previous_transaction_id: input.transaction_id,
    });
    if (!submissionRetrySafe({ previousTransactionId: input.transaction_id, nextTransactionId: submitted.transaction_id })) {
      throw new Error('refusing duplicate mutation: transaction IDs diverged');
    }
    return submitted;
  }
}

export function connectSunReyPool(urls: readonly string[]): SdkRpcEndpointPool {
  return new SdkRpcEndpointPool(urls.map((url) => ({ url })));
}

export function pooledTransport(urls: readonly string[]): HttpTransport {
  const pool = connectSunReyPool(urls);
  const first = pool.clients[0]!.http;
  return {
    baseUrl: urls[0] ?? '',
    get: (path) => pool.readWithFailover((client) => client.http.get(path)),
    post: (path, body, headers) => first.post(path, body, headers),
  };
}
