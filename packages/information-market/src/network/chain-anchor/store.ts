import type { ChainOperationId } from '../../../../sunrey-chain/src/ids.ts';
import type {
  HumanInformationAnchorId,
  HumanInformationAnchorReconciliationId,
} from './ids.ts';
import type {
  HumanInformationAnchor,
  HumanInformationAnchorReconciliation,
  HumanInformationConsentAnchorProjection,
  HumanInformationRevocationAnchorProjection,
  HumanInformationUsageAnchorProjection,
} from './types.ts';

export class HumanInformationAnchorStore {
  readonly anchors = new Map<HumanInformationAnchorId, HumanInformationAnchor>();
  readonly bySource = new Map<string, HumanInformationAnchorId>();
  readonly usageProjections = new Map<string, HumanInformationUsageAnchorProjection>();
  readonly consentProjections = new Map<string, HumanInformationConsentAnchorProjection>();
  readonly revocationProjections = new Map<string, HumanInformationRevocationAnchorProjection>();
  readonly reconciliations: HumanInformationAnchorReconciliation[] = [];
  readonly byOperation = new Map<ChainOperationId, HumanInformationAnchorId>();

  sourceKey(kind: HumanInformationAnchor['kind'], sourceRecordId: string): string {
    return `${kind}:${sourceRecordId}`;
  }

  put(anchor: HumanInformationAnchor): void {
    this.anchors.set(anchor.anchorId, anchor);
    this.bySource.set(this.sourceKey(anchor.kind, anchor.sourceRecordId), anchor.anchorId);
    if (anchor.operationId) {
      this.byOperation.set(anchor.operationId, anchor.anchorId);
    }
  }

  findBySource(kind: HumanInformationAnchor['kind'], sourceRecordId: string): HumanInformationAnchor | undefined {
    const id = this.bySource.get(this.sourceKey(kind, sourceRecordId));
    return id ? this.anchors.get(id) : undefined;
  }

  findByOperation(operationId: ChainOperationId): HumanInformationAnchor | undefined {
    const id = this.byOperation.get(operationId);
    return id ? this.anchors.get(id) : undefined;
  }

  rememberReconciliation(record: HumanInformationAnchorReconciliation): void {
    this.reconciliations.push(record);
    void record.reconciliationId as HumanInformationAnchorReconciliationId;
  }
}
