import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { MarketSurveillanceService } from './service.ts';
import {
  FixtureSurveillanceProvider,
  fixtureSurveillanceProfile,
  type ExternalSurveillanceSignal,
} from './provider-candidate/index.ts';

const NOW = asUtcInstant('2026-08-20T12:00:00.000Z');

describe('CHUNK-152 market-surveillance provider-candidate', () => {
  it('23. adapts external signals into existing alerts without enforcement authority', () => {
    const clock = new FrozenClock(NOW);
    const service = new MarketSurveillanceService({
      evidence: new EvidenceVault(clock),
      events: new DomainEventLog(),
      clock,
    });
    const provider = new FixtureSurveillanceProvider();
    const signal: ExternalSurveillanceSignal = {
      signalId: 'sig-1',
      kind: 'SELF_TRADING',
      marketId: 'mkt-sim',
      accountId: 'acct-1',
      participantId: 'part-1',
      observedAt: NOW,
    };
    const first = provider.ingest(service, signal);
    const replay = provider.ingest(service, signal);
    assert.equal(first.duplicate, false);
    assert.ok(first.alertCount >= 1);
    assert.equal(replay.duplicate, true);
    assert.equal(replay.alertCount, 0);
    assert.equal(first.cancelsOrder, false);
    assert.equal(first.freezesWallet, false);
    assert.equal(first.seizesBalance, false);
    assert.equal(first.blocksAccount, false);
    assert.equal(provider.isEnforcementAuthority(), false);
    assert.equal(fixtureSurveillanceProfile().isEnforcementAuthority, false);
    assert.equal(service.alerts[0]?.outputClass, 'CANDIDATE_ALERT');
    const proposal = service.proposeRestriction({
      alertId: service.alerts[0]!.alertId,
      accountId: 'acct-1',
      proposedStatus: 'RESTRICTED',
      actorKind: 'HUMAN_OPERATOR',
    });
    assert.equal('applied' in proposal && proposal.applied, false);
  });
});
