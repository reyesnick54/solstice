import { generateDek, sealEnvelope } from '../../../security/src/envelope.ts';
import type { TravelRuleNetworkPort } from '../ports.ts';
import type { TravelRuleMessage } from '../types.ts';
import { FakeTravelRuleTransport } from './transport.ts';
import {
  FIXTURE_TRAVEL_RULE_PROVIDER_ID,
  type TravelRuleCandidateMessage,
  type TravelRuleCandidateProfile,
} from './types.ts';

export function fixtureTravelRuleProfile(): TravelRuleCandidateProfile {
  return Object.freeze({
    providerId: FIXTURE_TRAVEL_RULE_PROVIDER_ID,
    version: '1.0.0-candidate',
    credentialDescriptorRef: 'cred-desc:fixture-travel-rule:travel_rule_worker',
    endpointProfileRef: 'endpoint:fixture-travel-rule:sandbox',
    dataProcessingAgreementRef: null,
    securityEvidenceRef: null,
    jurisdictionEvidenceRef: null,
    retentionPolicyRef: 'retention:encrypted-envelope',
    productionAuthorized: false,
    liveNetworkConnected: false,
    payloadOnChain: false,
  });
}

/**
 * Production-candidate Travel Rule adapter. Does not replace TravelRuleNetworkPort.
 */
export class FixtureTravelRuleCandidate {
  readonly #transport: FakeTravelRuleTransport;
  readonly #master = generateDek();
  readonly #seen = new Set<string>();
  readonly #messages = new Map<string, TravelRuleCandidateMessage>();

  constructor(transport: FakeTravelRuleTransport = new FakeTravelRuleTransport()) {
    this.#transport = transport;
  }

  discover(address: string) {
    return this.#transport.discover(address);
  }

  prepare(input: {
    readonly messageId: string;
    readonly withdrawalId: string;
    readonly recipientBinding: string;
    readonly originatorRef: string;
    readonly beneficiaryRef: string;
    readonly amountMinor: string;
    readonly currency: string;
  }): TravelRuleCandidateMessage | { readonly ok: false; readonly reasonCode: 'DUPLICATE_TRAVEL_RULE' } {
    if (this.#seen.has(input.messageId)) {
      return { ok: false, reasonCode: 'DUPLICATE_TRAVEL_RULE' };
    }
    const sealed = sealEnvelope({
      keyId: 'fixture-travel-rule',
      keyVersion: 1,
      purpose: 'DATA_ENCRYPTION',
      masterKey: this.#master,
      plaintext: Buffer.from(
        JSON.stringify({
          originatorRef: input.originatorRef,
          beneficiaryRef: input.beneficiaryRef,
          amountMinor: input.amountMinor,
          currency: input.currency,
          recipientBinding: input.recipientBinding,
          purpose: 'TRAVEL_RULE_ORIGINATOR_BENEFICIARY',
        }),
      ),
    });
    if (!sealed.ok) {
      throw new Error(sealed.error.message);
    }
    const message: TravelRuleCandidateMessage = Object.freeze({
      messageId: input.messageId,
      withdrawalId: input.withdrawalId,
      recipientBinding: input.recipientBinding,
      purposeBinding: 'TRAVEL_RULE_ORIGINATOR_BENEFICIARY',
      minimumNecessaryFields: true,
      envelope: sealed.value,
      state: 'PREPARED',
      acknowledged: false,
      authorizesWithdrawal: false,
      publicChainContainsRawPii: false,
      loggedPlaintext: false,
      evidenceRefs: Object.freeze([`tr-ev:${input.messageId}`]),
    });
    this.#seen.add(input.messageId);
    this.#messages.set(input.messageId, message);
    return message;
  }

  submit(messageId: string): TravelRuleCandidateMessage {
    const current = this.require(messageId);
    const result = this.#transport.submit(messageId);
    const next: TravelRuleCandidateMessage = Object.freeze({
      ...current,
      state: result.failed ? 'FAILED' : 'SUBMITTED',
      acknowledged: false,
      authorizesWithdrawal: false,
    });
    this.#messages.set(messageId, next);
    return next;
  }

  acknowledge(input: {
    readonly messageId: string;
    readonly recipientBinding: string;
  }): TravelRuleCandidateMessage | { readonly ok: false; readonly reasonCode: 'WRONG_RECIPIENT' } {
    const current = this.require(input.messageId);
    if (current.recipientBinding !== input.recipientBinding) {
      return { ok: false, reasonCode: 'WRONG_RECIPIENT' };
    }
    const next: TravelRuleCandidateMessage = Object.freeze({
      ...current,
      state: 'ACKNOWLEDGED',
      acknowledged: true,
      authorizesWithdrawal: false,
    });
    this.#messages.set(input.messageId, next);
    return next;
  }

  retry(messageId: string): TravelRuleCandidateMessage {
    const current = this.require(messageId);
    const next: TravelRuleCandidateMessage = Object.freeze({
      ...current,
      state: 'RETRY_PENDING',
      acknowledged: false,
      authorizesWithdrawal: false,
    });
    this.#messages.set(messageId, next);
    return next;
  }

  get(messageId: string): TravelRuleCandidateMessage | undefined {
    return this.#messages.get(messageId);
  }

  travelRuleAckAuthorizesWithdrawal(): false {
    return false;
  }

  payloadOnChain(): false {
    return false;
  }

  /**
   * Existing simulation port remains the canonical TravelRuleNetworkPort.
   * Candidate messages never become that port.
   */
  asSimulationPort(): TravelRuleNetworkPort {
    return {
      mode: 'SIMULATION_ONLY',
      discoverCounterparty: () => null,
      submit: (_message: TravelRuleMessage) => ({ acknowledged: false }),
    };
  }

  private require(messageId: string): TravelRuleCandidateMessage {
    const current = this.#messages.get(messageId);
    if (!current) {
      throw new Error(`unknown travel-rule candidate message ${messageId}`);
    }
    return current;
  }
}
