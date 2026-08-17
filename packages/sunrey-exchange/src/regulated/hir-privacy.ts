export type HirPrivacyReadiness = {
  readonly consentReady: boolean;
  readonly purposePolicyReady: boolean;
  readonly privacyReviewReady: boolean;
  readonly legalEvidenceReady: boolean;
  readonly cleanRoomReady: boolean;
  readonly rawPdvExportAvailable: false;
  readonly defaultDeny: true;
};

export function evaluateHirPrivacy(input: {
  readonly consentReady: boolean;
  readonly purposePolicyReady: boolean;
  readonly privacyReviewReady: boolean;
  readonly legalEvidenceReady: boolean;
  readonly cleanRoomReady: boolean;
}): HirPrivacyReadiness & { readonly allowed: boolean; readonly reasonCodes: readonly string[] } {
  const reasons: string[] = [];
  if (!input.consentReady) reasons.push('CONSENT_NOT_READY');
  if (!input.purposePolicyReady) reasons.push('PURPOSE_POLICY_NOT_READY');
  if (!input.privacyReviewReady) reasons.push('PRIVACY_REVIEW_NOT_READY');
  if (!input.legalEvidenceReady) reasons.push('LEGAL_EVIDENCE_NOT_READY');
  if (!input.cleanRoomReady) reasons.push('CLEAN_ROOM_NOT_READY');
  return Object.freeze({
    ...input,
    rawPdvExportAvailable: false,
    defaultDeny: true,
    allowed: reasons.length === 0,
    reasonCodes: Object.freeze(reasons.length === 0 ? ['HIR_READY_FOR_HUMAN_REVIEW'] : reasons),
  });
}

export function rawPdvExportAvailable(): false {
  return false;
}
