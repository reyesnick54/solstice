# Validator rewards

Rewards are versioned, integer, and sourced only from approved
monetary-policy channels.

## Sources

- Transaction-fee allocation (`VALIDATOR_REWARD_POOL`)
- Explicit validator reward pool
- Other monetary-policy-approved sources

Hidden inflation is forbidden.

## Participation evidence

Deterministic protocol data only: expected votes, valid signed votes,
missed votes, proposal assignments, valid proposals, active voting
power, and epoch membership. There is no AI performance score.

## Calculation

Weight = `(validVotes * voteWeight + validProposals * proposalWeight) * votingPower`
for epoch members. Entitlement = `pool * weight / totalWeight`.
Remainder goes to the governed destination so allocated = paid +
remainder.

Historical epochs use the policy that was active at that epoch.
One entitlement ID cannot be paid twice.
