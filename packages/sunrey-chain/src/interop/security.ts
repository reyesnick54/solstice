/**
 * Wave 3 Prompt 9 — interoperability security controls.
 * Production interop remains FAIL-CLOSED.
 */

import { createHash } from 'node:crypto';

import {
  DEV_INTEROP_TEST_ASSET,
  EXTERNAL_DEV_CHAIN_ID,
  INTEROP_PROTOCOL_VERSION,
  SUNREY_CHAIN_ID,
  type ChannelType,
  type InteropErrorCode,
} from './types.ts';

export const ENVELOPE_SCHEMA_VERSION = 1;
export const DOMAIN_ENVELOPE = 'sunrey.interop.envelope.v1';

export type InteropFlowDirection = 'INBOUND' | 'OUTBOUND';

export type InteropActivationState =
  | 'DISABLED'
  | 'DEVELOPMENT_ONLY'
  | 'GOVERNANCE_AUTHORIZED'
  | 'PRODUCTION_ACTIVE';

export type InteropMessageEnvelope = {
  readonly envelopeVersion: number;
  readonly protocolVersion: string;
  readonly direction: InteropFlowDirection;
  readonly sourceNetwork: string;
  readonly sourceChainId: string;
  readonly sourceTxHash: string;
  readonly sourceEventIndex: number;
  readonly destinationChainId: string;
  readonly destinationChannel: string;
  readonly messageType: ChannelType;
  readonly payloadHash: string;
  readonly messageNonce: number;
  readonly sequence: number;
  readonly expiryHeight: number;
  readonly expiryTimestamp: number;
  readonly proofReference: string;
  readonly attestationDigest: string;
  readonly domain: string;
};

export class InteropSecurityFailure extends Error {
  readonly code: InteropErrorCode | string;
  constructor(code: InteropErrorCode | string) {
    super(code);
    this.code = code;
  }
}

export type InteropActivationGate = {
  readonly state: InteropActivationState;
  readonly environment: string;
  readonly liveFlags: boolean;
  readonly governanceApprovalId: string | null;
  readonly qualificationComplete: boolean;
  readonly counselReview: string;
};

export function failClosedActivationGate(): InteropActivationGate {
  return Object.freeze({
    state: 'DISABLED',
    environment: 'simulation',
    liveFlags: false,
    governanceApprovalId: null,
    qualificationComplete: false,
    counselReview: 'RESEARCH_REQUIRED',
  });
}

export function requireProductionInterop(gate: InteropActivationGate): void {
  if (gate.state !== 'PRODUCTION_ACTIVE') {
    throw new InteropSecurityFailure('PRODUCTION_INTEROP_DISABLED');
  }
  if (gate.counselReview !== 'CONFIRMED_BY_COUNSEL') {
    throw new InteropSecurityFailure('PRODUCTION_INTEROP_DISABLED');
  }
  if (gate.environment !== 'simulation' && !gate.qualificationComplete) {
    throw new InteropSecurityFailure('PRODUCTION_INTEROP_DISABLED');
  }
}

export function relayerStartMustNotActivate(gate: InteropActivationGate): InteropActivationGate {
  return gate;
}

export type InteropNetworkPolicy = {
  readonly allowedExternalRpcEndpoints: readonly string[];
  readonly allowedSunreyIngressEndpoints: readonly string[];
  readonly deniedDestinations: readonly string[];
  readonly allowDatabaseAccess: boolean;
  readonly allowAdminApiAccess: boolean;
  readonly allowSecretStoreAccess: boolean;
  readonly allowValidatorKeyAccess: boolean;
};

export const DEFAULT_INTEROP_NETWORK_POLICY: InteropNetworkPolicy = Object.freeze({
  allowedExternalRpcEndpoints: Object.freeze(['fixture://external-dev-rpc']),
  allowedSunreyIngressEndpoints: Object.freeze(['https://interop-ingress.sunrey.test/v1']),
  deniedDestinations: Object.freeze([
    'postgres://*',
    'https://admin.sunrey.internal/*',
    'https://vault.sunrey.internal/*',
  ]),
  allowDatabaseAccess: false,
  allowAdminApiAccess: false,
  allowSecretStoreAccess: false,
  allowValidatorKeyAccess: false,
});

export type InteropServiceRole = 'WATCHER' | 'RELAYER' | 'VALIDATOR_NODE';

export function requireEgress(
  policy: InteropNetworkPolicy,
  role: InteropServiceRole,
  destination: string,
): void {
  if (policy.deniedDestinations.some((pattern) => patternMatch(pattern, destination))) {
    throw new InteropSecurityFailure('NETWORK_EGRESS_DENIED');
  }
  if (!policy.allowDatabaseAccess && destination.startsWith('postgres://')) {
    throw new InteropSecurityFailure('NETWORK_EGRESS_DENIED');
  }
  if (!policy.allowAdminApiAccess && destination.includes('/admin')) {
    throw new InteropSecurityFailure('NETWORK_EGRESS_DENIED');
  }
  if (!policy.allowSecretStoreAccess && destination.includes('vault')) {
    throw new InteropSecurityFailure('NETWORK_EGRESS_DENIED');
  }
  if (!policy.allowValidatorKeyAccess && destination.includes('validator') && destination.includes('key')) {
    throw new InteropSecurityFailure('NETWORK_EGRESS_DENIED');
  }
  const allowed =
    role === 'WATCHER'
      ? policy.allowedExternalRpcEndpoints
      : role === 'RELAYER'
        ? policy.allowedSunreyIngressEndpoints
        : [];
  if (role !== 'VALIDATOR_NODE' && !allowed.some((entry) => patternMatch(entry, destination))) {
    throw new InteropSecurityFailure('NETWORK_EGRESS_DENIED');
  }
}

export type RpcMethodClass = 'READ_ONLY' | 'SUBMISSION' | 'ADMIN' | 'VALIDATOR' | 'DANGEROUS';

export function interopMayCall(role: InteropServiceRole, method: string, path: string): void {
  const key = `${method} ${path}`;
  if (
    path.includes('/admin') ||
    path.includes('produce-block') ||
    path.includes('unsafe-reset') ||
    path.includes('/validator')
  ) {
    throw new InteropSecurityFailure('RPC_METHOD_FORBIDDEN');
  }
  if (role === 'WATCHER' && method === 'POST') {
    throw new InteropSecurityFailure('RPC_METHOD_FORBIDDEN');
  }
  if (key.includes('POST /admin') || key.includes('/validator/sign')) {
    throw new InteropSecurityFailure('RPC_METHOD_FORBIDDEN');
  }
}

export type InteropCircuitBreakers = {
  globalPaused: boolean;
  pausedNetworks: Set<string>;
  pausedAssets: Set<string>;
  rateLimitPerWindow: number;
  valueLimitMinor: bigint;
  messageCountLimit: number;
  windowMessageCount: number;
  windowValueMinor: bigint;
  auditLog: string[];
};

export function createInteropCircuitBreakers(): InteropCircuitBreakers {
  return {
    globalPaused: false,
    pausedNetworks: new Set(),
    pausedAssets: new Set(),
    rateLimitPerWindow: 64,
    valueLimitMinor: 1_000_000n,
    messageCountLimit: 1024,
    windowMessageCount: 0,
    windowValueMinor: 0n,
    auditLog: [],
  };
}

export function guardInteropMessage(
  circuits: InteropCircuitBreakers,
  networkId: string,
  assetId: string | null,
  valueMinor: bigint,
): void {
  if (circuits.globalPaused) {
    throw new InteropSecurityFailure('GLOBAL_INTEROP_PAUSED');
  }
  if (circuits.pausedNetworks.has(networkId)) {
    throw new InteropSecurityFailure('NETWORK_PAUSED');
  }
  if (assetId && circuits.pausedAssets.has(assetId)) {
    throw new InteropSecurityFailure('ASSET_PAUSED');
  }
  if (valueMinor > circuits.valueLimitMinor) {
    throw new InteropSecurityFailure('VALUE_LIMIT_EXCEEDED');
  }
  if (circuits.windowMessageCount >= circuits.messageCountLimit) {
    throw new InteropSecurityFailure('MESSAGE_COUNT_LIMIT_EXCEEDED');
  }
  circuits.windowMessageCount += 1;
  circuits.windowValueMinor += valueMinor;
}

export function envelopeDigest(envelope: InteropMessageEnvelope): string {
  const canonical = JSON.stringify({
    envelopeVersion: envelope.envelopeVersion,
    protocolVersion: envelope.protocolVersion,
    direction: envelope.direction,
    sourceNetwork: envelope.sourceNetwork,
    sourceChainId: envelope.sourceChainId,
    sourceTxHash: envelope.sourceTxHash,
    sourceEventIndex: envelope.sourceEventIndex,
    destinationChainId: envelope.destinationChainId,
    destinationChannel: envelope.destinationChannel,
    messageType: envelope.messageType,
    payloadHash: envelope.payloadHash,
    messageNonce: envelope.messageNonce,
    sequence: envelope.sequence,
    expiryHeight: envelope.expiryHeight,
    expiryTimestamp: envelope.expiryTimestamp,
    proofReference: envelope.proofReference,
    attestationDigest: envelope.attestationDigest,
    domain: envelope.domain,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function envelopeReplayKey(envelope: InteropMessageEnvelope): string {
  return createHash('sha256')
    .update(
      [
        envelope.sourceChainId,
        envelope.sourceTxHash,
        String(envelope.sourceEventIndex),
        String(envelope.messageNonce),
        envelope.direction,
      ].join('\0'),
    )
    .digest('hex');
}

export function validateEnvelopeStructure(
  envelope: InteropMessageEnvelope,
  nowUnix: number,
  height: number,
): void {
  if (envelope.envelopeVersion !== ENVELOPE_SCHEMA_VERSION) {
    throw new InteropSecurityFailure('UNSUPPORTED_MESSAGE_VERSION');
  }
  if (envelope.protocolVersion !== INTEROP_PROTOCOL_VERSION) {
    throw new InteropSecurityFailure('UNSUPPORTED_MESSAGE_VERSION');
  }
  if (envelope.expiryHeight !== 0 && height > envelope.expiryHeight) {
    throw new InteropSecurityFailure('MESSAGE_EXPIRED');
  }
  if (envelope.expiryTimestamp !== 0 && nowUnix > envelope.expiryTimestamp) {
    throw new InteropSecurityFailure('MESSAGE_EXPIRED');
  }
  if (envelope.domain !== DOMAIN_ENVELOPE) {
    throw new InteropSecurityFailure('SCHEMA_INVALID');
  }
}

export const INTEROP_SIGNING_PURPOSE = 'INTEROPERABILITY_SIGNING';
export const FORBIDDEN_INTEROP_KEY_PURPOSES = Object.freeze([
  'VALIDATOR_CONSENSUS_SIGNING',
  'BLOCK_PROPOSAL_SIGNING',
  'GOVERNANCE_SIGNING',
  'GENESIS_SIGNING',
  'WALLET_SIGNING',
  'EXECUTION_AUTHORITY_SIGNING',
  'TREASURY_MASTER',
  'CUSTODY_SIGNING',
]);

export function assertInteropKeySeparation(purposes: readonly string[]): void {
  for (const purpose of purposes) {
    if ((FORBIDDEN_INTEROP_KEY_PURPOSES as readonly string[]).includes(purpose)) {
      throw new InteropSecurityFailure('KEY_PURPOSE_FORBIDDEN');
    }
  }
  if (
    purposes.includes('VALIDATOR_CONSENSUS_SIGNING') &&
    purposes.includes(INTEROP_SIGNING_PURPOSE)
  ) {
    throw new InteropSecurityFailure('KEY_PURPOSE_FORBIDDEN');
  }
}

export function watcherSecurityModel(watcherCount: number): string {
  return watcherCount <= 1
    ? 'SINGLE_WATCHER_UNTRUSTED_UNTIL_VERIFIED'
    : 'MULTI_WATCHER_QUORUM_REQUIRED_FOR_PRODUCTION';
}

export function sampleEnvelope(payload: string): InteropMessageEnvelope {
  const payloadHash = createHash('sha256').update(payload).digest('hex');
  return Object.freeze({
    envelopeVersion: ENVELOPE_SCHEMA_VERSION,
    protocolVersion: INTEROP_PROTOCOL_VERSION,
    direction: 'INBOUND',
    sourceNetwork: 'net_external_dev',
    sourceChainId: EXTERNAL_DEV_CHAIN_ID,
    sourceTxHash: '0xdeadbeef',
    sourceEventIndex: 0,
    destinationChainId: SUNREY_CHAIN_ID,
    destinationChannel: 'chan-0',
    messageType: 'GENERIC_MESSAGE',
    payloadHash,
    messageNonce: 1,
    sequence: 0,
    expiryHeight: 100,
    expiryTimestamp: 1_900_000_000,
    proofReference: 'proof-ref',
    attestationDigest: 'att',
    domain: DOMAIN_ENVELOPE,
  });
}

function patternMatch(pattern: string, value: string): boolean {
  if (pattern.endsWith('/*')) {
    return value.startsWith(pattern.slice(0, -2));
  }
  if (pattern.endsWith('*')) {
    return value.startsWith(pattern.slice(0, -1));
  }
  return pattern === value;
}

export function productionInteropRemainsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const gate = failClosedActivationGate();
  if (env.NODE_ENV === 'production') {
    relayerStartMustNotActivate(gate);
  }
  if (env.SUNREY_INTEROP_RPC_URL) {
    relayerStartMustNotActivate(gate);
  }
  return gate.state === 'DISABLED';
}

export function devAssetOnly(assetId: string): void {
  if (assetId !== DEV_INTEROP_TEST_ASSET) {
    throw new InteropSecurityFailure('PRODUCTION_ASSET_UNAVAILABLE');
  }
}
