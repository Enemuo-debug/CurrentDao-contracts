import { IGovernance } from './interfaces/IGovernance';
import { Proposal, ProposalStatus, VoteReceipt } from './structures/ProposalStructure';
import { VotingLib } from './libraries/VotingLib';
import { QuadraticVoting } from './algorithms/QuadraticVoting';
import { WattToken } from '../token/WattToken';

export class Governance implements IGovernance {
    private proposals: Map<string, Proposal> = new Map();
    private receipts: Map<string, Map<string, VoteReceipt>> = new Map(); // proposalId => voter => receipt
    private delegates: Map<string, string> = new Map(); // delegator => delegatee
    
    private token: WattToken;
    private proposalCount: number = 0;
    
    // Configurable parameters
    private quorum: number = 1000; // Total votes needed
    private votingPeriod: number = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    private proposalThreshold: number = 100; // Minimum tokens to propose
    private timelockDelay: number = 48 * 60 * 60 * 1000; // 2 days in milliseconds
    
    private owner: string;

    constructor(token: WattToken, owner: string) {
        this.token = token;
        this.owner = owner;
    }

    // --- Governance Configuration ---

    public setQuorum(newQuorum: number, caller: string) {
        this.onlyOwner(caller);
        this.quorum = newQuorum;
    }

    public setVotingPeriod(newPeriod: number, caller: string) {
        this.onlyOwner(caller);
        this.votingPeriod = newPeriod;
    }

    private onlyOwner(caller: string) {
        if (caller !== this.owner) throw new Error("Only owner can adjust parameters");
    }

    // --- Proposal System ---

    public propose(targets: string[], values: number[], calldatas: string[], description: string, proposer: string): string {
        const balance = this.token.balanceOf(proposer);
        if (balance < this.proposalThreshold) {
            throw new Error("Governance: insufficient tokens to propose");
        }

        const id = VotingLib.generateProposalId(proposer, description, this.proposalCount++);
        const startTime = Date.now();
        const voteStart = startTime + 1000; // Starts after a brief delay
        const voteEnd = voteStart + this.votingPeriod;

        const newProposal: Proposal = {
            id,
            proposer,
            description,
            targets,
            values,
            calldatas,
            startTime,
            endTime: voteEnd,
            voteStart,
            voteEnd,
            status: ProposalStatus.Active, // For this sim, status becomes active immediately after delay
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            executed: false,
            canceled: false,
            quorum: this.quorum
        };

        this.proposals.set(id, newProposal);
        this.receipts.set(id, new Map());
        return id;
    }

    // --- Voting System ---

    public delegate(delegatee: string, delegator: string): void {
        this.delegates.set(delegator, delegatee);
    }

    public getVotingPower(account: string): number {
        // Calculate voting power using quadratic voting: sqrt(balance + delegated power)
        let totalBalance = this.token.balanceOf(account);
        
        // Add delegated balances
        for (const [delegator, delegatee] of this.delegates.entries()) {
            if (delegatee === account) {
                totalBalance += this.token.balanceOf(delegator);
            }
        }

        return QuadraticVoting.calculateVotingPower(totalBalance);
    }

    public castVote(proposalId: string, support: number, voter: string): number {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error("Governance: proposal not found");
        
        const currentTime = Date.now();
        if (!VotingLib.isProposalActive(proposal, currentTime)) {
            throw new Error("Governance: voting not active");
        }

        const proposalReceipts = this.receipts.get(proposalId)!;
        if (proposalReceipts.has(voter)) {
            throw new Error("Governance: already voted");
        }

        const weight = this.getVotingPower(voter);
        if (weight <= 0) throw new Error("Governance: no voting power");

        const receipt: VoteReceipt = {
            hasVoted: true,
            support,
            votes: weight * weight, // Original tokens used (simulated)
            weight: weight          // Actual votes in QV
        };

        proposalReceipts.set(voter, receipt);

        if (support === 1) { // For
            proposal.forVotes += weight;
        } else if (support === 0) { // Against
            proposal.againstVotes += weight;
        } else if (support === 2) { // Abstain
            proposal.abstainVotes += weight;
        }

        this.proposals.set(proposalId, proposal);
        return weight;
    }

    // --- Execution Lifecycle ---

    public execute(proposalId: string, executor: string): void {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error("Governance: proposal not found");

        const status = this.getProposalStatus(proposalId);
        if (status !== ProposalStatus.Queued) {
            throw new Error("Governance: proposal not queued for execution");
        }

        // Simulate execution
        proposal.status = ProposalStatus.Executed;
        proposal.executed = true;
        this.proposals.set(proposalId, proposal);
        
        // In a real system, we'd loop through targets/calldatas and call them
        console.log(`Executed proposal ${proposalId}`);
    }

    public cancel(proposalId: string, canceler: string): void {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error("Governance: proposal not found");

        if (canceler !== proposal.proposer && canceler !== this.owner) {
            throw new Error("Governance: only proposer or owner can cancel");
        }

        if (proposal.executed) throw new Error("Governance: cannot cancel executed proposal");

        proposal.status = ProposalStatus.Canceled;
        proposal.canceled = true;
        this.proposals.set(proposalId, proposal);
    }

    public getProposalStatus(proposalId: string): ProposalStatus {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error("Governance: proposal not found");

        if (proposal.canceled) return ProposalStatus.Canceled;
        if (proposal.executed) return ProposalStatus.Executed;

        const currentTime = Date.now();

        if (currentTime < proposal.voteStart) {
            return ProposalStatus.Draft;
        }

        if (currentTime <= proposal.voteEnd) {
            return ProposalStatus.Active;
        }

        if (VotingLib.hasSucceeded(proposal)) {
            // Check if it should be queued or just succeeded
            // Usually, there's a delay between Succeeded and Executable (Timelock)
            if (currentTime >= proposal.voteEnd + this.timelockDelay) {
                return ProposalStatus.Queued;
            }
            return ProposalStatus.Active; // Or a custom "Succeeded" status if we added it
        }

        return ProposalStatus.Defeated;
    }

    public getProposal(proposalId: string): Proposal {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error("Governance: proposal not found");
        return { ...proposal };
    }

    public getReceipt(proposalId: string, voter: string): VoteReceipt {
        const proposalReceipts = this.receipts.get(proposalId);
        if (!proposalReceipts) throw new Error("Governance: proposal not found");
        return proposalReceipts.get(voter) || { hasVoted: false, support: 0, votes: 0, weight: 0 };
    }
}
