import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ReviewActorKind } from '../types.ts';
import { JURISDICTION_CAPABILITY_POLICY_VERSION } from './taxonomy.ts';
import type {
  HeliosJurisdictionId,
  JurisdictionCapabilityState,
} from './taxonomy.ts';
import { isJurisdictionCapabilityState } from './taxonomy.ts';
import type {
  JurisdictionCapabilityDefinition,
  JurisdictionCapabilityPack,
} from './types.ts';

export class JurisdictionCapabilityRegistry {
  private readonly packs = new Map<HeliosJurisdictionId, JurisdictionCapabilityPack>();
  private readonly capabilities = new Map<string, JurisdictionCapabilityDefinition>();
  private readonly versionHistory = new Map<HeliosJurisdictionId, readonly string[]>();
  private activeVersions = new Map<HeliosJurisdictionId, string>();

  hydrate(packs: readonly JurisdictionCapabilityPack[]): void {
    for (const pack of packs) {
      this.putPack(pack);
    }
  }

  putPack(pack: JurisdictionCapabilityPack): void {
    this.packs.set(pack.packId, Object.freeze({ ...pack, capabilities: Object.freeze([...pack.capabilities]) }));
    this.activeVersions.set(pack.packId, pack.packVersion);
    const history = this.versionHistory.get(pack.packId) ?? [];
    if (!history.includes(pack.packVersion)) {
      this.versionHistory.set(pack.packId, Object.freeze([...history, pack.packVersion]));
    }
    for (const capability of pack.capabilities) {
      this.capabilities.set(capability.capabilityId, Object.freeze({ ...capability }));
    }
  }

  getPack(jurisdictionId: HeliosJurisdictionId): JurisdictionCapabilityPack | null {
    return this.packs.get(jurisdictionId) ?? null;
  }

  listPacks(): readonly JurisdictionCapabilityPack[] {
    return Object.freeze([...this.packs.values()]);
  }

  activeVersion(jurisdictionId: HeliosJurisdictionId): string | null {
    return this.activeVersions.get(jurisdictionId) ?? null;
  }

  versionHistoryFor(jurisdictionId: HeliosJurisdictionId): readonly string[] {
    return this.versionHistory.get(jurisdictionId) ?? Object.freeze([]);
  }

  findCapability(input: {
    readonly jurisdictionId: HeliosJurisdictionId;
    readonly legalEntityId: string;
    readonly action: JurisdictionCapabilityDefinition['action'];
    readonly customerClass: string;
    readonly environment: 'simulation' | 'live';
    readonly overlayId: string | null;
    readonly at: UtcInstant;
  }): JurisdictionCapabilityDefinition | null {
    const candidates = [...this.capabilities.values()].filter((row) => {
      if (row.jurisdictionId !== input.jurisdictionId) return false;
      if (row.action !== input.action) return false;
      if (row.environment !== input.environment) return false;
      if (row.legalEntityId !== input.legalEntityId) return false;
      if ((row.customerClass ?? 'RETAIL') !== input.customerClass) return false;
      if (input.overlayId !== null && row.overlayId !== input.overlayId) return false;
      if (input.overlayId === null && row.overlayId !== null) return false;
      if (Date.parse(input.at) < Date.parse(row.effectiveFrom)) return false;
      if (row.effectiveUntil && Date.parse(input.at) >= Date.parse(row.effectiveUntil)) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => specificityRank(b.status) - specificityRank(a.status))[0] ?? null;
  }

  /**
   * Human-only activation path. AI actors cannot promote to APPROVED_FOR_PRODUCTION.
   */
  updateCapabilityStatus(input: {
    readonly capabilityId: string;
    readonly status: JurisdictionCapabilityState;
    readonly actorKind: ReviewActorKind;
    readonly at: UtcInstant;
    readonly policyVersion: string;
  }): JurisdictionCapabilityDefinition {
    if (input.status === 'APPROVED_FOR_PRODUCTION' && input.actorKind !== 'HUMAN_OPERATOR') {
      throw new Error('AI cannot set APPROVED_FOR_PRODUCTION');
    }
    if (!isJurisdictionCapabilityState(input.status)) {
      throw new Error(`invalid capability status ${input.status}`);
    }
    const existing = this.capabilities.get(input.capabilityId);
    if (!existing) {
      throw new Error(`unknown capability ${input.capabilityId}`);
    }
    const updated = Object.freeze({
      ...existing,
      status: input.status,
      policyVersion: input.policyVersion,
      updatedAt: input.at,
    });
    this.capabilities.set(input.capabilityId, updated);
    return updated;
  }

  activatePackVersion(jurisdictionId: HeliosJurisdictionId, packVersion: string): void {
    const pack = this.packs.get(jurisdictionId);
    if (!pack || pack.packVersion !== packVersion) {
      throw new Error(`cannot activate unknown pack version ${jurisdictionId}@${packVersion}`);
    }
    this.activeVersions.set(jurisdictionId, packVersion);
  }

  snapshot(): {
    readonly packs: readonly JurisdictionCapabilityPack[];
    readonly activePackVersions: Readonly<Record<string, string>>;
  } {
    const active: Record<string, string> = {};
    for (const [id, version] of this.activeVersions.entries()) {
      active[id] = version;
    }
    return Object.freeze({
      packs: Object.freeze([...this.packs.values()]),
      activePackVersions: Object.freeze(active),
    });
  }
}

const STATUS_SPECIFICITY: Readonly<Record<JurisdictionCapabilityState, number>> = Object.freeze({
  REVOKED: 100,
  SUSPENDED: 95,
  DISABLED: 90,
  PARTNER_DEPENDENT: 85,
  RESTRICTED: 80,
  SANDBOX_ONLY: 75,
  APPROVED_FOR_PRODUCTION: 70,
  APPROVED_FOR_TEST: 65,
  LEGAL_REVIEW_REQUIRED: 50,
  RESEARCH_REQUIRED: 40,
  UNMAPPED: 10,
});

function specificityRank(status: JurisdictionCapabilityState): number {
  return STATUS_SPECIFICITY[status] ?? 0;
}

export function createJurisdictionCapabilityRegistry(
  packs: readonly JurisdictionCapabilityPack[],
): JurisdictionCapabilityRegistry {
  const registry = new JurisdictionCapabilityRegistry();
  registry.hydrate(packs);
  for (const pack of packs) {
    registry.activatePackVersion(pack.packId, pack.packVersion);
  }
  return registry;
}

export { JURISDICTION_CAPABILITY_POLICY_VERSION };
