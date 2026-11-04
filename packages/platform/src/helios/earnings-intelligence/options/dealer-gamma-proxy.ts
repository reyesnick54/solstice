/**
 * DealerGammaProxy — explicit proxy only. Does not infer exact dealer positioning from open interest.
 */

import type { OptionChainSnapshot } from './types.ts';
import type { DealerGammaProxy, DealerGammaProxyAssumptions } from './types.ts';

export const DEALER_GAMMA_PROXY_ASSUMPTIONS: DealerGammaProxyAssumptions = Object.freeze({
  treatsOpenInterestAsDealerShort: false,
  signConvention: 'CALL_POSITIVE_PUT_NEGATIVE',
  notDealerPositionInference: true,
  documentation:
    'DealerGammaProxy weights listed open interest by contract gamma when greeks are present. ' +
    'It does not identify dealer vs customer accounts and must not be read as dealer positioning.',
});

function contractGammaWeight(gammaBps: number | null, openInterest: bigint): number {
  if (gammaBps === null || openInterest <= 0n) {
    return 0;
  }
  return (gammaBps / 10_000) * Number(openInterest);
}

export function computeDealerGammaProxy(snapshot: OptionChainSnapshot): DealerGammaProxy {
  let weighted = 0;
  let hasGamma = false;
  for (const contract of snapshot.contracts) {
    const oi = contract.openInterest?.openInterestContracts ?? 0n;
    const gamma = contract.greeks?.gammaBps ?? null;
    if (gamma !== null && oi > 0n) {
      hasGamma = true;
      const sign = contract.right === 'CALL' ? 1 : -1;
      weighted += sign * contractGammaWeight(gamma, oi);
    }
  }
  return Object.freeze({
    label: 'DealerGammaProxy',
    proxyGammaNotionalBps: hasGamma ? Math.round(weighted) : null,
    assumptions: DEALER_GAMMA_PROXY_ASSUMPTIONS,
    grantsExecutionAuthority: false,
  });
}
