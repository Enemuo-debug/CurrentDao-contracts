import { ParticipationMetrics, DAOHealthMetrics } from '../structures/AnalyticsStructure';

export class AnalyticsLib {
    /**
     * Calculates the participation rate for a given proposal.
     */
    public static calculateParticipationRate(voterCount: number, totalTokenHolders: number): number {
        if (totalTokenHolders === 0) return 0;
        return (voterCount / totalTokenHolders) * 100;
    }

    /**
     * Calculates success percentage from total proposals.
     */
    public static calculateSuccessRate(successful: number, total: number): number {
        if (total === 0) return 0;
        return (successful / total) * 100;
    }

    /**
     * Aggregates metrics to produce a general health score.
     */
    public static calculateHealthScore(metrics: DAOHealthMetrics): number {
        // Weighted average of metrics
        const engagementWeight = 0.4;
        const successWeight = 0.3;
        const participationWeight = 0.3;

        const healthScore = (metrics.networkEngagement * engagementWeight) + 
                            (metrics.successRate * successWeight) + 
                            (metrics.averageParticipation * participationWeight);

        return Math.min(100, Math.max(0, healthScore));
    }
}
