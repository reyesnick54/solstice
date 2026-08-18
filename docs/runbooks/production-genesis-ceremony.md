# Runbook — production genesis ceremony

This runbook exercises the Chunk 85 architecture. It does not launch
mainnet.

## Safety

- Use `SUNREY_FIXTURE_ENV=local` or CI/test fixture context only.
- Do not create or commit production private keys.
- Dress-rehearsal artifacts are unusable as production inputs.
- AI may prepare checklists and verify hashes. AI cannot approve,
  activate genesis, or authorize launch.

## Dress rehearsal

```
npm run sunrey-ceremony -- production plan
npm run sunrey-ceremony -- production validators
npm run sunrey-ceremony -- production participants
npm run sunrey-ceremony -- production provider-check
npm run sunrey-ceremony -- production contribute
npm run sunrey-ceremony -- production attest
npm run sunrey-ceremony -- production genesis
npm run sunrey-ceremony -- production verify
npm run sunrey-ceremony -- production transcript
npm run sunrey-ceremony -- production authorization-dossier
npm run sunrey-ceremony -- production rehearse
```

## Offline / air-gapped stages

Transfer packages contain only public data, hashes, signing requests,
public signatures, attestations, and approved metadata. Secret key
material is forbidden.

## Real ceremony

A real production ceremony remains an EXTERNAL/HUMAN event. Changing
the Mainnet RC or Candidate V2 requires a new plan version. Multi-person
human authority is required. No single generic infrastructure
credential can authorize genesis.
