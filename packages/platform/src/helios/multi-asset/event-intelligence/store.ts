/**
 * In-memory macro event intelligence store with snapshot/restore.
 */

import type { MacroEventArtifact, MacroEventImpact, MacroEventInferenceProposal, MacroEventStoreSnapshot, SealedMacroEvent, EventBlackoutWindow } from './types.ts';

export type MacroEventIntelligenceStore = {
  readonly put: (sealed: SealedMacroEvent) => void;
  readonly update: (eventId: string, artifact: MacroEventArtifact) => void;
  readonly get: (eventId: string) => SealedMacroEvent | undefined;
  readonly list: () => readonly SealedMacroEvent[];
  readonly putImpact: (impact: MacroEventImpact) => void;
  readonly getImpact: (impactId: string) => MacroEventImpact | undefined;
  readonly listImpacts: () => readonly MacroEventImpact[];
  readonly putProposal: (proposal: MacroEventInferenceProposal) => void;
  readonly listProposals: () => readonly MacroEventInferenceProposal[];
  readonly putBlackout: (blackout: EventBlackoutWindow) => void;
  readonly listBlackouts: () => readonly EventBlackoutWindow[];
  readonly snapshot: () => MacroEventStoreSnapshot;
  readonly restore: (snapshot: MacroEventStoreSnapshot) => void;
};

export function createMacroEventIntelligenceStore(): MacroEventIntelligenceStore {
  const events = new Map<string, SealedMacroEvent>();
  const impacts = new Map<string, MacroEventImpact>();
  const proposals = new Map<string, MacroEventInferenceProposal>();
  const blackouts = new Map<string, EventBlackoutWindow>();

  return Object.freeze({
    put(sealed) {
      events.set(sealed.artifact.eventId, Object.freeze(sealed));
    },
    update(eventId, artifact) {
      const existing = events.get(eventId);
      if (!existing) return;
      events.set(eventId, Object.freeze({ artifact, sealedAt: existing.sealedAt }));
    },
    get(eventId) {
      return events.get(eventId);
    },
    list() {
      return Object.freeze([...events.values()]);
    },
    putImpact(impact) {
      impacts.set(impact.impactId, Object.freeze(impact));
    },
    getImpact(impactId) {
      return impacts.get(impactId);
    },
    listImpacts() {
      return Object.freeze([...impacts.values()]);
    },
    putProposal(proposal) {
      proposals.set(proposal.proposalId, Object.freeze(proposal));
    },
    listProposals() {
      return Object.freeze([...proposals.values()]);
    },
    putBlackout(blackout) {
      blackouts.set(blackout.blackoutId, Object.freeze(blackout));
    },
    listBlackouts() {
      return Object.freeze([...blackouts.values()]);
    },
    snapshot() {
      return Object.freeze({
        events: Object.freeze([...events.values()]),
        impacts: Object.freeze([...impacts.values()]),
        proposals: Object.freeze([...proposals.values()]),
        blackouts: Object.freeze([...blackouts.values()]),
      });
    },
    restore(snapshot) {
      events.clear();
      impacts.clear();
      proposals.clear();
      blackouts.clear();
      for (const sealed of snapshot.events) events.set(sealed.artifact.eventId, Object.freeze(sealed));
      for (const impact of snapshot.impacts) impacts.set(impact.impactId, Object.freeze(impact));
      for (const proposal of snapshot.proposals) proposals.set(proposal.proposalId, Object.freeze(proposal));
      for (const blackout of snapshot.blackouts) blackouts.set(blackout.blackoutId, Object.freeze(blackout));
    },
  });
}
