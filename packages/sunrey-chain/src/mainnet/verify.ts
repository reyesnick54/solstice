/**
 * sunrey-genesis candidate verify / sunrey-mainnet verify
 */

import { fixtureGenesisHash } from '../testnet/genesis.ts';
import { PRODUCTION_ADDRESS_HRP, PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from './identity.ts';
import {
  buildGenesisCandidate,
  type GenesisCandidateBundle,
  type GenesisCandidateInput,
  verifyGenesisCandidate,
} from './genesis-candidate.ts';
import { verifyReadinessBundle } from './bundle.ts';
import type { ReadinessBundle, ReadinessEvidenceRecord } from './types.ts';

export type MainnetVerifyReport = {
  readonly ok: boolean;
  readonly genesis: ReturnType<typeof verifyGenesisCandidate>;
  readonly networkId: string;
  readonly chainId: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly testnetGenesisRejected: boolean;
  readonly productionServicesActivated: false;
  readonly liveFlagsEnabled: false;
  readonly evidenceBundleOk: boolean;
};

export function verifyMainnetCandidate(input: {
  readonly genesisInput?: GenesisCandidateInput;
  readonly expectedHash?: string;
  readonly records?: readonly ReadinessEvidenceRecord[];
  readonly bundle?: ReadinessBundle;
}): MainnetVerifyReport {
  const bundle: GenesisCandidateBundle = buildGenesisCandidate(input.genesisInput);
  const genesis = input.genesisInput
    ? verifyGenesisCandidate(input.genesisInput, input.expectedHash ?? bundle.genesisHash)
    : bundle.verification;
  const evidenceOk =
    input.records && input.bundle ? verifyReadinessBundle(input.records, input.bundle) : true;
  return Object.freeze({
    ok: genesis.ok && evidenceOk && bundle.genesisHash !== fixtureGenesisHash(),
    genesis,
    networkId: bundle.candidate.networkId,
    chainId: bundle.candidate.chainId,
    genesisHash: bundle.genesisHash,
    validatorSetHash: bundle.validatorSetHash,
    testnetGenesisRejected: bundle.genesisHash !== fixtureGenesisHash(),
    productionServicesActivated: false,
    liveFlagsEnabled: false,
    evidenceBundleOk: evidenceOk,
  });
}

export function expectedCandidateIdentity(): {
  readonly networkId: typeof PRODUCTION_CANDIDATE_NETWORK_ID;
  readonly chainId: typeof PRODUCTION_CANDIDATE_CHAIN_ID;
  readonly addressHrp: typeof PRODUCTION_ADDRESS_HRP;
} {
  return Object.freeze({
    networkId: PRODUCTION_CANDIDATE_NETWORK_ID,
    chainId: PRODUCTION_CANDIDATE_CHAIN_ID,
    addressHrp: PRODUCTION_ADDRESS_HRP,
  });
}
