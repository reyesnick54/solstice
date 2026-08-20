import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_MONEY_ENABLED,
} from '../../../config/src/flags.ts';
import { monetaryPolicyRegistry, nativeAssetConstitution } from './constitution.ts';
import { emptyBook } from './supply.ts';
import {
  classifyParameter,
  currentUnconfiguredParameters,
  parameterManifestHash,
} from './production-activation/parameters.ts';
import {
  PRODUCTION_PARAMETER_IDS,
  type ProductionParameterRecord,
} from './production-activation/types.ts';
import {
  allParameterDefinitionsExist,
  completeFixturePackageInput,
  currentRepositoryParameterPackage,
  diffProductionParameterPackages,
  emptyParameterRegistry,
  expectedValueKind,
  fixtureCandidate,
  fixturePackageInput,
  fixtureQuantity,
  hashParameterCandidate,
  hashParameterPackage,
  PRODUCTION_PARAMETER_DEFINITIONS,
  PARAMETER_PACKAGE_STATES,
  productionParameterRecordsFromPackage,
  quantityValue,
  rationalConversionValue,
  receiptsForPackage,
  registerParameterPackage,
  registryMints,
  registryMutatesSupply,
  supersedeParameterPackage,
  validateParameterPackage,
} from './production-activation/parameter-package/index.ts';
import type { ProductionParameterValue } from './production-activation/parameter-package/index.ts';

describe('Chunk 144 production economic parameter registry', () => {
  it('1. all 15 parameter definitions exist', () => {
    assert.equal(PRODUCTION_PARAMETER_DEFINITIONS.length, 15);
    assert.equal(PRODUCTION_PARAMETER_IDS.length, 15);
    assert.equal(allParameterDefinitionsExist(), true);
  });

  it('2. each parameter has one expected value kind', () => {
    const kinds = new Set(PRODUCTION_PARAMETER_DEFINITIONS.map((row) => `${row.parameterId}:${row.valueKind}`));
    assert.equal(kinds.size, 15);
    assert.equal(expectedValueKind('SUNREY_MAXIMUM_SUPPLY'), 'QUANTITY');
    assert.equal(expectedValueKind('MOONREY_GPUV_TO_SETTLEMENT_CONVERSION'), 'RATIONAL_CONVERSION');
    assert.equal(expectedValueKind('GLOBAL_SUPPLY_GUARDS'), 'SUPPLY_GUARD_POLICY');
    assert.equal(expectedValueKind('GENESIS_ALLOCATION_MANIFEST'), 'GENESIS_ALLOCATION_REFERENCE');
  });

  it('3. missing parameter remains UNCONFIGURED', () => {
    const validated = validateParameterPackage(fixturePackageInput([]));
    const row = validated.coverage.rows.find((item) => item.parameterId === 'SUNREY_MAXIMUM_SUPPLY');
    assert.equal(row?.status, 'MISSING');
    assert.equal(validated.package.state, 'UNCONFIGURED');
    assert.equal(currentRepositoryParameterPackage().state, 'UNCONFIGURED');
  });

  it('4. explicit zero is distinct from missing', () => {
    const missing = validateParameterPackage(fixturePackageInput([]));
    const zero = validateParameterPackage(
      fixturePackageInput([fixtureCandidate('SUNREY_MAXIMUM_SUPPLY', { value: fixtureQuantity('SUNREY_COIN', 0n) })]),
    );
    const missingRow = missing.coverage.rows.find((row) => row.parameterId === 'SUNREY_MAXIMUM_SUPPLY');
    const zeroRow = zero.coverage.rows.find((row) => row.parameterId === 'SUNREY_MAXIMUM_SUPPLY');
    assert.equal(missingRow?.status, 'MISSING');
    assert.notEqual(zeroRow?.status, 'MISSING');
    assert.notEqual(missing.package.packageHash, zero.package.packageHash);
    assert.equal(zero.finalized[0]?.value && 'minorUnits' in zero.finalized[0].value ? zero.finalized[0].value.minorUnits : null, 0n);
  });

  it('5. bigint quantity accepted', () => {
    const value = quantityValue({ assetId: 'SUNREY_COIN', minorUnits: 0n });
    assert.equal(value.kind, 'QUANTITY');
    assert.equal(value.minorUnits, 0n);
    assert.equal(value.precisionReference, 'NATIVE_PROTOCOL_PRECISION');
    assert.equal(value.protocolPrecision, 6);
  });

  it('6. float quantity rejected', () => {
    assert.throws(() => quantityValue({ assetId: 'SUNREY_COIN', minorUnits: 1.5 }), /float/i);
    const raw = {
      ...fixtureCandidate('SUNREY_MAXIMUM_SUPPLY'),
      value: {
        kind: 'QUANTITY',
        minorUnits: 1.25,
        precisionReference: 'NATIVE_PROTOCOL_PRECISION',
        protocolPrecision: 6,
        assetId: 'SUNREY_COIN',
      } as unknown as ProductionParameterValue,
    };
    const validated = validateParameterPackage(fixturePackageInput([raw]));
    assert.equal(validated.blockingCodes.includes('FLOAT_QUANTITY_REJECTED'), true);
    assert.equal(validated.structurallyValid, false);
  });

  it('7. rational denominator zero rejected', () => {
    assert.throws(() => rationalConversionValue({ numerator: 1n, denominator: 0n }), /denominator/);
    const raw = {
      ...fixtureCandidate('SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION'),
      value: { kind: 'RATIONAL_CONVERSION', numerator: 1n, denominator: 0n } as ProductionParameterValue,
    };
    const validated = validateParameterPackage(fixturePackageInput([raw]));
    assert.equal(validated.blockingCodes.includes('RATIONAL_DENOMINATOR_ZERO'), true);
  });

  it('8. arbitrary source class rejected', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([{ ...fixtureCandidate('FEE_POLICY'), sourceClass: 'made-up-source' }]),
    );
    assert.equal(validated.blockingCodes.includes('ARBITRARY_SOURCE_CLASS'), true);
    assert.equal(validated.coverage.rows.find((row) => row.parameterId === 'FEE_POLICY')?.status, 'REJECTED_SOURCE');
  });

  it('9. sourceClass=PRODUCTION cannot bypass', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([{ ...fixtureCandidate('FEE_POLICY'), sourceClass: 'PRODUCTION' }]),
    );
    assert.equal(validated.blockingCodes.includes('PRODUCTION_SOURCE_CLASS_REJECTED'), true);
    const manual: ProductionParameterRecord = {
      id: 'FEE_POLICY',
      status: 'CONFIGURED',
      sourceClass: 'PRODUCTION',
      versionId: 'v1',
      valueHash: 'abc',
      governed: true,
      infrastructureMetadataOnly: false,
    };
    assert.equal(classifyParameter(manual).status, 'REJECTED_SOURCE');
  });

  it('10. duplicate parameter rejected', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([fixtureCandidate('FEE_POLICY'), fixtureCandidate('FEE_POLICY')]),
    );
    assert.equal(validated.blockingCodes.includes('DUPLICATE_PARAMETER'), true);
  });

  it('11. duplicate conflicting version rejected', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([
        fixtureCandidate('FEE_POLICY', { versionId: 'v1' }),
        fixtureCandidate('FEE_POLICY', { versionId: 'v2' }),
      ]),
    );
    assert.equal(validated.blockingCodes.includes('DUPLICATE_CONFLICTING_VERSION'), true);
  });

  it('12. genesis greater than max supply rejected', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([
        fixtureCandidate('SUNREY_MAXIMUM_SUPPLY', { value: fixtureQuantity('SUNREY_COIN', 3n) }),
        fixtureCandidate('SUNREY_GENESIS_SUPPLY', { value: fixtureQuantity('SUNREY_COIN', 5n) }),
      ]),
    );
    assert.equal(validated.blockingCodes.includes('GENESIS_EXCEEDS_MAXIMUM'), true);
    assert.equal(validated.structurallyValid, false);
  });

  it('13. negative cap rejected', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([
        {
          ...fixtureCandidate('SUNREY_PER_PERIOD_CAPS'),
          value: {
            kind: 'CAP_SCHEDULE',
            assetId: 'SUNREY_COIN',
            caps: [{ scope: 'PER_EPOCH', classOrCategory: null, quantityMinorUnits: -1n }],
          },
        },
      ]),
    );
    assert.equal(validated.blockingCodes.includes('NEGATIVE_CAP'), true);
  });

  it('14. missing dependency rejected', () => {
    const validated = validateParameterPackage(
      fixturePackageInput([fixtureCandidate('SUNREY_GENESIS_SUPPLY', { value: fixtureQuantity('SUNREY_COIN', 0n) })]),
    );
    assert.equal(validated.blockingCodes.includes('DEPENDENCY_MISSING'), true);
    assert.equal(
      validated.coverage.rows.find((row) => row.parameterId === 'SUNREY_GENESIS_SUPPLY')?.status,
      'DEPENDENCY_MISSING',
    );
  });

  it('15. deterministic parameter hash', () => {
    const first = hashParameterCandidate(fixtureCandidate('FEE_POLICY'));
    const second = hashParameterCandidate(fixtureCandidate('FEE_POLICY'));
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it('16. deterministic package hash', () => {
    const input = completeFixturePackageInput();
    const first = validateParameterPackage(input).package.packageHash;
    const second = validateParameterPackage(input).package.packageHash;
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it('17. parameter change changes hash', () => {
    const base = hashParameterCandidate(fixtureCandidate('SUNREY_MAXIMUM_SUPPLY', { versionId: 'fixture.a' }));
    const changed = hashParameterCandidate(fixtureCandidate('SUNREY_MAXIMUM_SUPPLY', { versionId: 'fixture.b' }));
    assert.notEqual(base, changed);
    const basePkg = validateParameterPackage(completeFixturePackageInput()).package.packageHash;
    const changedPkg = validateParameterPackage(completeFixturePackageInput({ SUNREY_MAXIMUM_SUPPLY: 'changed' }))
      .package.packageHash;
    assert.notEqual(basePkg, changedPkg);
  });

  it('18. evidence change changes package hash', () => {
    const base = fixturePackageInput([fixtureCandidate('FEE_POLICY')]);
    const withEvidence = {
      ...base,
      humanEvidence: [
        {
          evidenceId: 'ev.human.1',
          evidenceClass: 'HUMAN' as const,
          actorKind: 'HUMAN',
          role: 'PROTOCOL_AUTHORITY',
          reference: 'gov.native.monetary.constitution.v1',
          contentHash: 'aa'.repeat(32),
          fixture: false,
        },
      ],
    };
    const left = validateParameterPackage(base).package.packageHash;
    const right = validateParameterPackage(withEvidence).package.packageHash;
    assert.notEqual(left, right);
  });

  it('19. unordered input produces the same canonical hash', () => {
    const a = fixtureCandidate('FEE_POLICY');
    const b = fixtureCandidate('BURN_POLICY');
    const forward = validateParameterPackage(fixturePackageInput([a, b]));
    const reverse = validateParameterPackage(fixturePackageInput([b, a]));
    assert.equal(forward.package.packageHash, reverse.package.packageHash);
    assert.equal(hashParameterPackage(forward.package), hashParameterPackage(reverse.package));
  });

  it('20. AI approval rejected', () => {
    const validated = validateParameterPackage({
      ...fixturePackageInput([fixtureCandidate('FEE_POLICY')]),
      humanEvidence: [
        {
          evidenceId: 'ev.ai',
          evidenceClass: 'HUMAN',
          actorKind: 'AI',
          role: 'PROTOCOL_AUTHORITY',
          reference: 'ai-approval',
          contentHash: 'bb'.repeat(32),
          fixture: false,
        },
      ],
    });
    assert.equal(validated.blockingCodes.includes('AI_CANNOT_AUTHORIZE_PARAMETER'), true);
    assert.equal(validated.productionGovernanceComplete, false);
  });

  it('21. S3M approval rejected', () => {
    const validated = validateParameterPackage({
      ...fixturePackageInput([fixtureCandidate('FEE_POLICY')]),
      humanEvidence: [
        {
          evidenceId: 'ev.s3m',
          evidenceClass: 'HUMAN',
          actorKind: 'S3M',
          role: 'PROTOCOL_AUTHORITY',
          reference: 's3m-approval',
          contentHash: 'cc'.repeat(32),
          fixture: false,
        },
      ],
    });
    assert.equal(validated.blockingCodes.includes('AI_CANNOT_AUTHORIZE_PARAMETER'), true);
  });

  it('22. Grok approval rejected', () => {
    const validated = validateParameterPackage({
      ...fixturePackageInput([fixtureCandidate('FEE_POLICY')]),
      humanEvidence: [
        {
          evidenceId: 'ev.grok',
          evidenceClass: 'HUMAN',
          actorKind: 'GROK',
          role: 'LEGAL_AUTHORITY',
          reference: 'grok-approval',
          contentHash: 'dd'.repeat(32),
          fixture: false,
        },
      ],
    });
    assert.equal(validated.blockingCodes.includes('AI_CANNOT_AUTHORIZE_PARAMETER'), true);
  });

  it('23. fixture is structurally valid but not production-governed', () => {
    const validated = validateParameterPackage(completeFixturePackageInput());
    assert.equal(validated.structurallyValid, true);
    assert.equal(validated.productionGovernanceComplete, false);
    const receipts = receiptsForPackage(completeFixturePackageInput());
    assert.equal(receipts.every((row) => row.fixture === true), true);
    assert.equal(receipts.every((row) => row.productionGovernanceComplete === false), true);
    assert.equal(receipts.every((row) => row.productionActivated === false), true);
  });

  it('24. manual ProductionParameterRecord bypass rejected', () => {
    const bypass: ProductionParameterRecord = {
      id: 'SUNREY_MAXIMUM_SUPPLY',
      status: 'CONFIGURED',
      sourceClass: 'PRODUCTION',
      versionId: 'v1',
      valueHash: 'deadbeef',
      governed: true,
      infrastructureMetadataOnly: false,
    };
    assert.equal(classifyParameter(bypass).status, 'REJECTED_SOURCE');
    const noReceipt: ProductionParameterRecord = {
      id: 'SUNREY_MAXIMUM_SUPPLY',
      status: 'CONFIGURED',
      sourceClass: 'HUMAN_GOVERNANCE_CANDIDATE',
      versionId: 'v1',
      valueHash: 'deadbeef',
      governed: true,
      infrastructureMetadataOnly: false,
    };
    assert.equal(classifyParameter(noReceipt).status, 'UNCONFIGURED');
    const adapted = productionParameterRecordsFromPackage(completeFixturePackageInput());
    assert.equal(adapted.length, 15);
    assert.equal(adapted.every((row) => classifyParameter(row).status === 'CONFIGURED'), true);
  });

  it('25. candidate cannot mutate supply', () => {
    const book = emptyBook('SUNREY_COIN', 'sunrey.monetary.constitution.v1');
    const before = { genesis: book.genesisAllocated, issued: book.issuedPostGenesis, burned: book.burned };
    validateParameterPackage(completeFixturePackageInput());
    registerParameterPackage(emptyParameterRegistry(), completeFixturePackageInput());
    assert.equal(book.genesisAllocated, before.genesis);
    assert.equal(book.issuedPostGenesis, before.issued);
    assert.equal(book.burned, before.burned);
    assert.equal(registryMutatesSupply(), false);
  });

  it('26. candidate cannot mint', () => {
    const constitution = nativeAssetConstitution();
    const book = emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId);
    validateParameterPackage(completeFixturePackageInput());
    assert.equal(registryMints(), false);
    assert.equal(book.issuedPostGenesis, 0n);
    assert.equal(book.genesisAllocated, 0n);
    assert.equal(PARAMETER_PACKAGE_STATES.includes('PRODUCTION_ACTIVE' as (typeof PARAMETER_PACKAGE_STATES)[number]), false);
  });

  it('27. candidate cannot flip LIVE flags', () => {
    validateParameterPackage(completeFixturePackageInput());
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(CAPABILITIES.LIVE_MONEY_ENABLED, false);
    assert.equal(CAPABILITIES.ENVIRONMENT, 'simulation');
  });

  it('28. current repository remains UNCONFIGURED', () => {
    const current = currentRepositoryParameterPackage();
    assert.equal(current.state, 'UNCONFIGURED');
    assert.equal(current.productionActivated, false);
    assert.equal(current.usableAsAutomaticActivation, false);
    assert.equal(currentUnconfiguredParameters().every((row) => row.status === 'UNCONFIGURED'), true);
    const registry = monetaryPolicyRegistry();
    assert.equal(registry.constitution.productionEconomicActivationUnavailable, true);
    const first = parameterManifestHash(currentUnconfiguredParameters());
    const second = parameterManifestHash(currentUnconfiguredParameters());
    assert.equal(first, second);
  });

  it('supports supersession without overwriting history and does not auto-approve diffs', () => {
    const first = validateParameterPackage(
      fixturePackageInput([fixtureCandidate('FEE_POLICY', { versionId: 'v1' })], { packageId: 'pkg.a' }),
    ).package;
    let registry = registerParameterPackage(emptyParameterRegistry(), {
      ...fixturePackageInput([fixtureCandidate('FEE_POLICY', { versionId: 'v1' })], { packageId: 'pkg.a' }),
    });
    registry = supersedeParameterPackage(
      registry,
      'pkg.a',
      fixturePackageInput([fixtureCandidate('FEE_POLICY', { versionId: 'v2', supersedesVersion: 'v1' })], {
        packageId: 'pkg.b',
      }),
    );
    assert.equal(registry.packages.length, 2);
    assert.equal(registry.packages[0]?.state, 'SUPERSEDED');
    assert.equal(registry.packages[0]?.packageHash, first.packageHash);
    assert.equal(registry.packages[1]?.supersedes, 'pkg.a');
    const diff = diffProductionParameterPackages(registry.packages[0]!, registry.packages[1]!);
    assert.equal(diff.autoApproved, false);
    assert.equal(diff.changedParameters.length > 0, true);
  });
});
