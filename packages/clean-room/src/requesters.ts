import { RECIPIENT_EXTERNAL_RESEARCH, RECIPIENT_EXTERNAL_RESEARCH_BETA } from '../../consent/src/recipients.ts';
import { requesterIdFor, type CleanRoomRequesterId } from './ids.ts';
import type { CleanRoomRequester } from './types.ts';

export const REQUESTER_RESEARCH_ALPHA = requesterIdFor('research_alpha');
export const REQUESTER_RESEARCH_BETA = requesterIdFor('research_beta');

const FIXTURES: readonly CleanRoomRequester[] = Object.freeze([
  Object.freeze({
    requesterId: REQUESTER_RESEARCH_ALPHA,
    recipientId: RECIPIENT_EXTERNAL_RESEARCH,
    actorSubjectId: '',
    label: 'Simulated SunRey research partner Alpha',
    simulationFixture: true,
    liveEnterprise: false,
    canBrowseVault: false,
    canObtainKeys: false,
    canRunArbitrarySql: false,
  }),
  Object.freeze({
    requesterId: REQUESTER_RESEARCH_BETA,
    recipientId: RECIPIENT_EXTERNAL_RESEARCH_BETA,
    actorSubjectId: '',
    label: 'Simulated SunRey research partner Beta',
    simulationFixture: true,
    liveEnterprise: false,
    canBrowseVault: false,
    canObtainKeys: false,
    canRunArbitrarySql: false,
  }),
]);

export class RequesterRegistry {
  private readonly records = new Map<string, CleanRoomRequester>();

  constructor(seed: readonly CleanRoomRequester[] = FIXTURES) {
    for (const record of seed) {
      this.records.set(record.requesterId, record);
    }
  }

  bindActor(requesterId: CleanRoomRequesterId, actorSubjectId: string): CleanRoomRequester {
    const current = this.records.get(requesterId);
    if (!current) {
      throw new Error('unknown requester');
    }
    const bound = Object.freeze({ ...current, actorSubjectId });
    this.records.set(requesterId, bound);
    return bound;
  }

  get(id: string): CleanRoomRequester | undefined {
    return this.records.get(id);
  }

  byActor(actorSubjectId: string): CleanRoomRequester | undefined {
    return [...this.records.values()].find((row) => row.actorSubjectId === actorSubjectId);
  }

  list(): readonly CleanRoomRequester[] {
    return Object.freeze([...this.records.values()]);
  }
}
