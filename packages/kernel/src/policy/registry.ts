import type { PolicyPackId, PolicyVersionRecord, SourceReference } from './types.ts';
import type { LegalEntityCapability, PolicyPack, PolicyProductBinding } from './types.ts';
import { hashCanonical } from './hash.ts';

export type PolicyEventRecord = {
  readonly eventType:
    | 'PolicyPackActivated'
    | 'PolicyPackRetired'
    | 'PolicyReviewRequested'
    | 'PolicyReviewDecided';
  readonly schemaVersion: 1;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, string | null>>;
};

export type PolicyEventSink = {
  record(event: PolicyEventRecord): void;
};

export class PolicyRegistry {
  private readonly packs = new Map<PolicyPackId, PolicyPack>();
  private readonly versions = new Map<string, PolicyVersionRecord>();
  private readonly capabilities = new Map<string, LegalEntityCapability>();
  private readonly products = new Map<string, PolicyProductBinding>();
  private readonly sources = new Map<string, SourceReference>();
  private readonly usedVersionIds = new Set<string>();

  hydrate(input: {
    readonly packs?: readonly PolicyPack[];
    readonly versions?: readonly PolicyVersionRecord[];
    readonly capabilities?: readonly LegalEntityCapability[];
    readonly products?: readonly PolicyProductBinding[];
    readonly sources?: readonly SourceReference[];
    readonly usedVersionIds?: readonly string[];
  }): void {
    for (const pack of input.packs ?? []) {
      this.packs.set(pack.packId, freezePack(pack));
    }
    for (const version of input.versions ?? []) {
      this.versions.set(version.versionId, freezeVersion(version));
    }
    for (const pack of this.packs.values()) {
      for (const version of pack.versions) {
        this.versions.set(version.versionId, freezeVersion(version));
      }
    }
    for (const capability of input.capabilities ?? []) {
      this.capabilities.set(capability.capabilityId, Object.freeze({ ...capability }));
    }
    for (const product of input.products ?? []) {
      this.products.set(product.productId, Object.freeze({ ...product }));
    }
    for (const source of input.sources ?? []) {
      this.sources.set(source.sourceId, Object.freeze({ ...source }));
    }
    for (const id of input.usedVersionIds ?? []) {
      this.usedVersionIds.add(id);
    }
  }

  putPack(pack: PolicyPack): void {
    this.packs.set(pack.packId, freezePack(pack));
    for (const version of pack.versions) {
      this.putVersion(version);
    }
  }

  activatePack(
    packId: PolicyPackId,
    versionId: string,
    occurredAt: string,
    events?: PolicyEventSink,
  ): void {
    const version = this.versions.get(versionId);
    if (!version || version.packId !== packId) {
      throw new Error(`cannot activate unknown policy version ${versionId}`);
    }
    if (version.lifecycle === 'RETIRED') {
      throw new Error(`cannot activate retired policy version ${versionId}`);
    }
    this.putVersion({ ...version, lifecycle: 'ACTIVE_SIMULATION' });
    events?.record({
      eventType: 'PolicyPackActivated',
      schemaVersion: 1,
      occurredAt,
      payload: {
        packId,
        versionId,
        packHash: version.contentHash,
        lifecycle: 'ACTIVE_SIMULATION',
      },
    });
  }

  retirePack(
    packId: PolicyPackId,
    versionId: string,
    occurredAt: string,
    events?: PolicyEventSink,
  ): void {
    const version = this.versions.get(versionId);
    if (!version || version.packId !== packId) {
      throw new Error(`cannot retire unknown policy version ${versionId}`);
    }
    this.putVersion({ ...version, lifecycle: 'RETIRED' });
    events?.record({
      eventType: 'PolicyPackRetired',
      schemaVersion: 1,
      occurredAt,
      payload: {
        packId,
        versionId,
        packHash: version.contentHash,
        lifecycle: 'RETIRED',
      },
    });
  }

  putVersion(version: PolicyVersionRecord): void {
    const existing = this.versions.get(version.versionId);
    if (existing && this.usedVersionIds.has(existing.versionId)) {
      if (existing.contentHash !== version.contentHash) {
        throw new Error(
          `policy version ${existing.versionId} was used in a decision and cannot change meaning`,
        );
      }
    }
    this.versions.set(version.versionId, freezeVersion(version));
    const pack = this.packs.get(version.packId);
    if (pack) {
      const others = pack.versions.filter((row) => row.versionId !== version.versionId);
      this.packs.set(
        pack.packId,
        freezePack({
          ...pack,
          versions: [...others, version],
        }),
      );
    }
  }

  markUsed(versionId: string): void {
    this.usedVersionIds.add(versionId);
  }

  putCapability(capability: LegalEntityCapability): void {
    this.capabilities.set(capability.capabilityId, Object.freeze({ ...capability }));
  }

  putProductBinding(binding: PolicyProductBinding): void {
    this.products.set(binding.productId, Object.freeze({ ...binding }));
  }

  putSource(source: SourceReference): void {
    this.sources.set(source.sourceId, Object.freeze({ ...source }));
  }

  getPack(packId: PolicyPackId): PolicyPack | undefined {
    return this.packs.get(packId);
  }

  getVersion(versionId: string): PolicyVersionRecord | undefined {
    return this.versions.get(versionId);
  }

  listVersions(packId: PolicyPackId): readonly PolicyVersionRecord[] {
    return [...this.versions.values()].filter((row) => row.packId === packId);
  }

  getCapability(capabilityId: string): LegalEntityCapability | undefined {
    return this.capabilities.get(capabilityId);
  }

  findCapability(input: {
    readonly legalEntityId: string;
    readonly actionType: string;
    readonly productId?: string;
    readonly productType?: string;
    readonly environment: 'simulation' | 'live';
  }): LegalEntityCapability | undefined {
    const matches = [...this.capabilities.values()].filter((row) => {
      if (row.legalEntityId !== input.legalEntityId) {
        return false;
      }
      if (row.environment !== input.environment) {
        return false;
      }
      if (!row.actionTypes.includes(input.actionType)) {
        return false;
      }
      if (input.productId && row.productIds.length > 0 && !row.productIds.includes(input.productId)) {
        return false;
      }
      if (
        input.productType &&
        row.productTypes.length > 0 &&
        !row.productTypes.includes(input.productType)
      ) {
        return false;
      }
      return true;
    });
    return matches[0];
  }

  getProductBinding(productId: string): PolicyProductBinding | undefined {
    return this.products.get(productId);
  }

  getSource(sourceId: string): SourceReference | undefined {
    return this.sources.get(sourceId);
  }

  snapshot(): {
    readonly packs: readonly PolicyPack[];
    readonly versions: readonly PolicyVersionRecord[];
    readonly capabilities: readonly LegalEntityCapability[];
    readonly products: readonly PolicyProductBinding[];
    readonly sources: readonly SourceReference[];
    readonly usedVersionIds: readonly string[];
  } {
    return {
      packs: [...this.packs.values()],
      versions: [...this.versions.values()],
      capabilities: [...this.capabilities.values()],
      products: [...this.products.values()],
      sources: [...this.sources.values()],
      usedVersionIds: [...this.usedVersionIds],
    };
  }
}

function freezePack(pack: PolicyPack): PolicyPack {
  return Object.freeze({
    packId: pack.packId,
    name: pack.name,
    description: pack.description,
    versions: Object.freeze(pack.versions.map(freezeVersion)),
  });
}

function freezeVersion(version: PolicyVersionRecord): PolicyVersionRecord {
  return Object.freeze({
    ...version,
    rules: Object.freeze(version.rules.map((rule) => Object.freeze({ ...rule }))),
  });
}

export function contentHashForRules(version: Omit<PolicyVersionRecord, 'contentHash'>): string {
  return hashCanonical({
    packId: version.packId,
    version: version.version,
    lifecycle: version.lifecycle,
    legalReviewStatus: version.legalReviewStatus,
    effectiveFrom: version.effectiveFrom,
    effectiveUntil: version.effectiveUntil ?? null,
    rules: version.rules,
  });
}
