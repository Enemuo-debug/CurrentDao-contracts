import {
  ACL_ERROR,
  CommunityFeedback,
  GovernanceEvaluation,
  GovernanceProposal,
  GovernanceProposalType,
  GovernanceVote,
  GovernanceVoteChoice
} from '../interfaces/IAccessControlList';
import { ACLLib } from '../libraries/ACLLib';

/**
 * @title ACLGovernance
 * @dev Proposal and voting engine for dynamic role management and ACL configuration changes
 */
export class ACLGovernance {
  private readonly governanceMembers = new Set<string>();
  private readonly proposals = new Map<string, GovernanceProposal>();

  constructor(initialGovernanceMembers: string[]) {
    initialGovernanceMembers.forEach((member) => this.governanceMembers.add(member));
  }

  public createProposal<TPayload>(
    type: GovernanceProposalType,
    title: string,
    description: string,
    proposer: string,
    payload: TPayload,
    executionDelaySeconds: number = 0
  ): GovernanceProposal<TPayload> {
    this.assertGovernanceMember(proposer);

    const proposal: GovernanceProposal<TPayload> = {
      id: `${type}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      type,
      title,
      description,
      proposer,
      payload,
      votes: [],
      feedback: [],
      createdAt: ACLLib.now(),
      executableAt: ACLLib.now() + executionDelaySeconds,
      status: 'PENDING'
    };

    this.proposals.set(proposal.id, proposal as GovernanceProposal);
    return this.getProposal(proposal.id) as GovernanceProposal<TPayload>;
  }

  public castVote(proposalId: string, voter: string, choice: GovernanceVoteChoice, reason?: string): GovernanceProposal {
    this.assertGovernanceMember(voter);
    const proposal = this.getMutableProposal(proposalId);

    proposal.votes = proposal.votes.filter((vote) => vote.voter !== voter);
    const vote: GovernanceVote = {
      voter,
      choice,
      weight: 1,
      ...(reason ? { reason } : {}),
      timestamp: ACLLib.now()
    };
    proposal.votes.push(vote);

    return this.getProposal(proposalId);
  }

  public submitCommunityFeedback(proposalId: string, author: string, support: boolean, comment: string): GovernanceProposal {
    const proposal = this.getMutableProposal(proposalId);
    const feedback: CommunityFeedback = {
      author,
      support,
      comment,
      timestamp: ACLLib.now()
    };

    proposal.feedback.push(feedback);
    return this.getProposal(proposalId);
  }

  public evaluateProposal(proposalId: string, threshold: number, communityQuorum: number): GovernanceEvaluation {
    const proposal = this.getMutableProposal(proposalId);

    const forVotes = proposal.votes.filter((vote) => vote.choice === GovernanceVoteChoice.FOR).reduce((sum, vote) => sum + vote.weight, 0);
    const againstVotes = proposal.votes.filter((vote) => vote.choice === GovernanceVoteChoice.AGAINST).reduce((sum, vote) => sum + vote.weight, 0);
    const abstainVotes = proposal.votes.filter((vote) => vote.choice === GovernanceVoteChoice.ABSTAIN).reduce((sum, vote) => sum + vote.weight, 0);
    const communitySupport = proposal.feedback.filter((item) => item.support).length;
    const communityOpposition = proposal.feedback.filter((item) => !item.support).length;

    const approved = forVotes >= threshold && forVotes > againstVotes && proposal.feedback.length >= communityQuorum;
    proposal.status = approved ? 'APPROVED' : proposal.status === 'EXECUTED' ? 'EXECUTED' : 'PENDING';

    return {
      approved,
      forVotes,
      againstVotes,
      abstainVotes,
      communitySupport,
      communityOpposition
    };
  }

  public markExecuted(proposalId: string): GovernanceProposal {
    const proposal = this.getMutableProposal(proposalId);
    if (proposal.status !== 'APPROVED') {
      throw new Error(ACL_ERROR.PROPOSAL_NOT_APPROVED);
    }

    if (proposal.executableAt > ACLLib.now()) {
      throw new Error(ACL_ERROR.PROPOSAL_NOT_EXECUTABLE);
    }

    proposal.status = 'EXECUTED';
    proposal.executedAt = ACLLib.now();
    return this.getProposal(proposalId);
  }

  public addGovernanceMember(member: string): void {
    this.governanceMembers.add(member);
  }

  public removeGovernanceMember(member: string): void {
    this.governanceMembers.delete(member);
  }

  public replaceGovernanceMembers(members: string[]): void {
    this.governanceMembers.clear();
    members.forEach((member) => this.governanceMembers.add(member));
  }

  public isGovernanceMember(member: string): boolean {
    return this.governanceMembers.has(member);
  }

  public getGovernanceMembers(): string[] {
    return [...this.governanceMembers.values()];
  }

  public getProposal<TPayload = unknown>(proposalId: string): GovernanceProposal<TPayload> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(ACL_ERROR.PROPOSAL_NOT_FOUND);
    }

    return {
      ...proposal,
      votes: proposal.votes.map((vote) => ({ ...vote })),
      feedback: proposal.feedback.map((item) => ({ ...item }))
    } as GovernanceProposal<TPayload>;
  }

  public getProposals(): GovernanceProposal[] {
    return [...this.proposals.keys()].map((proposalId) => this.getProposal(proposalId));
  }

  private getMutableProposal(proposalId: string): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(ACL_ERROR.PROPOSAL_NOT_FOUND);
    }

    return proposal;
  }

  private assertGovernanceMember(member: string): void {
    if (!this.governanceMembers.has(member)) {
      throw new Error(ACL_ERROR.INVALID_GOVERNANCE_MEMBER);
    }
  }
}
