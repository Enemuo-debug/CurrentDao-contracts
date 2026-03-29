import { IGovernanceAnalytics } from './interfaces/IGovernanceAnalytics';
import { ParticipationMetrics, DAOHealthMetrics, VoterBehavior } from './structures/AnalyticsStructure';
import { AnalyticsLib } from './libraries/AnalyticsLib';
import { Governance } from '../dao/Governance';

export class GovernanceAnalytics implements IGovernanceAnalytics {
    private participationData: Map<string, ParticipationMetrics> = new Map();
    private voterBehaviors: Map<string, VoterBehavior> = new Map();
    private overallMetrics: DAOHealthMetrics;
    
    private governance: Governance;
    private totalSuccessfulProposals: number = 0;
    private totalProposalsTraversed: number = 0;

    constructor(governance: Governance) {
        this.governance = governance;
        this.overallMetrics = {
            activeProposals: 0,
            totalProposals: 0,
            successRate: 0,
            averageParticipation: 0,
            voterRetention: 0,
            networkEngagement: 0
        };
    }

    public trackProposal(proposalId: string): void {
        const proposal = this.governance.getProposal(proposalId);
        
        const metrics: ParticipationMetrics = {
            proposalId,
            totalVoters: 0,
            totalVotes: proposal.forVotes + proposal.againstVotes + proposal.abstainVotes,
            participationRate: 0,
            forPercentage: proposal.forVotes / (proposal.forVotes + proposal.againstVotes + proposal.abstainVotes || 1) * 100,
            againstPercentage: proposal.againstVotes / (proposal.forVotes + proposal.againstVotes + proposal.abstainVotes || 1) * 100,
            abstainPercentage: proposal.abstainVotes / (proposal.forVotes + proposal.againstVotes + proposal.abstainVotes || 1) * 100
        };

        this.participationData.set(proposalId, metrics);
        this.overallMetrics.totalProposals++;
        this.totalProposalsTraversed++;
    }

    public recordVote(proposalId: string, voter: string, support: number, weight: number): void {
        // Update proposal metrics
        const metrics = this.participationData.get(proposalId);
        if (metrics) {
            metrics.totalVoters++;
            metrics.totalVotes += weight;
            this.participationData.set(proposalId, metrics);
        }

        // Update voter behavior
        let behavior = this.voterBehaviors.get(voter);
        if (!behavior) {
            behavior = {
                voter,
                proposalsVoted: 0,
                loyaltyScore: 1,
                preferredSupport: support,
                votingPowerTrend: [weight]
            }
        }
        behavior.proposalsVoted++;
        behavior.votingPowerTrend.push(weight);
        this.voterBehaviors.set(voter, behavior);

        // Update health indicators
        this.updateHealthMetrics();
    }

    private updateHealthMetrics(): void {
        // Recalculate based on participation rates and success rates
        let totalPart = 0;
        this.participationData.forEach(p => totalPart += p.participationRate);
        
        this.overallMetrics.averageParticipation = totalPart / (this.participationData.size || 1);
        this.overallMetrics.successRate = AnalyticsLib.calculateSuccessRate(this.totalSuccessfulProposals, this.totalProposalsTraversed);
        this.overallMetrics.networkEngagement = AnalyticsLib.calculateHealthScore(this.overallMetrics);
    }

    public getParticipationMetrics(proposalId: string): ParticipationMetrics {
        const metrics = this.participationData.get(proposalId);
        if (!metrics) throw new Error("Analytics: proposal metrics not found");
        return { ...metrics };
    }

    public getDAOHealth(): DAOHealthMetrics {
        this.updateHealthMetrics();
        return { ...this.overallMetrics };
    }

    public getVoterBehavior(voter: string): VoterBehavior {
        const behavior = this.voterBehaviors.get(voter);
        if (!behavior) throw new Error("Analytics: voter behavior not found");
        return { ...behavior };
    }

    public calculateVoterRetention(): number {
        let multiVoters = 0;
        this.voterBehaviors.forEach(v => {
            if (v.proposalsVoted > 1) multiVoters++;
        });

        return (multiVoters / (this.voterBehaviors.size || 1)) * 100;
    }

    public benchmarkPerformance(otherDAOName: string): number {
        // Benchmark logic simulated
        return Math.random() * 100;
    }

    public exportAnalyticsData(): string {
        const data = {
            metrics: this.overallMetrics,
            proposals: Array.from(this.participationData.values()),
            voters: Array.from(this.voterBehaviors.values())
        };
        return JSON.stringify(data, null, 2);
    }
}
