export const COMPLIANCE_INTELLIGENCE_REFRESH_SCHEDULES = Object.freeze({
  onboarding: Object.freeze({ trigger: 'KYC_VERIFIED', rescreenHours: null }),
  periodic: Object.freeze({ trigger: 'SCHEDULED', rescreenHours: 24 * 7 }),
  eventTriggered: Object.freeze({
    triggers: Object.freeze(['JURISDICTION_CHANGE', 'MANUAL_REQUEST', 'CASE_ESCALATION']),
    rescreenHours: 0,
  }),
});
