export interface ParticipationMetrics {
    proposalId: string;
    totalVoters: number;
    totalVotes: number;
    participationRate: number; // Percentage of total supply
    forPercentage: number;
    againstPercentage: number;
    abstainPercentage: number;
}

export interface DAOHealthMetrics {
    activeProposals: number;
    totalProposals: number;
    successRate: number; // Percentage of successful proposals
    averageParticipation: number; // Average participation rate
    voterRetention: number; // Percentage of voters who participate in multiple proposals
    networkEngagement: number; // Score based on unique voters and frequency
}

export interface VoterBehavior {
    voter: string;
    proposalsVoted: number;
    loyaltyScore: number;
    preferredSupport: number; // 0, 1, or 2
    votingPowerTrend: number[]; // History of voting power
}
