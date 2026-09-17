import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AiApprovedPurpose, AiProviderKind } from '../taxonomy.ts';
import { minimizeContext } from '../envelope.ts';
import type { AiContextObject } from '../types.ts';
import type { S3mAuthorizedContextField, S3mFinanceServingRequest } from './contract.ts';
import type { S3mFinanceModelProfile } from './model-profile.ts';
import type { S3mAuthorizedContextClass, S3mPrivacyClassification } from './taxonomy.ts';
import {
  s3mPrivacyRequiresPrivateQualification,
  s3mQualificationPermitsPrivateContext,
  s3mQualificationPermitsServing,
} from './taxonomy.ts';

export type S3mContextBuildFailure = {
  readonly code:
    | 'PURPOSE_NOT_PERMITTED'
    | 'CONTEXT_CLASS_DENIED'
    | 'PRIVATE_CONTEXT_NOT_QUALIFIED'
    | 'SERVING_NOT_QUALIFIED'
    | 'EMPTY_AUTHORIZED_CONTEXT';
  readonly detail: string;
};

const PURPOSE_CONTEXT_CLASSES = {
  FINANCIAL_EXPLANATION: ['PEG_POSITION_SUMMARY', 'WORK_ORDER_SCOPE'],
  STRUCTURED_PROPOSAL_NARRATION: ['PEG_POSITION_SUMMARY', 'MANDATE_CONSTRAINT', 'WORK_ORDER_SCOPE'],
  SIMPLE_CLASSIFICATION: ['PUBLIC_RESEARCH'],
  GROWTH_PLANNING: ['PEG_GOAL_SUMMARY', 'PEG_POSITION_SUMMARY', 'MANDATE_CONSTRAINT'],
  PORTFOLIO_REASONING: ['PEG_POSITION_SUMMARY', 'MARKET_OBSERVATION'],
  PAYMENT_PREPARATION: ['PEG_POSITION_SUMMARY', 'WORK_ORDER_SCOPE'],
  EXCHANGE_ORDER_PREPARATION: ['PEG_POSITION_SUMMARY', 'MARKET_OBSERVATION'],
  USER_SUPPORT: ['PUBLIC_RESEARCH'],
  REGULATORY_EXPLANATION: ['PUBLIC_RESEARCH', 'WORK_ORDER_SCOPE'],
  GENERAL_ASSISTANT: ['PUBLIC_RESEARCH'],
  MARKET_OPPORTUNITY_RESEARCH: ['MARKET_OBSERVATION', 'PUBLIC_RESEARCH'],
} as const satisfies Record<AiApprovedPurpose, readonly S3mAuthorizedContextClass[]>;

const PRIVACY_ALLOWED_CLASSES = {
  PUBLIC_RESEARCH: ['PUBLIC_RESEARCH', 'MARKET_OBSERVATION'],
  INTERNAL: ['PUBLIC_RESEARCH', 'MARKET_OBSERVATION', 'WORK_ORDER_SCOPE'],
  CUSTOMER_PRIVATE: ['PEG_POSITION_SUMMARY', 'PEG_GOAL_SUMMARY', 'WORK_ORDER_SCOPE', 'MANDATE_CONSTRAINT'],
  RESTRICTED_SENSITIVE: ['PEG_POSITION_SUMMARY', 'PEG_GOAL_SUMMARY', 'MANDATE_CONSTRAINT', 'WORK_ORDER_SCOPE'],
} as const satisfies Record<S3mPrivacyClassification, readonly S3mAuthorizedContextClass[]>;

const S3M_ONLY_PROVIDERS: readonly AiProviderKind[] = Object.freeze(['S3M']);

/**
 * Build only the context permitted for this task.
 * task purpose → permission evaluation → authorized fields → privacy classification → capability check.
 */
export function buildAuthorizedS3mContext(input: {
  readonly request: S3mFinanceServingRequest;
  readonly profile: S3mFinanceModelProfile;
}): Result<
  { readonly fields: readonly S3mAuthorizedContextField[]; readonly gatewayContext: readonly AiContextObject[] },
  S3mContextBuildFailure
> {
  const { request, profile } = input;

  if (!s3mQualificationPermitsServing(profile.qualificationState)) {
    return err({
      code: 'SERVING_NOT_QUALIFIED',
      detail: `deployment is ${profile.qualificationState}; inference dispatch is blocked`,
    });
  }

  if (s3mPrivacyRequiresPrivateQualification(request.privacyClassification)) {
    if (!s3mQualificationPermitsPrivateContext(profile.qualificationState)) {
      return err({
        code: 'PRIVATE_CONTEXT_NOT_QUALIFIED',
        detail: `${request.privacyClassification} requires QUALIFIED_PRIVATE_CONTEXT deployment`,
      });
    }
  }

  const purposeClasses = new Set(PURPOSE_CONTEXT_CLASSES[request.purpose] ?? []);
  const privacyClasses = new Set(PRIVACY_ALLOWED_CLASSES[request.privacyClassification]);
  const profileClasses = new Set(profile.privacyCapability.authorizedContextClasses);

  const authorized: S3mAuthorizedContextField[] = [];
  for (const field of request.authorizedContext) {
    if (!purposeClasses.has(field.contextClass)) {
      return err({
        code: 'CONTEXT_CLASS_DENIED',
        detail: `context class ${field.contextClass} is not permitted for purpose ${request.purpose}`,
      });
    }
    if (!privacyClasses.has(field.contextClass)) {
      return err({
        code: 'CONTEXT_CLASS_DENIED',
        detail: `context class ${field.contextClass} is not permitted for privacy ${request.privacyClassification}`,
      });
    }
    if (!profileClasses.has(field.contextClass)) {
      return err({
        code: 'CONTEXT_CLASS_DENIED',
        detail: `deployment does not authorize context class ${field.contextClass}`,
      });
    }
    authorized.push(field);
  }

  if (authorized.length === 0 && request.privacyClassification !== 'PUBLIC_RESEARCH') {
    return err({
      code: 'EMPTY_AUTHORIZED_CONTEXT',
      detail: 'no authorized context fields remain after permission evaluation',
    });
  }

  const gatewayContext = minimizeContext({
    purpose: request.purpose,
    objects: authorized.map((field) =>
      Object.freeze({
        objectId: field.fieldId,
        dataClass: privacyToDataClass(request.privacyClassification),
        authorizedProviders: S3M_ONLY_PROVIDERS,
        userApproved: request.privacyClassification !== 'PUBLIC_RESEARCH',
        payload: field.payload,
      }),
    ),
  });

  return ok(Object.freeze({ fields: Object.freeze(authorized), gatewayContext }));
}

function privacyToDataClass(
  classification: S3mPrivacyClassification,
): AiContextObject['dataClass'] {
  switch (classification) {
    case 'PUBLIC_RESEARCH':
      return 'PUBLIC';
    case 'INTERNAL':
      return 'INTERNAL';
    case 'CUSTOMER_PRIVATE':
      return 'USER_APPROVED_CONTEXT';
    case 'RESTRICTED_SENSITIVE':
      return 'FINANCIAL_PRIVATE';
    default:
      return 'PUBLIC';
  }
}
