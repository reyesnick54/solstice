----------------------- MODULE GenesisExecutionAuthorization -----------------------
EXTENDS Naturals

VARIABLES status, planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten

Init ==
  /\ status = "PLAN_CREATED"
  /\ planHash = "plan_v1"
  /\ genesisHash = "gen_v1"
  /\ approvals = 0
  /\ actor = "HUMAN"
  /\ permitUsed = FALSE
  /\ fixture = FALSE
  /\ finalized = FALSE
  /\ rewritten = FALSE

Next ==
  \/ status = "PLAN_CREATED" /\ planHash = "plan_v1" /\ status' = "PLAN_VERIFIED" /\ UNCHANGED <<planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten>>
  \/ status = "PLAN_VERIFIED" /\ actor = "HUMAN" /\ approvals' = approvals + 1 /\ UNCHANGED <<status, planHash, genesisHash, actor, permitUsed, fixture, finalized, rewritten>>
  \/ status = "PLAN_VERIFIED" /\ approvals >= 2 /\ actor = "HUMAN" /\ fixture = FALSE /\ status' = "AUTHORIZATION_COMPLETE" /\ UNCHANGED <<planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten>>
  \/ status = "AUTHORIZATION_COMPLETE" /\ permitUsed = FALSE /\ status' = "EXECUTION_PERMIT_ISSUED" /\ UNCHANGED <<planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten>>
  \/ status = "EXECUTION_PERMIT_ISSUED" /\ permitUsed = FALSE /\ planHash = "plan_v1" /\ genesisHash = "gen_v1" /\ actor = "HUMAN" /\ fixture = FALSE /\ status' = "GENESIS_EXECUTED" /\ permitUsed' = TRUE /\ UNCHANGED <<planHash, genesisHash, approvals, actor, fixture, finalized, rewritten>>
  \/ status = "GENESIS_EXECUTED" /\ status' = "FIRST_BLOCK_FINALIZED" /\ finalized' = TRUE /\ UNCHANGED <<planHash, genesisHash, approvals, actor, permitUsed, fixture, rewritten>>
  \/ status = "FIRST_BLOCK_FINALIZED" /\ status' = "INITIAL_CHAIN_VERIFIED" /\ UNCHANGED <<planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten>>
  \/ permitUsed = TRUE /\ UNCHANGED <<status, planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten>>
  \/ actor' = "AI" /\ status # "GENESIS_EXECUTED" /\ status # "FIRST_BLOCK_FINALIZED" /\ status # "INITIAL_CHAIN_VERIFIED" /\ UNCHANGED <<status, planHash, genesisHash, approvals, permitUsed, fixture, finalized, rewritten>>

WrongPlanCannotExecute == status \in {"GENESIS_EXECUTED", "FIRST_BLOCK_FINALIZED", "INITIAL_CHAIN_VERIFIED"} => planHash = "plan_v1"
WrongGenesisCannotExecute == status \in {"GENESIS_EXECUTED", "FIRST_BLOCK_FINALIZED", "INITIAL_CHAIN_VERIFIED"} => genesisHash = "gen_v1"
InsufficientHumanAuthorityCannotExecute == status \in {"GENESIS_EXECUTED", "FIRST_BLOCK_FINALIZED", "INITIAL_CHAIN_VERIFIED"} => approvals >= 2
AiCannotAuthorize == status \in {"GENESIS_EXECUTED", "FIRST_BLOCK_FINALIZED", "INITIAL_CHAIN_VERIFIED"} => actor = "HUMAN"
FixtureCannotExecuteProduction == status \in {"GENESIS_EXECUTED", "FIRST_BLOCK_FINALIZED", "INITIAL_CHAIN_VERIFIED"} => fixture = FALSE
PermitCannotBeReplayed == permitUsed = TRUE => status \in {"GENESIS_EXECUTED", "FIRST_BLOCK_FINALIZED", "INITIAL_CHAIN_VERIFIED", "EXECUTION_PERMIT_ISSUED"}
FirstFinalizedStateNotRewritten == finalized = TRUE => rewritten = FALSE
Spec == Init /\ [][Next]_<<status, planHash, genesisHash, approvals, actor, permitUsed, fixture, finalized, rewritten>>
=============================================================================
