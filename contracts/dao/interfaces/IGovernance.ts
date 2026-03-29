import { Proposal, ProposalStatus, VoteReceipt } from '../structures/ProposalStructure';

export interface IGovernance {
    propose(targets: string[], values: number[], calldatas: string[], description: string, proposer: string): string;
    castVote(proposalId: string, support: number, voter: string): number;
    execute(proposalId: string, executor: string): void;
    cancel(proposalId: string, canceler: string): void;
    delegate(delegatee: string, delegator: string): void;
    getProposal(proposalId: string): Proposal;
    getProposalStatus(proposalId: string): ProposalStatus;
    getVotingPower(account: string, time?: number): number;
    getReceipt(proposalId: string, voter: string): VoteReceipt;
}
