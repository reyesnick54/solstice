import { opsErr, opsOk, type OpsResult, type PeerDescriptor, type PeerPolicy } from './types.ts';

export type PeerScoreEvent = {
  readonly peerId: string;
  readonly delta: number;
  readonly reason: string;
};

export type PeerView = {
  readonly peerId: string;
  readonly kind: PeerDescriptor['kind'];
  readonly score: number;
  readonly bannedUntilMs: number;
  readonly connected: boolean;
};

export class OperatorPeerPolicy {
  readonly policy: PeerPolicy;
  readonly #peers = new Map<string, PeerView>();
  readonly #now: () => number;

  constructor(policy: PeerPolicy, now: () => number = Date.now) {
    this.policy = policy;
    this.#now = now;
  }

  register(peer: PeerDescriptor): OpsResult<PeerView> {
    if (peer.kind === 'SENTRY' && !this.policy.persistentSentryPeers.includes(peer.peerId)) {
      return opsErr('UNSAFE_CONFIG', `sentry ${peer.peerId} is not in the persistent sentry set`);
    }
    if (peer.kind === 'PRIVATE' && !this.policy.allowedPrivatePeers.includes(peer.peerId)) {
      return opsErr('UNSAFE_CONFIG', `private peer ${peer.peerId} is not allowed`);
    }
    const view: PeerView = {
      peerId: peer.peerId,
      kind: peer.kind,
      score: 50,
      bannedUntilMs: 0,
      connected: false,
    };
    this.#peers.set(peer.peerId, view);
    return opsOk(view);
  }

  connect(peerId: string): OpsResult<PeerView> {
    const peer = this.#peers.get(peerId);
    if (!peer) {
      return opsErr('UNSAFE_CONFIG', `unknown peer ${peerId}`);
    }
    if (peer.bannedUntilMs > this.#now()) {
      return opsErr('UNSAFE_CONFIG', `peer ${peerId} is temporarily banned`);
    }
    const connected = [...this.#peers.values()].filter((row) => row.connected).length;
    if (connected >= this.policy.maxConnections) {
      return opsErr('UNSAFE_CONFIG', 'maximum peer connections reached');
    }
    const next = { ...peer, connected: true };
    this.#peers.set(peerId, next);
    return opsOk(next);
  }

  score(event: PeerScoreEvent): OpsResult<PeerView> {
    const peer = this.#peers.get(event.peerId);
    if (!peer) {
      return opsErr('UNSAFE_CONFIG', `unknown peer ${event.peerId}`);
    }
    const score = Math.max(0, peer.score + event.delta);
    const bannedUntilMs = score < this.policy.scoreThreshold ? this.#now() + this.policy.temporaryBanMs : 0;
    const next = { ...peer, score, bannedUntilMs, connected: bannedUntilMs === 0 ? peer.connected : false };
    this.#peers.set(event.peerId, next);
    return opsOk(next);
  }

  diversityWarning(): string | null {
    const connectedSentries = [...this.#peers.values()].filter(
      (peer) => peer.kind === 'SENTRY' && peer.connected,
    ).length;
    if (connectedSentries < this.policy.diversityWarnBelow) {
      return `peer diversity warning: ${connectedSentries} connected sentry path(s)`;
    }
    return null;
  }

  applyVotingPowerChange(): OpsResult<never> {
    return opsErr(
      'PEER_CANNOT_CHANGE_VOTING_POWER',
      'peer configuration cannot change consensus voting power',
    );
  }

  snapshot(): readonly PeerView[] {
    return [...this.#peers.values()].map((peer) => Object.freeze({ ...peer }));
  }
}
