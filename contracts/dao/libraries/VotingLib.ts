import { Proposal, ProposalStatus } from '../structures/ProposalStructure';

export class VotingLib {
    /**
     * Checks if a proposal is active for voting.
     */
    public static isProposalActive(proposal: Proposal, currentTime: number): boolean {
        return proposal.status === ProposalStatus.Active && 
               currentTime >= proposal.voteStart && 
               currentTime <= proposal.voteEnd;
    }

    /**
     * Checks if a proposal has reached quorum.
     */
    public static hasReachedQuorum(proposal: Proposal): boolean {
        const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        return totalVotes >= proposal.quorum;
    }

    /**
     * Checks if a proposal has succeeded.
     */
    public static hasSucceeded(proposal: Proposal): boolean {
        return proposal.forVotes > proposal.againstVotes && this.hasReachedQuorum(proposal);
    }

    /**
     * Generates a unique proposal ID.
     */
    public static generateProposalId(proposer: string, description: string, nonce: number): string {
        // Mock ID generation
        return `PROPOSAL_${proposer.slice(0, 6)}_${nonce}_${Date.now()}`;
    }
}
