# Dual-economy scenarios

Scenarios are versioned JSON under
`packages/sunrey-economics/config/scenarios/`.

Required catalog:

| Id | Intent |
| --- | --- |
| baseline | Human + AI + robots + energy/compute/manufacturing + Exchange + fees + validators |
| rapid-automation | Higher AI/robot production, lower labor dependence |
| energy-scarcity | Reduced energy availability |
| compute-abundance | Sharp compute increase |
| manufacturing-shock | Reduced manufacturing/logistics |
| human-demand-shock | Reduced human consumption |
| oracle-degradation | Stale/conflict/removed oracles; fail-closed issuance |
| market-volatility | Wide Exchange spreads and impact |
| high-concentration | Few dominant productive operators |
| decentralized-productive | Many smaller providers |
| network-congestion | High fee utilization against block limits |
| validator-low-fee / high-fee / unavailability / penalty | Validator economics shocks |
| policy-experiment | Simulator-only parameter changes |

Epoch counts such as 1, 12, 120, and 600 are supported. An epoch is
abstract unless a scenario configures otherwise.

Monte Carlo batches record every seed. Stochastic output is not a
financial prediction.
