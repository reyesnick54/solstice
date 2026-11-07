import type {
  AgentAllowedWithdrawalAction,
  AgentForbiddenWithdrawalAction,
  CustodyMovementAuthority,
  CustodyMovementDecision,
  CustodyRailKind,
  WithdrawalRequirementId,
} from './taxonomy.ts';

export type CustodyMovementGrant = {
  readonly grantId: string;
  readonly actorKind: 'HUMAN_CUSTOMER' | 'HUMAN_OPERATOR' | 'GROW_TRADING_AGENT' | 'SERVICE';
  readonly productScope: 'GROW' | 'EXCHANGE' | 'WALLET' | 'INSTITUTIONAL';
  /** Explicit grant only — no transitive or bundled withdrawal from trade. */
  readonly grantedAuthorities: readonly CustodyMovementAuthority[];
};

export type CustodyMovementRequest = {
  readonly requestId: string;
  readonly authority: CustodyMovementAuthority;
  readonly rail: CustodyRailKind;
  readonly grant: CustodyMovementGrant;
};

export type CustodyMovementIsolationResult = {
  readonly decision: CustodyMovementDecision;
  readonly authority: CustodyMovementAuthority;
  readonly reasonCodes: readonly string[];
  readonly tradeAuthorityImpliesWithdraw: false;
  readonly postsCustodyMovement: boolean;
};

export type WithdrawalRequirementStatus = {
  readonly requirement: WithdrawalRequirementId;
  readonly satisfied: boolean;
  readonly reasonCode: string | null;
};

export type WithdrawalAuthorityEnvelope = {
  readonly requirementStatuses: readonly WithdrawalRequirementStatus[];
  readonly allSatisfied: boolean;
  readonly rail: CustodyRailKind;
};

export type AgentWithdrawalBoundaryResult =
  | { readonly outcome: 'ALLOWED'; readonly action: AgentAllowedWithdrawalAction }
  | { readonly outcome: 'DENIED'; readonly action: AgentForbiddenWithdrawalAction; readonly code: string };

export type DigitalAssetCustodyPath = {
  readonly rail: 'DIGITAL_ASSET';
  readonly hsmMpcBoundaryPreserved: true;
  readonly destinationScreeningRequired: true;
  readonly travelRuleRequired: boolean;
  readonly chainConfirmationRequired: true;
  readonly mayUseCryptoSemanticsOnSecurities: false;
};

export type SecuritiesCustodyPath = {
  readonly rail: 'SECURITIES';
  readonly brokerSettlementRecords: true;
  readonly positionRecordAuthoritative: true;
  readonly chainConfirmationRequired: false;
  readonly travelRuleRequired: false;
  readonly forcedCryptoSemantics: false;
};

export type Exec11QualificationChecks = {
  readonly authoritiesExplicitlySeparated: boolean;
  readonly growTradeDoesNotGrantWithdraw: boolean;
  readonly growTradeDoesNotGrantTransfer: boolean;
  readonly withdrawalRequirementsEnumerated: boolean;
  readonly withdrawalGateComposable: boolean;
  readonly agentCannotApproveWithdrawal: boolean;
  readonly agentCannotCreateDestination: boolean;
  readonly digitalAssetPreservesProviderBoundaries: boolean;
  readonly securitiesAvoidsCryptoSemantics: boolean;
  readonly tradeNeverImpliesWithdraw: boolean;
  readonly fixtureQualificationHarnessPasses: boolean;
};
