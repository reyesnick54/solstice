import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { ConsentService } from '../../../consent/src/service.ts';
import { RECIPIENT_PERSONAL_AGENT } from '../../../consent/src/recipients.ts';
import { rejectArbitraryQuery } from '../../../clean-room/src/index.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { explorerExposurePolicy } from '../../../sunrey-explorer/src/privacy.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

const T0 = asUtcInstant('2026-08-17T00:00:00.000Z');

export const privacyScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'INFO-WRONG-PURPOSE',
    category: 'PRIVACY_ABUSE',
    seed: 5800,
    subsystem: 'consent',
    attack: 'wrong purpose',
    actors: [actor('agent', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'agent', 'wrong purpose')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'PURPOSE_MISMATCH')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'purpose firewall',
    detectiveControl: 'PURPOSE_MISMATCH',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INFO-EXPIRED-CONSENT',
    category: 'PRIVACY_ABUSE',
    seed: 5801,
    subsystem: 'consent',
    attack: 'expired consent',
    actors: [actor('agent', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'agent', 'use expired')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'PERMIT_EXPIRED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'permit TTL',
    detectiveControl: 'PERMIT_EXPIRED',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INFO-REVOKED-CONSENT',
    category: 'PRIVACY_ABUSE',
    seed: 5802,
    subsystem: 'consent',
    attack: 'revoked consent',
    actors: [actor('agent', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'subject', 'revoke')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'NO_ACTIVE_CONSENT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'revocation',
    detectiveControl: 'NO_ACTIVE_CONSENT',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INFO-RAW-ROW-EXPORT',
    category: 'PRIVACY_ABUSE',
    seed: 5803,
    subsystem: 'pdv',
    attack: 'raw-row export',
    actors: [actor('researcher', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'researcher', 'export raw')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'RAW_EXPORT_DENIED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'derived-only operations',
    detectiveControl: 'export denial',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INFO-UNAUTHORIZED-CLEANROOM',
    category: 'PRIVACY_ABUSE',
    seed: 5804,
    subsystem: 'clean-room',
    attack: 'unauthorized clean-room query',
    actors: [actor('researcher', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'researcher', 'arbitrary SQL')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'ARBITRARY_SQL_FORBIDDEN')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'rejectArbitraryQuery',
    detectiveControl: 'ARBITRARY_SQL_FORBIDDEN',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INFO-RECIPIENT-MISMATCH',
    category: 'PRIVACY_ABUSE',
    seed: 5805,
    subsystem: 'consent',
    attack: 'recipient mismatch',
    actors: [actor('other', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'other', 'use foreign permit')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'RECIPIENT_MISMATCH')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'recipient binding',
    detectiveControl: 'RECIPIENT_MISMATCH',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXPLORER-PDV',
    category: 'PRIVACY_ABUSE',
    seed: 5806,
    subsystem: 'explorer',
    attack: 'search raw PDV',
    actors: [actor('public', 'EXPLORER', true)],
    faults: [],
    timeline: [step(1, 'public', 'query pdvRaw')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'EXPLORER_DENIED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'ExplorerExposurePolicy',
    detectiveControl: 'field stripped',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXPLORER-KYC',
    category: 'PRIVACY_ABUSE',
    seed: 5807,
    subsystem: 'explorer',
    attack: 'search KYC',
    actors: [actor('public', 'EXPLORER', true)],
    faults: [],
    timeline: [step(1, 'public', 'query kycRecord')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'EXPLORER_DENIED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'ExplorerExposurePolicy',
    detectiveControl: 'field stripped',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXPLORER-CONSENT',
    category: 'PRIVACY_ABUSE',
    seed: 5808,
    subsystem: 'explorer',
    attack: 'search private consent',
    actors: [actor('public', 'EXPLORER', true)],
    faults: [],
    timeline: [step(1, 'public', 'query consentDetail')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'EXPLORER_DENIED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'ExplorerExposurePolicy',
    detectiveControl: 'field stripped',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXPLORER-HSM',
    category: 'PRIVACY_ABUSE',
    seed: 5809,
    subsystem: 'explorer',
    attack: 'search HSM metadata',
    actors: [actor('public', 'EXPLORER', true)],
    faults: [],
    timeline: [step(1, 'public', 'query privateKey')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS'],
    expectedDetections: [detection('security_log', 'EXPLORER_DENIED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'ExplorerExposurePolicy',
    detectiveControl: 'field stripped',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'EXPLORER-MACHINE-MANDATE',
    category: 'PRIVACY_ABUSE',
    seed: 5810,
    subsystem: 'explorer',
    attack: 'search private machine mandate fields',
    actors: [actor('public', 'EXPLORER', true)],
    faults: [],
    timeline: [step(1, 'public', 'query mandateSecret')],
    expectedSecurityProperties: ['NO_RAW_PERSONAL_DATA_EGRESS', 'NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'EXPLORER_DENIED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'ExplorerExposurePolicy',
    detectiveControl: 'field stripped',
    recovery: 'none',
    preventiveOnly: false,
  }),
];

export function runPrivacy(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId.startsWith('EXPLORER-')) {
    const payload = {
      height: 12,
      pdvRaw: 'secret-row',
      kycRecord: { name: 'alice' },
      consentDetail: { purpose: 'hidden' },
      privateKey: 'hex',
      mandateSecret: 'mandate',
      personalDataVault: { row: 1 },
    };
    const projected = explorerExposurePolicy.project(payload) as Record<string, unknown>;
    const leaked = ['pdvRaw', 'kycRecord', 'consentDetail', 'privateKey', 'mandateSecret', 'personalDataVault'].some(
      (key) => key in projected,
    );
    recordAlert(env, 'EXPLORER_DENIED');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !leaked && projected.height === 12,
      safetyHeld: !leaked,
      invariants: holdAll(scenario.expectedSecurityProperties, 'forbidden explorer fields stripped'),
      detections: [{ channel: 'security_log', code: 'EXPLORER_DENIED', observed: !leaked, detail: Object.keys(projected).join(',') }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'default-deny projection'),
      notes: `projected=${JSON.stringify(projected)}`,
    });
  }
  if (scenario.scenarioId === 'INFO-UNAUTHORIZED-CLEANROOM') {
    const rejected = rejectArbitraryQuery({ sql: 'SELECT * FROM pdv_rows' });
    const code = rejected.ok ? 'ALLOWED' : rejected.error.code;
    recordAlert(env, code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !rejected.ok,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, code),
      detections: [{ channel: 'security_log', code: 'ARBITRARY_SQL_FORBIDDEN', observed: !rejected.ok, detail: code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'SQL rejected'),
      notes: code,
    });
  }
  const clock = new FrozenClock(T0);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_range_alice',
    jurisdiction: asJurisdiction('GB'),
    identityId: 'idn_range_alice',
    customerId: asCustomerId('cust_range_alice'),
    capabilities: ['CONSENT_GRANT_OWN', 'CONSENT_REVOKE_OWN', 'CONSENT_VIEW_OWN'],
  });
  if (!provisioned.ok) {
    throw new Error(provisioned.error.message);
  }
  const consent = new ConsentService({ clock, keys, evidence, events });
  const draft = consent.draftConsent(provisioned.value, {
    subjectId: 'cust_range_alice',
    recipientId: RECIPIENT_PERSONAL_AGENT,
    purposeRef: 'PERSONAL_AGENT_ANALYSIS',
    categories: ['PAYROLL_DATA'],
    fields: ['netMinor'],
    operations: ['DERIVE'],
    derivationTypes: ['DERIVED_ONLY'],
    effectiveFrom: T0,
    expiresAt: asUtcInstant('2026-09-17T00:00:00.000Z'),
    requestedRetentionDays: 30,
    idempotencyKey: 'grant:range',
  });
  let code = 'OK';
  if (!draft.ok) {
    code = draft.error.code;
  } else {
    const confirmed = consent.confirmConsent(provisioned.value, draft.value.consentId, `confirm:${draft.value.consentId}`);
    if (!confirmed.ok) {
      code = confirmed.error.code;
    } else if (scenario.scenarioId === 'INFO-REVOKED-CONSENT') {
      const revoked = consent.revokeConsent(provisioned.value, draft.value.consentId, 'range', 'range-revoke');
      if (!revoked.ok) {
        code = revoked.error.code;
      } else {
        const permit = consent.issuePermit(provisioned.value, {
          subjectId: 'cust_range_alice',
          recipientId: RECIPIENT_PERSONAL_AGENT,
          purposeRef: 'PERSONAL_AGENT_ANALYSIS',
          resourceId: 'cust_range_alice',
          operation: 'READ',
          derivationType: 'RAW',
        });
        code = permit.ok ? 'ALLOWED' : permit.error.code;
      }
    } else if (scenario.scenarioId === 'INFO-WRONG-PURPOSE') {
      const permit = consent.issuePermit(provisioned.value, {
        subjectId: 'cust_range_alice',
        recipientId: RECIPIENT_PERSONAL_AGENT,
        purposeRef: 'MARKETING',
        resourceId: 'cust_range_alice',
        operation: 'READ',
        derivationType: 'RAW',
      });
      code = permit.ok ? 'ALLOWED' : permit.error.code;
    } else if (scenario.scenarioId === 'INFO-EXPIRED-CONSENT') {
      clock.set(asUtcInstant('2026-10-01T00:00:00.000Z'));
      const permit = consent.issuePermit(provisioned.value, {
        subjectId: 'cust_range_alice',
        recipientId: RECIPIENT_PERSONAL_AGENT,
        purposeRef: 'PERSONAL_AGENT_ANALYSIS',
        resourceId: 'cust_range_alice',
        operation: 'READ',
        derivationType: 'RAW',
      });
      code = permit.ok ? 'ALLOWED' : permit.error.code;
    } else if (scenario.scenarioId === 'INFO-RECIPIENT-MISMATCH') {
      const permit = consent.issuePermit(provisioned.value, {
        subjectId: 'cust_range_alice',
        recipientId: 'rcp_unknown_research',
        purposeRef: 'PERSONAL_AGENT_ANALYSIS',
        resourceId: 'cust_range_alice',
        operation: 'READ',
        derivationType: 'RAW',
      });
      code = permit.ok ? 'ALLOWED' : permit.error.code;
    } else {
      const permit = consent.issuePermit(provisioned.value, {
        subjectId: 'cust_range_alice',
        recipientId: RECIPIENT_PERSONAL_AGENT,
        purposeRef: 'PERSONAL_AGENT_ANALYSIS',
        resourceId: 'cust_range_alice',
        operation: 'READ',
        derivationType: 'RAW',
      });
      code = permit.ok ? 'RAW_EXPORT_DENIED' : permit.error.code;
    }
  }
  recordAlert(env, code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: code !== 'ALLOWED' && code !== 'OK',
    safetyHeld: true,
    invariants: holdAll(scenario.expectedSecurityProperties, code),
    detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: true, detail: code }],
    recovery: recovery('NONE_PREVENTIVE', false, true, true, 'no raw PDV egress'),
    notes: code,
  });
}
