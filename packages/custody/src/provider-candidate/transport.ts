import type { TravelRuleCandidateTransport } from './types.ts';

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
