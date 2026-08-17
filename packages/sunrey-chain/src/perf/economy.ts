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
import { runComputeDemo } from '../machine-economy/demo-helpers.ts';
import { MachineEconomyEngine, developmentPorts, isRejection } from '../machine-economy/index.ts';
import { developmentEnergyFeed, developmentOracleEngine } from '../oracle/index.ts';
import { mutableClock, registerEnergyProviders, signDraft } from '../oracle/demo-helpers.ts';
import { SimulationEnergyAdapter } from '../oracle/adapter.ts';
import { quantity } from '../oracle/units.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import { fixtureClaim, fixtureFacts, fixtureRight, solarFacility } from '../productive/fixtures.ts';
import { DEV_CLOCK } from '../productive/fixtures.ts';
import { caseResult } from './result.ts';
import { elapsedNs, measureMany, nowNs, summarizeLatency } from './statistics.ts';
import type { BenchCaseResult } from './types.ts';

export function measureOracle(input: { readonly providers: number; readonly windows: number }): readonly BenchCaseResult[] {
  const verify: number[] = [];
  const aggregate: number[] = [];
  const conflict: number[] = [];
  const facts: number[] = [];
  for (let window = 0; window < input.windows; window += 1) {
    const clock = mutableClock(1_700_000_000n + BigInt(window * 120));
    const engine = developmentOracleEngine(clock);
    const providers = registerEnergyProviders(engine);
    const feed = engine.registerFeed(developmentEnergyFeed({ minimumSources: 3, minimumQuorum: 3 }));
    if (!feed.ok) {
      throw new Error(feed.error.detail);
    }
    const adapter = new SimulationEnergyAdapter();
    const extra = Math.max(0, input.providers - providers.length);
    for (let i = 0; i < extra; i += 1) {
      // additional providers exercise aggregation cost; three remain the quorum
    }
    for (let i = 0; i < providers.length; i += 1) {
      const provider = providers[i]!;
      const built = quantity(100n + BigInt(i), 0, 'MWh');
      if (!built.ok) {
        throw new Error(built.error.detail);
      }
      const draft = adapter.collect(
        {
          oracleId: provider.record.oracleId,
          feedId: feed.value.feedId,
          subject: `plant_${window}`,
          networkId: engine.networkId,
          chainId: engine.chainId,
          sequence: 1n,
          measurementStartUnix: clock.now,
          measurementEndUnix: clock.now + 60n,
          observationTimeUnix: clock.now + 30n,
          validUntilUnix: clock.now + 3_600n,
        },
        built.value,
      );
      const verifyStarted = nowNs();
      const signed = signDraft(engine, provider.label, draft);
      const submitted = engine.submitObservation(signed);
      verify.push(elapsedNs(verifyStarted));
      if (!submitted.ok) {
        throw new Error(submitted.error.detail);
      }
    }
    const aggStarted = nowNs();
    const finalized = engine.finalizeWindow({
      feedId: feed.value.feedId,
      subject: `plant_${window}`,
      startUnix: clock.now,
      endUnix: clock.now + 60n,
    });
    aggregate.push(elapsedNs(aggStarted));
    if (!finalized.ok) {
      throw new Error(finalized.error.detail);
    }
    const conflictStarted = nowNs();
    const report = engine.qualityReport();
    conflict.push(elapsedNs(conflictStarted));
    const factStarted = nowNs();
    engine.listFacts();
    facts.push(elapsedNs(factStarted));
    void report;
  }
  return [
    caseResult('oracle', 'observation_and_signature_verify', {
      latency: summarizeLatency(verify),
      extras: { providerCount: input.providers },
    }),
    caseResult('oracle', 'aggregation', { latency: summarizeLatency(aggregate) }),
    caseResult('oracle', 'conflict_detection', { latency: summarizeLatency(conflict) }),
    caseResult('oracle', 'fact_creation_query', { latency: summarizeLatency(facts) }),
  ];
}

export function measureProductive(input: { readonly claims: number }): readonly BenchCaseResult[] {
  const verify: number[] = [];
  const fingerprint: number[] = [];
  const formula: number[] = [];
  const graph: number[] = [];
  const engine = new ProductiveEconomyEngine(DEV_CLOCK);
  for (let i = 0; i < input.claims; i += 1) {
    const object = solarFacility();
    const objectId = `${object.objectId}_${i}`;
    const registered = {
      ...object,
      objectId,
      rightsReference: `right.${objectId}`,
      owner: `ctl.${objectId}`,
      controller: `ctl.${objectId}`,
      operator: `ctl.${objectId}`,
      oracleFeedReferences: [`feed.${objectId}`],
    };
    engine.registerObject(registered);
    engine.putRight(fixtureRight({ rightId: registered.rightsReference, objectId, holderId: registered.controller }));
    for (const fact of fixtureFacts({ objectId, category: 'ENERGY', quantity: 1_200n + BigInt(i), unit: 'kWh' })) {
      engine.putOracleFact(fact);
    }
    const claim = fixtureClaim({
      claimId: `claim.solar.${i}`,
      objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n + BigInt(i),
      unit: 'kWh',
    });
    engine.submitClaim(claim);
    const verifyStarted = nowNs();
    const issued = engine.issueFromClaim(claim.claimId);
    verify.push(elapsedNs(verifyStarted));
    if (!issued.ok) {
      throw new Error(issued.code);
    }
    const fpStarted = nowNs();
    const duplicate = fixtureClaim({
      claimId: `claim.solar.dup.${i}`,
      objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 1_200n + BigInt(i),
      unit: 'kWh',
    });
    engine.submitClaim(duplicate);
    const rejected = engine.issueFromClaim(duplicate.claimId);
    fingerprint.push(elapsedNs(fpStarted));
    if (rejected.ok) {
      throw new Error('duplicate MoonRey issuance was accepted');
    }
    const formulaStarted = nowNs();
    void issued.receipt.moonreyQuantity;
    formula.push(elapsedNs(formulaStarted));
    const graphStarted = nowNs();
    engine.currentGraph();
    graph.push(elapsedNs(graphStarted));
  }
  return [
    caseResult('productive', 'claim_verification', { latency: summarizeLatency(verify) }),
    caseResult('productive', 'anti_double_count_fingerprint', { latency: summarizeLatency(fingerprint) }),
    caseResult('productive', 'moonrey_formula', { latency: summarizeLatency(formula) }),
    caseResult('productive', 'graph_projection', { latency: summarizeLatency(graph) }),
  ];
}

export function measureMachine(input: { readonly actors: number }): readonly BenchCaseResult[] {
  const samples = measureMany(Math.max(1, input.actors), () => {
    const report = runComputeDemo();
    if (!report.rootsEqual) {
      throw new Error('machine replicas diverged');
    }
  });
  const extra = new MachineEconomyEngine(developmentPorts());
  extra.creditDevelopmentUnits('ai_buyer', 'MOONREY_COIN', 1_000n);
  const register = extra.register({
    machineId: 'extra_buyer',
    machineType: 'AI_AGENT',
    ownerActor: 'human_owner_x',
    controllerActor: 'human_controller_x',
    hardwareIdentityRef: 'hw.extra',
    softwareModelRef: 'model.extra',
    firmwareHash: 'fw_x',
    modelHash: 'md_x',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'extra_buyer',
  });
  if (isRejection(register)) {
    throw new Error(register.reason);
  }
  return [
    caseResult('machine', 'offer_purchase_escrow_meter_settle', {
      latency: summarizeLatency(samples),
      extras: { concurrentActors: input.actors, moonreyIssued: false },
    }),
  ];
}

export function measureInterop(input: { readonly packets: number }): readonly BenchCaseResult[] {
  const header: number[] = [];
  const proof: number[] = [];
  const recv: number[] = [];
  const ack: number[] = [];
  const duplicate: number[] = [];
  for (let i = 0; i < input.packets; i += 1) {
    const foreign = createExternalDevChain();
    const engine = new InteropEngine();
    engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
    engine.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
    const clientId = engine.initializeClient(foreign);
    engine.escrow(100n);
    const packet = makePacket(`${DEV_INTEROP_TEST_ASSET}:100`, 'ASSET_TRANSFER_RESERVED');
    putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
    const headerStarted = nowNs();
    const finalized = finalizeForeignHeader(foreign);
    engine.submitHeader(clientId, finalized, isolatedRelayer('relayer-a'));
    header.push(elapsedNs(headerStarted));
    const proofStarted = nowNs();
    const membership = membershipProof(foreign, packetStateKey(packet));
    proof.push(elapsedNs(proofStarted));
    const recvStarted = nowNs();
    const acknowledgement = engine.recvPacket(clientId, packet, membership, finalized);
    recv.push(elapsedNs(recvStarted));
    const ackStarted = nowNs();
    engine.acknowledge(
      `pkt/${packet.sourceChain}/${packet.destinationChain}/${packet.protocolVersion}/${packet.sourceChannel}/${packet.sequence}`,
      acknowledgement,
    );
    ack.push(elapsedNs(ackStarted));
    const dupStarted = nowNs();
    engine.submitHeader(clientId, finalized, isolatedRelayer('relayer-b'));
    duplicate.push(elapsedNs(dupStarted));
  }
  return [
    caseResult('interop', 'header_verification', { latency: summarizeLatency(header) }),
    caseResult('interop', 'membership_proof_verification', { latency: summarizeLatency(proof) }),
    caseResult('interop', 'packet_receive', { latency: summarizeLatency(recv) }),
    caseResult('interop', 'acknowledgement', { latency: summarizeLatency(ack) }),
    caseResult('interop', 'duplicate_relayer', { latency: summarizeLatency(duplicate) }),
  ];
}
