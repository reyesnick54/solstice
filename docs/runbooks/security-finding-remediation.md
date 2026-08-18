# Security finding remediation runbook

1. Import a supplied independent-review record:
   `npm run sunrey-audit -- review import path/to/review.json`
2. List and inspect findings:
   `npm run sunrey-audit -- findings`
   `npm run sunrey-audit -- finding show FND-…`
3. Reproduce only on isolated development/testnet fixtures:
   `npm run sunrey-audit -- finding reproduce FND-…`
4. Record a remediation plan. Crypto findings must use established
   primitives. Heightened review applies to consensus, cryptography,
   signer safety, native supply, DVP, custody signing, and
   governance authority.
5. Add a regression test, formal/fuzz/range bindings, and a
   performance comparison for critical hot paths.
6. Generate a retest package:
   `npm run sunrey-audit -- retest-package FND-…`
7. Only a human reviewer may record `FindingRetestResult`.
8. Only a human security authority may accept residual risk.
9. Package evidence:
   `npm run sunrey-audit -- bundle`
10. Query release/mainnet gates for open CRITICAL/HIGH findings.

Do not treat `TEST_FIXTURE_NOT_EXTERNAL_AUDIT` records as a real
external audit. Do not invent an auditor name. Do not expose
`SECURITY_RESTRICTED` exploit detail publicly.
