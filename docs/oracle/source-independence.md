# Source independence

Two API endpoints controlled by one upstream organization do not
automatically count as independent sources when policy requires
independence.

Independence is computed from:

- provider ID
- controller reference
- upstream organization
- optional shared control group

Quorum policy may require a minimum number of independent controllers
in addition to a minimum number of providers.

Concentration analysis reports provider, controller, infrastructure,
geographic, and upstream shares. Warnings are engineering signals.
They do not claim Sybil resistance.
