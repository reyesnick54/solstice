# Security control catalog

Source: `packages/sunrey-chain/src/audit/controls.ts`
(`SecurityControlRegistry`).

Each control records:

- `control_id`
- description
- preventive / detective / recovery
- implementation path
- test references
- formal-property references where available
- runbook
- known limitations
- review status

Generate the current catalog with:

```bash
npm run sunrey-audit -- generate
```

The bundle writes `generated/controls.json` and
`generated/evidence-map.json`. An auditor can reproduce evidence from
source using the references on each control.
