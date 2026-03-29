# 🏛️ Current DAO Governance

The Current DAO Governance system is a decentralized decision-making framework built for the CurrentDao ecosystem. It allows $WATT token holders to propose, vote on, and execute protocol changes through a quadratic voting mechanism.

## 🌟 Key Features

### ⚖️ Quadratic Voting
To prevent whale dominance, voting power is calculated using the square root of the tokens owned or delegated. This encourages a more democratic participation and shields the DAO from being controlled by a few large holders.
- **Formula**: `votes = floor(sqrt(total_tokens))`
- **Example**: A holder with 10,000 $WATT has 100 votes, while a holder with 100 $WATT has 10 votes.

### 🛡️ Proposal Lifecycle
Proposals follow a strict state machine to ensure security and community review:
1.  **Draft**: Initial creation of the proposal.
2.  **Active**: Open for community voting.
3.  **Queued**: Voting has ended, proposal succeeded, and it's waiting in the timelock.
4.  **Executed**: Proposal has been implemented.
5.  **Canceled/Defeated**: Proposal failed or was canceled by the proposer/admin.

### 🤝 Voting Delegation
Users can delegate their voting power to trusted community members. This helps in achieving quorum and allows users who don't have time to review every proposal to still participate via their delegates.

### ⏰ Timelock & Security
All successful proposals must pass through a **Timelock** (typically 48 hours) before execution. This allows users who disagree with a decision to exit the protocol if necessary.

## 📊 Governance Parameters

- **Quorum**: Minimum votes required for a proposal to be valid (Defaut: 1,000).
- **Voting Period**: Duration of the voting window (Default: 24 hours).
- **Proposal Threshold**: Minimum $WATT required to submit a proposal (Default: 100 $WATT).
- **Execution Delay (Timelock)**: Time between a proposal passing and being executable (Default: 48 hours).

## 🚀 How to Participate

1.  **Hold $WATT**: Ensure you have $WATT tokens in your wallet.
2.  **Submit a Proposal**: Call `governance.propose()` if you meet the 100 $WATT threshold.
3.  **Vote**: Call `governance.castVote()` during the active voting period.
4.  **Delegate**: If you prefer, delegate your power using `governance.delegate(delegatee)`.

## 🧑‍💻 Technical Details

- **Contract**: `Governance.ts`
- **Interface**: `IGovernance.ts`
- **Algorithm**: `QuadraticVoting.ts`
- **Libraries**: `VotingLib.ts`

### Gas Optimization
- Voting power is pre-calculated based on token holdings.
- Efficient storage of vote receipts to prevent double-voting.
- Batch operations for large scale governance actions.
