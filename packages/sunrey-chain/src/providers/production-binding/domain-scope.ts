import type { ProductionProviderBinding } from './types.ts';
import { bindingErr, bindingOk, type BindingResult } from './types.ts';

const ORACLE_FORBIDDEN_OPERATIONS = Object.freeze([
  'SUBMIT_PAYMENT',
  'SUBMIT_CUSTODY_WITHDRAWAL',
  'MINT',
  'ISSUE_MOONREY',
  'ISSUE_SUNREY',
]);

const PAYMENT_DOMAINS = Object.freeze(['PAYMENT_RAIL', 'FX_LIQUIDITY', 'BANKING_REFERENCE']);

export function assertOracleBindingScoped(binding: ProductionProviderBinding): BindingResult<true> {
  if (binding.providerDomain !== 'ORACLE_DATA_SOURCE') {
    return bindingErr('ORACLE_BINDING_OUT_OF_SCOPE', 'MoonRey oracle binding must use ORACLE_DATA_SOURCE');
  }
  if (binding.dataClasses.some((cls) => cls !== 'ORACLE_PUBLIC_DATA' && cls !== 'PUBLIC_CHAIN_DATA')) {
    return bindingErr('ORACLE_BINDING_OUT_OF_SCOPE', 'oracle binding cannot carry payment or custody data classes');
  }
  if (binding.allowedOperations.some((operation) => ORACLE_FORBIDDEN_OPERATIONS.includes(operation))) {
    return bindingErr('ORACLE_BINDING_OUT_OF_SCOPE', 'oracle binding cannot mint, issue, or submit payments');
  }
  return bindingOk(true);
}

export function assertPaymentBindingScoped(binding: ProductionProviderBinding): BindingResult<true> {
  if (!PAYMENT_DOMAINS.includes(binding.providerDomain)) {
    return bindingErr('PAYMENT_BINDING_OUT_OF_SCOPE', 'payment binding must use a payment-family domain');
  }
  if (binding.providerDomain === 'PAYMENT_RAIL' && binding.dataClasses.some((cls) => cls !== 'PAYMENT_DATA')) {
    return bindingErr('PAYMENT_BINDING_OUT_OF_SCOPE', 'payment-rail binding is scoped to PAYMENT_DATA');
  }
  if (binding.providerDomain === 'FX_LIQUIDITY' && binding.allowedOperations.includes('SUBMIT_CUSTODY_WITHDRAWAL')) {
    return bindingErr('PAYMENT_BINDING_OUT_OF_SCOPE', 'FX binding cannot submit custody withdrawals');
  }
  if (binding.productionConnectivityEnabled !== false) {
    return bindingErr('PAYMENT_BINDING_OUT_OF_SCOPE', 'payment binding cannot enable live rails');
  }
  return bindingOk(true);
}

export function assertCustodyBindingAssetSafe(binding: ProductionProviderBinding): BindingResult<true> {
  if (binding.providerDomain !== 'CUSTODY_PROVIDER') {
    return bindingErr('CUSTODY_BINDING_NOT_ASSET_SAFE', 'custody binding must use CUSTODY_PROVIDER');
  }
  if (binding.dataClasses.some((cls) => cls !== 'CUSTODY_METADATA')) {
    return bindingErr('CUSTODY_BINDING_NOT_ASSET_SAFE', 'custody binding is limited to CUSTODY_METADATA');
  }
  if (binding.allowedOperations.includes('SUBMIT_PAYMENT')) {
    return bindingErr('CUSTODY_BINDING_NOT_ASSET_SAFE', 'custody binding cannot submit payments');
  }
  if (binding.productionConnectivityEnabled !== false) {
    return bindingErr('CUSTODY_BINDING_NOT_ASSET_SAFE', 'custody binding cannot enable live connectivity');
  }
  return bindingOk(true);
}

export function assertDomainSpecificScope(binding: ProductionProviderBinding): BindingResult<true> {
  if (binding.providerDomain === 'ORACLE_DATA_SOURCE') {
    return assertOracleBindingScoped(binding);
  }
  if (PAYMENT_DOMAINS.includes(binding.providerDomain)) {
    return assertPaymentBindingScoped(binding);
  }
  if (binding.providerDomain === 'CUSTODY_PROVIDER') {
    return assertCustodyBindingAssetSafe(binding);
  }
  return bindingOk(true);
}
