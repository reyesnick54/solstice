import { ok, type Result } from '../../../../domain/src/result.ts';
import type {
  DataAssetContributionProjection,
  DataAssetContributionProjectionPort,
  HinContributionFailure,
  HumanContributionRecord,
} from './contract.ts';

/**
 * Authorized internal projection of verified contribution IDs.
 * This is not a second registry and does not store raw content.
 */
export class HinContributionProjection {
  private readonly byContribution = new Map<string, HumanContributionRecord>();
  private readonly byReceipt = new Map<string, string>();
  private readonly byDescriptor = new Map<string, string[]>();
  private readonly bySubject = new Map<string, string[]>();

  remember(record: HumanContributionRecord): void {
    this.byContribution.set(record.contributionId, record);
    this.byReceipt.set(record.evidence.usageReceiptId, record.contributionId);
    const descriptorIds = this.byDescriptor.get(record.evidence.descriptorId) ?? [];
    descriptorIds.push(record.contributionId);
    this.byDescriptor.set(record.evidence.descriptorId, descriptorIds);
    const subjectIds = this.bySubject.get(record.evidence.subjectPseudonymousRef) ?? [];
    subjectIds.push(record.contributionId);
    this.bySubject.set(record.evidence.subjectPseudonymousRef, subjectIds);
  }

  byContributionId(contributionId: string): HumanContributionRecord | undefined {
    return this.byContribution.get(contributionId);
  }

  byUsageReceiptId(usageReceiptId: string): string | undefined {
    return this.byReceipt.get(usageReceiptId);
  }

  byDescriptorId(descriptorId: string): readonly string[] {
    return this.byDescriptor.get(descriptorId) ?? [];
  }

  bySubjectPseudonymousRef(subjectPseudonymousRef: string): readonly string[] {
    return this.bySubject.get(subjectPseudonymousRef) ?? [];
  }
}

export function createInMemoryDataAssetProjection(): DataAssetContributionProjectionPort {
  const rows = new Map<string, DataAssetContributionProjection>();
  return {
    attachContributionReference(
      projection: DataAssetContributionProjection,
    ): Result<DataAssetContributionProjection, HinContributionFailure> {
      const stored = Object.freeze({ ...projection, canonicalRefOnly: true as const, rawContentIncluded: false as const });
      rows.set(`${projection.descriptorId}:${projection.contributionId}`, stored);
      return ok(stored);
    },
  };
}
