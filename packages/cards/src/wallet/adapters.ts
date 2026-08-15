import { asNetworkTokenReference } from '../ids.ts';
import { asWalletProviderReference } from './ids.ts';
import type { WalletProvisionRequest, WalletProvisionResult, WalletProvisioningPort, WalletStatusUpdate } from './port.ts';
import type { WalletProvider } from './token.ts';

class SimulatedWalletAdapter implements WalletProvisioningPort {
  readonly provider: WalletProvider;

  constructor(provider: WalletProvider) {
    this.provider = provider;
  }

  provision(request: WalletProvisionRequest): WalletProvisionResult {
    return Object.freeze({
      providerReference: asWalletProviderReference(`sim_wref_${this.provider.toLowerCase()}_${request.tokenId}`),
      networkTokenReference: request.networkTokenReference.startsWith('sim_ntok_')
        ? request.networkTokenReference
        : asNetworkTokenReference(`sim_ntok_${request.tokenId}`),
      status: 'PENDING_VERIFICATION',
    });
  }

  updateStatus(update: WalletStatusUpdate): WalletStatusUpdate {
    return Object.freeze({ ...update });
  }
}

export class SimulatedAppleWalletAdapter extends SimulatedWalletAdapter {
  constructor() {
    super('APPLE_WALLET');
  }
}

export class SimulatedGoogleWalletAdapter extends SimulatedWalletAdapter {
  constructor() {
    super('GOOGLE_WALLET');
  }
}

export function walletAdapterFor(provider: WalletProvider): WalletProvisioningPort {
  return provider === 'APPLE_WALLET' ? new SimulatedAppleWalletAdapter() : new SimulatedGoogleWalletAdapter();
}
