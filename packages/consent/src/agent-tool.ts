import { err, ok, type Result } from '../../domain/src/result.ts';
import type { DataAssetId } from '../../personal-data-vault/src/ids.ts';
import type { PersonalDataVault } from '../../personal-data-vault/src/service.ts';
import { RECIPIENT_PERSONAL_AGENT } from './recipients.ts';
import type { ConsentFailure } from './types.ts';
import type { ConsentService } from './service.ts';

export type DerivedIncomeSummary = {
  readonly kind: 'DERIVED_MONTHLY_INCOME_SUMMARY';
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly netMinor: string;
  readonly currency: string;
  readonly sourceAssetId: string;
  readonly permitId: string;
  readonly purposeVersion: string;
  readonly consentVersion: string;
};

/**
 * Purpose-scoped tool. The Personal Economy Agent never receives vault DB
 * credentials. Raw payroll documents and receipts stay out of scope unless
 * the exact consent version names them.
 */
export class PurposeScopedVaultTool {
  constructor(
    private readonly consent: ConsentService,
    private readonly vault: PersonalDataVault,
  ) {}

  readDerivedMonthlyIncome(
    actor: unknown,
    input: { readonly subjectId: string; readonly assetId: DataAssetId },
  ): Result<DerivedIncomeSummary, ConsentFailure> {
    const issued = this.consent.issuePermit(actor, {
      subjectId: input.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: input.assetId,
      category: 'PAYROLL_DATA',
      fields: ['netMinor', 'currency', 'periodStart', 'periodEnd'],
      operation: 'DERIVE',
      derivationType: 'DERIVED_ONLY',
    });
    if (!issued.ok) {
      return issued;
    }
    const payload = this.vault.readForAuthorizedUse(actor, {
      subjectId: input.subjectId,
      assetId: input.assetId,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      useClass: 'INTERNAL_SYSTEM',
      operation: 'READ_MINIMIZED',
      requestedScope: 'derive:monthly_income_summary',
      fields: ['netMinor', 'currency', 'periodStart', 'periodEnd'],
    });
    if (!payload.ok) {
      return err({ code: payload.error.code as ConsentFailure['code'], message: payload.error.message });
    }
    const body = payload.value as {
      periodStart?: string;
      periodEnd?: string;
      netMinor?: string;
      currency?: string;
    };
    return ok({
      kind: 'DERIVED_MONTHLY_INCOME_SUMMARY',
      periodStart: body.periodStart ?? '',
      periodEnd: body.periodEnd ?? '',
      netMinor: body.netMinor ?? '0',
      currency: body.currency ?? 'USD',
      sourceAssetId: input.assetId,
      permitId: issued.value.permit.permitId,
      purposeVersion: issued.value.permit.purposeVersion,
      consentVersion: issued.value.permit.consentVersion,
    });
  }

  readRawReceipt(
    actor: unknown,
    input: { readonly subjectId: string; readonly assetId: DataAssetId },
  ): Result<never, ConsentFailure> {
    const issued = this.consent.issuePermit(actor, {
      subjectId: input.subjectId,
      recipientId: RECIPIENT_PERSONAL_AGENT,
      purposeRef: 'PERSONAL_AGENT_ANALYSIS',
      resourceId: input.assetId,
      category: 'RECEIPT',
      operation: 'READ',
      derivationType: 'RAW',
    });
    if (!issued.ok) {
      return issued;
    }
    return err({
      code: 'RESOURCE_OUT_OF_SCOPE',
      message: 'raw receipt access is outside the derived-income consent scope',
    });
  }
}
