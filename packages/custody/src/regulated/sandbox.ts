import { generateDek, sealEnvelope } from '../../../security/src/envelope.ts';
import type { IdentityKycProviderPort, IdentityKycProviderRequest } from '../../../kernel/src/regulated/identity-port.ts';
import type { TravelRuleProviderPort } from './travel-rule-port.ts';
import { recordCustodyActivation, type CustodyActivationRecord } from './hsm-activation.ts';

export class SandboxIdentityKycProvider implements IdentityKycProviderPort {
  verify(request: IdentityKycProviderRequest) {
    const review = request.subjectRef.includes('review');
    const fail = request.subjectRef.includes('fail');
    return Object.freeze({
      available: true,
      providerRef: 'sandbox-kyc',
      providerHash: `sandbox-kyc:${request.subjectRef}`,
      outcome: fail ? ('FAIL' as const) : review ? ('REVIEW' as const) : ('PASS' as const),
      kycState: fail ? ('FAILED' as const) : review ? ('IN_PROGRESS' as const) : ('VERIFIED' as const),
      kycLevel: 'STANDARD' as const,
      identityStatus: fail ? ('SUSPENDED' as const) : ('ACTIVE' as const),
      evidenceRefs: Object.freeze([`kyc:${request.subjectRef}`]),
      reasonCodes: Object.freeze([fail ? 'SANDBOX_KYC_FAIL' : review ? 'SANDBOX_KYC_REVIEW' : 'SANDBOX_KYC_PASS']),
      rawVendorSecretPresent: false as const,
    });
  }
}

export class SandboxTravelRuleProvider implements TravelRuleProviderPort {
  readonly #pending = new Set<string>();
  readonly #master = generateDek();

  forcePending(address: string): void {
    this.#pending.add(address);
  }

  discoverCounterparty(address: string) {
    return Object.freeze({
      discovered: true,
      counterpartyRef: `vasp:${address}`,
      jurisdiction: 'GB',
      publicChainPii: false as const,
    });
  }

  exchangeRequiredData(input: {
    readonly withdrawalId: string;
    readonly destination: string;
    readonly originatorRef: string;
    readonly beneficiaryRef: string;
  }) {
    const sealed = sealEnvelope({
      keyId: 'sandbox-travel-rule',
      keyVersion: 1,
      purpose: 'DATA_ENCRYPTION',
      masterKey: this.#master,
      plaintext: Buffer.from(`${input.originatorRef}->${input.beneficiaryRef}`),
    });
    if (!sealed.ok) {
      throw new Error(sealed.error.message);
    }
    const pending = this.#pending.has(input.destination);
    return Object.freeze({
      messageId: `trm_${input.withdrawalId}`,
      withdrawalId: input.withdrawalId,
      state: pending ? ('PENDING' as const) : ('DELIVERED' as const),
      providerTransactionRef: pending ? null : `tr_tx_${input.withdrawalId}`,
      requiredOriginatorPresent: true,
      requiredBeneficiaryPresent: true,
      envelope: sealed.value,
      evidenceRefs: Object.freeze([`tr:${input.withdrawalId}`]),
      publicChainContainsRawPii: false as const,
    });
  }

  status(messageId: string) {
    return messageId.includes('pending') ? ('PENDING' as const) : ('DELIVERED' as const);
  }
}

export function sandboxHsm(healthy = true): CustodyActivationRecord {
  return recordCustodyActivation({
    signerState: 'SIMULATION_SIGNER',
    providerId: 'sandbox-hsm',
    healthy,
    policyEvidenceRef: 'sandbox-hsm-policy',
  });
}
