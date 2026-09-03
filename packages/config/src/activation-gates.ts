// @ts-nocheck
/**
 * Fail-closed production activation gates for ADR-controlled features.
 *
 * Regulated or deferred capabilities default OFF. Explicit configuration
 * cannot bypass missing legal/regulatory approval markers in this tree.
 */

import {
  ENVIRONMENT,
  LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED,
  LIVE_BANKING_RAILS,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_CRYPTO_ENABLED,
  LIVE_CUSTODY_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_DATA_MONETIZATION_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED,
  LIVE_EXTERNAL_KYC,
  LIVE_HIN_BASED_ISSUANCE_ENABLED,
  LIVE_INFORMATION_RIGHTS_MARKETPLACE,
  LIVE_INTEROP_ENABLED,
  LIVE_INTEROP_RELAYERS_ENABLED,
  LIVE_INTEROP_WATCHERS_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
  PRODUCTION_HSM_KMS_CONFIGURED,
} from './flags.ts';

export const PRODUCTION_ACTIVATION_POLICY_ID = 'sunrey-adr-activation-gates/1' as const;

export const REGULATED_FEATURE_FLAGS = Object.freeze({
  LIVE_INTEROP_ENABLED,
  LIVE_INTEROP_RELAYERS_ENABLED,
  LIVE_INTEROP_WATCHERS_ENABLED,
  LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED,
  LIVE_CUSTODY_ENABLED,
  LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_KYC,
  LIVE_TRADING_ENABLED,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_INFORMATION_RIGHTS_MARKETPLACE,
  LIVE_DATA_MONETIZATION_ENABLED,
  LIVE_HIN_BASED_ISSUANCE_ENABLED,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
  PRODUCTION_HSM_KMS_CONFIGURED,
});

export type RegulatedFeatureFlag = keyof typeof REGULATED_FEATURE_FLAGS;

export type ActivationGateRequirement = {
  readonly flag: RegulatedFeatureFlag;
  readonly adrNumbers: readonly string[];
  readonly requiresLegalApproval: boolean;
  readonly requiresRegulatoryApproval: boolean;
  readonly requiresExternalProviderApproval: boolean;
  readonly requiresHumanAuthorizationMarker: boolean;
};

export const ACTIVATION_GATE_REQUIREMENTS: readonly ActivationGateRequirement[] = Object.freeze([
  {
    flag: 'LIVE_INTEROP_ENABLED',
    adrNumbers: ['0029'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_INTEROP_RELAYERS_ENABLED',
    adrNumbers: ['0029'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_INTEROP_WATCHERS_ENABLED',
    adrNumbers: ['0029'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED',
    adrNumbers: ['0029', '0031'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_CUSTODY_ENABLED',
    adrNumbers: ['0007', '0009'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED',
    adrNumbers: ['0007', '0012'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_EXCHANGE_ENABLED',
    adrNumbers: ['0014', '0026'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_TRADING_ENABLED',
    adrNumbers: ['0014'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_INVESTMENT_EXECUTION',
    adrNumbers: ['0014'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_INFORMATION_RIGHTS_MARKETPLACE',
    adrNumbers: ['0013'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_EXTERNAL_KYC',
    adrNumbers: ['0007', '0010'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_MONEY_ENABLED',
    adrNumbers: ['0006', '0031'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: false,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_PAYMENTS_ENABLED',
    adrNumbers: ['0006', '0010'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
  {
    flag: 'LIVE_BANKING_RAILS',
    adrNumbers: ['0006', '0010'],
    requiresLegalApproval: true,
    requiresRegulatoryApproval: true,
    requiresExternalProviderApproval: true,
    requiresHumanAuthorizationMarker: true,
  },
]);

export type ActivationGateViolation = {
  readonly flag: RegulatedFeatureFlag;
  readonly reason: string;
};

export function listEnabledRegulatedFlags(): RegulatedFeatureFlag[] {
  const enabled: RegulatedFeatureFlag[] = [];
  for (const [name, value] of Object.entries(REGULATED_FEATURE_FLAGS)) {
    if (value === true) {
      enabled.push(name as RegulatedFeatureFlag);
    }
  }
  return enabled;
}

export function evaluateActivationGates(input?: {
  readonly humanAuthorizationMarkerPresent?: boolean;
  readonly legalApprovalMarkerPresent?: boolean;
  readonly regulatoryApprovalMarkerPresent?: boolean;
  readonly externalProviderApprovalMarkerPresent?: boolean;
}): readonly ActivationGateViolation[] {
  const markers = {
    humanAuthorizationMarkerPresent: input?.humanAuthorizationMarkerPresent ?? false,
    legalApprovalMarkerPresent: input?.legalApprovalMarkerPresent ?? false,
    regulatoryApprovalMarkerPresent: input?.regulatoryApprovalMarkerPresent ?? false,
    externalProviderApprovalMarkerPresent: input?.externalProviderApprovalMarkerPresent ?? false,
  };
  const violations: ActivationGateViolation[] = [];

  for (const requirement of ACTIVATION_GATE_REQUIREMENTS) {
    if (REGULATED_FEATURE_FLAGS[requirement.flag] !== true) {
      continue;
    }
    if (requirement.requiresHumanAuthorizationMarker && !markers.humanAuthorizationMarkerPresent) {
      violations.push({
        flag: requirement.flag,
        reason: 'EXTERNAL_APPROVAL_REQUIRED: human authorization marker absent',
      });
    }
    if (requirement.requiresLegalApproval && !markers.legalApprovalMarkerPresent) {
      violations.push({
        flag: requirement.flag,
        reason: 'EXTERNAL_APPROVAL_REQUIRED: legal approval marker absent',
      });
    }
    if (requirement.requiresRegulatoryApproval && !markers.regulatoryApprovalMarkerPresent) {
      violations.push({
        flag: requirement.flag,
        reason: 'EXTERNAL_APPROVAL_REQUIRED: regulatory approval marker absent',
      });
    }
    if (requirement.requiresExternalProviderApproval && !markers.externalProviderApprovalMarkerPresent) {
      violations.push({
        flag: requirement.flag,
        reason: 'EXTERNAL_APPROVAL_REQUIRED: external provider approval marker absent',
      });
    }
  }

  return Object.freeze(violations);
}

export function assertRegulatedFeaturesFailClosed(): void {
  const enabled = listEnabledRegulatedFlags();
  if (enabled.length > 0) {
    throw new Error(
      `regulated feature flags must default OFF: ${enabled.join(', ')}`,
    );
  }
}

export function assertProductionActivationSafe(input?: {
  readonly nodeEnv?: string;
  readonly humanAuthorizationMarkerPresent?: boolean;
  readonly legalApprovalMarkerPresent?: boolean;
  readonly regulatoryApprovalMarkerPresent?: boolean;
  readonly externalProviderApprovalMarkerPresent?: boolean;
}): void {
  assertRegulatedFeaturesFailClosed();

  const nodeEnv = (input?.nodeEnv ?? process.env.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnv !== 'production' && nodeEnv !== 'prod') {
    return;
  }

  const violations = evaluateActivationGates(input);
  if (violations.length > 0) {
    const detail = violations.map((v) => `${v.flag}: ${v.reason}`).join('; ');
    throw new Error(`production activation gate violation: ${detail}`);
  }
}

export function interopProductionActivationAllowed(): false {
  return false;
}

export function assertInteropDevelopmentOnly(): void {
  if (LIVE_INTEROP_ENABLED || LIVE_INTEROP_RELAYERS_ENABLED || LIVE_INTEROP_WATCHERS_ENABLED) {
    throw new Error('production interop activation is forbidden; LIVE_INTEROP_* must remain false');
  }
  if (LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED) {
    throw new Error('external chain interaction is forbidden; LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED must remain false');
  }
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('interop remains simulation-only until governance gates pass');
  }
}
