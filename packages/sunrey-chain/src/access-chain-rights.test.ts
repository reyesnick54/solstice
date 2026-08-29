import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  ACCESS_CAPABILITY_REFS,
  ACCESS_CHAIN_INVARIANTS,
  ACCESS_COMMITMENT_KIND_TO_CHAIN_RECORD,
  ACCESS_COMMITMENT_KINDS,
  ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE,
  accessFinalityFor,
  accessRightTransfersOwnership,
  accessStateCommitment,
  applyAccessEvent,
  emptyAccessChainState,
  replayAccessEvents,
  validateAccessRightClass,
} from './access/index.ts';
import {
  ACCESS_FIXTURE_BLOCK_HEIGHT,
  ACCESS_FIXTURE_BLOCK_TIME,
  ACCESS_FIXTURE_RIGHT_EXPIRY,
  FIXTURE_ATTESTOR_ACTOR,
  FIXTURE_INACTIVE_OBJECT_ID,
  FIXTURE_OPERATOR_ACTOR,
  FIXTURE_OUTSIDER_ACTOR,
  FIXTURE_REVOKED_ACTOR,
  FIXTURE_SETTLEMENT,
  FIXTURE_TRAVELLER_ACTOR,
  FIXTURE_TREASURY_ACTOR,
  accessRightRequest,
  provisionAccessChainFixture,
  reservationRequest,
  unwrapAccess,
} from './access/fixtures.ts';
import { ownershipImpliesUnlimitedUse } from './protocol/rights.ts';
import type {
  AccessChainFailure,
  AccessCommitmentRecord,
  AccessRightCommitmentRequest,
  ReservationCommitmentRequest,
} from './access/types.ts';

const RIGHT_ID = 'arg_transit_seat_hours_0001';
const RESERVATION_ID = 'ars_transit_0001';
const USAGE_ID = 'ausg_transit_0001';
const DELIVERY_ID = 'adlv_transit_0001';

type AccessResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccessChainFailure };

function expectFailure<T>(result: AccessResult<T>): AccessChainFailure {
  assert.equal(result.ok, false, 'expected the commitment to be refused');
  return (result as { readonly ok: false; readonly error: AccessChainFailure }).error;
}

function grantRight(
  net: ReturnType<typeof provisionAccessChainFixture>,
  overrides: Record<string, unknown> = {},
): AccessCommitmentRecord {
  return unwrapAccess(
    net.access.commitAccessRight(accessRightRequest(overrides) as AccessRightCommitmentRequest),
  );
}

function reserve(
  net: ReturnType<typeof provisionAccessChainFixture>,
  overrides: Record<string, unknown> = {},
): AccessCommitmentRecord {
  return unwrapAccess(
    net.access.commitReservation(reservationRequest(overrides) as ReservationCommitmentRequest),
  );
}

function runFullLifecycle(net: ReturnType<typeof provisionAccessChainFixture>) {
  grantRight(net);
  reserve(net);
  unwrapAccess(
    net.access.confirmReservation({
      reservationId: RESERVATION_ID,
      actorRef: FIXTURE_OPERATOR_ACTOR,
      reasonCode: 'CAPACITY_CONFIRMED',
      blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 60n,
      blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
    }),
  );
  unwrapAccess(
    net.access.commitUsage({
      usageId: USAGE_ID,
      rightId: RIGHT_ID,
      reservationId: RESERVATION_ID,
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
      deliveryId: DELIVERY_ID,
      usageId: USAGE_ID,
      attestingActorRef: FIXTURE_ATTESTOR_ACTOR,
      outcomeCode: 'DELIVERED_IN_FULL',
      evidenceRef: 'evidence:transit.delivery.v1',
      blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 20_000n,
      blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 3,
    }),
  );
  return unwrapAccess(
    net.access.referenceSettlementEvidence({
      settlementEvidenceId: 'aset_transit_0001',
      deliveryId: DELIVERY_ID,
      actorRef: FIXTURE_TREASURY_ACTOR,
      settlement: FIXTURE_SETTLEMENT,
      blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 21_000n,
      blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 4,
    }),
  );
}

describe('ACCESS-08 access rights, reservations, and commitments on SunRey Chain', () => {
  it('1. maps every access commitment kind onto an existing chain record type', () => {
    const net = provisionAccessChainFixture();
    const right = grantRight(net);
    assert.equal(right.chainRecordType, 'EVIDENCE_ANCHOR');
    assert.equal(right.kind, 'ACCESS_RIGHT_CREATED');

    const settlement = runFullLifecycle(net);
    assert.equal(settlement.chainRecordType, 'DIGITAL_ASSET_SETTLEMENT');
    assert.equal(net.access.record(DELIVERY_ID) ?? undefined, undefined);

    const delivery = net.access
      .records()
      .find((record) => record.kind === 'DELIVERY_COMMITTED');
    assert.equal(delivery?.chainRecordType, 'ATTESTATION');

    for (const kind of ACCESS_COMMITMENT_KINDS) {
      assert.ok(ACCESS_COMMITMENT_KIND_TO_CHAIN_RECORD[kind]);
    }
    const intents = net.chain
      .snapshot()
      .intents.filter((intent) => intent.sourceSubsystem === 'access-fabric');
    assert.equal(intents.length, 6);
    for (const intent of intents) {
      assert.equal(intent.economicValueMovement, false);
      assert.equal(intent.dataClass, 'ON_CHAIN_SAFE');
    }
  });

  it('2. refuses unauthorized right creation', () => {
    const net = provisionAccessChainFixture();

    const unregistered = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({ issuerActorRef: 'act_not_in_registry' }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(unregistered.code, 'ACCESS_ACTOR_UNKNOWN');

    const revoked = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({ issuerActorRef: FIXTURE_REVOKED_ACTOR }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(revoked.code, 'ACCESS_ACTOR_REVOKED');

    const notAuthority = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({ issuerActorRef: FIXTURE_OUTSIDER_ACTOR }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(notAuthority.code, 'ACCESS_ISSUER_UNAUTHORIZED');

    const withoutCapability = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({ issuerActorRef: FIXTURE_TRAVELLER_ACTOR }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(withoutCapability.code, 'ACCESS_CAPABILITY_MISSING');

    assert.equal(net.access.events().length, 0);
    assert.equal(
      net.chain.snapshot().intents.filter((intent) => intent.sourceSubsystem === 'access-fabric')
        .length,
      0,
    );

    grantRight(net);
    const wrongReserver = expectFailure(
      net.access.commitReservation(
        reservationRequest({ requestingActorRef: FIXTURE_ATTESTOR_ACTOR }) as ReservationCommitmentRequest,
      ),
    );
    assert.equal(wrongReserver.code, 'ACCESS_CAPABILITY_MISSING');
  });

  it('3. refuses reservations and usage against an expired right', () => {
    const net = provisionAccessChainFixture();
    grantRight(net);
    const afterExpiry = ACCESS_FIXTURE_RIGHT_EXPIRY + 1n;

    const lateReservation = expectFailure(
      net.access.commitReservation(
        reservationRequest({
          reservationId: 'ars_late_0001',
          blockTimeUnixSeconds: afterExpiry,
        }) as ReservationCommitmentRequest,
      ),
    );
    assert.equal(lateReservation.code, 'ACCESS_RIGHT_EXPIRED');

    const lateUsage = expectFailure(
      net.access.commitUsage({
        usageId: 'ausg_late_0001',
        rightId: RIGHT_ID,
        actorRef: FIXTURE_TRAVELLER_ACTOR,
        quantity: 1n,
        measurementRef: 'measurement:transit.seat_hour.v1',
        purpose: 'sunrey.access.usage.commit',
        blockTimeUnixSeconds: afterExpiry,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 10,
      }),
    );
    assert.equal(lateUsage.code, 'ACCESS_RIGHT_EXPIRED');

    const outsideWindow = expectFailure(
      net.access.commitReservation(
        reservationRequest({
          reservationId: 'ars_outside_0001',
          endsAtUnixSeconds: ACCESS_FIXTURE_RIGHT_EXPIRY + 3_600n,
        }) as ReservationCommitmentRequest,
      ),
    );
    assert.equal(outsideWindow.code, 'ACCESS_RIGHT_WINDOW_INVALID');

    // Expiry is derived from time, so the stored right is untouched and the
    // access state never gained an event for the refused commitments.
    assert.equal(net.access.rightProjection(RIGHT_ID)?.state, 'ACTIVE');
    assert.equal(net.access.events().length, 1);
  });

  it('4. revokes a right, releases nothing retroactively, and blocks later reservations', () => {
    const net = provisionAccessChainFixture();
    grantRight(net);
    reserve(net);

    const revocation = unwrapAccess(
      net.access.revokeAccessRight({
        rightId: RIGHT_ID,
        revokingActorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'OPERATOR_WITHDRAWAL',
        policyRef: 'policy:access.transit.v1',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 120n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
      }),
    );
    assert.equal(revocation.kind, 'ACCESS_RIGHT_REVOKED');
    assert.equal(net.access.rightProjection(RIGHT_ID)?.state, 'REVOKED');
    assert.equal(net.access.rightProjection(RIGHT_ID)?.revokedAtUnixSeconds, ACCESS_FIXTURE_BLOCK_TIME + 120n);

    const afterRevocation = expectFailure(
      net.access.commitReservation(
        reservationRequest({
          reservationId: 'ars_post_revocation',
          blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 200n,
        }) as ReservationCommitmentRequest,
      ),
    );
    assert.equal(afterRevocation.code, 'ACCESS_RIGHT_REVOKED');

    // A right is revoked once. An identical resubmission is idempotent and a
    // differing one is a conflict, so revocation can never be recorded twice.
    const resubmitted = unwrapAccess(
      net.access.revokeAccessRight({
        rightId: RIGHT_ID,
        revokingActorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'OPERATOR_WITHDRAWAL',
        policyRef: 'policy:access.transit.v1',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 120n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
      }),
    );
    assert.equal(resubmitted.recordId, revocation.recordId);
    assert.equal(resubmitted.duplicateOf, revocation.recordId);

    const differingSecondRevocation = expectFailure(
      net.access.revokeAccessRight({
        rightId: RIGHT_ID,
        revokingActorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'OPERATOR_WITHDRAWAL_AGAIN',
        policyRef: 'policy:access.transit.v1',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 300n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 2,
      }),
    );
    assert.equal(differingSecondRevocation.code, 'ACCESS_COMMITMENT_CONFLICT');

    // The state machine refuses a second revocation on its own terms too, so a
    // hand-assembled event log cannot revoke an already revoked right.
    const revocationEvent = net.access
      .events()
      .find((event) => event.kind === 'ACCESS_RIGHT_REVOKED');
    assert.ok(revocationEvent);
    const state = unwrapAccess(replayAccessEvents(net.access.events()));
    const secondRevocation = applyAccessEvent(state, {
      ...revocationEvent,
      sequence: state.sequence + 1,
      commitmentKey: `${revocationEvent.commitmentKey}-variant` as typeof revocationEvent.commitmentKey,
    });
    assert.equal(secondRevocation.ok, false);
    assert.equal(
      (secondRevocation as { readonly ok: false; readonly error: AccessChainFailure }).error.code,
      'ACCESS_RIGHT_REVOKED',
    );

    assert.equal(net.access.events().length, 3);

    const unauthorizedRevocation = expectFailure(
      net.access.revokeAccessRight({
        rightId: 'arg_unknown',
        revokingActorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'MISTAKE',
        policyRef: 'policy:access.transit.v1',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 300n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 2,
      }),
    );
    assert.equal(unauthorizedRevocation.code, 'ACCESS_RIGHT_UNKNOWN');

    // The historical creation commitment stays on chain untouched.
    const created = net.access.records().find((record) => record.kind === 'ACCESS_RIGHT_CREATED');
    assert.ok(created);
    assert.equal(net.access.record(created.recordId)?.payloadCommitment, created.payloadCommitment);
  });

  it('5. treats an identical resubmission as a duplicate and a changed one as a conflict', () => {
    const net = provisionAccessChainFixture();
    const first = grantRight(net);

    const replayed = unwrapAccess(
      net.access.commitAccessRight(accessRightRequest() as AccessRightCommitmentRequest),
    );
    assert.equal(replayed.recordId, first.recordId);
    assert.equal(replayed.duplicateOf, first.recordId);
    assert.equal(net.access.events().length, 1);
    assert.equal(
      net.chain.snapshot().intents.filter((intent) => intent.sourceSubsystem === 'access-fabric')
        .length,
      1,
    );

    const conflicting = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          target: {
            productiveObjectId: 'peo_transit_fleet_north',
            capacityUnit: 'seat_hour',
            capacityQuantity: 400n,
            geographyRef: 'grid_ne_01',
          },
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(conflicting.code, 'ACCESS_COMMITMENT_CONFLICT');
    assert.equal(net.access.rightProjection(RIGHT_ID)?.capacityQuantity, 40n);

    reserve(net);
    const duplicateReservation = reserve(net);
    assert.equal(duplicateReservation.duplicateOf, duplicateReservation.recordId);
    assert.equal(net.access.events().length, 2);

    // The state machine independently refuses an event whose commitment key
    // was already applied, so a replayed log cannot double-count either.
    const events = net.access.events();
    const state = unwrapAccess(replayAccessEvents(events));
    const firstEvent = events[0];
    assert.ok(firstEvent);
    const reapplied = applyAccessEvent(state, { ...firstEvent, sequence: state.sequence + 1 });
    assert.equal(reapplied.ok, false);
    assert.equal(
      (reapplied as { readonly ok: false; readonly error: AccessChainFailure }).error.code,
      'ACCESS_DUPLICATE_COMMITMENT',
    );
  });

  it('6. refuses an invalid target productive object', () => {
    const net = provisionAccessChainFixture();

    const unknown = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          target: {
            productiveObjectId: 'peo_does_not_exist',
            capacityUnit: 'seat_hour',
            capacityQuantity: 10n,
            geographyRef: 'grid_ne_01',
          },
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(unknown.code, 'ACCESS_ISSUER_UNAUTHORIZED');

    const inactive = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          target: {
            productiveObjectId: FIXTURE_INACTIVE_OBJECT_ID,
            capacityUnit: 'seat_hour',
            capacityQuantity: 10n,
            geographyRef: 'grid_ne_01',
          },
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(inactive.code, 'ACCESS_TARGET_INACTIVE');

    const wrongUnit = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          target: {
            productiveObjectId: 'peo_transit_fleet_north',
            capacityUnit: 'gpu_hour',
            capacityQuantity: 10n,
            geographyRef: 'grid_ne_01',
          },
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(wrongUnit.code, 'ACCESS_TARGET_UNIT_MISMATCH');

    const zeroCapacity = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          target: {
            productiveObjectId: 'peo_transit_fleet_north',
            capacityUnit: 'seat_hour',
            capacityQuantity: 0n,
            geographyRef: 'grid_ne_01',
          },
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(zeroCapacity.code, 'ACCESS_TARGET_QUANTITY_INVALID');

    assert.equal(net.access.events().length, 0);
  });

  it('7. keeps personal access material off chain', () => {
    const net = provisionAccessChainFixture();

    const itinerary = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          scopeLabel: 'Kings Cross 09:14 to Newcastle 12:02 seat 14A',
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(itinerary.code, 'ACCESS_PRIVACY_VIOLATION');

    const contact = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          restrictionLabels: ['contact ada@example.com before boarding'],
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(contact.code, 'ACCESS_PRIVACY_VIOLATION');

    const paymentCredential = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          restrictionLabels: ['charge 4111111111111111'],
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(paymentCredential.code, 'ACCESS_PRIVACY_VIOLATION');

    const location = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          purpose: 'pickup at 54.978252, -1.617780',
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(location.code, 'ACCESS_PRIVACY_VIOLATION');

    // A holder is bound by a pseudonymous commitment, never by a raw subject id.
    const right = grantRight(net);
    const intent = net.chain
      .snapshot()
      .intents.find((row) => row.sourceRecordReference === RIGHT_ID);
    assert.ok(intent);
    assert.equal(intent.subjectReference?.kind, 'PSEUDONYMOUS_SUBJECT_REFERENCE');
    const serialized = JSON.stringify(intent.schema.fields);
    assert.equal(serialized.includes('sub_synthetic_traveller'), false);
    assert.equal(serialized.includes('northern-regional-transit'), false);
    assert.equal(serialized.includes('off-peak-only'), false);
    assert.equal(right.rawPersonalDataOnChain, false);
    assert.match(String(intent.schema.fields.holderReference), /^csr_[0-9a-f]{16}$/);
  });

  it('8. replays the committed log deterministically and in any delivery order', () => {
    const net = provisionAccessChainFixture();
    runFullLifecycle(net);

    const events = net.access.events();
    const live = net.access.stateCommitment();
    const replayed = unwrapAccess(replayAccessEvents(events));
    assert.equal(accessStateCommitment(replayed), live);

    const shuffled = [...events].reverse();
    const outOfOrder = unwrapAccess(replayAccessEvents(shuffled));
    assert.equal(accessStateCommitment(outOfOrder), live);

    const second = provisionAccessChainFixture();
    runFullLifecycle(second);
    assert.equal(second.access.stateCommitment(), live);

    const prefix = unwrapAccess(replayAccessEvents(events.slice(0, 3)));
    assert.notEqual(accessStateCommitment(prefix), live);
    let resumed = prefix;
    for (const event of events.slice(3)) {
      resumed = unwrapAccess(applyAccessEvent(resumed, event));
    }
    assert.equal(accessStateCommitment(resumed), live);

    const gap = applyAccessEvent(emptyAccessChainState(), { ...events[1]!, sequence: 3 });
    assert.equal(gap.ok, false);
    assert.equal(
      (gap as { readonly ok: false; readonly error: AccessChainFailure }).error.code,
      'ACCESS_SEQUENCE_INVALID',
    );
  });

  it('9. synchronizes finality without rewriting access state', () => {
    const net = provisionAccessChainFixture();
    runFullLifecycle(net);

    const beforeFinality = net.access.synchronizeFinality();
    assert.equal(beforeFinality.total, 6);
    assert.equal(beforeFinality.final, 0);
    assert.equal(beforeFinality.pending, 6);

    net.chain.advanceFinality(3);
    const afterFinality = net.access.synchronizeFinality();
    assert.equal(afterFinality.final, 6);
    assert.equal(afterFinality.pending, 0);
    assert.equal(afterFinality.stateCommitment, beforeFinality.stateCommitment);
    assert.equal(afterFinality.sequence, 6);
    for (const projection of afterFinality.projections) {
      assert.equal(projection.applicationStateRewrittenByChain, false);
      assert.ok(projection.blockReference);
    }

    const reconciled = unwrapAccess(net.access.reconcile(afterFinality.projections[0]!.recordId));
    assert.equal(reconciled.outcome, 'MATCHED');
    assert.equal(reconciled.autoFixed, false);

    const firstRecord = net.access.records()[0];
    assert.ok(firstRecord?.operationId);
    net.chain.observeReorg(firstRecord.operationId);
    const afterReorg = net.access.synchronizeFinality();
    assert.equal(afterReorg.reviewRequired, 1);
    assert.equal(afterReorg.stateCommitment, beforeFinality.stateCommitment);
    assert.equal(net.access.rightProjection(RIGHT_ID)?.state, 'ACTIVE');
    assert.equal(net.access.reservationProjection(RESERVATION_ID)?.state, 'SETTLED');
    assert.equal(accessFinalityFor('REORG_OBSERVED'), 'REVIEW_REQUIRED');
    assert.equal(accessFinalityFor('UNKNOWN'), 'UNKNOWN');
    assert.equal(accessFinalityFor('FINALIZED'), 'FINAL');
  });

  it('10. separates ownership from access, usage, lease, and reservation', () => {
    const net = provisionAccessChainFixture();

    for (const rightClass of ['OWN', 'CONTROL', 'TRANSFER']) {
      const refused = expectFailure(
        net.access.commitAccessRight(
          accessRightRequest({ rightClass }) as AccessRightCommitmentRequest,
        ),
      );
      assert.equal(refused.code, 'ACCESS_OWNERSHIP_RIGHT_REFUSED');
    }

    const conveying = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({
          permittedOperations: ['BOARD', 'TRANSFER_TITLE'],
        }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(conveying.code, 'ACCESS_OWNERSHIP_OPERATION_REFUSED');

    const minting = expectFailure(
      net.access.commitAccessRight(
        accessRightRequest({ permittedOperations: ['MINT'] }) as AccessRightCommitmentRequest,
      ),
    );
    assert.equal(minting.code, 'ACCESS_OWNERSHIP_OPERATION_REFUSED');

    assert.equal(validateAccessRightClass('LEASE', ['OCCUPY'])?.code, undefined);
    assert.equal(validateAccessRightClass('PARTICIPATE', [])?.code, 'ACCESS_RIGHT_CLASS_INVALID');

    const right = grantRight(net, { rightClass: 'LEASE' });
    assert.equal(right.conveysOwnership, false);
    const projection = net.access.rightProjection(RIGHT_ID);
    assert.equal(projection?.rightClass, 'LEASE');
    assert.equal(projection?.conveysOwnership, false);
    assert.equal(projection?.transferable, false);
    assert.equal(ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE.LEASE, 'LEASE');
    assert.equal(ACCESS_RIGHT_CLASS_TO_PROTOCOL_RIGHT_TYPE.RESERVATION, 'ACCESS');
    assert.equal(accessRightTransfersOwnership(), false);
    assert.equal(ownershipImpliesUnlimitedUse(), false);
  });

  it('11. keeps reserved and consumed capacity within the granted right', () => {
    const net = provisionAccessChainFixture();
    grantRight(net, {
      target: {
        productiveObjectId: 'peo_transit_fleet_north',
        capacityUnit: 'seat_hour',
        capacityQuantity: 6n,
        geographyRef: 'grid_ne_01',
      },
    });
    reserve(net, { quantity: 4n });

    const overCapacity = expectFailure(
      net.access.commitReservation(
        reservationRequest({ reservationId: 'ars_over', quantity: 3n }) as ReservationCommitmentRequest,
      ),
    );
    assert.equal(overCapacity.code, 'ACCESS_RESERVATION_CAPACITY_EXCEEDED');

    unwrapAccess(
      net.access.cancelReservation({
        reservationId: RESERVATION_ID,
        actorRef: FIXTURE_TRAVELLER_ACTOR,
        reasonCode: 'HOLDER_CANCELLED',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 100n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
      }),
    );
    assert.equal(net.access.reservationProjection(RESERVATION_ID)?.state, 'CANCELLED');
    assert.equal(net.access.rightProjection(RIGHT_ID)?.reservedQuantity, 0n);

    const nowAvailable = unwrapAccess(
      net.access.commitReservation(
        reservationRequest({
          reservationId: 'ars_after_cancel',
          quantity: 6n,
        }) as ReservationCommitmentRequest,
      ),
    );
    assert.equal(nowAvailable.kind, 'RESERVATION_COMMITTED');
  });

  it('12. holds a reservation until its hold elapses and then expires it', () => {
    const net = provisionAccessChainFixture();
    grantRight(net);
    reserve(net);

    const tooEarly = expectFailure(
      net.access.expireReservation({
        reservationId: RESERVATION_ID,
        actorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'HOLD_ELAPSED',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 60n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
      }),
    );
    assert.equal(tooEarly.code, 'ACCESS_RESERVATION_NOT_EXPIRED');

    unwrapAccess(
      net.access.expireReservation({
        reservationId: RESERVATION_ID,
        actorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'HOLD_ELAPSED',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 1_900n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 2,
      }),
    );
    assert.equal(net.access.reservationProjection(RESERVATION_ID)?.state, 'EXPIRED');
    assert.equal(net.access.rightProjection(RIGHT_ID)?.reservedQuantity, 0n);

    const usageOnExpired = expectFailure(
      net.access.commitUsage({
        usageId: 'ausg_expired_hold',
        rightId: RIGHT_ID,
        reservationId: RESERVATION_ID,
        actorRef: FIXTURE_TRAVELLER_ACTOR,
        quantity: 1n,
        measurementRef: 'measurement:transit.seat_hour.v1',
        purpose: 'sunrey.access.usage.commit',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 2_000n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 3,
      }),
    );
    assert.equal(usageOnExpired.code, 'ACCESS_RESERVATION_STATE_INVALID');
  });

  it('13. references only settlements the canonical ledger already recorded', () => {
    const net = provisionAccessChainFixture();
    grantRight(net);
    reserve(net);
    unwrapAccess(
      net.access.confirmReservation({
        reservationId: RESERVATION_ID,
        actorRef: FIXTURE_OPERATOR_ACTOR,
        reasonCode: 'CAPACITY_CONFIRMED',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 60n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 1,
      }),
    );
    unwrapAccess(
      net.access.commitUsage({
        usageId: USAGE_ID,
        rightId: RIGHT_ID,
        reservationId: RESERVATION_ID,
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
        deliveryId: DELIVERY_ID,
        usageId: USAGE_ID,
        attestingActorRef: FIXTURE_ATTESTOR_ACTOR,
        outcomeCode: 'DELIVERED_IN_FULL',
        evidenceRef: 'evidence:transit.delivery.v1',
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 20_000n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 3,
      }),
    );

    const invented = expectFailure(
      net.access.referenceSettlementEvidence({
        settlementEvidenceId: 'aset_invented',
        deliveryId: DELIVERY_ID,
        actorRef: FIXTURE_TREASURY_ACTOR,
        settlement: {
          journalId: 'jrn_never_posted',
          transferId: 'trf_never_posted',
          assetCommitment: 'asset_commitment_invented',
        },
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 21_000n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 4,
      }),
    );
    assert.equal(invented.code, 'ACCESS_SETTLEMENT_NOT_CANONICAL');

    const settlement = unwrapAccess(
      net.access.referenceSettlementEvidence({
        settlementEvidenceId: 'aset_transit_0001',
        deliveryId: DELIVERY_ID,
        actorRef: FIXTURE_TREASURY_ACTOR,
        settlement: FIXTURE_SETTLEMENT,
        blockTimeUnixSeconds: ACCESS_FIXTURE_BLOCK_TIME + 21_000n,
        blockHeight: ACCESS_FIXTURE_BLOCK_HEIGHT + 4,
      }),
    );
    assert.equal(settlement.altersLedger, false);
    assert.equal(settlement.mintsAsset, false);
    const projection = net.access.settlementProjection('aset_transit_0001');
    assert.equal(projection?.authoritativeLedger, 'canonical-internal-ledger');
    assert.equal(projection?.chainBalanceAuthoritative, false);
    assert.equal(net.chain.settlementAnchorStatus(FIXTURE_SETTLEMENT.journalId)?.journalId, FIXTURE_SETTLEMENT.journalId);
  });
});

describe('ACCESS-08 architecture guards', () => {
  const ROOT = join(import.meta.dirname, '..', '..', '..');
  const ACCESS_DIR = join(ROOT, 'packages/sunrey-chain/src/access');

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, out);
      } else if (entry.endsWith('.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  it('adds no chain, ledger, mint, or access coin', () => {
    assert.equal(existsSync(ACCESS_DIR), true);
    assert.equal(existsSync(join(ROOT, 'packages/access-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/access-ledger')), false);
    assert.equal(existsSync(join(ROOT, 'packages/access-coin')), false);
    assert.equal(existsSync(join(ROOT, 'packages/access-token')), false);
    assert.equal(existsSync(join(ROOT, 'packages/reservation-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/rights-chain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/mobility-chain')), false);

    for (const file of walk(ACCESS_DIR)) {
      if (file.endsWith('demo.ts')) {
        continue;
      }
      const source = readFileSync(file, 'utf8');
      assert.equal(/postJournal\s*\(/.test(source), false, file);
      assert.equal(/authorizeIssuance\s*\(/.test(source), false, file);
      assert.equal(/AuthorityIssuer/.test(source), false, file);
      assert.equal(/ExecutionAuthority/.test(source), false, file);
      assert.equal(/from ['"].*packages\/(ledger|permissions|kernel|sunrey-coin)/.test(source), false, file);
      assert.equal(/from ['"].*services\//.test(source), false, file);
      assert.equal(/ACCESS_COIN|AccessCoin|accessCoin/.test(source), false, file);
      assert.equal(/\bmintAccess|issueAccessAsset|AssetSupplyBook\b/.test(source), false, file);
      assert.equal(/Date\.now\s*\(|Math\.random\s*\(|fetch\s*\(/.test(source), false, file);
    }
  });

  it('declares the boundaries it is accountable for', () => {
    assert.equal(ACCESS_CHAIN_INVARIANTS.ACCESS_RIGHT_CONVEYS_OWNERSHIP, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.ACCESS_COMMITMENT_MINTS_ASSET, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.ACCESS_COMMITMENT_ALTERS_LEDGER, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.ACCESS_COMMITMENT_ISSUES_EXECUTION_AUTHORITY, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.ACCESS_FABRIC_HAS_NATIVE_UNIT, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.RAW_PERSONAL_DATA_ON_CHAIN, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.createsSecondChain, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.createsSecondLedger, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.PRODUCTION_ACTIVE, false);
    assert.equal(ACCESS_CHAIN_INVARIANTS.authoritativeBalanceSource, 'canonical-internal-ledger');
    assert.equal(Object.keys(ACCESS_CAPABILITY_REFS).length, 7);
    assert.equal(asUtcInstant('2026-08-29T09:00:00.000Z').endsWith('Z'), true);
  });
});
