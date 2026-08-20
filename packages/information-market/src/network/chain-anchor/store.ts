import type { ChainOperationId } from '../../../../sunrey-chain/src/ids.ts';
import type { HumanInformationAnchorReconciliationId } from './ids.ts';
import type {
  HinAnchorKind,
  HumanInformationAnchor,
  HumanInformationAnchorId,
  HumanInformationAnchorReconciliation,
  HumanInformationConsentAnchorProjection,
  HumanInformationRevocationAnchorProjection,
  HumanInformationUsageAnchorProjection,
} from './types.ts';

export type AnchorViewMeta = {
  readonly requesterId: string | null;
  readonly subjectHandle: string;
  readonly priorConsentCommitment: string | null;
};

export class HumanInformationAnchorStore {
  readonly views = new Map<HumanInformationAnchorId, HumanInformationAnchor>();
  readonly meta = new Map<HumanInformationAnchorId, AnchorViewMeta>();
  readonly bySource = new Map<string, HumanInformationAnchorId>();
  readonly usageProjections = new Map<string, HumanInformationUsageAnchorProjection>();
  readonly consentProjections = new Map<string, HumanInformationConsentAnchorProjection>();
  readonly revocationProjections = new Map<string, HumanInformationRevocationAnchorProjection>();
  readonly reconciliations: HumanInformationAnchorReconciliation[] = [];
  readonly byOperation = new Map<ChainOperationId, HumanInformationAnchorId>();

  sourceKey(kind: HinAnchorKind, sourceRecordId: string): string {
    return `${kind}:${sourceRecordId}`;
  }

  put(anchor: HumanInformationAnchor): void {
    this.views.set(anchor.anchorId, anchor);
    this.bySource.set(this.sourceKey(anchor.kind, anchor.sourceRecordId), anchor.anchorId);
    if (anchor.operationId) {
      this.byOperation.set(anchor.operationId, anchor.anchorId);
    }
  }

  findBySource(kind: HinAnchorKind, sourceRecordId: string): HumanInformationAnchor | undefined {
    const id = this.bySource.get(this.sourceKey(kind, sourceRecordId));
    return id ? this.views.get(id) : undefined;
  }

  findByOperation(operationId: ChainOperationId): HumanInformationAnchor | undefined {
    const id = this.byOperation.get(operationId);
    return id ? this.views.get(id) : undefined;
  }

  rememberReconciliation(record: HumanInformationAnchorReconciliation): void {
    this.reconciliations.push(record);
    void record.reconciliationId as HumanInformationAnchorReconciliationId;
  }
}
