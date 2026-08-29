import { ACCESS_CHAIN_INVARIANTS } from './invariants.ts';
import {
  ACCESS_FIXTURE_BLOCK_HEIGHT,
  ACCESS_FIXTURE_BLOCK_TIME,
  FIXTURE_ATTESTOR_ACTOR,
  FIXTURE_OPERATOR_ACTOR,
  FIXTURE_SETTLEMENT,
  FIXTURE_TRAVELLER_ACTOR,
  FIXTURE_TREASURY_ACTOR,
  accessRightRequest,
  provisionAccessChainFixture,
  reservationRequest,
  unwrapAccess,
} from './fixtures.ts';
import { accessStateCommitment, replayAccessEvents } from './state.ts';
import type {
  AccessRightCommitmentRequest,
  ReservationCommitmentRequest,
} from './types.ts';

const net = provisionAccessChainFixture();

const right = unwrapAccess(
  net.access.commitAccessRight(accessRightRequest() as AccessRightCommitmentRequest),
);
const reservation = unwrapAccess(
  net.access.commitReservation(reservationRequest() as ReservationCommitmentRequest),
);
unwrapAccess(
  net.access.confirmReservation({
    reservationId: 'ars_transit_0001',
    actorRef: FIXTURE_OPERATOR_ACTOR,
    reasonCode: 'CAPACITY_CONFIRMED',
    blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 60n,
    blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
  }),
);
unwrapAccess(
  net.access.commitUsage({
    usageId: 'ausg_transit_0001',
    rightId: 'arg_transit_seat_hours_0001',
    reservationId: 'ars_transit_0001',
    actorRef: FIXTURE_TRAVELLER_ACTOR,
    quantity: 4n,
    measurementRef: 'measurement:transit.seat_hour.v1',
    purpose: 'sunrey.access.usage.commit',
    blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 4_000n,
    blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 2,
  }),
);
unwrapAccess(
  net.access.commitDelivery({
    deliveryId: 'adlv_transit_0001',
    usageId: 'ausg_transit_0001',
    attestingActorRef: FIXTURE_ATTESTOR_ACTOR,
    outcomeCode: 'DELIVERED_IN_FULL',
    evidenceRef: 'evidence:transit.delivery.v1',
    blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 20_000n,
    blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 3,
  }),
);
const settlement = unwrapAccess(
  net.access.referenceSettlementEvidence({
    settlementEvidenceId: 'aset_transit_0001',
    deliveryId: 'adlv_transit_0001',
    actorRef: FIXTURE_TREASURY_ACTOR,
    settlement: FIXTURE_SETTLEMENT,
    blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 21_000n,
    blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 4,
  }),
);

net.chain.advanceFinality(3);
const report = net.access.synchronizeFinality();
const replayed = unwrapAccess(replayAccessEvents(net.access.events()));

console.log('ACCESS-08 SunRey Chain access rights, reservations, and commitments');
console.log('right commitment          ', right.payloadCommitment.slice(0, 16));
console.log('reservation commitment    ', reservation.payloadCommitment.slice(0, 16));
console.log('settlement chain record   ', settlement.chainRecordType);
console.log('committed events          ', net.access.events().length);
console.log('finalized commitments     ', `${report.final}/${report.total}`);
console.log('live state commitment     ', report.stateCommitment.slice(0, 16));
console.log('replayed state commitment ', accessStateCommitment(replayed).slice(0, 16));
console.log(
  'deterministic replay      ',
  accessStateCommitment(replayed) === report.stateCommitment,
);
console.log('reservation state         ', net.access.reservationProjection('ars_transit_0001')?.state);
console.log('right state               ', net.access.rightProjection('arg_transit_seat_hours_0001')?.state);
console.log('conveys ownership         ', ACCESS_CHAIN_INVARIANTS.ACCESS_RIGHT_CONVEYS_OWNERSHIP);
console.log('mints asset               ', ACCESS_CHAIN_INVARIANTS.ACCESS_COMMITMENT_MINTS_ASSET);
console.log('alters ledger             ', ACCESS_CHAIN_INVARIANTS.ACCESS_COMMITMENT_ALTERS_LEDGER);
