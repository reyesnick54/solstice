// @ts-nocheck
import { zkErr, type ZKProofProvider } from './types.ts';
import { ZERO_KNOWLEDGE_PROOF_CAPABILITY } from './types.ts';

export function createUnavailableZKProofProvider(): ZKProofProvider {
  return Object.freeze({
    capability: ZERO_KNOWLEDGE_PROOF_CAPABILITY,
    async prove() {
      return zkErr({
        code: 'ZK_PROVIDER_UNAVAILABLE',
        message: 'zero-knowledge proof provider is not configured; no custom circuits are shipped',
      });
    },
    async verify() {
      return zkErr({
        code: 'ZK_PROVIDER_UNAVAILABLE',
        message: 'zero-knowledge proof verification is not configured',
      });
    },
  });
}

export { zkErr, zkOk } from './types.ts';
