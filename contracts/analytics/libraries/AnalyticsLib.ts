import { ParticipationMetrics, DAOHealthMetrics } from '../structures/AnalyticsStructure';
import { PrivacySettings, UsageMetrics } from '../structures/UsageStructure';

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

    /**
     * Anonymizes an address based on privacy settings.
     */
    public static anonymizeAddress(address: string, settings: PrivacySettings): string {
        if (!settings.anonymizeUserIds) return address;
        
        // Simple hash-like anonymization for simulation
        let hash = 0;
        for (let i = 0; i < address.length; i++) {
            const char = address.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `anon_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Calculates trend from historical data.
     */
    public static calculateTrend(data: any[]): 'increasing' | 'decreasing' | 'stable' {
        if (data.length < 2) return 'stable';
        
        const last = data[data.length - 1];
        const previous = data[data.length - 2];
        
        const lastVal = typeof last === 'number' ? last : (last.value || 0);
        const prevVal = typeof previous === 'number' ? previous : (previous.value || 0);
        
        if (lastVal > prevVal * 1.05) return 'increasing';
        if (lastVal < prevVal * 0.95) return 'decreasing';
        return 'stable';
    }

    /**
     * Calculates performance indicators from usage metrics.
     */
    public static calculatePerformanceIndicators(metrics: UsageMetrics[]): any {
        if (metrics.length === 0) return { averageGasUsage: 0, errorRate: 0 };
        
        const totalGas = metrics.reduce((sum, m) => sum + m.gasUsed, 0);
        const errorCount = metrics.filter(m => m.functionName === 'error').length; // Simulated
        
        return {
            averageGasUsage: totalGas / metrics.length,
            errorRate: (errorCount / metrics.length) * 100
        };
    }

    /**
     * Estimates gas savings from batching.
     */
    public static estimateBatchGasSavings(singleGas: number, batchSize: number): number {
        if (batchSize <= 1) return 0;
        const baseOverhead = 21000;
        const batchOverhead = 30000;
        
        const individualTotal = singleGas * batchSize;
        const batchedTotal = batchOverhead + ((singleGas - baseOverhead) * batchSize);
        
        return Math.max(0, ((individualTotal - batchedTotal) / individualTotal) * 100);
    }

    /**
     * Calculates optimal batch size based on costs.
     */
    public static calculateOptimalBatchSize(baseCost: number, perItemCost: number): number {
        // Simple heuristic: balance overhead vs processing time
        return Math.min(50, Math.max(2, Math.floor(baseCost / (perItemCost * 0.1))));
    }

    /**
     * Validates privacy settings compliance.
     */
    public static validatePrivacyCompliance(settings: PrivacySettings): boolean {
        // Ensure minimum requirements are met
        return settings.dataRetentionDays <= 365 && 
               (!settings.collectIpAddresses || settings.anonymizeUserIds);
    }

    /**
     * Cleans up old data based on retention policy.
     */
    public static cleanupOldData(data: any[], retentionDays: number): any[] {
        const now = Date.now();
        const cutoff = now - (retentionDays * 24 * 60 * 60 * 1000);
        return data.filter(item => item.timestamp >= cutoff);
    }
}
