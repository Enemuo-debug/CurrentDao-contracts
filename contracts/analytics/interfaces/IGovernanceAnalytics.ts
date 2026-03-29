import { ParticipationMetrics, DAOHealthMetrics, VoterBehavior } from '../structures/AnalyticsStructure';

export interface IGovernanceAnalytics {
    trackProposal(proposalId: string): void;
    recordVote(proposalId: string, voter: string, support: number, weight: number): void;
    getParticipationMetrics(proposalId: string): ParticipationMetrics;
    getDAOHealth(): DAOHealthMetrics;
    getVoterBehavior(voter: string): VoterBehavior;
    calculateVoterRetention(): number;
    exportAnalyticsData(): string; // Returns JSON string
    benchmarkPerformance(otherDAOName: string): number; // returns performance score
}
