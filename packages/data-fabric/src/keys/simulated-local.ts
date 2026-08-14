import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import type { PersonalDataCategory } from '@solstice/kernel';
import { PERSONAL_DATA_CATEGORIES } from '@solstice/kernel';

import type { CategoryKeyProvider, KeyRef, SealedEnvelope } from './provider.ts';

/**
 * Simulated local provider. Each category has an independent 256-bit key.
 * A compromise of one category key cannot unwrap another category.
 *
 * FLAG FOR SECURITY REVIEW: this is not an HSM, KMS, or enclave. Keys live
 * in process memory and are generated at construction. Do not use for real
 * personal data. Real HSM/KMS integration is out of scope.
 */
export class SimulatedLocalKeyProvider implements CategoryKeyProvider {
  readonly providerId = 'SIMULATED_LOCAL' as const;
  readonly hsmIntegrated = false as const;
  readonly kmsIntegrated = false as const;
  readonly securityReviewRequired = true as const;

  readonly #keys = new Map<PersonalDataCategory, Buffer>();
  readonly #keyIds = new Map<PersonalDataCategory, string>();

  constructor(seedHex?: string) {
    for (const category of PERSONAL_DATA_CATEGORIES) {
      const material = seedHex
        ? createHash('sha256').update(`${seedHex}:${category}`).digest()
        : randomBytes(32);
      this.#keys.set(category, material);
      this.#keyIds.set(
        category,
        `sim-key-${category.toLowerCase()}-${createHash('sha256').update(material).digest('hex').slice(0, 12)}`,
      );
    }
  }

  keyRefFor(category: PersonalDataCategory): KeyRef {
    const keyId = this.#keyIds.get(category);
    if (!keyId) {
      throw new Error(`no key provisioned for category ${category}`);
    }
    return Object.freeze({
      category,
      keyId,
      algorithm: 'AES-256-GCM-SIMULATED',
      provider: 'SIMULATED_LOCAL',
      securityReviewRequired: true,
    });
  }

  wrap(category: PersonalDataCategory, plaintext: Uint8Array): SealedEnvelope {
    const key = this.#keys.get(category);
    const keyId = this.#keyIds.get(category);
    if (!key || !keyId) {
      throw new Error(`no key provisioned for category ${category}`);
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Object.freeze({
      category,
      keyId,
      ivHex: iv.toString('hex'),
      ciphertextHex: ciphertext.toString('hex'),
      authTagHex: authTag.toString('hex'),
      plaintextSha256: createHash('sha256').update(plaintext).digest('hex'),
    });
  }

  unwrap(category: PersonalDataCategory, envelope: SealedEnvelope): Uint8Array {
    if (envelope.category !== category) {
      throw new Error(
        `category key mismatch: envelope is ${envelope.category}, unwrap requested ${category}`,
      );
    }
    const key = this.#keys.get(category);
    const keyId = this.#keyIds.get(category);
    if (!key || !keyId) {
      throw new Error(`no key provisioned for category ${category}`);
    }
    if (envelope.keyId !== keyId) {
      throw new Error(`key id mismatch for category ${category}`);
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(envelope.ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(envelope.authTagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertextHex, 'hex')),
      decipher.final(),
    ]);
  }
}
