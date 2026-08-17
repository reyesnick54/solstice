/**
 * Isolated local/testnet network fault simulator.
 * No external hosts, scanning, or internet targets.
 */

import { RANGE_CHAIN_ID, RANGE_NETWORK_ID } from './types.ts';

export const NETWORK_FAULTS = [
  'PARTITION',
  'ASYMMETRIC_PARTITION',
  'LATENCY',
  'PACKET_DUPLICATION',
  'PACKET_REORDER',
  'PACKET_LOSS',
  'PEER_ISOLATION',
  'CONNECTION_CHURN',
  'ECLIPSE_ATTEMPT',
] as const;
export type NetworkFaultKind = (typeof NETWORK_FAULTS)[number];

export type RangePeer = {
  readonly peerId: string;
  readonly role: 'VALIDATOR' | 'SENTRY' | 'RPC' | 'MALICIOUS_PEER';
  readonly validatorId: string | null;
  readonly domainId: string;
  online: boolean;
  readonly allowed: boolean;
};

export type DeliveredMessage = {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly payload: string;
  readonly tick: number;
  readonly duplicated: boolean;
  readonly reordered: boolean;
};

export class IsolatedRangeNetwork {
  readonly networkId = RANGE_NETWORK_ID;
  readonly chainId = RANGE_CHAIN_ID;
  readonly peers: RangePeer[] = [];
  readonly inbox: DeliveredMessage[] = [];
  readonly alerts: string[] = [];
  readonly dropped: number[] = [];
  partitions = new Map<string, Set<string>>();
  latencyTicks = 0;
  lossBps = 0;
  duplicate = false;
  reorder = false;
  private tick = 0;
  private readonly rng: () => number;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    const domains = ['fd_alpha', 'fd_bravo', 'fd_charlie'] as const;
    const validatorIds = ['val_range_a', 'val_range_b', 'val_range_c', 'val_range_d', 'val_range_e', 'val_range_f', 'val_range_g'];
    for (let i = 0; i < validatorIds.length; i += 1) {
      const validatorId = validatorIds[i]!;
      const domainId = domains[i < 3 ? 0 : i < 5 ? 1 : 2]!;
      this.peers.push({
        peerId: `peer.${validatorId}`,
        role: 'VALIDATOR',
        validatorId,
        domainId,
        online: true,
        allowed: true,
      });
      this.peers.push({
        peerId: `sentry.${validatorId}.1`,
        role: 'SENTRY',
        validatorId,
        domainId,
        online: true,
        allowed: true,
      });
      this.peers.push({
        peerId: `sentry.${validatorId}.2`,
        role: 'SENTRY',
        validatorId,
        domainId,
        online: true,
        allowed: true,
      });
    }
    this.peers.push({
      peerId: 'rpc.public.1',
      role: 'RPC',
      validatorId: null,
      domainId: 'fd_alpha',
      online: true,
      allowed: true,
    });
    this.peers.push({
      peerId: 'peer.malicious.1',
      role: 'MALICIOUS_PEER',
      validatorId: null,
      domainId: 'fd_untrusted',
      online: true,
      allowed: false,
    });
    this.peers.push({
      peerId: 'peer.malicious.2',
      role: 'MALICIOUS_PEER',
      validatorId: null,
      domainId: 'fd_untrusted',
      online: true,
      allowed: true,
    });
  }

  applyFault(kind: NetworkFaultKind, targetId?: string): void {
    if (kind === 'PARTITION') {
      const left = new Set(this.peers.filter((peer) => peer.domainId === 'fd_alpha').map((peer) => peer.peerId));
      const right = new Set(this.peers.filter((peer) => peer.domainId !== 'fd_alpha').map((peer) => peer.peerId));
      this.partitions.set('left', left);
      this.partitions.set('right', right);
      this.alerts.push('NETWORK_PARTITION');
      return;
    }
    if (kind === 'ASYMMETRIC_PARTITION') {
      const isolated = targetId ?? 'peer.val_range_a';
      this.partitions.set('asymmetric', new Set([isolated]));
      this.alerts.push('ASYMMETRIC_PARTITION');
      return;
    }
    if (kind === 'LATENCY') {
      this.latencyTicks = 3;
      this.alerts.push('NETWORK_LATENCY');
      return;
    }
    if (kind === 'PACKET_DUPLICATION') {
      this.duplicate = true;
      this.alerts.push('PACKET_DUPLICATION');
      return;
    }
    if (kind === 'PACKET_REORDER') {
      this.reorder = true;
      this.alerts.push('PACKET_REORDER');
      return;
    }
    if (kind === 'PACKET_LOSS') {
      this.lossBps = 2_000;
      this.alerts.push('PACKET_LOSS');
      return;
    }
    if (kind === 'PEER_ISOLATION') {
      const peer = this.peers.find((row) => row.peerId === (targetId ?? 'peer.val_range_g'));
      if (peer) {
        peer.online = false;
      }
      this.alerts.push('VALIDATOR_PEER_ISOLATION');
      return;
    }
    if (kind === 'CONNECTION_CHURN') {
      for (const peer of this.peers.filter((row) => row.role === 'SENTRY')) {
        peer.online = this.rng() > 0.3;
      }
      this.alerts.push('CONNECTION_CHURN');
      return;
    }
    this.alerts.push('ECLIPSE_ATTEMPT');
  }

  canDeliver(from: string, to: string): boolean {
    const source = this.peers.find((peer) => peer.peerId === from);
    const dest = this.peers.find((peer) => peer.peerId === to);
    if (!source || !dest || !source.online || !dest.online) {
      return false;
    }
    if (!source.allowed || !dest.allowed) {
      this.alerts.push('PEER_POLICY_DENIED');
      return false;
    }
    for (const group of this.partitions.values()) {
      const sourceIn = group.has(from);
      const destIn = group.has(to);
      if (sourceIn !== destIn && this.partitions.size > 0) {
        return false;
      }
    }
    if (this.lossBps > 0 && this.rng() * 10_000 < this.lossBps) {
      this.dropped.push(this.tick);
      return false;
    }
    return true;
  }

  send(from: string, to: string, kind: string, payload: string): boolean {
    this.tick += 1;
    if (!this.canDeliver(from, to)) {
      return false;
    }
    const message: DeliveredMessage = {
      from,
      to,
      kind,
      payload,
      tick: this.tick + this.latencyTicks,
      duplicated: this.duplicate,
      reordered: this.reorder,
    };
    this.inbox.push(message);
    if (this.duplicate) {
      this.inbox.push({ ...message, tick: message.tick + 1, duplicated: true });
    }
    if (this.reorder && this.inbox.length > 1) {
      const last = this.inbox[this.inbox.length - 1]!;
      const prev = this.inbox[this.inbox.length - 2]!;
      this.inbox[this.inbox.length - 1] = prev;
      this.inbox[this.inbox.length - 2] = last;
    }
    return true;
  }

  sentryDiversity(validatorId: string): number {
    const domains = new Set(
      this.peers.filter((peer) => peer.role === 'SENTRY' && peer.validatorId === validatorId && peer.online).map((peer) => peer.domainId),
    );
    return domains.size;
  }

  eclipseResisted(validatorId: string): boolean {
    const validator = this.peers.find((peer) => peer.validatorId === validatorId && peer.role === 'VALIDATOR');
    if (!validator) {
      return false;
    }
    const honestSentries = this.peers.filter(
      (peer) => peer.role === 'SENTRY' && peer.validatorId === validatorId && peer.online && peer.allowed,
    );
    const malicious = this.peers.filter((peer) => peer.role === 'MALICIOUS_PEER');
    for (const attacker of malicious) {
      this.send(attacker.peerId, validator.peerId, 'ECLIPSE', 'isolate');
    }
    return honestSentries.length >= 2 && this.sentryDiversity(validatorId) >= 1;
  }
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
