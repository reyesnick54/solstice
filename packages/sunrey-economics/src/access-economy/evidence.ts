/**
 * Access Economy simulation evidence.
 *
 * Uses the canonical hash-chained Evidence Vault from packages/evidence.
 * This is not a second vault, and it is not a ledger: no balance, no
 * posting, and no monetary unit is written here.
 */

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault, GENESIS_PREV_SHA256, type EvidenceRecord } from '../../../evidence/src/index.ts';
import {
  ACCESS_ECONOMY_EVIDENCE_KINDS,
  FORBIDDEN_ACCESS_EVIDENCE_KEYS,
  type AccessEconomyEvidenceKind,
} from './ids.ts';
import { ACCESS_SIM_EPOCH_START } from './capacity.ts';
import type { AccessEvidenceSummary } from './types.ts';

const FORBIDDEN_KEYS = new Set<string>(FORBIDDEN_ACCESS_EVIDENCE_KEYS);

/**
 * A payload that carries a forbidden sensitive key never reaches the chain.
 * The simulation fails loudly rather than sealing it.
 */
export function assertSealablePayload(payload: unknown, path = '$'): void {
  if (payload === null || typeof payload !== 'object') {
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertSealablePayload(item, `${path}[${index}]`));
    return;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key) && value !== false) {
      throw new Error(`forbidden sensitive key '${key}' cannot be sealed into access evidence at ${path}`);
    }
    assertSealablePayload(value, `${path}.${key}`);
  }
}

/**
 * Deterministic, replayable evidence journal for one scenario run. The
 * clock advances by a fixed step so the same seed yields the same chain.
 */
export class AccessSimulationEvidence {
  private readonly vault: EvidenceVault;
  private readonly clock: FrozenClock;
  private readonly kinds: AccessEconomyEvidenceKind[] = [];
  private consequential = 0;

  constructor() {
    this.clock = new FrozenClock(asUtcInstant(ACCESS_SIM_EPOCH_START));
    this.vault = new EvidenceVault(this.clock);
  }

  seal(kind: AccessEconomyEvidenceKind, payload: unknown, consequential = false): EvidenceRecord {
    if (!ACCESS_ECONOMY_EVIDENCE_KINDS.includes(kind)) {
      throw new Error(`unknown access evidence kind ${kind}`);
    }
    assertSealablePayload(payload);
    const record = this.vault.seal(kind, payload);
    this.kinds.push(kind);
    if (consequential) {
      this.consequential += 1;
    }
    this.clock.advanceMs(1_000n);
    return record;
  }

  records(): readonly EvidenceRecord[] {
    return this.vault.list();
  }

  summary(): AccessEvidenceSummary {
    const verified = this.vault.verifyChain();
    const records = this.vault.list();
    const head = records.length === 0 ? GENESIS_PREV_SHA256 : records[records.length - 1]!.recordSha256;
    return Object.freeze({
      kinds: Object.freeze([...new Set(this.kinds)]),
      recordCount: records.length,
      chainVerified: verified.ok === true && verified.length === records.length,
      headRecordSha256: head,
      consequentialTransitions: this.consequential,
      sealedConsequentialTransitions: this.consequential,
      forbiddenKeysPresent: false,
    });
  }
}
