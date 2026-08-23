# SunRey Agent Tool Catalog

Canonical registry: `packages/sunrey-agent/src/tools/catalog.ts`
Version: `1.0.0` for every tool.
Production remains disabled.

The model may summarize results. It must not invent missing financial
numbers or alter authoritative numeric fields.

`createRecipientProposal` is listed so the model cannot invent a
beneficiary API. It always returns `NOT_ELIGIBLE`.

## READ_FINANCIAL

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getFinancialSnapshot | Owner snapshot with class breakdown | none | accounts + totals | READ | READ_FINANCIAL_STATE | read-only | accounts / PEG ports | no |
| getAccounts | List owned accounts | none | account list | READ | READ_FINANCIAL_STATE | read-only | accounts | no |
| getAccountBalance | One owned balance | `accountId` | account | READ | READ_FINANCIAL_STATE | read-only | accounts | no |
| getRecentActivity | Recent activity | `accountId` | activity items | READ | READ_FINANCIAL_STATE | read-only | accounts | no |
| analyzeSpending | PEG cash-flow facts | none | inflows / outflows / net | READ | READ_FINANCIAL_STATE | read-only | PEG | no |

## PAYMENTS

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getRecipients | List owned recipients | none | recipients | READ | READ_FINANCIAL_STATE | read-only | payments | no |
| createRecipientProposal | Refuse beneficiary create | `displayName` | NOT_ELIGIBLE | PRIVILEGED_FINANCIAL_MUTATION | PREPARE_PAYMENT | refused | payments beneficiaries | n/a |
| createPaymentQuote | Server-derived quote | `sourceAccountId`, `recipientId`, `amount`, `currency`, optional `purpose` | quote (amount, fees, destination, rate, expiry) | READ | PREPARE_PAYMENT | read-only | payments quote | no |
| createPaymentProposal | Prepare payment | same as quote + optional `quoteId` | proposal id | PROPOSAL | PREPARE_PAYMENT | proposal | ProposalGate + payments | yes |
| getPaymentStatus | Owned payment status | `paymentId` | payment | READ | READ_FINANCIAL_STATE | read-only | payments | no |

## FX

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getFxQuote | Server-owned FX quote | `sourceCurrency`, `destinationCurrency`, `sourceAmount` | quote | READ | READ_FINANCIAL_STATE | read-only | payments FX | no |
| createFxProposal | Propose conversion | `quoteId`, `sourceAmount`, currencies | proposal id | PROPOSAL | PREPARE_PAYMENT | proposal | FX + ProposalGate | yes |

## GROW

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getGoals | Declared goals | none | goals | READ | READ_FINANCIAL_STATE | read-only | PEG / grow | no |
| getOpportunities | Opportunity feed | none | opportunities | READ | READ_FINANCIAL_STATE | read-only | Growth Orchestrator | no |
| getGrowthPlan | Current plan | optional `planId` | plan | READ | READ_FINANCIAL_STATE | read-only | ProductGrowthPlan | no |
| getGrowthProposals | Known proposals only | none | proposals | READ | READ_FINANCIAL_STATE | read-only | grow + growth-tools | no |
| createGrowthProposal | Propose a grow action | `opportunityId`, `amount`, `currency` | proposal id | PROPOSAL | REBALANCE_WITHIN_POLICY | proposal | grow + ProposalGate | yes |
| modifyGrowthProposal | Supersede a draft | `proposalId`, `amount` | new proposal id | PROPOSAL | REBALANCE_WITHIN_POLICY | proposal | grow proposal | yes |

## PORTFOLIO

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getPortfolio | Holdings + allocation | none | portfolio | READ | READ_FINANCIAL_STATE | read-only | exchange consumer / investments | no |
| getHoldings | Integer quantities | none | holdings | READ | READ_FINANCIAL_STATE | read-only | portfolio | no |
| getPerformance | Informational quantity change | none | quantity change | READ | READ_FINANCIAL_STATE | read-only | portfolio | no |
| getAllocation | Sleeve breakdown beside totals | none | allocation | READ | READ_FINANCIAL_STATE | read-only | portfolio | no |
| getPortfolioRisk | Informational disclosure | none | risk label | READ | READ_FINANCIAL_STATE | read-only | portfolio | no |

## EXCHANGE

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getMarkets | Markets + eligibility | none | markets | READ | READ_FINANCIAL_STATE | read-only | sunrey-exchange | no |
| getAsset | Listed asset | `assetId` | asset | READ | READ_FINANCIAL_STATE | read-only | exchange / coin tool | no |
| getMarketPrice | Last trade, not guaranteed | `marketId` | price units | READ | READ_FINANCIAL_STATE | read-only | SubjectScopedSunReyExchangeTool | no |
| getOrders | Owner orders | none | orders | READ | READ_FINANCIAL_STATE | read-only | consumer orders | no |
| createExchangeOrderProposal | Propose a trade | `marketId`, `side`, `quantity`, `assetId` | proposal id | PROPOSAL | PREPARE_EXCHANGE_ORDER | proposal | exchange + ProposalGate | yes |

## WALLETS / CUSTODY

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getWallets | Subject-scoped customer wallets | none | wallets | READ | READ_FINANCIAL_STATE | read-only | packages/custody product | no |
| getWalletBalance | One owned wallet | `walletId` | wallet | READ | READ_FINANCIAL_STATE | read-only | packages/custody product | no |
| getDepositStatus | Owned deposit | `depositId` | deposit | READ | READ_FINANCIAL_STATE | read-only | packages/custody getDeposit | no |
| createWithdrawalProposal | Propose withdrawal. Cannot sign, broadcast, add destinations, or bypass step-up | `walletId`, `destinationId`, `amount`, `assetId` | proposal id | PROPOSAL | REQUEST_HUMAN_APPROVAL | proposal | packages/custody + ProposalGate | yes |

## CARDS

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getCards | List cards (last4 / status) | none | cards | READ | READ_FINANCIAL_STATE | read-only | cards | no |
| getCardStatus | One card | `cardId` | card | READ | READ_FINANCIAL_STATE | read-only | cards | no |
| createCardControlProposal | Propose freeze / unfreeze / limit | `cardId`, `control`, optional `limitMinorUnits` | proposal id | PROPOSAL | REQUEST_HUMAN_APPROVAL | proposal | cards + ProposalGate | yes |

## DATA

| Tool | Purpose | Input | Output | Risk | Mandate | Mode | Domain | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| getConsentSummary | Active permits | none | summary | READ | READ_FINANCIAL_STATE | read-only | consent | no |
| getDataPermissions | Authorized scopes | none | scopes | READ | READ_FINANCIAL_STATE | read-only | consent / PDV | no |

## Not created

Tools were not created for unsupported or forbidden capabilities:

- live bank / rail / FX execution
- beneficiary create / modify
- Ledger posting
- Execution Authority issuance
- provider credential access
- `sendMoneyImmediately` / `executeProposal` / `selfApprove`
