import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { factTypeIsMappedForSource } from '../../productive/source-taxonomy/registry.ts';
import type { EconomicDataSource, ProductionOracleRejection } from './types.ts';

export class EconomicDataSourceRegistry {
  private readonly sources = new Map<string, EconomicDataSource[]>();

  register(source: EconomicDataSource): Result<EconomicDataSource, ProductionOracleRejection> {
    if (source.sourceId.length === 0 || source.providerId.length === 0) {
      return err({ code: 'INVALID_IDENTIFIER', detail: 'source and provider identifiers are required' });
    }
    if (!factTypeIsMappedForSource(source.category, source.factType)) {
      return err({
        code: 'SCHEMA_INCOMPATIBLE',
        detail: `category ${source.category} does not collect ${source.factType}`,
      });
    }
    if (source.credentialRef === null && source.authenticationMethod !== 'FILE_FIXTURE_TEST_ONLY') {
      return err({ code: 'CREDENTIAL_NOT_ASSIGNED', detail: 'non-fixture sources must reference a SecretReference' });
    }
    const versions = this.sources.get(source.sourceId) ?? [];
    const latest = versions[versions.length - 1];
    if (latest && source.version <= latest.version) {
      return err({ code: 'SCHEMA_INCOMPATIBLE', detail: 'source version must increase' });
    }
    this.sources.set(source.sourceId, [...versions, source]);
    return ok(source);
  }

  get(sourceId: string, version?: number): EconomicDataSource | undefined {
    const versions = this.sources.get(sourceId) ?? [];
    if (version === undefined) {
      return versions[versions.length - 1];
    }
    return versions.find((row) => row.version === version);
  }

  list(): readonly EconomicDataSource[] {
    return [...this.sources.values()]
      .map((rows) => rows[rows.length - 1])
      .filter((row): row is EconomicDataSource => row !== undefined)
      .sort((a, b) => (a.sourceId < b.sourceId ? -1 : 1));
  }

  listByProvider(providerId: string): readonly EconomicDataSource[] {
    return this.list().filter((row) => row.providerId === providerId && !row.retired);
  }
}
