# Rejected Opportunity Research Report (CF02)

**Marker:** `HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED`

## Purpose

The **Rejected Opportunity Shadow Book** holds research-grade counterfactuals for opportunities the behavioral policy **did not** take. It complements the Decision Ledger (CF01) and feeds off-policy evaluation without asserting that a rejection was “wrong.”

## What is stored

| Field | Description |
|-------|-------------|
| `opportunityId` | Stable id at `asOf` |
| `decisionTime` | When the policy declined |
| `rejectionReasons` | Gate codes (risk, mandate, overlap, liquidity) |
| `shadowPassivePnL` | CF02 passive path (no market impact) |
| `twinExecutionPnL` | Execution Twin path (fees, slippage, partial fill) |
| `marketResponseScenarioIds` | CF08 scenario refs |

## Customer and research language

- **Never** “you would have made $X.”  
- Approved phrasing: **model-implied counterfactual**, **scenario-dependent**, **not realized**, **not a promise of missed profit** (adversarial G).  
- When passive shadow is positive but Execution Twin erases edge, both lines stay visible (adversarial F).

## Sealing

Shadow rows are sealed with the same Evidence Vault discipline as other HELIOS research artifacts (`decisionTime`, `gitSha`, diagnostic bundle hash).

