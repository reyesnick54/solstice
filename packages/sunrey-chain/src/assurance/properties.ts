import { authorizeAccountAction, encodeAddress, historicalSignatureStillVerifies, parseAddress } from '../wallet/index.ts';
import {
  CLASSICAL_WALLET_SUITE,
  publicDescriptorFromSeed,
  seedFromLabel,
  signWalletBytes,
} from '../wallet/keys.ts';
import type { AccountKeyRecord, BlockchainAccount, WalletSignature } from '../wallet/types.ts';
import { calculateFee, developmentFeeSchedule } from '../fees/schedule.ts';
import { usageForOperation } from '../fees/meter.ts';
import { FeeEngine } from '../fees/engine.ts';
import {
  developmentFeePolicyV2,
  disposeFeeV2,
  developmentFeeDispositionPolicyV2,
  dispositionV2Reconciles,
  nextBaseResourcePrice,
  initialBaseResourcePriceState,
  quoteFeeV2,
  usageV2ForTransaction,
} from '../fees/v2/index.ts';
import { transferTx, txId } from '../fees/demo-helpers.ts';
import { developmentFeeAssetPolicy, disposeFee, developmentFeeDispositionPolicy, dispositionReconciles } from '../fees/policy.ts';
import { medianOf, weightedMedianOf } from '../oracle/aggregation.ts';
import { contributionFingerprint } from '../productive/fingerprint.ts';
import { evaluateIssuanceFormula, mulDiv } from '../productive/formula.ts';
import { applyBurn, applyIssuance, emptyMoonReySupply, supplyReconciles } from '../productive/supply.ts';
import { MachineEconomyEngine, isRejection } from '../machine-economy/engine.ts';
import { developmentPorts } from '../machine-economy/ports.ts';
import {
  InteropEngine,
  createExternalDevChain,
  developmentExternalChain,
  finalizeForeignHeader,
  isolatedRelayer,
  makePacket,
  membershipProof,
  packetStateKey,
  putForeignState,
} from '../interop/index.ts';
import { DEV_INTEROP_TEST_ASSET, EXTERNAL_DEV_CHAIN_ID } from '../interop/types.ts';
import type { SeededRng } from './rng.ts';

type AssetBook = {
  issued: bigint;
  burned: bigint;
  circulating: bigint;
  locked: bigint;
};

function emptyBook(): AssetBook {
  return { issued: 0n, burned: 0n, circulating: 0n, locked: 0n };
}

function bookReconciles(book: AssetBook): boolean {
  return book.issued - book.burned === book.circulating + book.locked
    && book.issued >= 0n
    && book.burned >= 0n
    && book.circulating >= 0n
    && book.locked >= 0n;
}

export function feeActualNeverExceedsMax(rng: SeededRng, cases: number): void {
  const schedule = developmentFeeSchedule();
  for (let i = 0; i < cases; i += 1) {
    const encoded = rng.int(64, 2_048);
    const sigs = rng.int(1, 8);
    const usage = usageForOperation('NATIVE_TRANSFER', encoded, sigs);
    const actual = calculateFee(schedule, usage);
    const maxFee = actual + rng.bigint(0n, 5_000n);
    if (actual > maxFee) {
      throw new Error(`actual_fee ${actual} exceeded max_fee ${maxFee}`);
    }
    const disposition = disposeFee(developmentFeeDispositionPolicy(), 'SUNREY_COIN', actual);
    if (!dispositionReconciles(disposition)) {
      throw new Error('fee disposition failed to reconcile');
    }
    if (!developmentFeeAssetPolicy().enabledAssets.includes('SUNREY_COIN')) {
      throw new Error('development fee asset policy missing SUNREY_COIN');
    }
  }
}

export function feePolicyV2Properties(rng: SeededRng, cases: number): void {
  const policy = developmentFeePolicyV2();
  const start = initialBaseResourcePriceState(policy.bounds, 100n, 0);
  for (let i = 0; i < cases; i += 1) {
    const used = rng.bigint(0n, policy.bounds.blockResourceLimit * 2n);
    const next = nextBaseResourcePrice(start, used, policy.bounds, 1);
    if (next.baseResourcePrice < policy.bounds.minBasePrice || next.baseResourcePrice > policy.bounds.maxBasePrice) {
      throw new Error('v2 base price escaped bounds');
    }
    const again = nextBaseResourcePrice(start, used, policy.bounds, 1);
    if (again.baseResourcePrice !== next.baseResourcePrice) {
      throw new Error('v2 next price is not deterministic');
    }
    const tx = transferTx(txId(`v2-prop-${i}`), 'alice', 'bob', 1n, 5_000_000n);
    const usage = usageV2ForTransaction({ ...tx, signatureClass: i % 3 === 0 ? 'PQ' : 'CLASSICAL' });
    const quote = quoteFeeV2({
      policy,
      usage,
      baseResourcePrice: next.baseResourcePrice,
      feeAsset: 'SUNREY_COIN',
      maximumAuthorizedFee: 5_000_000n,
    });
    if (quote.ok && quote.quote.estimatedTotal > quote.quote.maximumAuthorizedFee) {
      throw new Error('v2 charged exceeded max_fee');
    }
    if (quote.ok) {
      const split = disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', quote.quote.estimatedTotal);
      if (!dispositionV2Reconciles(split)) {
        throw new Error('v2 disposition mismatch');
      }
    }
  }
}

export function feeEngineReservationConserved(rng: SeededRng, cases: number): void {
  for (let i = 0; i < cases; i += 1) {
    const engine = new FeeEngine();
    engine.faucet('alice', 1_000_000n);
    const amount = rng.bigint(1n, 200n);
    const maxFee = rng.bigint(1_000n, 8_000n);
    const tx = transferTx(txId(`fee-${i}-${rng.seed}`), 'alice', 'bob', amount, maxFee);
    const admission = engine.validateAdmission(tx);
    if (admission) {
      continue;
    }
    const result = engine.execute({
      tx,
      blockHeight: 1,
      blockId: 'b1',
      proposerId: 'val_a',
      validators: [
        { validatorId: 'val_a', votingPower: 1n },
        { validatorId: 'val_b', votingPower: 1n },
        { validatorId: 'val_c', votingPower: 1n },
        { validatorId: 'val_d', votingPower: 1n },
      ],
    });
    if (!result.ok) {
      continue;
    }
    const receipt = result.receipt;
    if (receipt.actualFee > receipt.reservedFee) {
      throw new Error('actual_fee exceeded reserved');
    }
    if (receipt.reservedFee !== receipt.actualFee + receipt.releasedFee) {
      throw new Error('reserved != charged + released');
    }
  }
}

export function walletThresholdProperties(rng: SeededRng, cases: number): void {
  for (let i = 0; i < cases; i += 1) {
    const n = rng.int(2, 5);
    const threshold = rng.int(1, n);
    const keys = Array.from({ length: n }, (_, index) => {
      const keyId = `key.${i}.${index}`;
      const seed = seedFromLabel(`${rng.seed}:${keyId}`);
      const descriptor = publicDescriptorFromSeed(keyId, seed);
      return { keyId, seed, descriptor };
    });
    const address = encodeAddress({
      networkId: 'net_sunrey_simulation',
      addressClass: 'MULTI_AUTH_ACCOUNT',
      algorithm: 'ED25519_V1',
      descriptorBytes: Buffer.from(keys.map((key) => key.keyId).join(',')),
    });
    const parsed = parseAddress(address.text, 'net_sunrey_simulation');
    if (!parsed.ok) {
      throw new Error(`valid address failed to parse: ${parsed.detail}`);
    }
    const records: AccountKeyRecord[] = keys.map((key) => ({
      keyId: key.keyId,
      suiteId: CLASSICAL_WALLET_SUITE,
      algorithm: 'ED25519_V1',
      publicKeyHex: key.descriptor.publicKeyHex,
      purpose: 'WALLET_SIGNING',
      status: 'ACTIVE',
      version: 1,
      createdHeight: 1,
      activatedHeight: 1,
      revokedHeight: null,
      rotatedFrom: null,
    }));
    const account: BlockchainAccount = {
      schemaVersion: 1,
      accountId: `bca.${i}`,
      address,
      ownerActorId: `actor.${i}`,
      controllerActorIds: [`actor.${i}`],
      accountType: 'MULTI_AUTH_ACCOUNT',
      authorizationPolicy: {
        schemaVersion: 1,
        kind: 'M_OF_N',
        threshold,
        authorizedKeyIds: keys.map((key) => key.keyId),
        roleBindings: {},
        recoveryKeyIds: [],
      },
      nonce: 1n,
      approvedCryptoSuites: [CLASSICAL_WALLET_SUITE],
      recoveryPolicyReference: null,
      createdHeight: 1,
      status: 'ACTIVE',
      keys: records,
      delegatedLimits: [],
      pendingRecovery: null,
      pendingRotation: null,
      securityHoldPolicy: null,
    };
    const bodyHash = Buffer.alloc(32, (i % 255) + 1).toString('hex');
    const presented = rng.int(0, n);
    const chosen = keys.slice(0, presented);
    const signatures: WalletSignature[] = chosen.map((key) => ({
      keyId: key.keyId,
      suiteId: CLASSICAL_WALLET_SUITE,
      publicKeyHex: key.descriptor.publicKeyHex,
      signatureHex: signWalletBytes(key.seed, Buffer.from(bodyHash, 'hex')),
    }));
    const withDuplicate = rng.bool() && signatures.length > 0 ? [...signatures, signatures[0]!] : signatures;
    const result = authorizeAccountAction({
      account,
      bodyHash,
      signatures: withDuplicate,
      currentHeight: 10,
    });
    const unique = new Set(withDuplicate.map((signature) => signature.keyId));
    if (withDuplicate.length !== unique.size) {
      if (result.ok) {
        throw new Error('duplicate signer satisfied threshold');
      }
    } else if (presented < threshold && result.ok) {
      throw new Error('insufficient signatures authorized an action');
    } else if (presented >= threshold && !result.ok) {
      throw new Error(`valid M-of-N rejected: ${result.detail}`);
    }
    if (signatures[0]) {
      if (!historicalSignatureStillVerifies(signatures[0].publicKeyHex, bodyHash, signatures[0].signatureHex)) {
        throw new Error('historical signature stopped verifying');
      }
      const revoked: BlockchainAccount = {
        ...account,
        keys: account.keys.map((key, index) => (index === 0 ? { ...key, status: 'REVOKED', revokedHeight: 2 } : key)),
      };
      const revokedResult = authorizeAccountAction({
        account: revoked,
        bodyHash,
        signatures: [signatures[0]],
        currentHeight: 11,
      });
      if (revokedResult.ok) {
        throw new Error('revoked key signed a new transaction');
      }
    }
  }
}

export function oracleAggregationProperties(rng: SeededRng, cases: number): void {
  for (let i = 0; i < cases; i += 1) {
    const values = Array.from({ length: rng.int(1, 7) }, () => rng.bigint(1n, 10_000n));
    const shuffled = rng.shuffle(values);
    if (medianOf(values) !== medianOf(shuffled)) {
      throw new Error('median depended on insertion order');
    }
    const weighted = values.map((value, index) => ({ value, weight: BigInt(index + 1) }));
    const shuffledWeighted = rng.shuffle(weighted);
    if (weightedMedianOf(weighted) !== weightedMedianOf(shuffledWeighted)) {
      throw new Error('weighted median depended on insertion order');
    }
  }
}

export function moonreyIssuanceProperties(rng: SeededRng, cases: number): void {
  let supply = emptyMoonReySupply();
  const seen = new Set<string>();
  for (let i = 0; i < cases; i += 1) {
    const eligible = rng.bigint(1n, 5_000n);
    const result = evaluateIssuanceFormula({
      eligibleQuantity: eligible,
      categoryWeight: rng.bigint(1n, 1_000_000n),
      claimTypeWeight: rng.bigint(1n, 1_000_000n),
      qualityFactor: rng.bigint(1n, 1_000_000n),
      roundingMode: rng.pick(['FLOOR', 'CEIL', 'ROUND_HALF_EVEN']),
      maximumIssuance: rng.bigint(1n, 2_000n),
    });
    if (result.moonreyQuantity > result.uncappedQuantity) {
      throw new Error('cap produced more than uncapped');
    }
    const left = contributionFingerprint({
      objectId: 'obj.solar',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1_700_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 100n,
      baseUnitId: 'kWh',
      oracleFactIds: ['z', 'a'],
      upstreamContributionIds: ['b', 'a'],
    });
    const right = contributionFingerprint({
      objectId: 'obj.solar',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1_700_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 100n,
      baseUnitId: 'kWh',
      oracleFactIds: ['a', 'z'],
      upstreamContributionIds: ['a', 'b'],
    });
    if (left !== right) {
      throw new Error('fingerprint depended on input order');
    }
    const fingerprint = contributionFingerprint({
      objectId: `obj.${rng.int(0, 8)}`,
      measurementPeriodEpoch: rng.int(1, 4),
      validFromUnixSeconds: 1_700_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      claimType: rng.pick(['CAPACITY', 'OUTPUT', 'DELIVERY']),
      category: rng.pick(['ENERGY', 'COMPUTE', 'MANUFACTURING']),
      normalizedQuantity: eligible,
      baseUnitId: 'kWh',
      oracleFactIds: rng.shuffle(['fact.a', 'fact.b', 'fact.c']).slice(0, rng.int(1, 3)),
      upstreamContributionIds: rng.shuffle(['up.1', 'up.2']).slice(0, rng.int(0, 2)),
    });
    if (seen.has(fingerprint) || result.moonreyQuantity === 0n) {
      continue;
    }
    seen.add(fingerprint);
    supply = applyIssuance(supply, result.moonreyQuantity);
    if (rng.int(0, 4) === 0 && supply.holdings > 0n) {
      supply = applyBurn(supply, rng.bigint(1n, supply.holdings));
    }
    if (!supplyReconciles(supply)) {
      throw new Error('MoonRey supply failed to reconcile');
    }
  }
}

export function nativeAssetInvariantProperties(rng: SeededRng, cases: number): void {
  const books: Record<'SUNREY_COIN' | 'MOONREY_COIN', AssetBook> = {
    SUNREY_COIN: emptyBook(),
    MOONREY_COIN: emptyBook(),
  };
  const usedAuth = new Set<string>();
  for (let i = 0; i < cases; i += 1) {
    const asset = rng.pick(['SUNREY_COIN', 'MOONREY_COIN'] as const);
    const book = books[asset];
    const qty = rng.bigint(1n, 200n);
    const op = rng.pick(['issue', 'burn', 'lock', 'unlock', 'cross'] as const);
    if (op === 'issue') {
      const auth = `auth.${asset}.${i}`;
      if (usedAuth.has(auth)) {
        continue;
      }
      usedAuth.add(auth);
      book.issued += qty;
      book.circulating += qty;
    } else if (op === 'burn') {
      if (qty > book.circulating) {
        continue;
      }
      book.burned += qty;
      book.circulating -= qty;
    } else if (op === 'lock') {
      if (qty > book.circulating) {
        continue;
      }
      book.circulating -= qty;
      book.locked += qty;
    } else if (op === 'unlock') {
      if (qty > book.locked) {
        continue;
      }
      book.locked -= qty;
      book.circulating += qty;
    }
    if (!bookReconciles(book)) {
      throw new Error(`${asset} supply invariant broken`);
    }
    if (books.SUNREY_COIN.circulating + books.MOONREY_COIN.circulating < 0n) {
      throw new Error('cross-asset arithmetic produced a negative');
    }
  }
}

export function machineMandateProperties(): void {
  const engine = new MachineEconomyEngine(developmentPorts());
  engine.creditDevelopmentUnits('human_owner_1', 'SUNREY_COIN', 50_000n);
  const registered = engine.register({
    machineId: 'machine.fuzz.1',
    machineType: 'AI_AGENT',
    ownerActor: 'human_owner_1',
    controllerActor: 'human_controller_1',
    hardwareIdentityRef: 'hw.fuzz',
    softwareModelRef: 'model.fuzz.v1',
    firmwareHash: 'fw_fuzz',
    modelHash: 'md_fuzz',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'machine.fuzz.1',
  });
  if (isRejection(registered)) {
    throw new Error(`machine register failed: ${registered.reason}`);
  }
  const forbidden = engine.refuseAuthority('machine.fuzz.1', 'BECOME_VALIDATOR');
  if (!isRejection(forbidden)) {
    throw new Error('machine became a validator');
  }
}

export function interopPacketAtMostOnce(): void {
  const foreign = createExternalDevChain();
  const engine = new InteropEngine();
  engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  engine.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
  const clientId = engine.initializeClient(foreign);
  engine.escrow(25n);
  const packet = makePacket(`${DEV_INTEROP_TEST_ASSET}:25`, 'ASSET_TRANSFER_RESERVED');
  putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
  const header = finalizeForeignHeader(foreign);
  engine.submitHeader(clientId, header, isolatedRelayer('relayer.honest'));
  engine.recvPacket(clientId, packet, membershipProof(foreign, packetStateKey(packet)), header);
  let replayed = false;
  try {
    engine.recvPacket(clientId, packet, membershipProof(foreign, packetStateKey(packet)), header);
    replayed = true;
  } catch {
    replayed = false;
  }
  if (replayed) {
    throw new Error('packet executed twice');
  }
  engine.assertSupply();
}

export function mulDivMatchesRounding(rng: SeededRng, cases: number): void {
  for (let i = 0; i < cases; i += 1) {
    const value = rng.bigint(0n, 10_000n);
    const numerator = rng.bigint(0n, 1_000_000n);
    const denominator = rng.bigint(1n, 1_000_000n);
    const floor = mulDiv(value, numerator, denominator, 'FLOOR');
    const ceil = mulDiv(value, numerator, denominator, 'CEIL');
    if (floor > ceil) {
      throw new Error('floor exceeded ceil');
    }
  }
}
