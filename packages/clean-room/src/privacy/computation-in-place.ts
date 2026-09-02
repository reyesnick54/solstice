import { err, ok } from '../../../domain/src/result.ts';

export type CapabilityClassification = 'IMPLEMENTED' | 'PARTIAL' | 'INTERFACE_ONLY' | 'FUTURE';

export const PRIVATE_COMPUTATION_CAPABILITY: CapabilityClassification = 'INTERFACE_ONLY';
export const CLEAN_ROOM_CAPABILITY: CapabilityClassification = 'PARTIAL';
export const TEE_CAPABILITY: CapabilityClassification = 'INTERFACE_ONLY';

export type ComputationVenue = 'AUTHORIZED_SOURCE' | 'SECURE_CLEAN_ROOM' | 'TRUSTED_EXECUTION_ENVIRONMENT' | 'PRIVATE_COMPUTATION_SERVICE';

export type ComputationInPlaceRequest = {
  readonly venue: ComputationVenue;
  readonly purposeId: string;
  readonly computationId: string;
  readonly inputCommitmentHashes: readonly string[];
  readonly outputClass: 'BOOLEAN_ATTESTATION' | 'AGGREGATE_STATISTIC' | 'VERIFIED_ATTRIBUTE' | 'COMPUTATION_RECEIPT';
};

export type ComputationInPlaceResult = {
  readonly verified: boolean;
  readonly resultCommitmentHash: string;
  readonly rawDatasetCopied: false;
  readonly venue: ComputationVenue;
};

export type PrivateComputationProvider = {
  readonly capability: typeof PRIVATE_COMPUTATION_CAPABILITY | 'PARTIAL' | 'IMPLEMENTED';
  execute(request: ComputationInPlaceRequest): Promise<
    import('../../../domain/src/result.ts').Result<ComputationInPlaceResult, { readonly code: string; readonly message: string }>
  >;
};

export function createSimulationCleanRoomComputationProvider(): PrivateComputationProvider {
  return Object.freeze({
    capability: CLEAN_ROOM_CAPABILITY,
    async execute(request) {
      const seed = request.inputCommitmentHashes.join(':');
      return ok(
        Object.freeze({
          verified: true,
          resultCommitmentHash: `cmp:${seed.slice(0, 32)}`,
          rawDatasetCopied: false,
          venue: request.venue,
        }),
      );
    },
  });
}

export function createUnavailableTeeComputationProvider(): PrivateComputationProvider {
  return Object.freeze({
    capability: TEE_CAPABILITY,
    async execute() {
      return err({
        code: 'TEE_NOT_CONFIGURED',
        message: 'trusted execution environment integration is not implemented',
      });
    },
  });
}
