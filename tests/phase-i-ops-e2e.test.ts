import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { ControlRoom } from '../packages/sunrey-chain/src/ops/control-room/control-room.ts';
import { CONTROL_ROOM_CAPABILITIES } from '../packages/sunrey-chain/src/ops/control-room/types.ts';
import { runDrill } from '../packages/sunrey-chain/src/ops/drills.ts';
import { runExchangeRedTeam, unauthorizedMutations } from '../packages/sunrey-exchange/src/productization/red-team.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { runSmokeCampaign } from '../packages/sunrey-range/src/campaign.ts';

describe('Phase I operations and exception control room', () => {
  it('opens payment, provider, and surveillance cases without minting or posting', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    const room = new ControlRoom();
    const incident = room.openPaymentIncident();
    assert.ok(incident.incidentId);
    assert.equal(incident.kind, 'PAYMENT_SUBMISSION_UNKNOWN_SURGE');
    assert.equal(CONTROL_ROOM_CAPABILITIES.canPostLedger, false);
    assert.equal(CONTROL_ROOM_CAPABILITIES.canMint, false);
    assert.equal(CONTROL_ROOM_CAPABILITIES.canIssueAuthority, false);
    assert.equal(room.postLedger().ok, false);
    assert.equal(room.mint().ok, false);
    assert.equal(room.enableLiveFlags().ok, false);
  });

  it('records achieved DR rehearsal RPO/RTO as engineering measurements only', () => {
    const endToEnd = runDrill('END_TO_END_RESILIENCE');
    assert.equal(endToEnd.report.finalState, 'RECOVERED');
    assert.equal(endToEnd.report.measuredRpoMs, 0n);
    assert.equal(endToEnd.report.measuredRtoMs, 120_000n);
    assert.match(endToEnd.report.operatorNotes, /ENGINEERING_TEST_TARGETS/);
    const database = runDrill('DATABASE_LOSS');
    assert.equal(database.report.finalState, 'RECOVERED');
    assert.equal(database.report.measuredRpoMs, 0n);
    assert.equal(database.report.measuredRtoMs, 90_000n);
  });
});

describe('Phase I combined red-team evidence', () => {
  it('records zero unauthorized Exchange mutations and a passing range smoke campaign', () => {
    const attempts = runExchangeRedTeam(asUtcInstant('2026-08-23T12:00:00.000Z'));
    assert.equal(unauthorizedMutations(attempts), 0);
    const campaign = runSmokeCampaign();
    assert.equal(campaign.failed, 0);
    assert.equal(campaign.invariantBreaches, 0);
    assert.ok(campaign.passed > 0);
  });
});
