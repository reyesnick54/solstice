import { createHash } from 'node:crypto';

import {
  DEV_INTEROP_TEST_ASSET,
  EXTERNAL_DEV_CHAIN_ID,
  INTEROP_PROTOCOL_VERSION,
  SUNREY_CHAIN_ID,
  type ChannelType,
  type ClientStatus,
  type ConnectionState,
  type ExternalChainDefinition,
  type InterchainPacket,
  type InteropAssetSnapshot,
  type InteropErrorCode,
  type InteropMetrics,
  type InteropSecurityProfile,
  type PacketLifecycle,
} from './types.ts';
import { assertInteropActivationGate } from './activation-guard.ts';

export class InteropFailure extends Error {
  readonly code: InteropErrorCode;
  constructor(code: InteropErrorCode) {
    super(code);
    this.code = code;
  }
}

function sha256(parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update(part);
    hash.update('\0');
  }
  return hash.digest('hex');
}

export interface IsolatedRelayer {
  readonly relayerId: string;
  readonly kind: 'RELAYER';
}

export function isolatedRelayer(id: string): IsolatedRelayer {
  return { relayerId: id, kind: 'RELAYER' };
}

export function relayerCannotVote(_relayer: IsolatedRelayer): never {
  throw new InteropFailure('RELAYER_FORBIDDEN');
}

export function relayerCannotGovern(_relayer: IsolatedRelayer): never {
  throw new InteropFailure('RELAYER_FORBIDDEN');
}

export function refuseWrappedFiat(asset: string): void {
  if (asset.startsWith(DEV_INTEROP_TEST_ASSET)) {
    return;
  }
  if (asset === 'USD' || asset === 'EUR' || asset === 'WRAPPED_USD' || asset === 'WUSD') {
    throw new InteropFailure('WRAPPED_FIAT_FORBIDDEN');
  }
  if (asset === 'SUNREY_COIN' || asset === 'MOONREY_COIN') {
    throw new InteropFailure('PRODUCTION_ASSET_UNAVAILABLE');
  }
  throw new InteropFailure('WRAPPED_FIAT_FORBIDDEN');
}

export function refuseAutomaticIdentityTrust(): never {
  throw new InteropFailure('IDENTITY_NOT_AUTOMATICALLY_TRUSTED');
}

export function refuseForeignEconomicTruth(): never {
  throw new InteropFailure('FOREIGN_VALUE_NOT_ECONOMIC_TRUTH');
}

export function refuseFiatLedgerMutation(): never {
  throw new InteropFailure('FIAT_LEDGER_MUTATION_FORBIDDEN');
}

export interface SimulatedHeader {
  readonly chainId: string;
  readonly height: number;
  readonly parentHash: string;
  readonly stateRoot: string;
  readonly genesisHash: string;
  readonly finality: string;
}

export interface SimulatedForeignChain {
  readonly chainId: string;
  readonly genesisHash: string;
  height: number;
  state: Map<string, string>;
  lastHash: string;
}

export function createExternalDevChain(): SimulatedForeignChain {
  const genesisHash = sha256(['genesis', EXTERNAL_DEV_CHAIN_ID, 'distinct-from-sunrey']);
  return {
    chainId: EXTERNAL_DEV_CHAIN_ID,
    genesisHash,
    height: 0,
    state: new Map(),
    lastHash: genesisHash,
  };
}

export function putForeignState(chain: SimulatedForeignChain, key: string, value: string): void {
  chain.state.set(key, value);
}

export function finalizeForeignHeader(chain: SimulatedForeignChain): SimulatedHeader {
  const entries = [...chain.state.entries()].sort(([a], [b]) => a.localeCompare(b));
  const stateRoot = sha256(entries.flatMap(([k, v]) => [k, v]));
  const height = chain.height + 1;
  const header: SimulatedHeader = {
    chainId: chain.chainId,
    height,
    parentHash: chain.lastHash,
    stateRoot,
    genesisHash: chain.genesisHash,
    finality: sha256(['finality', chain.chainId, String(height), stateRoot, 'ext_a', 'ext_b', 'ext_c']),
  };
  chain.height = height;
  chain.lastHash = sha256([header.chainId, String(header.height), header.stateRoot, header.parentHash]);
  return header;
}

export function membershipProof(chain: SimulatedForeignChain, key: string): { key: string; value: string; root: string } {
  const value = chain.state.get(key);
  if (value === undefined) {
    throw new InteropFailure('INVALID_MEMBERSHIP_PROOF');
  }
  const entries = [...chain.state.entries()].sort(([a], [b]) => a.localeCompare(b));
  return { key, value, root: sha256(entries.flatMap(([k, v]) => [k, v])) };
}

export class InteropEngine {
  readonly sunreyChainId = SUNREY_CHAIN_ID;
  nowUnix = 1_700_000_000;
  chains = new Map<string, ExternalChainDefinition>();
  clients = new Map<
    string,
    {
      status: ClientStatus;
      latestHeight: number;
      genesisHash: string;
      lastUpdate: number;
      trustingPeriod: number;
    }
  >();
  connections = new Map<string, ConnectionState>();
  packets = new Map<string, { packet: InterchainPacket; lifecycle: PacketLifecycle; commitment: string }>();
  replay = new Set<string>();
  ackReplay = new Set<string>();
  verifiedHeaders = new Map<string, SimulatedHeader>();
  assets: InteropAssetSnapshot = {
    assetId: DEV_INTEROP_TEST_ASSET,
    circulating: 1_000_000n,
    escrowed: 0n,
    authorizedRemote: 0n,
    definedTotal: 1_000_000n,
  };
  metrics: InteropMetrics = {
    interopClients: 0,
    interopVerifiedHeaders: 0,
    interopRejectedHeaders: 0,
    interopPacketsSent: 0,
    interopPacketsReceived: 0,
    interopPacketReplays: 0,
    interopTimeouts: 0,
    interopClientAge: 0,
    interopClientFrozen: 0,
    interopProofFailures: 0,
    relayerSubmissions: 0,
  };

  registerChain(def: ExternalChainDefinition, actor: 'GOVERNANCE' | 'AI' | 'RELAYER'): void {
    assertInteropActivationGate();
    if (actor === 'AI') {
      throw new InteropFailure('AI_CANNOT_ACTIVATE');
    }
    if (actor === 'RELAYER') {
      throw new InteropFailure('RELAYER_FORBIDDEN');
    }
    this.chains.set(def.externalChainId, def);
  }

  activateChain(chainId: string, actor: 'GOVERNANCE' | 'AI' | 'RELAYER'): void {
    assertInteropActivationGate();
    if (actor === 'AI') {
      throw new InteropFailure('AI_CANNOT_ACTIVATE');
    }
    if (actor === 'RELAYER') {
      throw new InteropFailure('RELAYER_FORBIDDEN');
    }
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new InteropFailure('UNREGISTERED_CHAIN');
    }
    chain.status = 'ACTIVE_DEVELOPMENT';
  }

  initializeClient(chain: SimulatedForeignChain): string {
    const registered = this.chains.get(chain.chainId);
    if (!registered) {
      throw new InteropFailure('UNREGISTERED_CHAIN');
    }
    if (registered.status !== 'ACTIVE_DEVELOPMENT' && registered.status !== 'DEVELOPMENT_ONLY') {
      throw new InteropFailure('UNREGISTERED_CHAIN');
    }
    if (registered.genesisHash !== chain.genesisHash) {
      throw new InteropFailure('WRONG_GENESIS');
    }
    const id = `ic/${chain.chainId}/${this.sunreyChainId}/${INTEROP_PROTOCOL_VERSION}/client-0`;
    this.clients.set(id, {
      status: 'ACTIVE',
      latestHeight: 0,
      genesisHash: chain.genesisHash,
      lastUpdate: this.nowUnix,
      trustingPeriod: 86_400,
    });
    this.metrics.interopClients = this.clients.size;
    return id;
  }

  submitHeader(clientId: string, header: SimulatedHeader, _relayer: IsolatedRelayer): void {
    this.metrics.relayerSubmissions += 1;
    const client = this.clients.get(clientId);
    if (!client) {
      throw new InteropFailure('UNREGISTERED_CHAIN');
    }
    if (client.status === 'FROZEN') {
      this.metrics.interopRejectedHeaders += 1;
      throw new InteropFailure('CLIENT_FROZEN');
    }
    if (client.status === 'EXPIRED') {
      throw new InteropFailure('CLIENT_EXPIRED');
    }
    if (header.chainId !== EXTERNAL_DEV_CHAIN_ID && header.chainId !== this.chains.get(header.chainId)?.externalChainId) {
      this.metrics.interopRejectedHeaders += 1;
      throw new InteropFailure('WRONG_EXTERNAL_CHAIN_ID');
    }
    if (!this.chains.has(header.chainId)) {
      throw new InteropFailure('UNREGISTERED_CHAIN');
    }
    if (header.finality.length < 16) {
      this.metrics.interopRejectedHeaders += 1;
      this.metrics.interopProofFailures += 1;
      throw new InteropFailure('INVALID_FINALITY_PROOF');
    }
    const existing = this.verifiedHeaders.get(`${clientId}:${header.height}`);
    if (existing && existing.stateRoot === header.stateRoot) {
      return;
    }
    if (header.height !== client.latestHeight + 1) {
      this.metrics.interopRejectedHeaders += 1;
      throw new InteropFailure('INVALID_HEADER');
    }
    this.verifiedHeaders.set(`${clientId}:${header.height}`, header);
    client.latestHeight = header.height;
    client.lastUpdate = this.nowUnix;
    this.metrics.interopVerifiedHeaders += 1;
  }

  freeze(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new InteropFailure('UNREGISTERED_CHAIN');
    }
    client.status = 'FROZEN';
    this.metrics.interopClientFrozen += 1;
  }

  expireClients(): void {
    for (const client of this.clients.values()) {
      if (this.nowUnix - client.lastUpdate > client.trustingPeriod) {
        client.status = 'EXPIRED';
        this.metrics.interopClientAge = this.nowUnix - client.lastUpdate;
      }
    }
  }

  handshake(connectionId: string, step: ConnectionState): void {
    const current = this.connections.get(connectionId);
    if (!current && step !== 'INIT') {
      throw new InteropFailure('GOVERNANCE_REQUIRED');
    }
    this.connections.set(connectionId, step === 'CONFIRM' ? 'OPEN' : step);
  }

  sendPacket(packet: InterchainPacket): string {
    const commitment = sha256([
      String(packet.sequence),
      packet.sourceChain,
      packet.destinationChain,
      packet.sourceChannel,
      packet.destinationChannel,
      packet.packetType,
      packet.payload,
      packet.protocolVersion,
    ]);
    const id = `pkt/${packet.sourceChain}/${packet.destinationChain}/${packet.protocolVersion}/${packet.sourceChannel}/${packet.sequence}`;
    this.packets.set(id, { packet, lifecycle: 'SENT', commitment });
    this.metrics.interopPacketsSent += 1;
    return id;
  }

  recvPacket(
    clientId: string,
    packet: InterchainPacket,
    proof: { key: string; value: string; root: string },
    header: SimulatedHeader,
  ): string {
    const client = this.clients.get(clientId);
    if (!client || client.status !== 'ACTIVE') {
      throw new InteropFailure(client?.status === 'FROZEN' ? 'CLIENT_FROZEN' : 'UNREGISTERED_CHAIN');
    }
    if (header.stateRoot !== proof.root) {
      this.metrics.interopProofFailures += 1;
      throw new InteropFailure('INVALID_MEMBERSHIP_PROOF');
    }
    const encoded = JSON.stringify(packet);
    if (proof.value !== encoded) {
      this.metrics.interopProofFailures += 1;
      throw new InteropFailure('MODIFIED_PACKET');
    }
    const replay = sha256([
      packet.sourceChain,
      packet.destinationChain,
      packet.sourceChannel,
      String(packet.sequence),
      packet.packetType,
      packet.protocolVersion,
    ]);
    if (this.replay.has(replay)) {
      this.metrics.interopPacketReplays += 1;
      throw new InteropFailure('PACKET_REPLAY');
    }
    this.replay.add(replay);
    const id = `pkt/${packet.sourceChain}/${packet.destinationChain}/${packet.protocolVersion}/${packet.sourceChannel}/${packet.sequence}`;
    this.packets.set(id, { packet, lifecycle: 'RECEIVED', commitment: sha256([encoded]) });
    this.metrics.interopPacketsReceived += 1;
    if (packet.packetType === 'ASSET_TRANSFER_RESERVED') {
      const amount = BigInt(packet.payload.split(':')[1] ?? '0');
      this.representRemote(amount);
    }
    return sha256(['ack', encoded]);
  }

  acknowledge(packetId: string, ack: string): void {
    if (this.ackReplay.has(ack)) {
      throw new InteropFailure('ACK_REPLAY');
    }
    this.ackReplay.add(ack);
    const row = this.packets.get(packetId);
    if (row) {
      row.lifecycle = 'ACKNOWLEDGED';
    }
  }

  timeout(packetId: string): void {
    const row = this.packets.get(packetId);
    if (!row) {
      return;
    }
    row.lifecycle = 'TIMED_OUT';
    this.metrics.interopTimeouts += 1;
  }

  escrow(amount: bigint): void {
    refuseWrappedFiat(this.assets.assetId);
    if (this.assets.circulating < amount) {
      throw new InteropFailure('SUPPLY_INVARIANT_VIOLATED');
    }
    this.assets.circulating -= amount;
    this.assets.escrowed += amount;
    this.assertSupply();
  }

  representRemote(amount: bigint): void {
    if (this.assets.escrowed < amount) {
      throw new InteropFailure('SUPPLY_INVARIANT_VIOLATED');
    }
    this.assets.escrowed -= amount;
    this.assets.authorizedRemote += amount;
    this.assertSupply();
  }

  recoverEscrow(amount: bigint): void {
    if (this.assets.escrowed < amount) {
      throw new InteropFailure('SUPPLY_INVARIANT_VIOLATED');
    }
    this.assets.escrowed -= amount;
    this.assets.circulating += amount;
    this.assertSupply();
  }

  assertSupply(): void {
    if (this.assets.circulating + this.assets.escrowed + this.assets.authorizedRemote !== this.assets.definedTotal) {
      throw new InteropFailure('SUPPLY_INVARIANT_VIOLATED');
    }
  }

  stateRoot(): string {
    return sha256([
      ...[...this.clients.keys()],
      ...[...this.packets.keys()],
      this.assets.circulating.toString(),
      this.assets.escrowed.toString(),
      this.assets.authorizedRemote.toString(),
    ]);
  }

  securityProfile(clientId: string): InteropSecurityProfile {
    const client = this.clients.get(clientId);
    return {
      foreignFinalityModel: 'SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN',
      verifiedClientType: 'SIMULATED_DETERMINISTIC_BFT',
      proofSystem: 'SORTED_MERKLE_V1',
      sunreyCryptoClassification: 'HYBRID_CAPABLE',
      foreignCryptoClassification: 'CLASSICAL',
      weakestTrustDomain: 'CLASSICAL',
      interopCannotExceedWeakestDomain: true,
      validatorTrustAssumptions: 'foreign quorum independently verified; relayer untrusted',
      clientAgeSeconds: client ? this.nowUnix - client.lastUpdate : 0,
      status: client?.status ?? 'UNINITIALIZED',
      riskClassification: 'FOREIGN_CLASSICAL_WEAKEST_DOMAIN',
      absoluteSecurityClaim: false,
      trustedMultisigBridge: false,
      productionReady: false,
    };
  }
}

export function developmentExternalChain(genesisHash: string): ExternalChainDefinition {
  return {
    externalChainId: EXTERNAL_DEV_CHAIN_ID,
    displayName: 'ExternalDevChain',
    chainFamily: 'SIMULATED_BFT',
    finalityModel: 'SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN',
    clientType: 'SIMULATED_DETERMINISTIC_BFT',
    genesisHash,
    trustAnchor: genesisHash,
    proofSystem: 'SORTED_MERKLE_V1',
    expectedBlockFormat: 'EXTERNAL_DEV_HEADER_V1',
    timeoutPolicy: 'FAIL_CLOSED_HEIGHT_OR_TIMESTAMP',
    minimumFinalityRule: 'QUORUM_2F_PLUS_1',
    allowedCapabilities: [
      'GENERIC_MESSAGE',
      'ORACLE_FACT',
      'ASSET_TRANSFER_DEV_ONLY',
      'IDENTITY_ATTESTATION',
      'ECONOMIC_ATTESTATION',
    ],
    status: 'DRAFT',
    activationHeight: 0,
    schemaVersion: 1,
  };
}

export function makePacket(
  payload: string,
  packetType: ChannelType = 'GENERIC_MESSAGE',
  sequence = 0,
): InterchainPacket {
  return {
    sequence,
    sourceChain: EXTERNAL_DEV_CHAIN_ID,
    sourceChannel: 'chan-0',
    destinationChain: SUNREY_CHAIN_ID,
    destinationChannel: 'chan-0',
    packetType,
    payload,
    timeoutHeight: 20,
    timeoutTimestamp: 0,
    sender: 'ext.sender',
    receiver: 'sunrey.receiver',
    protocolVersion: INTEROP_PROTOCOL_VERSION,
  };
}

export function packetStateKey(packet: InterchainPacket): string {
  return `packets/${packet.sourceChain}/${packet.sequence}`;
}
