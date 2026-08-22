/**
 * Simulation issuer that implements the production card contract.
 */

import { SimulatedCardProcessor } from '../simulated-processor.ts';
import type { WalletProvider } from '../wallet/token.ts';
import type { ProductionCardIssuer, WalletTokenLifecycleResult } from './issuer.ts';
import type { DigitalWalletHookRequest, DigitalWalletHookResult, DigitalWalletHooks } from './wallet.ts';
import { walletCertificationPosture } from './wallet.ts';

export class SimulatedProductionCardIssuer extends SimulatedCardProcessor implements ProductionCardIssuer, DigitalWalletHooks {
  readonly providerId = 'SIMULATED_CARD_PROCESSOR';
  readonly lifecycle = 'SIMULATED' as const;
  readonly canPostLedger = false as const;
  readonly canIssueExecutionAuthority = false as const;
  readonly producesProductionCard = false as const;
  readonly applePayCertified = false as const;
  readonly googlePayCertified = false as const;

  suspendWalletToken(input: {
    readonly processorCardRef: string;
    readonly walletProvider: WalletProvider;
  }): WalletTokenLifecycleResult {
    return Object.freeze({
      outcome: 'ACCEPTED',
      status: 'SUSPENDED',
      providerReference: `sim_wallet_${input.walletProvider}_suspend`,
    });
  }

  resumeWalletToken(input: {
    readonly processorCardRef: string;
    readonly walletProvider: WalletProvider;
  }): WalletTokenLifecycleResult {
    return Object.freeze({
      outcome: 'ACCEPTED',
      status: 'ACTIVE',
      providerReference: `sim_wallet_${input.walletProvider}_resume`,
    });
  }

  deleteWalletToken(input: {
    readonly processorCardRef: string;
    readonly walletProvider: WalletProvider;
  }): WalletTokenLifecycleResult {
    return Object.freeze({
      outcome: 'ACCEPTED',
      status: 'DELETED',
      providerReference: `sim_wallet_${input.walletProvider}_delete`,
    });
  }

  evaluateEligibility(request: DigitalWalletHookRequest) {
    const meta = this.retrieveSafeMetadata(request.processorCardRef as never);
    return Object.freeze({ eligible: meta?.status === 'ACTIVE' });
  }

  requestProvisioning(request: DigitalWalletHookRequest): DigitalWalletHookResult {
    const provisioned = this.provisionWallet({
      processorCardRef: request.processorCardRef as never,
      walletProvider: request.walletProvider,
      deviceRef: request.deviceRef,
    });
    return Object.freeze({
      outcome: provisioned.outcome,
      status: provisioned.status === 'FAILED' ? 'NOT_ELIGIBLE' : provisioned.status,
      providerReference: provisioned.providerReference,
      ...walletCertificationPosture(),
    });
  }

  getTokenStatus(request: DigitalWalletHookRequest): DigitalWalletHookResult {
    return Object.freeze({
      outcome: 'ACCEPTED',
      status: 'ACTIVE',
      providerReference: `sim_wallet_${request.walletProvider}_status`,
      ...walletCertificationPosture(),
    });
  }

  suspend(request: DigitalWalletHookRequest): DigitalWalletHookResult {
    const result = this.suspendWalletToken(request);
    return Object.freeze({ ...result, status: result.status, ...walletCertificationPosture() });
  }

  resume(request: DigitalWalletHookRequest): DigitalWalletHookResult {
    const result = this.resumeWalletToken(request);
    return Object.freeze({ ...result, status: result.status, ...walletCertificationPosture() });
  }

  delete(request: DigitalWalletHookRequest): DigitalWalletHookResult {
    const result = this.deleteWalletToken(request);
    return Object.freeze({ ...result, status: result.status, ...walletCertificationPosture() });
  }
}
