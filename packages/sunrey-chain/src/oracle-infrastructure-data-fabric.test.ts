import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { liveMainnetConnectivityEnabled } from './oracle/production/runtime-types.ts';
import { FACT_SCHEMAS } from './oracle/schemas.ts';
import { UNIT_CODES } from './oracle/types.ts';
import { mappingById } from './oracle/source-taxonomy/registry.ts';
import {
  attributeInfrastructureAndLogistics,
  attributeRealEstateAndInfrastructure,
  capacityEqualsRealizedUse,
  certifyInfrastructureSandbox,
  deriveFacilityTime,
  evaluateInfrastructureAdversary,
  evaluateInfrastructureClaimPath,
  evaluateInfrastructureUtilization,
  identifyInfrastructureEvents,
  infrastructureCertificationCannotAuthorizeMoonRey,
  infrastructureFactCannotAutoMint,
  infrastructureProductionIsActive,
  infrastructureRealProviderContacted,
  infrastructureRecord,
  ingestInfrastructureRecord,
  ingestInfrastructureRecords,
  ingestRealEstateRecord,
  legacyMachineHReinterpreted,
  legacyMachineHUsageRecord,
  occupiedSpaceRecord,
  reproduceLegacyMachineH,
  simulationPolicy,
  terminalCapacityRecord,
  terminalUsageRecord,
} from './oracle/production/provider-families/index.ts';

const NOW = 1_700_000_000n;

describe('CHUNK-135 infrastructure data fabric', () => {
  it('7. derives facility-time with exact arithmetic', () => {
    const derived = deriveFacilityTime({ facilityUnits: 2n, durationSeconds: 10_800n });
    assert.equal(derived.ok, true);
    if (derived.ok) {
      assert.equal(derived.value.mantissa, 6n);
      assert.equal(derived.value.unitId, 'facility_hour');
    }
    const ingested = ingestInfrastructureRecord(terminalUsageRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (ingested.ok) {
      assert.equal(ingested.value.observation.canonicalQuantity.mantissa, 6n);
      assert.equal(ingested.value.observation.unitSemantics, 'INFRASTRUCTURE_FACILITY_TIME_V2');
    }
  });

  it('8. keeps infrastructure capacity distinct from usage', () => {
    const capacity = ingestInfrastructureRecord(terminalCapacityRecord(NOW), NOW);
    assert.equal(capacity.ok, true);
    if (capacity.ok) {
      assert.equal(capacity.value.observation.factType, 'INFRASTRUCTURE_CAPACITY');
      assert.equal(capacity.value.observation.createsUsageEvent, false);
    }
    assert.equal(capacityEqualsRealizedUse(), false);
    const disguised = evaluateInfrastructureAdversary('CAPACITY_AS_USAGE', NOW);
    assert.equal(disguised.ok, true);
  });

  it('9. reproduces historical machine_h evidence without reinterpretation', () => {
    const reproduced = reproduceLegacyMachineH(6n);
    assert.equal(reproduced.ok, true);
    if (reproduced.ok) {
      assert.equal(reproduced.value.unitId, 'machine_h');
      assert.equal(reproduced.value.mantissa, 6n);
    }
    const ingested = ingestInfrastructureRecord(legacyMachineHUsageRecord(NOW), NOW);
    assert.equal(ingested.ok, true);
    if (ingested.ok) {
      assert.equal(ingested.value.observation.canonicalUnit, 'machine_h');
      assert.equal(ingested.value.observation.unitSemantics, 'LEGACY_INFRASTRUCTURE_MACHINE_H_V1');
      assert.equal(ingested.value.observation.legacyMachineHReinterpreted, false);
    }
    assert.equal(legacyMachineHReinterpreted(), false);
    assert.equal(FACT_SCHEMAS.INFRASTRUCTURE_USAGE.allowedUnits.includes('machine_h'), true);
  });

  it('10. prefers facility-time for new infrastructure feeds', () => {
    assert.equal(UNIT_CODES.includes('facility_hour'), true);
    assert.equal(FACT_SCHEMAS.INFRASTRUCTURE_USAGE.allowedUnits.includes('facility_hour'), true);
    const silent = evaluateInfrastructureAdversary('MACHINE_H_AS_FACILITY_HOUR', NOW);
    assert.equal(silent.ok, true);
    const mapping = mappingById('spm.infrastructure.INFRASTRUCTURE_USAGE.INFRASTRUCTURE', 1);
    assert.ok(mapping);
    assert.equal(mapping.allowedSourceUnits.includes('facility_hour'), true);
    assert.equal(mapping.allowedSourceUnits.includes('machine_h'), true);
  });

  it('11. requires attribution when real estate and infrastructure describe one service', () => {
    const space = ingestRealEstateRecord(occupiedSpaceRecord(NOW), NOW);
    const terminal = ingestInfrastructureRecord(terminalUsageRecord(NOW), NOW);
    assert.equal(space.ok && terminal.ok, true);
    if (!space.ok || !terminal.ok) {
      throw new Error('ingest failed');
    }
    const same = attributeRealEstateAndInfrastructure({
      realEstate: space.value.observation,
      infrastructure: terminal.value.observation,
      sameUnderlyingService: true,
    });
    assert.equal(same.decisions.some((row) => row.reasons.includes('REAL_ESTATE_INFRASTRUCTURE_SAME_SERVICE')), true);
    assert.equal(same.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length < 2, true);
  });

  it('12. treats port terminal usage and ocean freight as distinct services', () => {
    const terminal = ingestInfrastructureRecord(terminalUsageRecord(NOW), NOW);
    assert.equal(terminal.ok, true);
    if (!terminal.ok) {
      throw new Error(terminal.error.detail);
    }
    const distinct = attributeInfrastructureAndLogistics({
      infrastructure: terminal.value.observation,
      sameUnderlyingService: false,
    });
    assert.equal(
      distinct.decisions.some((row) =>
        row.reasons.includes('INDEPENDENT_INFRASTRUCTURE_SERVICE') || row.reasons.includes('INDEPENDENT_LOGISTICS_SERVICE') || row.reasons.includes('SEPARATE_REALIZED_SERVICE'),
      ),
      true,
    );
  });

  it('13. zeros duplicate terminal-plus-logistics claims of one service', () => {
    const terminal = ingestInfrastructureRecord(terminalUsageRecord(NOW), NOW);
    assert.equal(terminal.ok, true);
    if (!terminal.ok) {
      throw new Error(terminal.error.detail);
    }
    const duplicate = attributeInfrastructureAndLogistics({
      infrastructure: terminal.value.observation,
      sameUnderlyingService: true,
    });
    assert.equal(duplicate.decisions.some((row) => row.reasons.includes('INFRASTRUCTURE_LOGISTICS_DUPLICATE')), true);
    assert.equal(duplicate.decisions.filter((row) => row.decision === 'FULL_ATTRIBUTION').length < 2, true);
  });

  it('14. validates infrastructure utilization denominators by class', () => {
    const usage = ingestInfrastructureRecord(terminalUsageRecord(NOW), NOW);
    const capacity = ingestInfrastructureRecord(terminalCapacityRecord(NOW), NOW);
    assert.equal(usage.ok && capacity.ok, true);
    if (!usage.ok || !capacity.ok) {
      throw new Error('ingest failed');
    }
    const okRatio = evaluateInfrastructureUtilization({
      actual: usage.value.observation,
      capacity: capacity.value.observation,
    });
    assert.equal(okRatio.ok, true);
    const mismatched = ingestInfrastructureRecord(
      infrastructureRecord({
        identifier: 'rec.airport',
        sourceClass: 'AIRPORT_INFRASTRUCTURE_SYSTEM',
        infrastructureClass: 'AIRPORT_TERMINAL',
        identity: { facilityId: 'facility.airport-1', terminalId: 'terminal.a' },
      }),
      NOW,
    );
    assert.equal(mismatched.ok, true);
    if (mismatched.ok && usage.ok) {
      const refused = evaluateInfrastructureUtilization({
        actual: usage.value.observation,
        capacity: mismatched.value.observation,
      });
      assert.equal(refused.ok, false);
    }
  });

  it('16-20. refuses fake quorum, stays offline, and cannot mint', () => {
    assert.equal(evaluateInfrastructureAdversary('SAME_CONTROLLER_FAKE_QUORUM', NOW).ok, true);
    assert.equal(evaluateInfrastructureAdversary('FLOAT_DURATION', NOW).ok, true);
    assert.equal(evaluateInfrastructureAdversary('SCHEMA_DRIFT', NOW).ok, true);
    assert.equal(evaluateInfrastructureAdversary('WRONG_UNIT', NOW).ok, true);
    assert.equal(evaluateInfrastructureAdversary('STALE_UTILIZATION', NOW).ok, true);
    assert.equal(infrastructureRealProviderContacted(), false);
    assert.equal(liveMainnetConnectivityEnabled(), false);
    assert.equal(infrastructureFactCannotAutoMint(), false);
    assert.equal(infrastructureProductionIsActive(), false);
    const gpuv = evaluateInfrastructureClaimPath({ factType: 'INFRASTRUCTURE_CAPACITY', claimType: 'OUTPUT' });
    assert.equal(gpuv.ok, false);
    const certified = certifyInfrastructureSandbox('valid_terminal_usage', NOW);
    assert.equal(certified.record.productionAuthorized, false);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(infrastructureCertificationCannotAuthorizeMoonRey(), false);
  });

  it('clusters same-facility observations as one infrastructure event', () => {
    const batch = ingestInfrastructureRecords(
      [
        terminalUsageRecord(NOW),
        infrastructureRecord({ sourceClass: 'PORT_INFRASTRUCTURE_SYSTEM', identifier: 'rec.port.same' }),
      ],
      NOW,
    );
    assert.equal(batch.ok, true);
    if (!batch.ok) {
      throw new Error(batch.error.detail);
    }
    const events = identifyInfrastructureEvents(batch.value.map((row) => row.observation));
    assert.equal(events.ok, true);
    if (events.ok) {
      assert.equal(events.value.length, 1);
    }
  });
});
