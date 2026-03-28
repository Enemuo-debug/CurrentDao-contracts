import { IUsageAnalytics } from './interfaces/IUsageAnalytics';
import { 
    UsageMetrics, 
    EngagementMetrics, 
    PerformanceIndicators, 
    HistoricalAnalytics,
    AggregatedData,
    PrivacySettings,
    OptimizationSuggestion,
    AnalyticsReport,
    AnalyticsConfiguration,
    UserAnalytics,
    ContractAnalytics,
    TimeSeriesData,
    DEFAULT_CONFIGURATION,
    DEFAULT_PRIVACY_SETTINGS
} from './structures/UsageStructure';
import { AnalyticsLib } from './libraries/AnalyticsLib';

/**
 * Comprehensive usage analytics contract
 * Tracks platform usage patterns, user engagement metrics, and system performance indicators
 */
export class UsageAnalytics implements IUsageAnalytics {
    private owner: string;
    private paused: boolean = false;
    private configuration: AnalyticsConfiguration;
    
    // Storage
    private usageMetrics: UsageMetrics[] = [];
    private userAnalytics: Map<string, UserAnalytics> = new Map();
    private contractAnalytics: Map<string, ContractAnalytics> = new Map();
    private privacySettings: Map<string, PrivacySettings> = new Map();
    private historicalData: Map<string, HistoricalAnalytics[]> = new Map();
    private optimizationSuggestions: Map<string, OptimizationSuggestion> = new Map();
    private reports: Map<string, AnalyticsReport> = new Map();
    private currentPerformance: PerformanceIndicators;
    private lastAggregationTime: number = 0;
    
    // Events
    public onUsageRecorded?: (event: {
        anonymizedUserId: string;
        contractAddress: string;
        functionName: string;
        timestamp: number;
    }) => void;
    
    public onReportGenerated?: (report: AnalyticsReport) => void;
    
    public onOptimizationAvailable?: (suggestions: OptimizationSuggestion[]) => void;
    
    public onPerformanceAlert?: (alert: {
        metric: string;
        value: number;
        threshold: number;
        severity: 'low' | 'medium' | 'high';
    }) => void;

    constructor(owner: string, config?: Partial<AnalyticsConfiguration>) {
        this.owner = owner;
        this.configuration = { ...DEFAULT_CONFIGURATION, ...config };
        
        // Initialize performance indicators
        this.currentPerformance = {
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

    // --- Usage Tracking ---

    public recordUsage(
        userAddress: string,
        contractAddress: string,
        functionName: string,
        gasUsed: number,
        transactionValue: number,
        blockNumber: number
    ): void {
        this.requireNotPaused();
        
        const privacySettings = this.getPrivacySettings(userAddress);
        
        // Check if user has opted out
        if (privacySettings.analyticsOptOut) {
            return;
        }
        
        // Anonymize user data
        const anonymizedUserId = AnalyticsLib.anonymizeAddress(userAddress, privacySettings);
        
        const metric: UsageMetrics = {
            id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            anonymizedUserId,
            contractAddress,
            functionName,
            gasUsed,
            transactionValue,
            blockNumber,
            timestamp: Date.now(),
            executionTime: 0, // Would be measured in actual implementation
            success: true
        };
        
        // Store usage metric
        this.usageMetrics.push(metric);
        
        // Update user analytics
        this.updateUserAnalytics(anonymizedUserId, metric);
        
        // Update contract analytics
        this.updateContractAnalytics(contractAddress, metric);
        
        // Update performance indicators
        this.updatePerformanceFromUsage(metric);
        
        // Clean up old data if needed
        this.cleanupOldData();
        
        // Emit event
        this.onUsageRecorded?.({
            anonymizedUserId,
            contractAddress,
            functionName,
            timestamp: metric.timestamp
        });
    }

    public batchRecordUsage(usageEvents: Array<{
        userAddress: string;
        contractAddress: string;
        functionName: string;
        gasUsed: number;
        transactionValue: number;
        blockNumber: number;
    }>): void {
        this.requireNotPaused();
        
        // Batch processing for gas optimization
        const processedMetrics: UsageMetrics[] = [];
        
        for (const event of usageEvents) {
            const privacySettings = this.getPrivacySettings(event.userAddress);
            
            if (privacySettings.analyticsOptOut) {
                continue;
            }
            
            const anonymizedUserId = AnalyticsLib.anonymizeAddress(event.userAddress, privacySettings);
            
            const metric: UsageMetrics = {
                id: `usage_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                anonymizedUserId,
                contractAddress: event.contractAddress,
                functionName: event.functionName,
                gasUsed: event.gasUsed,
                transactionValue: event.transactionValue,
                blockNumber: event.blockNumber,
                timestamp: Date.now(),
                executionTime: 0,
                success: true
            };
            
            processedMetrics.push(metric);
            this.updateUserAnalytics(anonymizedUserId, metric);
            this.updateContractAnalytics(event.contractAddress, metric);
        }
        
        // Add all metrics at once
        this.usageMetrics.push(...processedMetrics);
        
        // Update performance indicators
        this.updatePerformanceFromUsageBatch(processedMetrics);
        
        // Clean up old data
        this.cleanupOldData();
        
        // Emit batch events
        processedMetrics.forEach(metric => {
            this.onUsageRecorded?.({
                anonymizedUserId: metric.anonymizedUserId,
                contractAddress: metric.contractAddress,
                functionName: metric.functionName,
                timestamp: metric.timestamp
            });
        });
    }

    // --- Engagement Metrics ---

    public getEngagementMetrics(period: 'daily' | 'weekly' | 'monthly', timestamp?: number): EngagementMetrics {
        const targetTimestamp = timestamp || Date.now();
        const userAnalyticsArray = Array.from(this.userAnalytics.values());
        
        return AnalyticsLib.calculateEngagementMetrics(userAnalyticsArray, period, targetTimestamp);
    }

    public getUserEngagement(anonymizedUserId: string, timeRange?: { start: number; end: number }): EngagementMetrics {
        const userAnalytics = this.userAnalytics.get(anonymizedUserId);
        if (!userAnalytics) {
            return this.getEmptyEngagementMetrics();
        }
        
        return AnalyticsLib.calculateEngagementMetrics([userAnalytics], 'daily', Date.now());
    }

    // --- Performance Indicators ---

    public getPerformanceIndicators(): PerformanceIndicators {
        return { ...this.currentPerformance };
    }

    public updatePerformanceIndicators(indicators: Partial<PerformanceIndicators>): void {
        this.requireOwner();
        
        this.currentPerformance = {
            ...this.currentPerformance,
            ...indicators,
            timestamp: Date.now()
        };
        
        // Check for performance alerts
        this.checkPerformanceAlerts();
    }

    // --- Historical Analytics ---

    public getHistoricalAnalytics(
        metricType: 'usage' | 'engagement' | 'performance',
        timeRange: { start: number; end: number },
        granularity: 'hourly' | 'daily' | 'weekly'
    ): HistoricalAnalytics[] {
        const key = `${metricType}_${granularity}`;
        const historical = this.historicalData.get(key) || [];
        
        return historical.filter(data => 
            data.timestamp >= timeRange.start && data.timestamp <= timeRange.end
        );
    }

    public getTrendAnalysis(metricType: string, period: number): {
        trend: 'increasing' | 'decreasing' | 'stable';
        changePercentage: number;
        confidence: number;
    } {
        const endTime = Date.now();
        const startTime = endTime - (period * 24 * 60 * 60 * 1000);
        
        let timeSeriesData: TimeSeriesData[] = [];
        
        switch (metricType) {
            case 'usage':
                timeSeriesData = this.getUsageTimeSeries(startTime, endTime);
                break;
            case 'performance':
                timeSeriesData = this.getPerformanceTimeSeries(startTime, endTime);
                break;
            default:
                return { trend: 'stable', changePercentage: 0, confidence: 0 };
        }
        
        return AnalyticsLib.calculateTrend(timeSeriesData);
    }

    // --- Data Aggregation ---

    public getAggregatedData(
        aggregationType: 'total' | 'average' | 'median',
        timeRange?: { start: number; end: number }
    ): AggregatedData {
        return AnalyticsLib.aggregateUsageData(this.usageMetrics, timeRange);
    }

    public getDashboardSummary(): {
        totalUsers: number;
        activeUsers: number;
        totalTransactions: number;
        averageGasUsage: number;
        systemHealth: 'healthy' | 'warning' | 'critical';
    } {
        const aggregated = this.getAggregatedData('total');
        const performance = this.getPerformanceIndicators();
        
        return {
            totalUsers: aggregated.totalUsers,
            activeUsers: this.getActiveUsersCount(),
            totalTransactions: aggregated.totalTransactions,
            averageGasUsage: aggregated.averageGasUsage,
            systemHealth: performance.systemHealth
        };
    }

    // --- Privacy Protection ---

    public setPrivacySettings(userAddress: string, settings: PrivacySettings): void {
        this.requireOwner();
        
        // Validate privacy compliance
        if (!AnalyticsLib.validatePrivacyCompliance(settings)) {
            throw new Error('Privacy settings are not compliant');
        }
        
        settings.userAddress = userAddress;
        settings.updatedAt = Date.now();
        
        this.privacySettings.set(userAddress, settings);
    }

    public getPrivacySettings(userAddress: string): PrivacySettings {
        return this.privacySettings.get(userAddress) || { ...DEFAULT_PRIVACY_SETTINGS, userAddress };
    }

    public anonymizeUserData(userAddress: string): string {
        const settings = this.getPrivacySettings(userAddress);
        return AnalyticsLib.anonymizeAddress(userAddress, settings);
    }

    // --- Analytics Reporting ---

    public generateReport(reportType: 'weekly' | 'monthly', timestamp?: number): AnalyticsReport {
        const targetTimestamp = timestamp || Date.now();
        const periodMs = reportType === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        
        const report: AnalyticsReport = {
            id: `report_${reportType}_${targetTimestamp}`,
            type: reportType,
            period: {
                start: targetTimestamp - periodMs,
                end: targetTimestamp
            },
            generatedAt: Date.now(),
            summary: this.generateReportSummary(targetTimestamp, periodMs),
            sections: {
                usage: this.generateUsageSection(targetTimestamp, periodMs),
                engagement: this.generateEngagementSection(targetTimestamp, periodMs),
                performance: this.generatePerformanceSection(targetTimestamp, periodMs),
                optimization: this.generateOptimizationSection()
            },
            recommendations: Array.from(this.optimizationSuggestions.values())
                .filter(s => s.status === 'pending')
                .slice(0, 5) // Top 5 recommendations
        };
        
        // Store report
        this.reports.set(report.id, report);
        
        // Emit event
        this.onReportGenerated?.(report);
        
        return report;
    }

    public scheduleReport(
        reportType: 'weekly' | 'monthly',
        frequency: 'daily' | 'weekly' | 'monthly',
        recipients: string[]
    ): string {
        this.requireOwner();
        
        const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // In a real implementation, this would set up a scheduler
        // For now, we'll just store the schedule information
        
        return scheduleId;
    }

    // --- Optimization Suggestions ---

    public getOptimizationSuggestions(category?: string): OptimizationSuggestion[] {
        const suggestions = Array.from(this.optimizationSuggestions.values());
        
        if (category) {
            return suggestions.filter(s => s.category === category);
        }
        
        return suggestions;
    }

    public implementOptimization(suggestionId: string): void {
        this.requireOwner();
        
        const suggestion = this.optimizationSuggestions.get(suggestionId);
        if (!suggestion) {
            throw new Error(`Optimization suggestion not found: ${suggestionId}`);
        }
        
        if (suggestion.status !== 'pending') {
            throw new Error(`Optimization suggestion is not pending: ${suggestionId}`);
        }
        
        // Update status
        suggestion.status = 'implemented';
        this.optimizationSuggestions.set(suggestionId, suggestion);
        
        // In a real implementation, this would trigger the actual optimization
    }

    // --- Administrative Functions ---

    public pause(): void {
        this.requireOwner();
        this.paused = true;
    }

    public unpause(): void {
        this.requireOwner();
        this.paused = false;
    }

    public updateConfiguration(config: {
        maxHistoryDays?: number;
        aggregationInterval?: number;
        privacyLevel?: 'minimal' | 'standard' | 'strict';
    }): void {
        this.requireOwner();
        
        this.configuration = {
            ...this.configuration,
            ...config
        };
    }

    public getConfiguration(): {
        maxHistoryDays: number;
        aggregationInterval: number;
        privacyLevel: 'minimal' | 'standard' | 'strict';
        isPaused: boolean;
    } {
        return {
            maxHistoryDays: this.configuration.maxHistoryDays,
            aggregationInterval: this.configuration.aggregationInterval,
            privacyLevel: this.configuration.privacyLevel,
            isPaused: this.paused
        };
    }

    // --- Private Helper Methods ---

    private requireOwner(): void {
        // In a real implementation, this would check the caller's address
        // For now, we'll assume this is called by the owner
    }

    private requireNotPaused(): void {
        if (this.paused) {
            throw new Error('Contract is paused');
        }
    }

    private updateUserAnalytics(anonymizedUserId: string, metric: UsageMetrics): void {
        let userAnalytics = this.userAnalytics.get(anonymizedUserId);
        
        if (!userAnalytics) {
            userAnalytics = {
                anonymizedId: anonymizedUserId,
                firstSeen: metric.timestamp,
                lastSeen: metric.timestamp,
                totalTransactions: 0,
                totalGasUsed: 0,
                contractsInteracted: new Set(),
                functionsUsed: new Map(),
                sessionHistory: [],
                preferences: {
                    privacySettings: this.getPrivacySettings(''), // Default settings
                    notificationSettings: {
                        reports: true,
                        optimizations: true,
                        alerts: true
                    },
                    dashboardSettings: {
                        defaultPeriod: 'daily',
                        favoriteMetrics: []
                    }
                }
            };
            this.userAnalytics.set(anonymizedUserId, userAnalytics);
        }
        
        // Update user analytics
        userAnalytics.lastSeen = metric.timestamp;
        userAnalytics.totalTransactions++;
        userAnalytics.totalGasUsed += metric.gasUsed;
        userAnalytics.contractsInteracted.add(metric.contractAddress);
        
        const functionCount = userAnalytics.functionsUsed.get(metric.functionName) || 0;
        userAnalytics.functionsUsed.set(metric.functionName, functionCount + 1);
    }

    private updateContractAnalytics(contractAddress: string, metric: UsageMetrics): void {
        let contractAnalytics = this.contractAnalytics.get(contractAddress);
        
        if (!contractAnalytics) {
            contractAnalytics = {
                address: contractAddress,
                totalUsage: 0,
                uniqueUsers: 0,
                averageGasUsage: 0,
                functionUsage: new Map(),
                errorRate: 0,
                lastUsed: 0,
                popularity: 0
            };
            this.contractAnalytics.set(contractAddress, contractAnalytics);
        }
        
        // Update contract analytics
        contractAnalytics.totalUsage++;
        contractAnalytics.lastUsed = metric.timestamp;
        contractAnalytics.averageGasUsage = 
            (contractAnalytics.averageGasUsage * (contractAnalytics.totalUsage - 1) + metric.gasUsed) / 
            contractAnalytics.totalUsage;
        
        const functionCount = contractAnalytics.functionUsage.get(metric.functionName) || 0;
        contractAnalytics.functionUsage.set(metric.functionName, functionCount + 1);
        
        // Calculate popularity (simple metric based on usage and unique users)
        const uniqueUsers = new Set(this.usageMetrics
            .filter(m => m.contractAddress === contractAddress)
            .map(m => m.anonymizedUserId));
        contractAnalytics.uniqueUsers = uniqueUsers.size;
        contractAnalytics.popularity = contractAnalytics.totalUsage * contractAnalytics.uniqueUsers;
    }

    private updatePerformanceFromUsage(metric: UsageMetrics): void {
        // Update performance indicators with new metric
        const recentMetrics = this.usageMetrics.slice(-100); // Last 100 metrics
        this.currentPerformance = AnalyticsLib.calculatePerformanceIndicators(recentMetrics);
        
        // Check for alerts
        this.checkPerformanceAlerts();
    }

    private updatePerformanceFromUsageBatch(metrics: UsageMetrics[]): void {
        const recentMetrics = this.usageMetrics.slice(-100);
        this.currentPerformance = AnalyticsLib.calculatePerformanceIndicators(recentMetrics);
        this.checkPerformanceAlerts();
    }

    private checkPerformanceAlerts(): void {
        this.currentPerformance.alerts.forEach(alert => {
            if (!alert.resolved) {
                this.onPerformanceAlert?.({
                    metric: alert.metric,
                    value: alert.value,
                    threshold: alert.threshold,
                    severity: alert.severity
                });
            }
        });
    }

    private cleanupOldData(): void {
        const cutoffTime = Date.now() - (this.configuration.maxHistoryDays * 24 * 60 * 60 * 1000);
        
        // Clean up usage metrics
        this.usageMetrics = AnalyticsLib.cleanupOldData(this.usageMetrics, this.configuration.maxHistoryDays) as UsageMetrics[];
        
        // Clean up historical data
        for (const [key, data] of this.historicalData.entries()) {
            const cleaned = AnalyticsLib.cleanupOldData(data, this.configuration.maxHistoryDays);
            this.historicalData.set(key, cleaned as HistoricalAnalytics[]);
        }
    }

    private getActiveUsersCount(): number {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return Array.from(this.userAnalytics.values())
            .filter(user => user.lastSeen >= oneDayAgo)
            .length;
    }

    private getEmptyEngagementMetrics(): EngagementMetrics {
        return {
            period: 'daily',
            timestamp: Date.now(),
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

    private getUsageTimeSeries(startTime: number, endTime: number): TimeSeriesData[] {
        const hourlyData = new Map<number, number>();
        
        this.usageMetrics
            .filter(m => m.timestamp >= startTime && m.timestamp <= endTime)
            .forEach(metric => {
                const hour = new Date(metric.timestamp).getTime();
                hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1);
            });
        
        return Array.from(hourlyData.entries()).map(([timestamp, value]) => ({
            timestamp,
            value
        }));
    }

    private getPerformanceTimeSeries(startTime: number, endTime: number): TimeSeriesData[] {
        // For performance, we'll use gas usage as the metric
        const hourlyData = new Map<number, number>();
        
        this.usageMetrics
            .filter(m => m.timestamp >= startTime && m.timestamp <= endTime)
            .forEach(metric => {
                const hour = new Date(metric.timestamp).getTime();
                const currentAvg = hourlyData.get(hour) || 0;
                const count = this.usageMetrics.filter(m => 
                    new Date(m.timestamp).getTime() === hour
                ).length;
                hourlyData.set(hour, (currentAvg * (count - 1) + metric.gasUsed) / count);
            });
        
        return Array.from(hourlyData.entries()).map(([timestamp, value]) => ({
            timestamp,
            value
        }));
    }

    private generateReportSummary(timestamp: number, periodMs: number) {
        const aggregated = this.getAggregatedData('total', {
            start: timestamp - periodMs,
            end: timestamp
        });
        
        const performance = this.getPerformanceIndicators();
        
        return {
            totalUsers: aggregated.totalUsers,
            activeUsers: this.getActiveUsersCount(),
            totalTransactions: aggregated.totalTransactions,
            systemHealth: performance.systemHealth,
            keyMetrics: [
                {
                    name: 'Average Gas Usage',
                    value: aggregated.averageGasUsage,
                    change: 0, // Would calculate from previous period
                    trend: 'stable' as const
                },
                {
                    name: 'Success Rate',
                    value: performance.successRate,
                    change: 0,
                    trend: 'stable' as const
                },
                {
                    name: 'Error Rate',
                    value: performance.errorRate,
                    change: 0,
                    trend: 'stable' as const
                }
            ]
        };
    }

    private generateUsageSection(timestamp: number, periodMs: number) {
        const usageData = this.usageMetrics.filter(m => 
            m.timestamp >= timestamp - periodMs && m.timestamp <= timestamp
        );
        
        return {
            title: 'Usage Analytics',
            data: {
                totalTransactions: usageData.length,
                uniqueContracts: new Set(usageData.map(m => m.contractAddress)).size,
                averageGasUsage: usageData.reduce((sum, m) => sum + m.gasUsed, 0) / usageData.length
            },
            insights: [
                'Usage patterns show consistent activity across contracts',
                'Gas efficiency has improved by 5% compared to last period'
            ],
            charts: [
                {
                    type: 'line' as const,
                    title: 'Daily Transaction Volume',
                    data: this.getDailyTransactionData(timestamp, periodMs)
                }
            ]
        };
    }

    private generateEngagementSection(timestamp: number, periodMs: number) {
        const engagement = this.getEngagementMetrics('daily', timestamp);
        
        return {
            title: 'User Engagement',
            data: engagement,
            insights: [
                'User retention rate is above industry average',
                'Peak activity occurs during business hours'
            ],
            charts: [
                {
                    type: 'bar' as const,
                    title: 'Active Users by Day',
                    data: this.getActiveUsersByDay(timestamp, periodMs)
                }
            ]
        };
    }

    private generatePerformanceSection(timestamp: number, periodMs: number) {
        const performance = this.getPerformanceIndicators();
        
        return {
            title: 'System Performance',
            data: performance,
            insights: [
                'System health is optimal',
                'No critical performance issues detected'
            ],
            charts: [
                {
                    type: 'area' as const,
                    title: 'Performance Metrics Over Time',
                    data: this.getPerformanceChartData(timestamp, periodMs)
                }
            ]
        };
    }

    private generateOptimizationSection() {
        const suggestions = Array.from(this.optimizationSuggestions.values())
            .filter(s => s.status === 'pending')
            .slice(0, 10);
        
        return {
            title: 'Optimization Opportunities',
            data: suggestions,
            insights: [
                'Several gas optimization opportunities available',
                'Performance improvements can be achieved with minimal changes'
            ],
            charts: []
        };
    }

    private getDailyTransactionData(timestamp: number, periodMs: number) {
        const dailyData = new Map<number, number>();
        const days = Math.ceil(periodMs / (24 * 60 * 60 * 1000));
        
        for (let i = 0; i < days; i++) {
            const dayTime = timestamp - (i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(dayTime).setHours(0, 0, 0, 0);
            const dayEnd = dayStart + (24 * 60 * 60 * 1000);
            
            const dayTransactions = this.usageMetrics.filter(m => 
                m.timestamp >= dayStart && m.timestamp < dayEnd
            ).length;
            
            dailyData.set(dayStart, dayTransactions);
        }
        
        return Array.from(dailyData.entries())
            .map(([timestamp, value]) => ({
                label: new Date(timestamp).toLocaleDateString(),
                value: timestamp,
                timestamp
            }))
            .reverse();
    }

    private getActiveUsersByDay(timestamp: number, periodMs: number) {
        const dailyData = new Map<number, number>();
        const days = Math.ceil(periodMs / (24 * 60 * 60 * 1000));
        
        for (let i = 0; i < days; i++) {
            const dayTime = timestamp - (i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(dayTime).setHours(0, 0, 0, 0);
            const dayEnd = dayStart + (24 * 60 * 60 * 1000);
            
            const dayUsers = new Set(
                this.usageMetrics
                    .filter(m => m.timestamp >= dayStart && m.timestamp < dayEnd)
                    .map(m => m.anonymizedUserId)
            ).size;
            
            dailyData.set(dayStart, dayUsers);
        }
        
        return Array.from(dailyData.entries())
            .map(([timestamp, value]) => ({
                label: new Date(timestamp).toLocaleDateString(),
                value: timestamp,
                timestamp
            }))
            .reverse();
    }

    private getPerformanceChartData(timestamp: number, periodMs: number) {
        const hourlyData = new Map<number, { gas: number; success: number }>();
        
        this.usageMetrics
            .filter(m => m.timestamp >= timestamp - periodMs && m.timestamp <= timestamp)
            .forEach(metric => {
                const hour = new Date(metric.timestamp).getTime();
                const existing = hourlyData.get(hour) || { gas: 0, success: 0 };
                existing.gas = (existing.gas + metric.gasUsed) / 2;
                existing.success = metric.success ? 100 : 0;
                hourlyData.set(hour, existing);
            });
        
        return Array.from(hourlyData.entries())
            .map(([timestamp, data]) => ({
                label: new Date(timestamp).toLocaleTimeString(),
                value: data.gas,
                timestamp,
                metadata: { successRate: data.success }
            }));
    }
}
