import type { EncryptedEnvelope } from '../../security/src/envelope.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import type { TravelRuleProtectionPort } from './ports.ts';

export class KeyProviderTravelRuleProtection implements TravelRuleProtectionPort {
  private readonly keys: KeyProvider;

  constructor(keys: KeyProvider) {
    this.keys = keys;
  }

  seal(plaintext: Buffer): EncryptedEnvelope {
    const sealed = this.keys.encrypt('DATA_ENCRYPTION', plaintext);
    if (!sealed.ok) {
      throw new Error(sealed.error.message);
    }
    return sealed.value;
  }
}
