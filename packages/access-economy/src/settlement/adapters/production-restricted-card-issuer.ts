/**
 * Production restricted card issuer shell.
 *
 * No production card-issuing credentials or provider contract exist.
 * All operations return BLOCKED_PENDING_PROVIDER.
 */

import {
  PRODUCTION_SHELL_CONTROL_SUPPORT,
  type RestrictedCardIssueInput,
  type RestrictedCardIssueResult,
  type RestrictedCardIssuerPort,
  type IssuerSafeCardMetadata,
} from '../issuer-port.ts';
import type { AccessCardControls } from '../types.ts';

export const PRODUCTION_CARD_ISSUER_REQUIREMENTS = [
  'SIGNED_CARD_ISSUING_AGREEMENT',
  'PCI_DSS_ASSESSMENT',
  'COMMERCIAL_TERMS',
  'PRODUCTION_CREDENTIALS',
  'WEBHOOK_ENDPOINT_VERIFICATION',
  'FRAUD_MONITORING',
  'OPERATIONAL_RUNBOOK',
] as const;

export type ProductionCardIssuerRequirement = (typeof PRODUCTION_CARD_ISSUER_REQUIREMENTS)[number];

export type ProductionCardIssuerChecklist = {
  readonly providerId: string | null;
  readonly requirements: readonly {
    readonly requirement: ProductionCardIssuerRequirement;
    readonly satisfied: false;
    readonly notes: string;
  }[];
  readonly liveEnabled: false;
  readonly sandboxAvailable: false;
};

export function productionCardIssuerChecklist(providerId: string | null = null): ProductionCardIssuerChecklist {
  return Object.freeze({
    providerId,
    requirements: Object.freeze(
      PRODUCTION_CARD_ISSUER_REQUIREMENTS.map((requirement) =>
        Object.freeze({
          requirement,
          satisfied: false as const,
          notes: 'production card-issuing credentials and provider contract required',
        }),
      ),
    ),
    liveEnabled: false,
    sandboxAvailable: false,
  });
}

export class ProductionRestrictedCardIssuerShell implements RestrictedCardIssuerPort {
  readonly providerId: string;
  readonly lifecycle = 'PRODUCTION' as const;
  readonly controlSupport = PRODUCTION_SHELL_CONTROL_SUPPORT;

  constructor(providerId: string = 'BLOCKED_PENDING_PROVIDER') {
    this.providerId = providerId;
  }

  issueRestrictedCard(_input: RestrictedCardIssueInput): RestrictedCardIssueResult {
    void _input;
    return { ok: false, code: 'PROVIDER_BLOCKED' };
  }

  applyControls(_providerCardId: string, _controls: AccessCardControls): IssuerSafeCardMetadata | undefined {
    void _providerCardId;
    void _controls;
    return undefined;
  }

  disableCard(_providerCardId: string): IssuerSafeCardMetadata | undefined {
    void _providerCardId;
    return undefined;
  }

  checklist(): ProductionCardIssuerChecklist {
    return productionCardIssuerChecklist(this.providerId);
  }
}
