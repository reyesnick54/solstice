/**
 * Singular protocol-native supply authority, invariants, governance
 * gate, replay-protected burn, genesis blocking, and isolated
 * simulation. Exchange, Agent, frontend, oracle, and operational
 * databases cannot change total supply.
 */

import { createHash } from 'node:crypto';

import { nativeAssetConstitution } from '../economics/constitution.ts';
import { rejectAiActivation } from '../economics/governance.ts';
import {
  authorizeIssuance,
  type IssuanceRejection,
  type IssuanceResult,
} from '../economics/issuance.ts';
import { burn, type BurnRejection } from '../economics/operations.ts';
import { MonetaryPolicySimulator, type MonetaryPolicySimulatorInput } from '../economics/simulator.ts';
import {
  emptyBook,
  expectedTotal,
  observedTotal,
  snapshotOf,
  supplyReconciles,
  type AssetSupplyBook,
} from '../economics/supply.ts';
import {
  booksFromCanonicalSupplies,
  canonicalSuppliesFromBooks,
  type CanonicalProtocolState,
} from '../deterministic-state/index.ts';
import { createGenesisState } from '../deterministic-state/genesis.ts';
import {
  ENGINEERING_SIMULATION,
  PRODUCTION_PARAMETER_UNCONFIGURED,
  type BurnClass,
  type MonetaryIssuanceAuthority,
  type MonetaryPolicyState,
  type NativeMonetaryAssetId,
  type NativeSupplySnapshot,
} from '../economics/types.ts';
import {
  ECONOMIC_PARAMETER_NOT_AUTHORIZED,
  economicPolicyDocument,
  mainnetEconomicsMissing,
  type VersionedEconomicPolicyDocument,
} from './economic-policy.ts';
import { nativeAssetAuthorityBoundary } from './authority.ts';

export const CANONICAL_SUPPLY_AUTHORITY = 'packages/sunrey-chain/src/economics/supply.ts' as const;
export const CANONICAL_MINT_GATE = 'packages/sunrey-chain/src/economics/issuance.ts' as const;

export const FORBIDDEN_SUPPLY_MUTATORS = [
  'EXCHANGE_DATABASE',
  'FRONTEND',
  'AGENT',
  'AI',
  'ORACLE',
  'OPERATIONAL_DATABASE',
] as const;
export type ForbiddenSupplyMutator = (typeof FORBIDDEN_SUPPLY_MUTATORS)[number];

export const PERMITTED_SUPPLY_ACTORS = ['PROTOCOL', 'HUMAN_GOVERNANCE'] as const;
export type PermittedSupplyActor = (typeof PERMITTED_SUPPLY_ACTORS)[number];

export type SupplyActor = PermittedSupplyActor | ForbiddenSupplyMutator;

export type SupplyInvariantFailure =
  | 'NEGATIVE_SUPPLY'
  | 'WALLET_EXCEEDS_SUPPLY'
  | 'RECONCILIATION_MISMATCH'
  | 'UNAUTHORIZED_ACTOR'
  | 'MAINNET_ECONOMICS_NOT_AUTHORIZED'
  | 'MISSING_GOVERNANCE'
  | 'AI_CANNOT_APPROVE';

export type SupplyInvariantReport = {
  readonly ok: boolean;
  readonly failures: readonly SupplyInvariantFailure[];
  readonly snapshots: Readonly<Record<NativeMonetaryAssetId, NativeSupplySnapshot>>;
};

export function refuseForbiddenMutator(actor: SupplyActor): SupplyInvariantFailure | null {
  if ((FORBIDDEN_SUPPLY_MUTATORS as readonly string[]).includes(actor)) {
    return 'UNAUTHORIZED_ACTOR';
  }
  return null;
}

export function enforceSupplyInvariants(books: readonly AssetSupplyBook[]): SupplyInvariantReport {
  const failures: SupplyInvariantFailure[] = [];
  const snapshots = {} as Record<NativeMonetaryAssetId, NativeSupplySnapshot>;
  for (const book of books) {
    snapshots[book.assetId] = snapshotOf(book);
    if (expectedTotal(book) < 0n || book.burned < 0n || book.circulating < 0n) {
      failures.push('NEGATIVE_SUPPLY');
    }
    if (!supplyReconciles(book) || expectedTotal(book) !== observedTotal(book)) {
      failures.push('RECONCILIATION_MISMATCH');
    }
    let held = 0n;
    for (const position of book.positions.values()) {
      const wallet =
        position.circulating + position.locked + position.escrowed + position.feeReserved;
      held += wallet;
      if (wallet > expectedTotal(book)) {
        failures.push('WALLET_EXCEEDS_SUPPLY');
      }
    }
    if (held > expectedTotal(book)) {
      failures.push('WALLET_EXCEEDS_SUPPLY');
    }
  }
  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures),
    snapshots: Object.freeze(snapshots),
  });
}

export type HumanGovernanceEvidence = {
  readonly decisionId: string;
  readonly documentVersion: string;
  readonly documentHash: string;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly effectiveAtUtc: string;
  readonly authorizedBy: 'HUMAN_GOVERNANCE';
  readonly aiApproved: false;
  readonly signatureOrReference: string;
};

export type GovernanceGateResult =
  | { readonly ok: true; readonly evidence: HumanGovernanceEvidence }
  | {
      readonly ok: false;
      readonly code: 'MISSING_GOVERNANCE' | 'AI_CANNOT_APPROVE' | 'MAINNET_ECONOMICS_NOT_AUTHORIZED';
    };

export function evaluateHumanGovernanceGate(input: {
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly actor: SupplyActor;
  readonly evidence?: Partial<HumanGovernanceEvidence>;
  readonly policy?: VersionedEconomicPolicyDocument;
}): GovernanceGateResult {
  if (input.actor === 'AI' || input.actor === 'AGENT') {
    return { ok: false, code: 'AI_CANNOT_APPROVE' };
  }
  const policy = input.policy ?? economicPolicyDocument({ network: input.network });
  if (input.network === 'MAINNET' && mainnetEconomicsMissing(policy)) {
    return { ok: false, code: 'MAINNET_ECONOMICS_NOT_AUTHORIZED' };
  }
  if (input.network === 'MAINNET') {
    const evidence = input.evidence;
    if (
      !evidence?.decisionId ||
      !evidence.documentVersion ||
      !evidence.documentHash ||
      !evidence.effectiveAtUtc ||
      !evidence.signatureOrReference ||
      evidence.authorizedBy !== 'HUMAN_GOVERNANCE' ||
      evidence.aiApproved !== false
    ) {
      return { ok: false, code: 'MISSING_GOVERNANCE' };
    }
    return {
      ok: true,
      evidence: Object.freeze({
        decisionId: evidence.decisionId,
        documentVersion: evidence.documentVersion,
        documentHash: evidence.documentHash,
        network: 'MAINNET',
        effectiveAtUtc: evidence.effectiveAtUtc,
        authorizedBy: 'HUMAN_GOVERNANCE',
        aiApproved: false,
        signatureOrReference: evidence.signatureOrReference,
      }),
    };
  }
  return {
    ok: true,
    evidence: Object.freeze({
      decisionId: input.evidence?.decisionId ?? `gov.dev.${input.network.toLowerCase()}`,
      documentVersion: policy.versionId,
      documentHash: policy.contentHash,
      network: input.network,
      effectiveAtUtc: input.evidence?.effectiveAtUtc ?? '1970-01-01T00:00:00.000Z',
      authorizedBy: 'HUMAN_GOVERNANCE',
      aiApproved: false,
      signatureOrReference: input.evidence?.signatureOrReference ?? 'DEVELOPMENT_OR_TESTNET_ONLY',
    }),
  };
}

export type AuthorizedBurnRequest = {
  readonly assetId: NativeMonetaryAssetId;
  readonly account: string;
  readonly quantity: bigint;
  readonly burnClass: BurnClass;
  readonly authorizedSource: 'VOLUNTARY_USER' | 'FEE_MARKET' | 'PROTOCOL_PENALTY';
  readonly replayIdentifier: string;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly actor: SupplyActor;
};

export type BurnControlResult =
  | {
      readonly ok: true;
      readonly book: AssetSupplyBook;
      readonly evidenceId: string;
      readonly supplyBefore: bigint;
      readonly supplyAfter: bigint;
    }
  | {
      readonly ok: false;
      readonly code:
        | BurnRejection
        | SupplyInvariantFailure
        | 'BURN_REPLAY'
        | 'BURN_POLICY_UNRESOLVED'
        | 'UNAUTHORIZED_SOURCE';
    };

export function authorizedBurn(book: AssetSupplyBook, request: AuthorizedBurnRequest): BurnControlResult {
  const actorRefusal = refuseForbiddenMutator(request.actor);
  if (actorRefusal) {
    return { ok: false, code: actorRefusal };
  }
  if (request.network === 'MAINNET') {
    return { ok: false, code: 'BURN_POLICY_UNRESOLVED' };
  }
  if (request.assetId !== book.assetId) {
    return { ok: false, code: 'UNAUTHORIZED_BURN_CLASS' };
  }
  const replay = `BURN:${request.assetId}:${request.replayIdentifier}`;
  if (book.usedReplayIds.has(replay)) {
    return { ok: false, code: 'BURN_REPLAY' };
  }
  const supplyBefore = expectedTotal(book);
  const burned = burn(book, request.account, request.quantity, request.burnClass);
  if (!burned.ok) {
    return burned;
  }
  burned.book.usedReplayIds.add(replay);
  const report = enforceSupplyInvariants([burned.book]);
  if (!report.ok) {
    return { ok: false, code: report.failures[0] ?? 'RECONCILIATION_MISMATCH' };
  }
  return {
    ok: true,
    book: burned.book,
    evidenceId: createHash('sha256').update(replay).digest('hex'),
    supplyBefore,
    supplyAfter: expectedTotal(burned.book),
  };
}

export type GenesisControlResult =
  | { readonly ok: true; readonly classification: 'ZERO_MAINNET' | 'LABELED_TESTNET_DEVELOPMENT' }
  | { readonly ok: false; readonly code: 'MAINNET_GENESIS_BLOCKED' | 'TESTNET_CANNOT_BECOME_MAINNET' };

/** Labeled development faucet sizes. Must never be copied into mainnet genesis. */
export const LABELED_TESTNET_SUNREY_DEVELOPMENT_UNITS = 1_000_000_000_000n;
export const LABELED_TESTNET_MOONREY_DEVELOPMENT_UNITS = 100_000_000_000n;

export function evaluateGenesisAllocation(input: {
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  readonly productionAllocationAuthorized?: boolean;
  readonly nonZeroMainnetQuantity?: bigint;
  readonly testnetQuantity?: bigint;
  readonly promoteTestnetToMainnet?: boolean;
}): GenesisControlResult {
  if (input.promoteTestnetToMainnet === true) {
    return { ok: false, code: 'TESTNET_CANNOT_BECOME_MAINNET' };
  }
  if (input.network === 'MAINNET') {
    if (input.productionAllocationAuthorized === true || (input.nonZeroMainnetQuantity ?? 0n) > 0n) {
      return { ok: false, code: 'MAINNET_GENESIS_BLOCKED' };
    }
    return { ok: true, classification: 'ZERO_MAINNET' };
  }
  if (
    input.testnetQuantity === LABELED_TESTNET_SUNREY_DEVELOPMENT_UNITS ||
    input.testnetQuantity === LABELED_TESTNET_MOONREY_DEVELOPMENT_UNITS
  ) {
    return { ok: true, classification: 'LABELED_TESTNET_DEVELOPMENT' };
  }
  return { ok: true, classification: input.network === 'TESTNET' ? 'LABELED_TESTNET_DEVELOPMENT' : 'ZERO_MAINNET' };
}

export type IsolatedSimulationOutput = {
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly becomesProductionConfiguration: false;
  readonly ok: boolean;
};

export function runIsolatedEconomicSimulation(input: MonetaryPolicySimulatorInput): IsolatedSimulationOutput {
  const output = new MonetaryPolicySimulator().run(input);
  return Object.freeze({
    classification: ENGINEERING_SIMULATION,
    becomesProductionConfiguration: false,
    ok: output.ok,
  });
}

export function simulationCannotAuthorizeProduction(
  output: IsolatedSimulationOutput,
  network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET',
): boolean {
  return output.becomesProductionConfiguration === false && network === 'MAINNET'
    ? mainnetEconomicsMissing(economicPolicyDocument({ network }))
    : true;
}

export class ProtocolNativeSupplyAuthority {
  readonly owner = CANONICAL_SUPPLY_AUTHORITY;
  readonly mintGate = CANONICAL_MINT_GATE;
  readonly applicationImported = false;
  private readonly books: Record<NativeMonetaryAssetId, AssetSupplyBook>;
  private readonly policyState: MonetaryPolicyState;
  private readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';

  constructor(input?: {
    readonly policyState?: MonetaryPolicyState;
    readonly network?: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
  }) {
    this.policyState = input?.policyState ?? 'DEVELOPMENT_ACTIVE';
    this.network = input?.network ?? 'DEVELOPMENT';
    const constitution = nativeAssetConstitution(this.policyState);
    this.books = {
      SUNREY_COIN: emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId),
      MOONREY_COIN: emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId),
    };
  }

  book(assetId: NativeMonetaryAssetId): AssetSupplyBook {
    return this.books[assetId];
  }

  snapshots(): Readonly<Record<NativeMonetaryAssetId, NativeSupplySnapshot>> {
    return Object.freeze({
      SUNREY_COIN: snapshotOf(this.books.SUNREY_COIN),
      MOONREY_COIN: snapshotOf(this.books.MOONREY_COIN),
    });
  }

  applyIssuance(input: {
    readonly actor: SupplyActor;
    readonly authority: MonetaryIssuanceAuthority;
  }): IssuanceResult | { readonly ok: false; readonly code: SupplyInvariantFailure | IssuanceRejection } {
    const actorRefusal = refuseForbiddenMutator(input.actor);
    if (actorRefusal) {
      return { ok: false, code: actorRefusal };
    }
    if (input.authority.actorKind === 'AI' || input.authority.actorKind === 'AGENT') {
      return { ok: false, code: 'AI_MONETARY_AUTHORIZATION_REJECTED' };
    }
    if (this.network === 'MAINNET') {
      return { ok: false, code: 'MAINNET_ECONOMICS_NOT_AUTHORIZED' };
    }
    const constitution = nativeAssetConstitution(this.policyState);
    const result = authorizeIssuance(constitution, this.books[input.authority.assetId], input.authority);
    if (!result.ok) {
      return result;
    }
    const report = enforceSupplyInvariants([result.book]);
    if (!report.ok) {
      return { ok: false, code: report.failures[0] ?? 'RECONCILIATION_MISMATCH' };
    }
    this.books[input.authority.assetId] = result.book;
    return result;
  }

  applyBurn(request: AuthorizedBurnRequest): BurnControlResult {
    const result = authorizedBurn(this.books[request.assetId], request);
    if (result.ok) {
      this.books[request.assetId] = result.book;
    }
    return result;
  }

  invariantReport(): SupplyInvariantReport {
    return enforceSupplyInvariants([this.books.SUNREY_COIN, this.books.MOONREY_COIN]);
  }

  toCanonicalState(input?: {
    readonly height?: bigint;
    readonly finalizedBlockId?: string | null;
    readonly executedTransactionIds?: readonly string[];
    readonly executedIssuanceAuthorizationIds?: readonly string[];
    readonly governanceAuthorizationRefs?: readonly string[];
    readonly accountNonces?: CanonicalProtocolState['accountNonces'];
  }): CanonicalProtocolState {
    const base = createGenesisState({ policyState: this.policyState });
    return Object.freeze({
      ...base,
      height: input?.height ?? 0n,
      finalizedBlockId: input?.finalizedBlockId ?? null,
      supplies: canonicalSuppliesFromBooks(this.books),
      accountNonces: Object.freeze([...(input?.accountNonces ?? [])]),
      executedTransactionIds: Object.freeze([...(input?.executedTransactionIds ?? [])].sort()),
      executedIssuanceAuthorizationIds: Object.freeze(
        [...(input?.executedIssuanceAuthorizationIds ?? [])].sort(),
      ),
      governanceAuthorizationRefs: Object.freeze([...(input?.governanceAuthorizationRefs ?? [])].sort()),
    });
  }

  static fromCanonicalState(state: CanonicalProtocolState): ProtocolNativeSupplyAuthority {
    const authority = new ProtocolNativeSupplyAuthority({
      policyState: state.policyState,
      network:
        state.policyState === 'TESTNET_ACTIVE'
          ? 'TESTNET'
          : state.policyState === 'PRODUCTION_CANDIDATE'
            ? 'MAINNET'
            : 'DEVELOPMENT',
    });
    const books = booksFromCanonicalSupplies(state.supplies);
    authority.books.SUNREY_COIN = books.SUNREY_COIN;
    authority.books.MOONREY_COIN = books.MOONREY_COIN;
    return authority;
  }
}

export function supplyAuthorityBoundary() {
  const boundary = nativeAssetAuthorityBoundary();
  return Object.freeze({
    canonicalOwner: CANONICAL_SUPPLY_AUTHORITY,
    mintGate: CANONICAL_MINT_GATE,
    applicationAuthority: boundary.application,
    nativeAuthority: boundary.nativeChain,
    applicationSupplyImported: false,
    productionMigrationPerformed: false,
    forbiddenMutators: FORBIDDEN_SUPPLY_MUTATORS,
    productionParameter: PRODUCTION_PARAMETER_UNCONFIGURED,
    mainnetEconomics: ECONOMIC_PARAMETER_NOT_AUTHORIZED,
  });
}

export function rejectAiEconomicApproval(actorKind: 'HUMAN' | 'AI' | 'AGENT' | 'AUTOMATION'): void {
  rejectAiActivation(actorKind);
}
