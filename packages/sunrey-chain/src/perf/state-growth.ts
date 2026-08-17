import { FeeEngine } from '../fees/engine.ts';
import { FeeMempool } from '../fees/mempool.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import { DEV_CLOCK, fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from '../productive/fixtures.ts';
import { validatorDescriptors } from './consensus.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';
import { lockTx, nativeTransferTx } from './workload.ts';

export function measureStateGrowth(input: { readonly accounts: number; readonly transfers: number }): readonly BenchCaseResult[] {
  const engine = new FeeEngine();
  const productive = new ProductiveEconomyEngine(DEV_CLOCK);
  const query: number[] = [];
  for (let i = 0; i < input.accounts; i += 1) {
    engine.faucet(`acct_${i}`, 50_000n);
  }
  const mempool = new FeeMempool(engine);
  const validators = validatorDescriptors(4);
  let height = 1;
  for (let i = 0; i < input.transfers; i += 1) {
    const from = `acct_${i % input.accounts}`;
    const to = `acct_${(i + 1) % input.accounts}`;
    const tx = i % 5 === 0 ? lockTx(`grow-lock:${i}`, from, 1n) : nativeTransferTx(`grow:${i}`, from, to, 2n);
    mempool.admit(tx);
    if (mempool.size() >= 8 || i === input.transfers - 1) {
      const selected = mempool.selectForBlock();
      engine.activateAt(height);
      for (const item of selected) {
        engine.execute({
          tx: item,
          blockHeight: height,
          blockId: `blk_${height}`,
          proposerId: validators[0]!.validatorId,
          validators,
        });
      }
      mempool.removeCommitted(selected.map((item) => item.transactionId));
      height += 1;
    }
  }
  for (let i = 0; i < Math.min(8, input.accounts); i += 1) {
    const object = {
      ...solarFacility(),
      objectId: `obj.grow.${i}`,
      rightsReference: `right.obj.grow.${i}`,
      owner: `ctl.obj.grow.${i}`,
      controller: `ctl.obj.grow.${i}`,
      operator: `ctl.obj.grow.${i}`,
      oracleFeedReferences: [`feed.obj.grow.${i}`],
    };
    productive.registerObject(object);
    productive.putRight(fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller }));
    for (const fact of fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 100n + BigInt(i), unit: 'kWh' })) {
      productive.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: `claim.grow.${i}`,
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 100n + BigInt(i),
      unit: 'kWh',
    });
    productive.submitClaim(claim);
    productive.issueFromClaim(claim.claimId);
  }
  for (let i = 0; i < input.accounts; i += 1) {
    const started = nowNs();
    engine.accounts.position(`acct_${i}`, 'SUNREY_COIN');
    query.push(elapsedNs(started));
  }
  const snapshot = productive.snapshot();
  const snapshotBytes = JSON.stringify({
    objects: snapshot.objects.length,
    claims: snapshot.claims.length,
    facts: snapshot.facts.length,
    contributions: snapshot.contributions.length,
    receipts: snapshot.receipts.length,
  }).length;
  const restartStarted = nowNs();
  const replica = new ProductiveEconomyEngine(DEV_CLOCK);
  replica.restoreFromSnapshot(snapshot);
  const restartNs = elapsedNs(restartStarted);
  return [
    caseResult('state_growth', 'query_latency', {
      latency: summarizeLatency(query),
      extras: {
        accounts: input.accounts,
        transfers: input.transfers,
        snapshotBytes,
        restartNs,
        stateSizeHint: engine.receipts.size + snapshot.objects.length + snapshot.facts.length,
      },
    }),
  ];
}
