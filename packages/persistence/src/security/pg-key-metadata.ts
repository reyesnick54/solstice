import type { Pool } from 'pg';

import type { KeyMetadata } from '../../../security/src/metadata.ts';
import type { KeyPurpose } from '../../../security/src/purposes.ts';
import type { KeyStatus } from '../../../security/src/lifecycle.ts';
import type { KeyMetadataStore } from '../../../security/src/store.ts';
import { withClient } from '../postgres/pools.ts';

export class PostgresKeyMetadataStore implements KeyMetadataStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async upsert(metadata: KeyMetadata): Promise<void> {
    await withClient(this.pool, (client) =>
      client.query(
        `INSERT INTO security.key_metadata (
           key_id, purpose, algorithm, version, status, created_at, activated_at,
           retired_at, revoked_at, provider, public_material, provider_ref
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (key_id, version) DO UPDATE SET
           status = EXCLUDED.status,
           activated_at = EXCLUDED.activated_at,
           retired_at = EXCLUDED.retired_at,
           revoked_at = EXCLUDED.revoked_at,
           public_material = EXCLUDED.public_material,
           provider_ref = EXCLUDED.provider_ref`,
        [
          metadata.keyId,
          metadata.purpose,
          metadata.algorithm,
          metadata.version,
          metadata.status,
          metadata.createdAt,
          metadata.activatedAt,
          metadata.retiredAt,
          metadata.revokedAt,
          metadata.provider,
          metadata.publicMaterial,
          metadata.providerRef,
        ],
      ),
    );
  }

  async list(purpose?: string): Promise<readonly KeyMetadata[]> {
    return withClient(this.pool, async (client) => {
      const result = purpose
        ? await client.query(
            `SELECT key_id, purpose, algorithm, version, status, created_at, activated_at,
                    retired_at, revoked_at, provider, public_material, provider_ref
               FROM security.key_metadata WHERE purpose = $1 ORDER BY key_id, version`,
            [purpose],
          )
        : await client.query(
            `SELECT key_id, purpose, algorithm, version, status, created_at, activated_at,
                    retired_at, revoked_at, provider, public_material, provider_ref
               FROM security.key_metadata ORDER BY key_id, version`,
          );
      return result.rows.map((row) => ({
        keyId: row.key_id as string,
        purpose: row.purpose as KeyPurpose,
        algorithm: row.algorithm as KeyMetadata['algorithm'],
        version: Number(row.version),
        status: row.status as KeyStatus,
        createdAt: new Date(row.created_at as string | Date).toISOString(),
        activatedAt: row.activated_at
          ? new Date(row.activated_at as string | Date).toISOString()
          : null,
        retiredAt: row.retired_at ? new Date(row.retired_at as string | Date).toISOString() : null,
        revokedAt: row.revoked_at ? new Date(row.revoked_at as string | Date).toISOString() : null,
        provider: row.provider as string,
        publicMaterial: (row.public_material as string | null) ?? null,
        providerRef: row.provider_ref as string,
      }));
    });
  }
}
