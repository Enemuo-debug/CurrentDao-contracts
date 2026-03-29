export enum ProposalStatus {
    Draft,
    Active,
    Queued,
    Executed,
    Canceled,
    Defeated
}

export interface Proposal {
    id: string;
    proposer: string;
    description: string;
    targets: string[];
    values: number[];
    calldatas: string[];
    startTime: number;
    endTime: number;
    voteStart: number;
    voteEnd: number;
    status: ProposalStatus;
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
    executed: boolean;
    canceled: boolean;
    quorum: number;
}

export interface VoteReceipt {
    hasVoted: boolean;
    support: number; // 0: against, 1: for, 2: abstain
    votes: number;
    weight: number; // For quadratic voting, weight is sqrt(votes) or similar
}
