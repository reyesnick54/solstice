/**
 * ACCESS-18 — wires HIN marketplace services into the access-economy bridge ports.
 */

import type { Clock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import { err, ok } from '../../../../domain/src/result.ts';
import { Money } from '../../../../money/src/money.ts';
import { AssetQuantity } from '../../../../money/src/asset-quantity.ts';
import { SUNREY_COIN_ASSET_ID } from '../../../../sunrey-coin/src/ids.ts';
import type { SunReyCoinService } from '../../../../sunrey-coin/src/service.ts';
import { ConsentDataUseAuthorization } from '../../../../consent/src/authorization.ts';
import { ConsentService } from '../../../../consent/src/service.ts';
import { CleanRoomService } from '../../../../clean-room/src/service.ts';
import { PersonalDataVault } from '../../../../personal-data-vault/src/service.ts';
import { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../../../security/src/simulation.ts';
import { createSandboxSimulationFiatPort } from '../../fiat.ts';
import {
  createHumanInformationAccessBridge,
  dataOpportunityIdFor,
  type HumanInformationAccessBridge,
} from '../../../../access-economy/src/hin-access/engine.ts';
import type {
  HinCompensationSettlementPort,
  HinOpportunityAcceptancePort,
} from '../../../../access-economy/src/hin-access/contract.ts';
import type { HinAccessFailure } from '../../../../access-economy/src/hin-access/types.ts';
import { subjectRefFor } from '../../../../access-economy/src/ids.ts';
import type { AccessEpochId } from '../../../../access-economy/src/participation/types.ts';
import { InformationMarketService } from '../../service.ts';
import type { FiatCompensationPort } from '../../types.ts';

export type HinAccessBridgeFactoryOptions = {
  readonly clock: Clock;
  readonly market: InformationMarketService;
  readonly coin: SunReyCoinService;
  readonly fiat: FiatCompensationPort;
  readonly actorId?: string;
};

function opportunityAcceptancePort(
  market: InformationMarketService,
  actorId: string,
): HinOpportunityAcceptancePort {
  return {
    acceptOpportunity(input) {
      const accepted = market.acceptOpportunity(
        { actorId, subjectId: input.subjectId, authorizedCapabilities: ['INFORMATION_MARKET_PARTICIPATE'] },
        input.marketOpportunityId,
        input.consentId,
      );
      if (!accepted.ok) {
        return err({ code: 'CONSENT_REVOKED_BEFORE_USE', message: accepted.error.message });
      }
      return ok({ accepted: true });
    },
    declineOpportunity(input) {
      const declined = market.declineOpportunity(
        { actorId, subjectId: input.subjectId, authorizedCapabilities: ['INFORMATION_MARKET_PARTICIPATE'] },
        input.marketOpportunityId,
      );
      if (!declined.ok) {
        return err({ code: 'USER_DECLINED', message: declined.error.message });
      }
      return ok({ declined: true });
    },
  };
}

function compensationSettlementPort(
  coin: SunReyCoinService,
  fiat: FiatCompensationPort,
  actorId: string,
): HinCompensationSettlementPort {
  return {
    transferExistingSunRey(input) {
      const transfer = coin.transfer(
        actorId,
        input.customerId as never,
        'sponsor_owner',
        input.subjectId,
        AssetQuantity.fromScaledUnits(input.amountMinor, SUNREY_COIN_ASSET_ID),
      );
      if (transfer.outcome !== 'OK') {
        return err({ code: 'COMPENSATION_REFUSED', message: 'canonical coin transfer refused' });
      }
      return ok({ settlementRef: transfer.value.transferId });
    },
    creditFiat(input) {
      const credit = fiat.creditParticipant({
        actorId,
        customerId: input.customerId,
        participantAccountId: input.accountId,
        amount: Money.fromMinorUnits(input.amountMinor, 'USD'),
        contributionId: input.contributionId,
      });
      if (credit.outcome !== 'OK') {
        return err({ code: 'COMPENSATION_REFUSED', message: credit.message });
      }
      return ok({ settlementRef: credit.intentId });
    },
  };
}

export function createHinAccessBridgeFromMarket(options: HinAccessBridgeFactoryOptions): HumanInformationAccessBridge {
  const actorId = options.actorId ?? 'access18.simulation.actor';
  return createHumanInformationAccessBridge({
    nowUtc: () => options.clock.now(),
    opportunityAcceptance: opportunityAcceptancePort(options.market, actorId),
    compensationSettlement: compensationSettlementPort(options.coin, options.fiat, actorId),
  });
}

export function createSandboxHinAccessBridge(clock: Clock, customerId: string): HumanInformationAccessBridge {
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const consent = new ConsentService({ clock, keys, evidence, events });
  const vault = new PersonalDataVault({
    clock,
    keys,
    evidence,
    events,
    authorization: new ConsentDataUseAuthorization(consent),
  });
  const cleanRoom = new CleanRoomService({ clock, keys, evidence, events, consent, vault });
  const coin = createMockSunReyTransferCoin();
  const fiat = createSandboxSimulationFiatPort(clock);
  const market = new InformationMarketService({ clock, keys, evidence, events, consent, cleanRoom, coin, fiat });
  const bridge = createHinAccessBridgeFromMarket({ clock, market, coin, fiat });
  const epochEnd = asUtcInstant('2026-12-31T23:59:59.000Z');
  bridge.participation.registerEpoch({
    epochId: 'accepoch_sandbox' as AccessEpochId,
    windowStart: clock.now(),
    windowEnd: epochEnd,
    closedAt: null,
  });
  bridge.participation.recordSettledBalanceObservation({
    subjectRef: subjectRefFor(customerId),
    observedAt: clock.now(),
    balanceMinor: 0n,
    sourceRef: 'sandbox_opening',
    sourceKind: 'OPENING_BALANCE',
    replayKey: `sandbox_opening:${customerId}`,
  });
  bridge.fundOpportunity({
    opportunityId: dataOpportunityIdFor(`sandbox_vehicle_pref:${customerId}`),
    requesterLabel: 'Northline Automotive Research',
    informationRequested: 'Vehicle preference research',
    purpose: 'AGGREGATED_RESEARCH',
    permittedPurposeRef: 'purpose.vehicle_preference_research',
    compensationPath: 'EXISTING_SR_TRANSFER',
    compensationAmountMinor: 5n,
    compensationAsset: 'SUNREY_COIN',
    fundedAmountMinor: 250_000n,
    expiresAt: epochEnd,
    revocationRules: 'Revocation stops future use; settled compensation remains auditable.',
  });
  return bridge;
}

export function createSimulationCompensationPorts(
  coin: SunReyCoinService,
  fiat: FiatCompensationPort,
  actorId = 'access18.simulation.actor',
): HinCompensationSettlementPort {
  return compensationSettlementPort(coin, fiat, actorId);
}

export function createMockSunReyTransferCoin(): SunReyCoinService {
  return {
    transfer: () => ({
      outcome: 'OK' as const,
      value: { transferId: 'xfer_simulation' },
    }),
  } as unknown as SunReyCoinService;
}

export function mapSettlementFailure(code: string, message: string): HinAccessFailure {
  return { code: code as HinAccessFailure['code'], message };
}
