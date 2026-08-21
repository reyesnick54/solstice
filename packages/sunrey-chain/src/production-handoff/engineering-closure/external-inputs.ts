import type { ExternalProductionInput } from './types.ts';

function input(
  id: string,
  title: string,
  activationDomains: readonly string[],
  requiredForThoseDomains: boolean,
  notes: string,
): ExternalProductionInput {
  return Object.freeze({
    id,
    title,
    present: false,
    fabricated: false,
    activationDomains,
    requiredForThoseDomains,
    universallyLegallyRequired: false,
    notes,
  });
}

/**
 * Outstanding real-world inputs. Presence is false in this repository.
 * Required-for-domain follows the Chunk 160/161 evidence/scope architecture.
 * Not a claim that every item is universally legally required.
 */
export function currentExternalProductionInputRegister(): readonly ExternalProductionInput[] {
  return Object.freeze([
    input('ext.production-economic-parameters', 'Production economic parameter selections', ['SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET', 'SUNREY_CHAIN'], true, 'Chunk 143/144 parameters remain UNCONFIGURED.'),
    input('ext.human-governance-signatures', 'Real human governance signatures', ['SUNREY_CHAIN', 'SUNREY_COIN_NATIVE_ASSET', 'MOONREY_COIN_NATIVE_ASSET'], true, 'Fixture acceptances are not real signatures.'),
    input('ext.security-audit', 'External security audit', ['SUNREY_CHAIN', 'SUNREY_EXCHANGE', 'INSTITUTIONAL_CUSTODY'], true, 'Engineering review is not an external audit.'),
    input('ext.pentest', 'Penetration test / retest as required', ['SUNREY_CHAIN', 'SUNREY_EXCHANGE'], true, 'Adversarial range is isolated and fixture-only.'),
    input('ext.counsel-opinions', 'Counsel opinions', ['SUNREY_CHAIN', 'SUNREY_EXCHANGE', 'FIAT_BANKING', 'HUMAN_INFORMATION_MARKET'], true, 'No CONFIRMED_BY_COUNSEL policy rules.'),
    input('ext.licenses', 'Licenses / registrations', ['SUNREY_CHAIN', 'SUNREY_EXCHANGE', 'FIAT_BANKING', 'INSTITUTIONAL_CUSTODY'], true, 'Operating-scope matrix stays disabled without evidence.'),
    input('ext.regulatory-approvals', 'Regulatory approvals', ['SUNREY_CHAIN', 'SUNREY_EXCHANGE', 'FIAT_BANKING'], true, 'Unknown corridors remain RESEARCH_REQUIRED / disabled.'),
    input('ext.bank-baas', 'Bank / BaaS agreements', ['FIAT_BANKING', 'PAYMENT_RAILS'], true, 'No live bank connection. LIVE_EXTERNAL_BANK_CONNECTION=false.'),
    input('ext.payment-rails', 'Payment rail agreements', ['PAYMENT_RAILS'], true, 'Rail adapters are sandbox/fixture only.'),
    input('ext.fx-provider', 'FX provider agreements', ['PAYMENT_RAILS'], true, 'FX quotes are simulation.'),
    input('ext.kyc-aml', 'KYC / AML provider agreements', ['FIAT_BANKING', 'PAYMENT_RAILS', 'SUNREY_EXCHANGE'], true, 'No live KYC vendor. LIVE_EXTERNAL_KYC=false.'),
    input('ext.travel-rule', 'Travel Rule provider', ['INSTITUTIONAL_CUSTODY', 'SUNREY_EXCHANGE'], true, 'Travel Rule candidate is a fixture adapter.'),
    input('ext.custody-provider', 'Custody provider', ['INSTITUTIONAL_CUSTODY'], true, 'Provider-candidate framework only.'),
    input('ext.oracle-licenses', 'Oracle / data licenses', ['PRODUCTIVE_CAPACITY_MARKET'], true, 'Injected/fake transports only. Production valuation inactive.'),
    input('ext.hsm-kms', 'HSM / KMS evidence', ['SUNREY_CHAIN', 'INSTITUTIONAL_CUSTODY'], true, 'Simulation key provider. Fixture HSM rehearsal only.'),
    input('ext.validator-operators', 'Real validator operators', ['SUNREY_CHAIN'], true, 'Devnet / rehearsal validators only.'),
    input('ext.infrastructure', 'Infrastructure agreements', ['SUNREY_CHAIN'], true, 'Production infrastructure module is a candidate, not a live contract.'),
    input('ext.dns-certs-cloud', 'DNS / certificate / cloud configuration', ['SUNREY_CHAIN'], false, 'Required for a public network, not for core software completeness.'),
    input('ext.operational-staffing', 'Operational staffing', ['SUNREY_CHAIN'], true, 'Human accountability roles cannot be satisfied by AI.'),
    input('ext.oncall', 'Incident / on-call acceptance', ['SUNREY_CHAIN'], true, 'Operator acceptance remains fixture / not real.'),
  ]);
}
