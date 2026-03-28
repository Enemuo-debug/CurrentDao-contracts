import { 
    UsageMetrics, 
    EngagementMetrics, 
    PerformanceIndicators, 
    HistoricalAnalytics,
    AggregatedData,
    PrivacySettings,
    OptimizationSuggestion,
    AnalyticsConfiguration,
    TimeSeriesData,
    UserAnalytics,
    ContractAnalytics,
    DEFAULT_CONFIGURATION,
    OPTIMIZATION_TEMPLATES
} from '../structures/UsageStructure';

/**
 * Utility library for analytics calculations and data processing
 */
export class AnalyticsLib {
    
    // --- Data Anonymization ---

    /**
     * Anonymizes user address based on privacy settings
     */
    static anonymizeAddress(userAddress: string, settings: PrivacySettings): string {
        switch (settings.anonymizationLevel) {
            case 'none':
                return userAddress;
            case 'partial':
                return this.partialAnonymize(userAddress);
            case 'full':
                return this.fullAnonymize(userAddress);
            default:
                return this.partialAnonymize(userAddress);
        }
    }

    private static partialAnonymize(address: string): string {
        if (address.length <= 8) return '0x****';
        return address.substring(0, 6) + '****' + address.substring(address.length - 4);
    }

    private static fullAnonymize(address: string): string {
        // Create a consistent hash for the address
        let hash = 0;
        for (let i = 0; i < address.length; i++) {
            const char = address.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return '0x' + Math.abs(hash).toString(16).padStart(40, '0').substring(0, 40);
    }

    // --- Time Series Analysis ---

    /**
     * Calculates trend analysis for time series data
     */
    static calculateTrend(data: TimeSeriesData[]): {
        trend: 'increasing' | 'decreasing' | 'stable';
        changePercentage: number;
        confidence: number;
    } {
        if (data.length < 2) {
            return { trend: 'stable', changePercentage: 0, confidence: 0 };
        }

        const firstValue = data[0].value;
        const lastValue = data[data.length - 1].value;
        const changePercentage = ((lastValue - firstValue) / firstValue) * 100;

        // Simple linear regression for trend detection
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        data.forEach((point, index) => {
            sumX += index;
            sumY += point.value;
            sumXY += index * point.value;
            sumX2 += index * index;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const confidence = Math.abs(slope) / (firstValue || 1) * 100;

        let trend: 'increasing' | 'decreasing' | 'stable';
        if (Math.abs(changePercentage) < 5) {
            trend = 'stable';
        } else if (changePercentage > 0) {
            trend = 'increasing';
        } else {
            trend = 'decreasing';
        }

        return { trend, changePercentage, confidence: Math.min(confidence, 100) };
    }

    /**
     * Aggregates time series data by specified granularity
     */
    static aggregateByGranularity(
        data: TimeSeriesData[], 
        granularity: 'hourly' | 'daily' | 'weekly' | 'monthly'
    ): TimeSeriesData[] {
        const aggregated = new Map<number, number[]>();

        data.forEach(point => {
            const date = new Date(point.timestamp);
            let key: number;

            switch (granularity) {
                case 'hourly':
                    key = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime();
                    break;
                case 'daily':
                    key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                    break;
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime();
                    break;
                case 'monthly':
                    key = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
                    break;
            }

            if (!aggregated.has(key)) {
                aggregated.set(key, []);
            }
            aggregated.get(key)!.push(point.value);
        });

        return Array.from(aggregated.entries()).map(([timestamp, values]) => ({
            timestamp,
            value: values.reduce((sum, val) => sum + val, 0) / values.length
        }));
    }

    // --- Performance Metrics ---

    /**
     * Calculates performance indicators from usage metrics
     */
    static calculatePerformanceIndicators(metrics: UsageMetrics[]): PerformanceIndicators {
        if (metrics.length === 0) {
            return {
                systemHealth: 'healthy',
                averageGasUsage: 0,
                gasEfficiency: 100,
                averageExecutionTime: 0,
                successRate: 100,
                errorRate: 0,
                throughput: 0,
                latency: 0,
                availability: 100,
                resourceUtilization: 0,
                timestamp: Date.now(),
                alerts: []
            };
        }

        const successfulMetrics = metrics.filter(m => m.success);
        const failedMetrics = metrics.filter(m => !m.success);
        
        const averageGasUsage = metrics.reduce((sum, m) => sum + m.gasUsed, 0) / metrics.length;
        const averageExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
        const successRate = (successfulMetrics.length / metrics.length) * 100;
        const errorRate = (failedMetrics.length / metrics.length) * 100;

        // Calculate throughput (transactions per minute)
        const timeSpan = Math.max(...metrics.map(m => m.timestamp)) - Math.min(...metrics.map(m => m.timestamp));
        const throughput = timeSpan > 0 ? (metrics.length / timeSpan) * 60000 : 0;

        // Calculate gas efficiency (compared to baseline)
        const baselineGasUsage = 50000; // Example baseline
        const gasEfficiency = Math.max(0, 100 - ((averageGasUsage - baselineGasUsage) / baselineGasUsage) * 100);

        // Determine system health
        let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
        const alerts: any[] = [];

        if (errorRate > 10) {
            systemHealth = 'critical';
            alerts.push({
                metric: 'errorRate',
                value: errorRate,
                threshold: 10,
                severity: 'high' as const,
                message: 'High error rate detected',
                timestamp: Date.now(),
                resolved: false
            });
        } else if (errorRate > 5) {
            systemHealth = 'warning';
            alerts.push({
                metric: 'errorRate',
                value: errorRate,
                threshold: 5,
                severity: 'medium' as const,
                message: 'Elevated error rate',
                timestamp: Date.now(),
                resolved: false
            });
        }

        if (averageGasUsage > 100000) {
            alerts.push({
                metric: 'gasUsage',
                value: averageGasUsage,
                threshold: 100000,
                severity: 'medium' as const,
                message: 'High gas usage detected',
                timestamp: Date.now(),
                resolved: false
            });
        }

        return {
            systemHealth,
            averageGasUsage,
            gasEfficiency,
            averageExecutionTime,
            successRate,
            errorRate,
            throughput,
            latency: averageExecutionTime,
            availability: successRate,
            resourceUtilization: Math.min(100, (averageGasUsage / 200000) * 100),
            timestamp: Date.now(),
            alerts
        };
    }

    // --- Engagement Metrics ---

    /**
     * Calculates engagement metrics from user analytics
     */
    static calculateEngagementMetrics(
        userAnalytics: UserAnalytics[],
        period: 'daily' | 'weekly' | 'monthly',
        timestamp: number = Date.now()
    ): EngagementMetrics {
        if (userAnalytics.length === 0) {
            return {
                period,
                timestamp,
                activeUsers: 0,
                newUsers: 0,
                returningUsers: 0,
                totalTransactions: 0,
                uniqueContracts: 0,
                averageSessionDuration: 0,
                bounceRate: 0,
                retentionRate: 0,
                featureUsage: new Map(),
                peakActivityHours: []
            };
        }

        const periodMs = this.getPeriodMs(period);
        const periodStart = timestamp - periodMs;

        const activeUsers = userAnalytics.filter(user => 
            user.lastSeen >= periodStart && user.lastSeen <= timestamp
        ).length;

        const newUsers = userAnalytics.filter(user => 
            user.firstSeen >= periodStart && user.firstSeen <= timestamp
        ).length;

        const returningUsers = activeUsers - newUsers;

        const totalTransactions = userAnalytics.reduce((sum, user) => sum + user.totalTransactions, 0);
        
        const allContracts = new Set<string>();
        userAnalytics.forEach(user => {
            user.contractsInteracted.forEach(contract => allContracts.add(contract));
        });

        // Calculate average session duration
        const sessions = userAnalytics.flatMap(user => user.sessionHistory);
        const averageSessionDuration = sessions.length > 0 
            ? sessions.reduce((sum, session) => sum + session.duration, 0) / sessions.length 
            : 0;

        // Calculate bounce rate (users with only one transaction)
        const bouncedUsers = userAnalytics.filter(user => user.totalTransactions === 1).length;
        const bounceRate = activeUsers > 0 ? (bouncedUsers / activeUsers) * 100 : 0;

        // Calculate retention rate (users active in previous period still active)
        const retentionRate = this.calculateRetentionRate(userAnalytics, period, timestamp);

        // Aggregate feature usage
        const featureUsage = new Map<string, number>();
        userAnalytics.forEach(user => {
            user.functionsUsed.forEach((count, functionName) => {
                featureUsage.set(functionName, (featureUsage.get(functionName) || 0) + count);
            });
        });

        // Calculate peak activity hours
        const peakActivityHours = this.calculatePeakActivityHours(sessions);

        return {
            period,
            timestamp,
            activeUsers,
            newUsers,
            returningUsers,
            totalTransactions,
            uniqueContracts: allContracts.size,
            averageSessionDuration,
            bounceRate,
            retentionRate,
            featureUsage,
            peakActivityHours
        };
    }

    private static getPeriodMs(period: 'daily' | 'weekly' | 'monthly'): number {
        switch (period) {
            case 'daily': return 24 * 60 * 60 * 1000;
            case 'weekly': return 7 * 24 * 60 * 60 * 1000;
            case 'monthly': return 30 * 24 * 60 * 60 * 1000;
        }
    }

    private static calculateRetentionRate(
        userAnalytics: UserAnalytics[], 
        period: 'daily' | 'weekly' | 'monthly',
        timestamp: number
    ): number {
        const periodMs = this.getPeriodMs(period);
        const currentPeriodStart = timestamp - periodMs;
        const previousPeriodStart = currentPeriodStart - periodMs;

        const previouslyActive = userAnalytics.filter(user => 
            user.lastSeen >= previousPeriodStart && user.lastSeen < currentPeriodStart
        );

        const stillActive = previouslyActive.filter(user => 
            user.lastSeen >= currentPeriodStart && user.lastSeen <= timestamp
        );

        return previouslyActive.length > 0 ? (stillActive.length / previouslyActive.length) * 100 : 0;
    }

    private static calculatePeakActivityHours(sessions: any[]): number[] {
        const hourlyActivity = new Array(24).fill(0);
        
        sessions.forEach(session => {
            const hour = new Date(session.startTime).getHours();
            hourlyActivity[hour]++;
        });

        const maxActivity = Math.max(...hourlyActivity);
        const threshold = maxActivity * 0.8;
        
        return hourlyActivity
            .map((activity, hour) => ({ hour, activity }))
            .filter(({ activity }) => activity >= threshold)
            .map(({ hour }) => hour);
    }

    // --- Data Aggregation ---

    /**
     * Aggregates usage data into summary statistics
     */
    static aggregateUsageData(
        metrics: UsageMetrics[],
        timeRange?: { start: number; end: number }
    ): AggregatedData {
        let filteredMetrics = metrics;
        
        if (timeRange) {
            filteredMetrics = metrics.filter(m => 
                m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
            );
        }

        const uniqueUsers = new Set(filteredMetrics.map(m => m.anonymizedUserId));
        const uniqueContracts = new Set(filteredMetrics.map(m => m.contractAddress));
        
        const totalTransactions = filteredMetrics.length;
        const totalGasUsed = filteredMetrics.reduce((sum, m) => sum + m.gasUsed, 0);
        const totalValue = filteredMetrics.reduce((sum, m) => sum + m.transactionValue, 0);
        
        const averageGasUsage = totalTransactions > 0 ? totalGasUsed / totalTransactions : 0;
        const averageTransactionValue = totalTransactions > 0 ? totalValue / totalTransactions : 0;

        // Calculate top contracts by usage
        const contractUsage = new Map<string, number>();
        filteredMetrics.forEach(m => {
            contractUsage.set(m.contractAddress, (contractUsage.get(m.contractAddress) || 0) + 1);
        });

        const topContracts = Array.from(contractUsage.entries())
            .map(([address, usage]) => ({
                address,
                usage,
                percentage: (usage / totalTransactions) * 100
            }))
            .sort((a, b) => b.usage - a.usage)
            .slice(0, 10);

        return {
            totalUsers: uniqueUsers.size,
            activeUsers: uniqueUsers.size,
            totalTransactions,
            totalGasUsed,
            averageGasUsage,
            totalValue,
            averageTransactionValue,
            uniqueContracts: uniqueContracts.size,
            topContracts,
            timeRange: {
                start: timeRange?.start || Math.min(...filteredMetrics.map(m => m.timestamp)),
                end: timeRange?.end || Math.max(...filteredMetrics.map(m => m.timestamp))
            },
            lastUpdated: Date.now()
        };
    }

    // --- Optimization Suggestions ---

    /**
     * Generates optimization suggestions based on analytics data
     */
    static generateOptimizationSuggestions(
        metrics: UsageMetrics[],
        performance: PerformanceIndicators,
        config: AnalyticsConfiguration
    ): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];

        // Gas optimization suggestions
        if (performance.averageGasUsage > config.alertThresholds.gasUsage) {
            suggestions.push({
                id: `gas_optimization_${Date.now()}`,
                category: 'gas',
                priority: 'high',
                title: 'High Gas Usage Detected',
                description: `Average gas usage of ${performance.averageGasUsage} exceeds threshold of ${config.alertThresholds.gasUsage}`,
                impact: {
                    gasSavings: 20,
                    performanceImprovement: 10
                },
                implementation: {
                    difficulty: 'medium',
                    estimatedTime: 6,
                    prerequisites: ['Code analysis', 'Gas profiling']
                },
                status: 'pending',
                createdAt: Date.now(),
                validUntil: Date.now() + (14 * 24 * 60 * 60 * 1000)
            });
        }

        // Performance optimization suggestions
        if (performance.averageExecutionTime > config.alertThresholds.latency) {
            suggestions.push({
                id: `performance_optimization_${Date.now()}`,
                category: 'performance',
                priority: 'medium',
                title: 'High Latency Detected',
                description: `Average execution time of ${performance.averageExecutionTime}ms exceeds threshold`,
                impact: {
                    performanceImprovement: 30
                },
                implementation: {
                    difficulty: 'medium',
                    estimatedTime: 8,
                    prerequisites: ['Performance profiling', 'Code optimization']
                },
                status: 'pending',
                createdAt: Date.now(),
                validUntil: Date.now() + (14 * 24 * 60 * 60 * 1000)
            });
        }

        // Error rate optimization
        if (performance.errorRate > config.alertThresholds.errorRate) {
            suggestions.push({
                id: `error_reduction_${Date.now()}`,
                category: 'security',
                priority: 'high',
                title: 'High Error Rate Detected',
                description: `Error rate of ${performance.errorRate}% exceeds threshold`,
                impact: {
                    performanceImprovement: 25,
                    userExperienceImprovement: 40
                },
                implementation: {
                    difficulty: 'hard',
                    estimatedTime: 12,
                    prerequisites: ['Error analysis', 'Code review', 'Testing']
                },
                status: 'pending',
                createdAt: Date.now(),
                validUntil: Date.now() + (14 * 24 * 60 * 60 * 1000)
            });
        }

        // Add template suggestions if enabled
        if (config.optimization.enabled) {
            suggestions.push(...OPTIMIZATION_TEMPLATES.filter(template => 
                config.optimization.maxPriority === 'critical' ? template.priority === 'critical' :
                config.optimization.maxPriority === 'high' ? ['critical', 'high'].includes(template.priority) :
                config.optimization.maxPriority === 'medium' ? ['critical', 'high', 'medium'].includes(template.priority) :
                true
            ));
        }

        return suggestions;
    }

    // --- Gas Optimization ---

    /**
     * Estimates gas savings for batch operations
     */
    static estimateBatchGasSavings(singleOperationGas: number, batchSize: number): number {
        // Batch operations typically save 20-40% gas per operation
        const batchEfficiency = 0.3; // 30% savings
        const totalSingleGas = singleOperationGas * batchSize;
        const estimatedBatchGas = singleOperationGas + (singleOperationGas * batchSize * (1 - batchEfficiency));
        return totalSingleGas - estimatedBatchGas;
    }

    /**
     * Calculates optimal batch size for gas efficiency
     */
    static calculateOptimalBatchSize(
        baseGasCost: number,
        perItemGasCost: number,
        maxGasLimit: number = 8000000
    ): number {
        const maxPossibleSize = Math.floor((maxGasLimit - baseGasCost) / perItemGasCost);
        
        // Consider diminishing returns after certain batch sizes
        const efficiencyOptimalSize = Math.floor(baseGasCost / perItemGasCost * 10);
        
        return Math.min(maxPossibleSize, efficiencyOptimalSize, 100); // Cap at 100 for practicality
    }

    // --- Privacy Validation ---

    /**
     * Validates privacy settings compliance
     */
    static validatePrivacyCompliance(settings: PrivacySettings): boolean {
        // Check data retention limits
        const maxRetentionDays = 365;
        if (settings.dataRetention > maxRetentionDays) {
            return false;
        }

        // Check anonymization level
        if (settings.dataCollection && settings.anonymizationLevel === 'none') {
            return false; // Require at least partial anonymization when collecting data
        }

        return true;
    }

    // --- Data Cleanup ---

    /**
     * Cleans up old data based on retention policies
     */
    static cleanupOldData(
        data: { timestamp: number }[],
        maxAge: number
    ): { timestamp: number }[] {
        const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
        return data.filter(item => item.timestamp >= cutoffTime);
    }
}
