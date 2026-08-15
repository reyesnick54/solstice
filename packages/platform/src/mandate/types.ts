import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AgentInterpretationId } from '../../../agent/src/ids.ts';
import type {
  EconomicMandateId,
  MandateConfirmationId,
  MandateConstraintId,
  MandateDraftId,
  MandateGoalId,
  MandateVersion,
} from '../ids.ts';
import type {
  CompilerErrorCode,
  GoalSource,
  HardConstraintKind,
  MandateGoalKind,
  MandateGoalStatus,
  MandateState,
  SoftPreferenceKind,
  UserConfirmationState,
} from './taxonomy.ts';

export type SerializedMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type TimeHorizon = {
  readonly kind: 'DATE' | 'DURATION_DAYS';
  readonly date?: UtcInstant;
  readonly days?: number;
};

export type MandateGoal = {
  readonly goalId: MandateGoalId;
  readonly kind: MandateGoalKind;
  readonly label: string;
  readonly priority: number;
  readonly target?: SerializedMoney;
  readonly baseline?: SerializedMoney;
  readonly timeHorizon?: TimeHorizon;
  readonly currency: string;
  readonly status: MandateGoalStatus;
  readonly source: GoalSource;
  readonly userConfirmationState: UserConfirmationState;
  readonly pegNodeId?: string;
};

export type HardConstraint = {
  readonly constraintId: MandateConstraintId;
  readonly kind: HardConstraintKind;
  readonly amount?: SerializedMoney;
  readonly accountIds?: readonly string[];
  readonly currencies?: readonly string[];
  readonly categories?: readonly string[];
  readonly jurisdictions?: readonly string[];
  readonly days?: number;
  readonly metadata?: string;
  readonly overrideForbidden: true;
};

export type SoftPreference = {
  readonly kind: SoftPreferenceKind;
  readonly weight: number;
};

export type MandateDraft = {
  readonly draftId: MandateDraftId;
  readonly subjectId: string;
  readonly sourceText: string;
  readonly source: 'USER' | 'AGENT_INTERPRETATION' | 'PEG';
  readonly interpretationId?: AgentInterpretationId;
  readonly currency: string;
  readonly goals: readonly MandateGoal[];
  readonly hardConstraints: readonly HardConstraint[];
  readonly softPreferences: readonly SoftPreference[];
  readonly createdAt: UtcInstant;
  readonly modelTextIsPolicy: false;
};

export type MandateConfirmation = {
  readonly confirmationId: MandateConfirmationId;
  readonly mandateId: EconomicMandateId;
  readonly version: MandateVersion;
  readonly actorId: string;
  readonly subjectId: string;
  readonly sessionId: string;
  readonly authenticationAssurance: string;
  readonly confirmedAt: UtcInstant;
  readonly contextHash: string;
  readonly confirmationHash: string;
  readonly highImpact: boolean;
  readonly stepUpRequired: boolean;
  readonly stepUpSatisfied: boolean;
};

export type CompiledEconomicMandate = {
  readonly mandateId: EconomicMandateId;
  readonly version: MandateVersion;
  readonly subjectId: string;
  readonly state: MandateState;
  readonly sourceText: string;
  readonly currency: string;
  readonly goals: readonly MandateGoal[];
  readonly hardConstraints: readonly HardConstraint[];
  readonly softPreferences: readonly SoftPreference[];
  readonly confirmation?: MandateConfirmation;
  readonly compiledAt: UtcInstant;
  readonly supersededByVersion?: MandateVersion;
  readonly planningEligible: boolean;
};

export type CompilerIssue = {
  readonly code: CompilerErrorCode;
  readonly message: string;
  readonly constraintKinds?: readonly HardConstraintKind[];
};

export type MandateCompileFailure = {
  readonly code: 'MANDATE_INVALID';
  readonly issues: readonly CompilerIssue[];
};
