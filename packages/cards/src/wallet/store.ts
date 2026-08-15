import type { DevicePaymentToken } from './token.ts';

export type WalletProvisioningAttempt = {
  readonly attemptId: string;
  readonly tokenId: string;
  readonly cardId: string;
  readonly deviceId: string;
  readonly walletProvider: string;
  readonly outcome: string;
  readonly reasons: readonly string[];
  readonly createdAt: string;
};

export class WalletStore {
  private readonly tokens = new Map<string, DevicePaymentToken>();
  private readonly tokensByKey = new Map<string, DevicePaymentToken>();
  private readonly attempts = new Map<string, WalletProvisioningAttempt>();
  private readonly callbacks = new Map<string, DevicePaymentToken>();

  saveToken(token: DevicePaymentToken): void {
    this.tokens.set(token.tokenId, token);
  }

  getToken(tokenId: string): DevicePaymentToken | undefined {
    return this.tokens.get(tokenId);
  }

  getTokenByProviderRef(ref: string): DevicePaymentToken | undefined {
    return [...this.tokens.values()].find((token) => token.providerReference === ref);
  }

  listTokensByCard(cardId: string): readonly DevicePaymentToken[] {
    return [...this.tokens.values()].filter((token) => token.cardId === cardId);
  }

  listTokensByDevice(deviceId: string): readonly DevicePaymentToken[] {
    return [...this.tokens.values()].filter((token) => token.deviceId === deviceId);
  }

  tokenByIdempotency(key: string): DevicePaymentToken | undefined {
    return this.tokensByKey.get(key);
  }

  markTokenIdempotency(key: string, token: DevicePaymentToken): void {
    this.tokensByKey.set(key, token);
  }

  saveAttempt(attempt: WalletProvisioningAttempt): void {
    this.attempts.set(attempt.attemptId, attempt);
  }

  listAttempts(): readonly WalletProvisioningAttempt[] {
    return [...this.attempts.values()];
  }

  callbackByKey(key: string): DevicePaymentToken | undefined {
    return this.callbacks.get(key);
  }

  markCallback(key: string, token: DevicePaymentToken): void {
    this.callbacks.set(key, token);
  }
}
