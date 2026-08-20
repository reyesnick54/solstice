import type { TravelRuleCandidateTransport } from './types.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export class FakeTravelRuleTransport implements TravelRuleCandidateTransport {
  readonly kind = 'FAKE' as const;
  readonly realNetwork = false as const;
  readonly #fail = new Set<string>();

  failNext(address: string): void {
    this.#fail.add(address);
  }

  discover(address: string): { readonly discovered: boolean; readonly counterpartyRef: string | null } {
    if (address.includes('unknown')) {
      return Object.freeze({ discovered: false, counterpartyRef: null });
    }
    return Object.freeze({ discovered: true, counterpartyRef: `vasp:${address}` });
  }

  submit(messageId: string): { readonly acknowledged: boolean; readonly failed: boolean } {
    if (this.#fail.has(messageId) || messageId.includes('fail')) {
      return Object.freeze({ acknowledged: false, failed: true });
    }
    return Object.freeze({ acknowledged: true, failed: false });
  }
}

/**
 * Injected custody transports. No vendor SDK. No real custody API.
 */

export type CustodyTransportRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: Readonly<Record<string, unknown>>;
};

export type CustodyTransportResponse = {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly realNetwork: false;
};

export type CustodyCandidateTransport = {
  readonly kind: 'FIXTURE' | 'SCRIPTED_SANDBOX';
  readonly realNetwork: false;
  readonly vendorSdkPresent: false;
  exchange(request: CustodyTransportRequest): CustodyCandidateResult<CustodyTransportResponse>;
};

export class FixtureCustodyTransport implements CustodyCandidateTransport {
  readonly kind = 'FIXTURE' as const;
  readonly realNetwork = false as const;
  readonly vendorSdkPresent = false as const;

  exchange(request: CustodyTransportRequest): CustodyCandidateResult<CustodyTransportResponse> {
    return candidateOk(
      Object.freeze({
        status: 200,
        body: Object.freeze({
          fixture: true,
          method: request.method,
          path: request.path,
        }),
        realNetwork: false,
      }),
    );
  }
}

export class ScriptedCustodySandboxTransport implements CustodyCandidateTransport {
  readonly kind = 'SCRIPTED_SANDBOX' as const;
  readonly realNetwork = false as const;
  readonly vendorSdkPresent = false as const;
  private readonly scripts = new Map<string, CustodyTransportResponse | CustodyCandidateResult<never>>();

  script(path: string, response: CustodyTransportResponse | CustodyCandidateResult<never>): void {
    this.scripts.set(path, response);
  }

  exchange(request: CustodyTransportRequest): CustodyCandidateResult<CustodyTransportResponse> {
    const scripted = this.scripts.get(request.path);
    if (!scripted) {
      return candidateErr('SANDBOX_UNSCRIPTED', `no sandbox script for ${request.path}`);
    }
    if ('ok' in scripted) {
      return scripted;
    }
    return candidateOk(scripted);
  }
}

export function assertNoRealCustodyCall(transport: CustodyCandidateTransport): true {
  if (transport.realNetwork !== false || transport.vendorSdkPresent !== false) {
    throw new Error('real custody provider transport is forbidden');
  }
  return true;
}
