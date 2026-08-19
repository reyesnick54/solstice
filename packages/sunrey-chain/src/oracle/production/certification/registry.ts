import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { EconomicDataSourceCertificationRecord } from './types.ts';

export type CertificationRegistryRejection = {
  readonly code: 'CERTIFICATION_NOT_FOUND' | 'CERTIFICATION_IMMUTABLE' | 'CERTIFICATION_SUPERSEDED';
  readonly detail: string;
};

/**
 * Versioned certification registry. Historical records are immutable.
 * A new certification supersedes the previous current record for a feed.
 */
export class EconomicDataSourceCertificationRegistry {
  private readonly byId = new Map<string, EconomicDataSourceCertificationRecord>();
  private readonly historyByFeed = new Map<string, string[]>();
  private readonly currentByFeed = new Map<string, string>();

  put(
    record: EconomicDataSourceCertificationRecord,
  ): Result<EconomicDataSourceCertificationRecord, CertificationRegistryRejection> {
    const existing = this.byId.get(record.certificationId);
    if (existing) {
      return err({
        code: 'CERTIFICATION_IMMUTABLE',
        detail: `certification ${record.certificationId} cannot be mutated`,
      });
    }
    const feedKey = feedKeyOf(record);
    const currentId = this.currentByFeed.get(feedKey);
    const stored: EconomicDataSourceCertificationRecord = Object.freeze({
      ...record,
      supersedes: currentId ?? record.supersedes,
      supersededBy: null,
    });
    this.byId.set(stored.certificationId, stored);
    const history = this.historyByFeed.get(feedKey) ?? [];
    this.historyByFeed.set(feedKey, [...history, stored.certificationId]);
    this.currentByFeed.set(feedKey, stored.certificationId);
    return ok(stored);
  }

  get(certificationId: string): EconomicDataSourceCertificationRecord | undefined {
    return this.byId.get(certificationId);
  }

  current(providerId: string, sourceId: string, feedId: string): EconomicDataSourceCertificationRecord | undefined {
    const id = this.currentByFeed.get(`${providerId}:${sourceId}:${feedId}`);
    return id ? this.byId.get(id) : undefined;
  }

  history(providerId: string, sourceId: string, feedId: string): readonly EconomicDataSourceCertificationRecord[] {
    const ids = this.historyByFeed.get(`${providerId}:${sourceId}:${feedId}`) ?? [];
    return ids.map((id) => this.byId.get(id)).filter((row): row is EconomicDataSourceCertificationRecord => row !== undefined);
  }

  list(): readonly EconomicDataSourceCertificationRecord[] {
    return [...this.byId.values()].sort((a, b) => (a.certificationId < b.certificationId ? -1 : 1));
  }
}

function feedKeyOf(record: Pick<EconomicDataSourceCertificationRecord, 'providerId' | 'sourceId' | 'feedId'>): string {
  return `${record.providerId}:${record.sourceId}:${record.feedId}`;
}
