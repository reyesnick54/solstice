import type {
  ApprovedComputationId,
  CleanRoomComputationRequestId,
  HumanInformationAssetDescriptorId,
  HumanInformationCompensationInstructionId,
  HumanInformationConsentGrantId,
  HumanInformationOfferId,
  HumanInformationRequestId,
  HumanInformationRightId,
  HumanInformationSubjectId,
  InformationConnectorId,
} from './ids.ts';
import type {
  ApprovedComputation,
  CleanRoomComputationRequest,
  CleanRoomComputationResult,
  ControlCenterProjection,
  HumanInformationAssetDescriptor,
  HumanInformationCompensationInstruction,
  HumanInformationConsentGrant,
  HumanInformationOffer,
  HumanInformationPermission,
  HumanInformationPurposeGrant,
  HumanInformationRequest,
  HumanInformationRevocation,
  HumanInformationRight,
  HumanInformationSubject,
  HumanInformationTransaction,
  HumanInformationUsageReceipt,
  InformationConnector,
  InformationProvenance,
  NetworkRequester,
  OnChainAnchor,
  PrivacyIncident,
} from './types.ts';

export class HumanInformationNetworkStore {
  readonly subjects = new Map<HumanInformationSubjectId, HumanInformationSubject>();
  readonly descriptors = new Map<HumanInformationAssetDescriptorId, HumanInformationAssetDescriptor>();
  readonly rights = new Map<HumanInformationRightId, HumanInformationRight>();
  readonly permissions = new Map<string, HumanInformationPermission>();
  readonly grants = new Map<HumanInformationConsentGrantId, HumanInformationConsentGrant>();
  readonly purposes = new Map<string, HumanInformationPurposeGrant>();
  readonly offers = new Map<HumanInformationOfferId, HumanInformationOffer>();
  readonly requests = new Map<HumanInformationRequestId, HumanInformationRequest>();
  readonly transactions = new Map<string, HumanInformationTransaction>();
  readonly computations = new Map<ApprovedComputationId, ApprovedComputation>();
  readonly jobs = new Map<CleanRoomComputationRequestId, CleanRoomComputationRequest>();
  readonly results = new Map<string, CleanRoomComputationResult>();
  readonly receipts = new Map<string, HumanInformationUsageReceipt>();
  readonly compensation = new Map<HumanInformationCompensationInstructionId, HumanInformationCompensationInstruction>();
  readonly revocations = new Map<string, HumanInformationRevocation>();
  readonly requesters = new Map<string, NetworkRequester>();
  readonly connectors = new Map<InformationConnectorId, InformationConnector>();
  readonly provenance = new Map<string, InformationProvenance>();
  readonly anchors: OnChainAnchor[] = [];
  readonly incidents: PrivacyIncident[] = [];
  readonly queryFingerprints = new Map<string, number>();
  emergencyRestricted = false;

  rightsFor(subjectId: HumanInformationSubjectId): HumanInformationRight[] {
    return [...this.rights.values()].filter((row) => row.subjectId === subjectId);
  }

  requestsForRequester(requesterId: string): HumanInformationRequest[] {
    return [...this.requests.values()].filter((row) => row.requesterId === requesterId);
  }

  controlCenter(subject: HumanInformationSubject): ControlCenterProjection {
    const rights = this.rightsFor(subject.subjectId);
    const permissions = [...this.permissions.values()].filter((row) => row.subjectId === subject.subjectId);
    return Object.freeze({
      subjectHandle: subject.publicHandle,
      categories: Object.freeze([...new Set(rights.map((row) => this.descriptors.get(row.descriptorId)?.category).filter(Boolean))] as ControlCenterProjection['categories']),
      activePermissions: Object.freeze(permissions.filter((row) => row.status === 'ACTIVE')),
      requesters: Object.freeze([...new Set(permissions.map((row) => row.requesterId))]),
      purposes: Object.freeze([...new Set(permissions.map((row) => row.purpose))]),
      compensation: Object.freeze(
        [...this.compensation.values()].filter((row) => row.subjectId === subject.subjectId),
      ),
      usageHistory: Object.freeze(
        [...this.receipts.values()].filter((row) => rights.some((right) => right.rightId === row.rightId)),
      ),
      revocations: Object.freeze(
        [...this.revocations.values()].filter((row) => row.subjectId === subject.subjectId),
      ),
      pendingRequests: Object.freeze(
        [...this.requests.values()].filter((row) => row.status === 'SUBMITTED' || row.status === 'ELIGIBLE'),
      ),
    });
  }
}
