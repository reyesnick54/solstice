/**
 * Optional local address-book metadata.
 *
 * Labels are display metadata only. The address / account ID remains
 * the authoritative identity.
 */

import type { AddressBookEntry } from './types.ts';

export class AddressBook {
  private readonly entries = new Map<string, AddressBookEntry>();

  set(addressText: string, label: string, note = ''): AddressBookEntry {
    const entry = Object.freeze({ addressText, label, note });
    this.entries.set(addressText, entry);
    return entry;
  }

  get(addressText: string): AddressBookEntry | null {
    return this.entries.get(addressText) ?? null;
  }

  list(): readonly AddressBookEntry[] {
    return [...this.entries.values()];
  }

  resolve(label: string): string | null {
    const found = [...this.entries.values()].find((entry) => entry.label === label);
    return found?.addressText ?? null;
  }
}
