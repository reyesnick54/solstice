import type { CertificationPolicy, CertificationSubject, SecurityConformanceResult } from './types.ts';

const FORBIDDEN_REDIRECT_HOSTS = ['169.254.169.254', 'localhost', '127.0.0.1', 'metadata', '0.0.0.0'];

export function evaluateSecurityConformance(
  subject: CertificationSubject,
  policy: CertificationPolicy,
): SecurityConformanceResult {
  const connector = subject.connector;
  const details: string[] = [];

  const endpointAllowlisted = connector.endpointAllowlisted && connector.approvedEndpointProfile;
  if (!endpointAllowlisted) {
    details.push('endpoint is not on the engineering allowlist');
  }

  const httpsTlsOk =
    connector.protocol === 'FILE_FIXTURE' || (connector.protocol === 'HTTPS' && connector.tlsValidated);
  if (!httpsTlsOk) {
    details.push('HTTPS/TLS engineering requirement failed');
  }

  const authenticationClassOk =
    connector.authenticationClass.length > 0 &&
    (connector.authenticationClass === 'FILE_FIXTURE_TEST_ONLY' || connector.authenticationSucceeded);
  if (!authenticationClassOk) {
    details.push(`authentication class ${connector.authenticationClass} failed`);
  }

  const secretIsolated = connector.secretIsolated;
  if (!secretIsolated) {
    details.push('secrets are not isolated from the feed definition');
  }

  const redirectTarget = connector.redirectedTo ?? '';
  const redirectForbidden = FORBIDDEN_REDIRECT_HOSTS.some((host) => redirectTarget.includes(host));
  const redirectPolicyOk = connector.redirectedTo === null || (connector.redirectAllowed && !redirectForbidden);
  if (!redirectPolicyOk) {
    details.push(`redirect to ${connector.redirectedTo ?? 'unknown'} is forbidden`);
  }

  const ssrfPolicyOk = !connector.ssrfAttempted || connector.ssrfBlocked;
  if (!ssrfPolicyOk) {
    details.push('SSRF policy failed; forbidden target was not blocked');
  }

  const responseBoundsOk =
    connector.responseBytes <= policy.maximumResponseBytes && connector.responseBytes <= connector.maxResponseBytes;
  if (!responseBoundsOk) {
    details.push('response bound policy failed');
  }

  const timeoutPolicyOk = !connector.timedOut && connector.timeoutMs <= connector.timeoutBudgetMs;
  if (!timeoutPolicyOk) {
    details.push('timeout policy failed');
  }

  const retryPolicyOk = connector.retryCount <= connector.maxRetries;
  if (!retryPolicyOk) {
    details.push('retry policy exceeded');
  }

  const rateLimitOk = connector.rateLimitEvents === 0 || !connector.circuitBreakerOpen;
  if (connector.rateLimitEvents > 0) {
    details.push(`${connector.rateLimitEvents} rate-limit events recorded in sandbox`);
  }

  const circuitBreakerOk = !connector.circuitBreakerOpen;
  if (!circuitBreakerOk) {
    details.push('circuit breaker is open');
  }

  const engineeringFail =
    !endpointAllowlisted ||
    !httpsTlsOk ||
    !authenticationClassOk ||
    !secretIsolated ||
    !redirectPolicyOk ||
    !ssrfPolicyOk ||
    !responseBoundsOk ||
    !timeoutPolicyOk ||
    !retryPolicyOk ||
    !circuitBreakerOk;

  return Object.freeze({
    verdict: engineeringFail ? 'FAIL' : 'PASS',
    endpointAllowlisted,
    httpsTlsOk,
    authenticationClassOk,
    secretIsolated,
    redirectPolicyOk,
    ssrfPolicyOk,
    responseBoundsOk,
    timeoutPolicyOk,
    retryPolicyOk,
    rateLimitOk,
    circuitBreakerOk,
    independentAuditClaimed: false,
    details: Object.freeze(details),
  });
}
