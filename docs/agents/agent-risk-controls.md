# Agent risk controls

The canonical risk engine may restrict an action. It does not become
wallet authority.

Automation never bypasses the Compliance Kernel. If an action is
unavailable under the active jurisdiction pack, the agent cannot execute
it. Schedule does not override authorization or market/compliance state.

Loss and error events are recorded:

- execution failure
- price protection rejection
- market unavailable
- compliance rejection
- mandate-limit rejection
- network failure

Risk is not automatically increased after losses.

Formal model `AGENT_MANDATE_SAFETY` checks: no self-expansion, no
budget overrun, no unapproved asset or market, revoked mandate cannot
authorize, AI identity alone cannot sign, and human-required actions
cannot execute without approval.
