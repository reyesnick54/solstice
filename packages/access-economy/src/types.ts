import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  AccessBoundKind,
  AccessCapacityCategory,
  AccessIntentKind,
  AccessRightState,
} from './taxonomy.ts';
import type {
  AccessIntentId,
  AccessRightId,
  CapacityRef,
  DeliveryEvidenceRef,
  ReservationRef,
} from './ids.ts';

export type AccessBound =
  | { readonly kind: 'TIME'; readonly notBefore: UtcInstant; readonly notAfter: UtcInstant }
  | { readonly kind: 'QUANTITY'; readonly unit: string; readonly quantity: bigint }
  | { readonly kind: 'LOCATION'; readonly jurisdiction: string; readonly placeRef: string }
  | { readonly kind: 'USAGE'; readonly meter: string; readonly allowance: bigint };

export type AccessRight = Readonly<{
  readonly id: AccessRightId;
  readonly subjectRef: string;
  readonly capacityRef: CapacityRef;
  readonly category: AccessCapacityCategory;
  readonly bounds: readonly AccessBound[];
  readonly state: AccessRightState;
  readonly isOwnership: false;
  readonly isMoney: false;
  readonly isSecurity: false;
  readonly grantsMint: false;
  readonly impliesSettlement: false;
  readonly valuesHuman: false;
  readonly createsCapacity: false;
  readonly overridesLegalRights: false;
  readonly bypassesPolicy: false;
  readonly reservationRef: ReservationRef | null;
  readonly deliveryEvidenceRef: DeliveryEvidenceRef | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
}>;

export type AccessIntent = Readonly<{
  readonly id: AccessIntentId;
  readonly kind: AccessIntentKind;
  readonly subjectRef: string;
  readonly capacityRef: CapacityRef;
  readonly category: AccessCapacityCategory;
  readonly bounds: readonly AccessBound[];
  readonly purposeRef: string;
  readonly pegContextRef: string | null;
  readonly proposedAt: UtcInstant;
  readonly isActionIntent: false;
  readonly isExecutionAuthority: false;
}>;

export type AccessFabricFailureCode =
  | 'INVALID_BOUND'
  | 'INVALID_CATEGORY'
  | 'FORBIDDEN_FIELD'
  | 'FORBIDDEN_OWNERSHIP_CLAIM'
  | 'FORBIDDEN_MONETARY_CLAIM'
  | 'FORBIDDEN_MINT_CLAIM'
  | 'FORBIDDEN_SETTLEMENT_CLAIM'
  | 'FORBIDDEN_HUMAN_WORTH_FIELD'
  | 'FORBIDDEN_ACCESS_COIN_FIELD'
  | 'NOT_FOUND'
  | 'STATE_CONFLICT';

export type AccessFabricFailure = Readonly<{
  readonly code: AccessFabricFailureCode;
  readonly message: string;
}>;

export type ProposeAccessIntentInput = Readonly<{
  readonly id: AccessIntentId;
  readonly kind: AccessIntentKind;
  readonly subjectRef: string;
  readonly capacityRef: CapacityRef;
  readonly category: AccessCapacityCategory;
  readonly bounds: readonly AccessBound[];
  readonly purposeRef: string;
  readonly pegContextRef?: string | null;
  readonly proposedAt: UtcInstant;
}>;

export type RegisterAccessRightInput = Readonly<{
  readonly id: AccessRightId;
  readonly subjectRef: string;
  readonly capacityRef: CapacityRef;
  readonly category: AccessCapacityCategory;
  readonly bounds: readonly AccessBound[];
  readonly state?: AccessRightState;
  readonly reservationRef?: ReservationRef | null;
  readonly deliveryEvidenceRef?: DeliveryEvidenceRef | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
}>;

export type AccessFabricSnapshot = Readonly<{
  readonly rights: readonly AccessRight[];
  readonly intents: readonly AccessIntent[];
}>;

export type AccessFabricPort = Readonly<{
  proposeIntent(input: ProposeAccessIntentInput): import('../../domain/src/result.ts').Result<AccessIntent, AccessFabricFailure>;
  registerRight(input: RegisterAccessRightInput): import('../../domain/src/result.ts').Result<AccessRight, AccessFabricFailure>;
  getRight(id: AccessRightId): AccessRight | null;
  getIntent(id: AccessIntentId): AccessIntent | null;
  snapshot(): AccessFabricSnapshot;
}>;
