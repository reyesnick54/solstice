import { hasTwoThirdsPlus } from '../validators/index.ts';
import { developmentNodeCapability, type NodeCapability, type UpgradePlan } from '../governance/index.ts';
import { authorizeDevelopmentUpgrade, developmentUpgradeFixture } from './upgrade.ts';

export const SEVEN_VALIDATOR_IDS = [
  'val_ops_a',
  'val_ops_b',
  'val_ops_c',
  'val_ops_d',
  'val_ops_e',
  'val_ops_f',
  'val_ops_g',
] as const;

export type NetworkNode = {
  readonly id: string;
  binaryVersion: number;
  protocolVersion: number;
  height: bigint;
  online: boolean;
  readonly votingPower: bigint;
};

export type Commit = {
  readonly height: bigint;
  readonly blockId: string;
  readonly protocolVersion: number;
  readonly voters: readonly string[];
};

export class SevenValidatorNetwork {
  readonly nodes: NetworkNode[];
  readonly commits: Commit[] = [];
  protocolVersion = 1;
  activationHeight: bigint | null = null;
  plan: UpgradePlan | null = null;

  constructor() {
    this.nodes = SEVEN_VALIDATOR_IDS.map((id) => ({
      id,
      binaryVersion: 1,
      protocolVersion: 1,
      height: 0n,
      online: true,
      votingPower: 1n,
    }));
  }

  onlinePower(): bigint {
    return this.nodes.filter((node) => node.online).reduce((sum, node) => sum + node.votingPower, 0n);
  }

  hasQuorum(): boolean {
    return hasTwoThirdsPlus(
      this.onlinePower(),
      this.nodes.reduce((sum, node) => sum + node.votingPower, 0n),
    );
  }

  deployBinary(ids: readonly string[], binaryVersion: number): void {
    for (const node of this.nodes) {
      if (ids.includes(node.id)) {
        node.binaryVersion = binaryVersion;
      }
    }
  }

  scheduleGovernedActivation(height: bigint, plan: UpgradePlan): void {
    this.activationHeight = height;
    this.plan = plan;
  }

  activated(height: bigint): boolean {
    return this.activationHeight !== null && height >= this.activationHeight;
  }

  produce(height: bigint): Commit | null {
    const target = this.plan?.targetProtocolVersion ?? 2;
    const protocol = this.activated(height) ? target : 1;
    const voters: string[] = [];
    for (const node of this.nodes) {
      if (!node.online) {
        continue;
      }
      if (this.activated(height) && node.binaryVersion < protocol) {
        continue;
      }
      node.height = height;
      if (this.activated(height) && node.binaryVersion >= protocol) {
        node.protocolVersion = protocol;
      }
      voters.push(node.id);
    }
    if (!hasTwoThirdsPlus(BigInt(voters.length), 7n)) {
      return null;
    }
    if (this.activated(height)) {
      this.protocolVersion = protocol;
    }
    const commit: Commit = {
      height,
      blockId: `block-${height.toString()}-p${protocol}`,
      protocolVersion: protocol,
      voters,
    };
    this.commits.push(commit);
    return commit;
  }

  catchUp(id: string, toHeight: bigint): void {
    const node = this.nodes.find((row) => row.id === id);
    if (!node) {
      return;
    }
    node.online = true;
    node.height = toHeight;
    if (this.activated(toHeight) && node.binaryVersion >= this.protocolVersion) {
      node.protocolVersion = this.protocolVersion;
    }
  }

  safetyHolds(): boolean {
    const byHeight = new Map<string, Set<string>>();
    for (const commit of this.commits) {
      const key = commit.height.toString();
      const set = byHeight.get(key) ?? new Set<string>();
      set.add(commit.blockId);
      byHeight.set(key, set);
    }
    return [...byHeight.values()].every((set) => set.size === 1);
  }
}

export function runRollingUpgrade(): {
  readonly beforeActivation: readonly Commit[];
  readonly atActivation: Commit | null;
  readonly afterLagCatchup: boolean;
  readonly quorumHeld: boolean;
  readonly safety: boolean;
  readonly newBinaryDidNotAutoActivate: boolean;
} {
  const net = new SevenValidatorNetwork();
  const fixture = developmentUpgradeFixture(12);
  authorizeDevelopmentUpgrade(fixture.manager, fixture.plan);
  net.scheduleGovernedActivation(12n, fixture.plan);
  const before: Commit[] = [];
  for (let height = 1n; height <= 10n; height += 1n) {
    const commit = net.produce(height);
    if (commit) {
      before.push(commit);
    }
  }
  net.deployBinary(SEVEN_VALIDATOR_IDS.slice(0, 6), 2);
  const preActivation = net.produce(11n);
  const newBinaryDidNotAutoActivate =
    (preActivation?.protocolVersion ?? 0) === 1 &&
    net.nodes.filter((node) => node.binaryVersion === 2 && node.protocolVersion === 1).length === 6;
  if (preActivation) {
    before.push(preActivation);
  }
  net.nodes[6]!.online = false;
  const atActivation = net.produce(12n);
  net.nodes[6]!.binaryVersion = 2;
  net.catchUp('val_ops_g', 12n);
  net.produce(13n);
  return {
    beforeActivation: before,
    atActivation,
    afterLagCatchup: net.nodes[6]!.height >= 12n && net.nodes[6]!.protocolVersion === 2,
    quorumHeld: net.hasQuorum(),
    safety: net.safetyHolds(),
    newBinaryDidNotAutoActivate,
  };
}

export function compatibleCapabilityFor(plan: UpgradePlan): NodeCapability {
  return developmentNodeCapability(plan);
}
