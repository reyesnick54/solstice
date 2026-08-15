import { EPHEMERAL_PLAINTEXT_GUARANTEE } from './taxonomy.ts';
import type { EphemeralRow } from './compute.ts';

/**
 * In-process working set. Not a durable store. Not a TEE/HSM.
 */
export class EphemeralWorkspace {
  private rows: EphemeralRow[] | null = [];

  add(row: EphemeralRow): void {
    if (!this.rows) {
      throw new Error('workspace already released');
    }
    this.rows.push(row);
  }

  snapshot(): readonly EphemeralRow[] {
    return Object.freeze([...(this.rows ?? [])]);
  }

  release(): void {
    this.rows = null;
  }

  released(): boolean {
    return this.rows === null;
  }

  guarantee(): string {
    return EPHEMERAL_PLAINTEXT_GUARANTEE;
  }
}
