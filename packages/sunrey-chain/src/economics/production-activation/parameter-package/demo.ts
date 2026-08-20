/**
 * demo:sunrey-production-parameter-registry
 *
 * Shows the 15 parameter definitions, then a PARTIAL fixture package
 * with no recommended production values.
 */

import { PRODUCTION_PARAMETER_IDS } from '../types.ts';

import { PRODUCTION_PARAMETER_DEFINITIONS } from './definitions.ts';
import { partialDemoPackageInput } from './fixtures.ts';
import { receiptsForPackage } from './receipt.ts';
import { currentRepositoryParameterPackage, validateParameterPackage } from './validation.ts';

export function runProductionParameterRegistryDemo(): void {
  const current = currentRepositoryParameterPackage();
  const sample = validateParameterPackage(partialDemoPackageInput());
  const receipts = receiptsForPackage(partialDemoPackageInput());
  const fixtureReceipt = receipts.find((row) => row.parameterId === 'SUNREY_MAXIMUM_SUPPLY');

  console.log('PRODUCTION ECONOMIC PARAMETER REGISTRY');
  console.log(`PARAMETER_COUNT=${PRODUCTION_PARAMETER_DEFINITIONS.length}`);
  console.log('definitions=');
  for (const row of PRODUCTION_PARAMETER_DEFINITIONS) {
    console.log(`  ${row.parameterId} kind=${row.valueKind} scope=${row.assetScope}`);
  }
  console.log(`canonicalIds=${PRODUCTION_PARAMETER_IDS.join(',')}`);
  console.log(`currentRepositoryState=${current.state}`);
  console.log(`currentPackageHash=${current.packageHash}`);
  console.log(`samplePackageState=${sample.package.state}`);
  console.log(`sampleCoverageMissing=${sample.coverage.missingCount}`);
  console.log(`sampleCoveragePresent=${sample.coverage.presentCount}`);
  console.log(`sampleFixtureParameter=${fixtureReceipt?.parameterId ?? 'none'}`);
  console.log(`sampleFixtureCandidateConfigured=${String(fixtureReceipt?.candidateConfigured ?? false)}`);
  console.log(`sampleFixtureProductionGovernanceComplete=${String(fixtureReceipt?.productionGovernanceComplete ?? false)}`);
  console.log('PRODUCTION_VALUES_SELECTED=false');
  console.log('ARBITRARY_SOURCE_CLASS_ALLOWED=false');
  console.log('FIXTURE_CAN_AUTHORIZE_PRODUCTION=false');
  console.log('PACKAGE_MUTATES_SUPPLY=false');
  console.log('PACKAGE_MINTS=false');
  console.log('PRODUCTION_ACTIVE=false');
}

runProductionParameterRegistryDemo();
