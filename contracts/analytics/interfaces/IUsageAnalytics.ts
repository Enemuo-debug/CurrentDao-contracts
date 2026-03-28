import { 
    UsageMetrics, 
    EngagementMetrics, 
    PerformanceIndicators, 
    HistoricalAnalytics, 
    AggregatedData, 
    PrivacySettings,
    OptimizationSuggestion,
    AnalyticsReport
} from '../structures/UsageStructure';

/**
 * Interface for usage analytics contract
 * Tracks platform usage patterns, user engagement, and system performance
 */
export interface IUsageAnalytics {
    // --- Usage Tracking ---
    
    /**
     * Records a contract interaction for analytics
     * @param userAddress User address (will be anonymized based on privacy settings)
     * @param contractAddress Contract that was interacted with
     * @param functionName Function that was called
     * @param gasUsed Gas consumed by the transaction
     * @param transactionValue Value transferred in the transaction
     * @param blockNumber Block number of the transaction
     */
    recordUsage(
        userAddress: string,
        contractAddress: string,
        functionName: string,
        gasUsed: number,
        transactionValue: number,
        blockNumber: number
    ): void;

    /**
     * Batch records multiple usage events for gas optimization
     * @param usageEvents Array of usage events to record
     */
    batchRecordUsage(usageEvents: Array<{
        userAddress: string;
        contractAddress: string;
        functionName: string;
        gasUsed: number;
        transactionValue: number;
        blockNumber: number;
    }>): void;

    // --- Engagement Metrics ---

    /**
     * Gets engagement metrics for a specific time period
     * @param period Time period (daily, weekly, monthly)
     * @param timestamp Timestamp for the period
     */
    getEngagementMetrics(period: 'daily' | 'weekly' | 'monthly', timestamp?: number): EngagementMetrics;

    /**
     * Gets user engagement metrics for a specific user (anonymized)
     * @param anonymizedUserId Anonymized user identifier
     * @param timeRange Time range for the metrics
     */
    getUserEngagement(anonymizedUserId: string, timeRange?: { start: number; end: number }): EngagementMetrics;

    // --- Performance Indicators ---

    /**
     * Gets current system performance indicators
     */
    getPerformanceIndicators(): PerformanceIndicators;

    /**
     * Updates performance metrics
     * @param indicators New performance indicators
     */
    updatePerformanceIndicators(indicators: Partial<PerformanceIndicators>): void;

    // --- Historical Analytics ---

    /**
     * Gets historical analytics data
     * @param metricType Type of metric to retrieve
     * @param timeRange Time range for the data
     * @param granularity Data granularity (hourly, daily, weekly)
     */
    getHistoricalAnalytics(
        metricType: 'usage' | 'engagement' | 'performance',
        timeRange: { start: number; end: number },
        granularity: 'hourly' | 'daily' | 'weekly'
    ): HistoricalAnalytics[];

    /**
     * Generates trend analysis for a specific metric
     * @param metricType Type of metric to analyze
     * @param period Analysis period (7, 30, 90 days)
     */
    getTrendAnalysis(metricType: string, period: number): {
        trend: 'increasing' | 'decreasing' | 'stable';
        changePercentage: number;
        confidence: number;
    };

    // --- Data Aggregation ---

    /**
     * Gets aggregated usage statistics
     * @param aggregationType Type of aggregation (total, average, median)
     * @param timeRange Time range for aggregation
     */
    getAggregatedData(
        aggregationType: 'total' | 'average' | 'median',
        timeRange?: { start: number; end: number }
    ): AggregatedData;

    /**
     * Generates summary statistics for dashboard display
     */
    getDashboardSummary(): {
        totalUsers: number;
        activeUsers: number;
        totalTransactions: number;
        averageGasUsage: number;
        systemHealth: 'healthy' | 'warning' | 'critical';
    };

    // --- Privacy Protection ---

    /**
     * Sets privacy settings for a user
     * @param userAddress User address
     * @param settings Privacy settings
     */
    setPrivacySettings(userAddress: string, settings: PrivacySettings): void;

    /**
     * Gets privacy settings for a user
     * @param userAddress User address
     */
    getPrivacySettings(userAddress: string): PrivacySettings;

    /**
     * Anonymizes user data based on privacy settings
     * @param userAddress User address to anonymize
     */
    anonymizeUserData(userAddress: string): string;

    // --- Analytics Reporting ---

    /**
     * Generates a comprehensive analytics report
     * @param reportType Type of report (weekly, monthly)
     * @param timestamp Timestamp for the report period
     */
    generateReport(reportType: 'weekly' | 'monthly', timestamp?: number): AnalyticsReport;

    /**
     * Schedules automated report generation
     * @param reportType Type of report
     * @param frequency Report frequency
     * @param recipients Addresses to receive the report
     */
    scheduleReport(
        reportType: 'weekly' | 'monthly',
        frequency: 'daily' | 'weekly' | 'monthly',
        recipients: string[]
    ): string;

    // --- Optimization Suggestions ---

    /**
     * Gets optimization suggestions based on usage patterns
     * @param category Category of optimization (gas, performance, user_experience)
     */
    getOptimizationSuggestions(category?: string): OptimizationSuggestion[];

    /**
     * Implements an optimization suggestion
     * @param suggestionId ID of the suggestion to implement
     */
    implementOptimization(suggestionId: string): void;

    // --- Administrative Functions ---

    /**
     * Pauses analytics recording
     */
    pause(): void;

    /**
     * Resumes analytics recording
     */
    unpause(): void;

    /**
     * Updates analytics configuration
     * @param config Configuration updates
     */
    updateConfiguration(config: {
        maxHistoryDays?: number;
        aggregationInterval?: number;
        privacyLevel?: 'minimal' | 'standard' | 'strict';
    }): void;

    /**
     * Gets current configuration
     */
    getConfiguration(): {
        maxHistoryDays: number;
        aggregationInterval: number;
        privacyLevel: 'minimal' | 'standard' | 'strict';
        isPaused: boolean;
    };

    // --- Events ---

    /**
     * Emitted when usage is recorded
     */
    onUsageRecorded?: (event: {
        anonymizedUserId: string;
        contractAddress: string;
        functionName: string;
        timestamp: number;
    }) => void;

    /**
     * Emitted when a report is generated
     */
    onReportGenerated?: (report: AnalyticsReport) => void;

    /**
     * Emitted when optimization suggestions are available
     */
    onOptimizationAvailable?: (suggestions: OptimizationSuggestion[]) => void;

    /**
     * Emitted when performance thresholds are breached
     */
    onPerformanceAlert?: (alert: {
        metric: string;
        value: number;
        threshold: number;
        severity: 'low' | 'medium' | 'high';
    }) => void;
}
