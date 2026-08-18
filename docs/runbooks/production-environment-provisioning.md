# Runbook — production environment provisioning

CI and operators use local/rehearsal infrastructure only.

```
npm run sunrey-ops -- production plan
npm run sunrey-ops -- production verify-plan
npm run sunrey-ops -- production topology
npm run sunrey-ops -- production services
npm run sunrey-ops -- production providers
npm run sunrey-ops -- production drift
npm run sunrey-ops -- production rehearse
```

Actual provider mutation commands preserve the human-authorization
architecture. Do not pass a `PRODUCTION` class to automated CI.

Do not execute production genesis from this runbook.
