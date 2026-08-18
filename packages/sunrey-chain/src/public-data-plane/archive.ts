import type { ArchiveNode } from './types.ts';

export type ArchiveQuery = {
  readonly fromHeight: number;
  readonly toHeight: number;
  readonly scan: boolean;
};

export type ArchiveQueryResult = {
  readonly ok: boolean;
  readonly nodeId: string | null;
  readonly heights: readonly number[];
  readonly onValidatorCriticalPath: false;
  readonly signingAuthority: false;
  readonly error?: 'ARCHIVE_UNAVAILABLE' | 'RANGE_REJECTED';
};

export class ArchiveQueryService {
  private readonly nodes: ArchiveNode[];
  private readonly history: readonly number[];
  private available = true;

  constructor(input: { readonly nodes?: readonly ArchiveNode[]; readonly historyHeights?: readonly number[] } = {}) {
    this.nodes = [...(input.nodes ?? [developmentArchiveNode()])];
    this.history = input.historyHeights ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }

  nodesWithoutSigningAuthority(): readonly ArchiveNode[] {
    return this.nodes.filter((node) => node.signingAuthority === false && node.onValidatorCriticalPath === false);
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  query(query: ArchiveQuery): ArchiveQueryResult {
    if (!this.available || this.nodes.length === 0) {
      return {
        ok: false,
        nodeId: null,
        heights: [],
        onValidatorCriticalPath: false,
        signingAuthority: false,
        error: 'ARCHIVE_UNAVAILABLE',
      };
    }
    if (query.fromHeight < 0 || query.toHeight < query.fromHeight) {
      return {
        ok: false,
        nodeId: this.nodes[0]?.nodeId ?? null,
        heights: [],
        onValidatorCriticalPath: false,
        signingAuthority: false,
        error: 'RANGE_REJECTED',
      };
    }
    const heights = this.history.filter((height) => height >= query.fromHeight && height <= query.toHeight);
    return {
      ok: true,
      nodeId: this.nodes[0]!.nodeId,
      heights,
      onValidatorCriticalPath: false,
      signingAuthority: false,
    };
  }
}

export function developmentArchiveNode(): ArchiveNode {
  return Object.freeze({
    nodeId: 'archive-1',
    retainsHistoricalData: true,
    signingAuthority: false,
    onValidatorCriticalPath: false,
  });
}
