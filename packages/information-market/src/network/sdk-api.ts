import type { HumanInformationNetworkEngine } from './engine.ts';
import type {
  CleanRoomComputationRequest,
  CleanRoomComputationResult,
  ConsentPreview,
  HumanInformationCompensationInstruction,
  HumanInformationRequest,
  HumanInformationRevocation,
  HumanInformationRight,
  HumanInformationUsageReceipt,
} from './types.ts';
import type { Result } from '../../../domain/src/result.ts';
import type { NetworkFailure } from './types.ts';
import type {
  ApprovedComputationId,
  CleanRoomComputationRequestId,
  HumanInformationAssetDescriptorId,
  HumanInformationConsentGrantId,
  HumanInformationRequestId,
  HumanInformationRightId,
  HumanInformationSubjectId,
} from './ids.ts';
import type { OutputClass, ProcessingClass } from './taxonomy.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AgentMandateContext, DeveloperAccessContext } from './types.ts';

/**
 * In-process SDK surface for Chunk 100. HTTP clients in
 * `@solstice/sunrey-sdk` call the same method names over `/v1/information/*`.
 */
export function createInformationApi(engine: HumanInformationNetworkEngine) {
  return {
    getInformationRights(subjectId: HumanInformationSubjectId): readonly HumanInformationRight[] {
      return engine.getInformationRights(subjectId);
    },
    getInformationRequests(requesterId?: string): readonly HumanInformationRequest[] {
      return engine.getInformationRequests(requesterId);
    },
    previewInformationConsent(input: {
      readonly requestId: HumanInformationRequestId;
      readonly subjectId: HumanInformationSubjectId;
      readonly descriptorId: HumanInformationAssetDescriptorId;
    }): Result<ConsentPreview, NetworkFailure> {
      return engine.previewInformationConsent(input);
    },
    approveInformationConsent(input: {
      readonly requestId: HumanInformationRequestId;
      readonly subjectId: HumanInformationSubjectId;
      readonly descriptorId: HumanInformationAssetDescriptorId;
      readonly processingClass: ProcessingClass;
      readonly outputClass: OutputClass;
      readonly expiresAt: UtcInstant;
      readonly agent?: AgentMandateContext;
    }) {
      return engine.approveInformationConsent(input);
    },
    revokeInformationConsent(input: {
      readonly grantId: HumanInformationConsentGrantId;
      readonly agent?: AgentMandateContext;
    }): Result<HumanInformationRevocation, NetworkFailure> {
      return engine.revokeInformationConsent(input);
    },
    getInformationUsage(subjectId?: HumanInformationSubjectId): readonly HumanInformationUsageReceipt[] {
      return engine.getInformationUsage(subjectId);
    },
    getInformationCompensation(subjectId?: HumanInformationSubjectId): readonly HumanInformationCompensationInstruction[] {
      return engine.getInformationCompensation(subjectId);
    },
    submitInformationRequest: engine.submitInformationRequest.bind(engine),
    submitCleanRoomComputation: engine.submitCleanRoomComputation.bind(engine),
    getCleanRoomResult(input: {
      readonly computationRequestId: CleanRoomComputationRequestId;
      readonly privacySafeValue: string | number | boolean;
      readonly cohortSize: number;
    }): Result<CleanRoomComputationResult, NetworkFailure> {
      return engine.getCleanRoomResult(input);
    },
  };
}

export type InformationApi = ReturnType<typeof createInformationApi>;
export type { ApprovedComputationId, CleanRoomComputationRequest, HumanInformationRequest };
