import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { RegisteredDevice } from '../auth.ts';
import { asBusinessIdentityId, asDeviceId, asSolsticeIdentityId } from '../ids.ts';
import type { BusinessIdentity } from '../model.ts';
import { FakeIdentityTransport } from './transport.ts';
import { FixturePersonVerificationProvider } from './person.ts';
import { FixtureDocumentVerificationProvider } from './document.ts';
import { FixtureLivenessVerificationProvider } from './liveness.ts';
import { FixtureBusinessVerificationProvider } from './business.ts';
import { FixtureBeneficialOwnershipProvider } from './beneficial-ownership.ts';
import { FixtureDeviceRiskProvider } from './device-risk.ts';
import type { IdentityProviderPorts } from '../ports.ts';

export function createFixtureIdentityTransport(): FakeIdentityTransport {
  return new FakeIdentityTransport();
}

export function createFixtureIdentityProviderPorts(
  transport: FakeIdentityTransport = new FakeIdentityTransport(),
): IdentityProviderPorts & {
  readonly documentVerification: FixtureDocumentVerificationProvider;
  readonly liveness: FixtureLivenessVerificationProvider;
} {
  return {
    identityVerification: new FixturePersonVerificationProvider(transport),
    documentVerification: new FixtureDocumentVerificationProvider(transport),
    liveness: new FixtureLivenessVerificationProvider(transport),
    businessVerification: new FixtureBusinessVerificationProvider(transport),
    beneficialOwnership: new FixtureBeneficialOwnershipProvider(transport),
    deviceRisk: new FixtureDeviceRiskProvider(transport),
  };
}

export function fixtureBusiness(now: UtcInstant): BusinessIdentity {
  return Object.freeze({
    id: asBusinessIdentityId('biz_fixture_1'),
    subjectId: asSolsticeIdentityId('idn_fixture_biz'),
    kind: 'BUSINESS',
    legalNameRef: 'name-ref:fixture-co',
    registrationRef: 'reg:fixture-co',
    jurisdiction: asJurisdiction('GB'),
    businessStatus: 'ACTIVE',
    authorizedRepresentatives: Object.freeze([]),
    beneficialOwnerRefs: Object.freeze([]),
    controlPersonRefs: Object.freeze([]),
    verificationState: 'UNDECLARED',
    createdAt: now,
    version: 1,
  });
}

export function fixtureDevice(now: UtcInstant): RegisteredDevice {
  return Object.freeze({
    deviceId: asDeviceId('dev_fixture_1'),
    identityId: asSolsticeIdentityId('idn_fixture_person'),
    deviceRef: 'device-ref:fixture',
    firstSeenAt: now,
    lastSeenAt: now,
    authenticationMethod: 'PASSKEY',
    authenticationStrength: 'STRONG',
    trustState: 'KNOWN',
    riskState: 'CLEAR',
    revokedAt: null,
  });
}
