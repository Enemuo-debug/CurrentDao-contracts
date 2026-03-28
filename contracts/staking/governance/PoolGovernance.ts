import type { IGovernanceProposal } from '../interfaces/IYieldFarming';

const VOTING_PERIOD = 7 * 86_400; // 7 days
const QUORUM_BPS = 1000;          // 10% of total voting weight
const PASS_THRESHOLD_BPS = 5001;  // >50% to pass

export class PoolGovernance {
    private proposals: Map<number, IGovernanceProposal> = new Map();
    private nextProposalId = 1;
    private totalVotingWeight: number;
    private onExecute: (poolId: number, paramKey: string, newValue: number) => void;

    constructor(
        totalVotingWeight: number,
        onExecute: (poolId: number, paramKey: string, newValue: number) => void
    ) {
        this.totalVotingWeight = totalVotingWeight;
        this.onExecute = onExecute;
    }

    propose(
        poolId: number,
        paramKey: string,
        newValue: number,
        proposer: string,
        now: number
    ): number {
        const id = this.nextProposalId++;
        this.proposals.set(id, {
            proposalId: id,
            poolId,
            paramKey,
            newValue,
            proposer,
            votesFor: 0,
            votesAgainst: 0,
            executed: false,
            deadline: now + VOTING_PERIOD,
        });
        return id;
    }

    vote(proposalId: number, voter: string, support: boolean, weight: number, now: number): void {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        if (now > proposal.deadline) throw new Error('Voting period ended');
        if (proposal.executed) throw new Error('Proposal already executed');
        if (weight <= 0) throw new Error('Vote weight must be positive');

        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }
    }

    execute(proposalId: number, now: number): void {
        const proposal = this.proposals.get(proposalId);
        if (!proposal) throw new Error('Proposal not found');
        if (now <= proposal.deadline) throw new Error('Voting period not ended');
        if (proposal.executed) throw new Error('Already executed');

        const totalVotes = proposal.votesFor + proposal.votesAgainst;
        const quorum = (this.totalVotingWeight * QUORUM_BPS) / 10_000;
        if (totalVotes < quorum) throw new Error('Quorum not reached');

        const forBps = (proposal.votesFor / totalVotes) * 10_000;
        if (forBps <= PASS_THRESHOLD_BPS) throw new Error('Proposal did not pass');

        proposal.executed = true;
        this.onExecute(proposal.poolId, proposal.paramKey, proposal.newValue);
    }

    getProposal(proposalId: number): IGovernanceProposal | null {
        return this.proposals.get(proposalId) ?? null;
    }

    getActiveProposals(now: number): IGovernanceProposal[] {
        return Array.from(this.proposals.values()).filter(
            p => !p.executed && now <= p.deadline
        );
    }

    updateTotalVotingWeight(weight: number): void {
        this.totalVotingWeight = weight;
    }
}
