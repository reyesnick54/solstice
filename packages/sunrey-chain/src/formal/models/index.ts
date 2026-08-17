import type { FormalModel } from '../explore.ts';
import type { FormalProfile } from '../types.ts';
import { createConsensusModel } from './consensus.ts';
import { createAdaptiveFeeMarketModel } from './adaptive-fee-market.ts';
import { createCryptoPolicyModel } from './crypto-policy.ts';
import { createDvpModel } from './dvp.ts';
import { createFeeModel } from './fees.ts';
import { createGovernanceModel } from './governance.ts';
import { createInteropAssetModel } from './interop-asset.ts';
import { createInteropPacketModel } from './interop-packet.ts';
import { createMoonReyModel } from './moonrey.ts';
import { createNativeAssetModel } from './native-asset.ts';
import { createSignerModel } from './signer.ts';
import { createValidatorSetModel } from './validator-set.ts';

export function modelsForProfile(profile: FormalProfile) {
  const bounds = {
    validators: profile.consensusValidators,
    maxHeight: profile.consensusMaxHeight,
    maxRound: profile.consensusMaxRound,
    byzantineValidators: profile.byzantineValidators,
    maxQuantity: profile.maxQuantity,
    maxOrders: profile.maxOrders,
    maxPackets: profile.maxPackets,
    maxEpochs: profile.maxEpochs,
  };
  return [
    createConsensusModel(bounds),
    createSignerModel(bounds),
    createValidatorSetModel(bounds),
    createGovernanceModel(bounds),
    createNativeAssetModel(bounds),
    createFeeModel(bounds),
    createDvpModel(bounds),
    createMoonReyModel(bounds),
    createInteropPacketModel(bounds),
    createInteropAssetModel(bounds),
    createCryptoPolicyModel(bounds),
    createAdaptiveFeeMarketModel(bounds),
  ] as FormalModel<unknown>[];
}

export { createConsensusModel, quorumBoundaryCases } from './consensus.ts';
export { createSignerModel } from './signer.ts';
export { createValidatorSetModel, setHash } from './validator-set.ts';
export { createGovernanceModel } from './governance.ts';
export { createNativeAssetModel } from './native-asset.ts';
export { createFeeModel } from './fees.ts';
export { createDvpModel } from './dvp.ts';
export { createMoonReyModel, contributionFingerprint } from './moonrey.ts';
export { createInteropPacketModel } from './interop-packet.ts';
export { createInteropAssetModel, MODEL_INTEROP_ASSET } from './interop-asset.ts';
export { createCryptoPolicyModel, MODEL_CRYPTO_STATES } from './crypto-policy.ts';
export { createAdaptiveFeeMarketModel } from './adaptive-fee-market.ts';
