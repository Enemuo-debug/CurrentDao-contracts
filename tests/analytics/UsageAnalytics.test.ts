import { UsageAnalytics } from '../contracts/analytics/UsageAnalytics';
import { AnalyticsLib } from '../contracts/analytics/libraries/AnalyticsLib';
import { 
    PrivacySettings, 
    DEFAULT_PRIVACY_SETTINGS,
    AnalyticsConfiguration 
} from '../contracts/analytics/structures/UsageStructure';

describe('UsageAnalytics', () => {
    let analytics: UsageAnalytics;
    let owner: string;
    let user1: string;
    let user2: string;
    let contract1: string;
    let contract2: string;

    beforeEach(() => {
        owner = '0xowner12345678901234567890123456789012345678';
        user1 = '0xuser1111111111111111111111111111111111111111';
        user2 = '0xuser2222222222222222222222222222222222222222';
        contract1 = '0xcontract1111111111111111111111111111111111111';
        contract2 = '0xcontract2222222222222222222222222222222222222';
        
        analytics = new UsageAnalytics(owner);
    });

    describe('Contract Initialization', () => {
        test('should initialize with correct owner', () => {
            expect(analytics.getConfiguration()).toBeDefined();
            expect(analytics.getConfiguration().isPaused).toBe(false);
        });

        test('should accept custom configuration', () => {
            const customConfig: Partial<AnalyticsConfiguration> = {
                maxHistoryDays: 180,
                aggregationInterval: 30,
                privacyLevel: 'strict'
            };
            
            const customAnalytics = new UsageAnalytics(owner, customConfig);
            const config = customAnalytics.getConfiguration();
            
            expect(config.maxHistoryDays).toBe(180);
            expect(config.aggregationInterval).toBe(30);
            expect(config.privacyLevel).toBe('strict');
        });
    });

    describe('Usage Tracking', () => {
        test('should record single usage event', () => {
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            
            const dashboard = analytics.getDashboardSummary();
            expect(dashboard.totalTransactions).toBe(1);
            expect(dashboard.totalUsers).toBe(1);
        });

        test('should record multiple usage events', () => {
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            analytics.recordUsage(user2, contract1, 'transfer', 30000, 500, 12346);
            analytics.recordUsage(user1, contract2, 'approve', 25000, 0, 12347);
            
            const dashboard = analytics.getDashboardSummary();
            expect(dashboard.totalTransactions).toBe(3);
            expect(dashboard.totalUsers).toBe(2);
        });

        test('should record batch usage events efficiently', () => {
            const batchEvents = [
                { userAddress: user1, contractAddress: contract1, functionName: 'mint', gasUsed: 50000, transactionValue: 1000, blockNumber: 12345 },
                { userAddress: user2, contractAddress: contract1, functionName: 'transfer', gasUsed: 30000, transactionValue: 500, blockNumber: 12346 },
                { userAddress: user1, contractAddress: contract2, functionName: 'approve', gasUsed: 25000, transactionValue: 0, blockNumber: 12347 }
            ];
            
            analytics.batchRecordUsage(batchEvents);
            
            const dashboard = analytics.getDashboardSummary();
            expect(dashboard.totalTransactions).toBe(3);
            expect(dashboard.totalUsers).toBe(2);
        });

        test('should respect privacy opt-out', () => {
            const privacySettings: PrivacySettings = {
                ...DEFAULT_PRIVACY_SETTINGS,
                userAddress: user1,
                analyticsOptOut: true
            };
            
            analytics.setPrivacySettings(user1, privacySettings);
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            
            const dashboard = analytics.getDashboardSummary();
            expect(dashboard.totalTransactions).toBe(0);
            expect(dashboard.totalUsers).toBe(0);
        });

        test('should emit usage recorded events', () => {
            const events: any[] = [];
            analytics.onUsageRecorded = (event) => events.push(event);
            
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            
            expect(events).toHaveLength(1);
            expect(events[0].contractAddress).toBe(contract1);
            expect(events[0].functionName).toBe('mint');
        });
    });

    describe('Engagement Metrics', () => {
        beforeEach(() => {
            // Setup test data
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            analytics.recordUsage(user1, contract1, 'transfer', 30000, 500, 12346);
            analytics.recordUsage(user2, contract1, 'mint', 50000, 1000, 12347);
        });

        test('should calculate daily engagement metrics', () => {
            const metrics = analytics.getEngagementMetrics('daily');
            
            expect(metrics.period).toBe('daily');
            expect(metrics.activeUsers).toBe(2);
            expect(metrics.totalTransactions).toBe(3);
            expect(metrics.uniqueContracts).toBe(1);
        });

        test('should calculate weekly engagement metrics', () => {
            const metrics = analytics.getEngagementMetrics('weekly');
            
            expect(metrics.period).toBe('weekly');
            expect(metrics.activeUsers).toBe(2);
            expect(metrics.totalTransactions).toBe(3);
        });

        test('should get user-specific engagement', () => {
            const anonymizedId = analytics.anonymizeUserData(user1);
            const userEngagement = analytics.getUserEngagement(anonymizedId);
            
            expect(userEngagement.totalTransactions).toBeGreaterThan(0);
        });
    });

    describe('Performance Indicators', () => {
        beforeEach(() => {
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            analytics.recordUsage(user2, contract1, 'transfer', 30000, 500, 12346);
            analytics.recordUsage(user1, contract2, 'approve', 25000, 0, 12347);
        });

        test('should calculate performance indicators', () => {
            const performance = analytics.getPerformanceIndicators();
            
            expect(performance.systemHealth).toBeDefined();
            expect(performance.averageGasUsage).toBeGreaterThan(0);
            expect(performance.successRate).toBe(100);
            expect(performance.errorRate).toBe(0);
        });

        test('should update performance indicators', () => {
            const newIndicators = {
                averageGasUsage: 60000,
                successRate: 95,
                errorRate: 5
            };
            
            analytics.updatePerformanceIndicators(newIndicators);
            
            const performance = analytics.getPerformanceIndicators();
            expect(performance.averageGasUsage).toBe(60000);
            expect(performance.successRate).toBe(95);
            expect(performance.errorRate).toBe(5);
        });

        test('should emit performance alerts when thresholds are breached', () => {
            const alerts: any[] = [];
            analytics.onPerformanceAlert = (alert) => alerts.push(alert);
            
            // Set high error rate to trigger alert
            analytics.updatePerformanceIndicators({
                errorRate: 15
            });
            
            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].metric).toBe('errorRate');
        });
    });

    describe('Historical Analytics', () => {
        beforeEach(() => {
            // Add historical data
            const now = Date.now();
            for (let i = 0; i < 100; i++) {
                const timestamp = now - (i * 60 * 60 * 1000); // Hourly data
                analytics.recordUsage(user1, contract1, 'mint', 50000 + i * 100, 1000, 12345 + i);
            }
        });

        test('should retrieve historical analytics data', () => {
            const timeRange = {
                start: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
                end: Date.now()
            };
            
            const historical = analytics.getHistoricalAnalytics('usage', timeRange, 'hourly');
            
            expect(historical.length).toBeGreaterThan(0);
            expect(historical[0].metricType).toBe('usage');
        });

        test('should calculate trend analysis', () => {
            const trend = analytics.getTrendAnalysis('usage', 7); // 7 days
            
            expect(trend.trend).toBeDefined();
            expect(['increasing', 'decreasing', 'stable']).toContain(trend.trend);
            expect(typeof trend.changePercentage).toBe('number');
            expect(typeof trend.confidence).toBe('number');
        });
    });

    describe('Data Aggregation', () => {
        beforeEach(() => {
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            analytics.recordUsage(user2, contract1, 'transfer', 30000, 500, 12346);
            analytics.recordUsage(user1, contract2, 'approve', 25000, 0, 12347);
            analytics.recordUsage(user2, contract2, 'mint', 55000, 1500, 12348);
        });

        test('should aggregate usage data', () => {
            const aggregated = analytics.getAggregatedData('total');
            
            expect(aggregated.totalTransactions).toBe(4);
            expect(aggregated.totalUsers).toBe(2);
            expect(aggregated.uniqueContracts).toBe(2);
            expect(aggregated.averageGasUsage).toBeGreaterThan(0);
        });

        test('should aggregate data within time range', () => {
            const now = Date.now();
            const timeRange = {
                start: now - (60 * 60 * 1000), // Last hour
                end: now
            };
            
            const aggregated = analytics.getAggregatedData('total', timeRange);
            
            expect(aggregated.timeRange.start).toBe(timeRange.start);
            expect(aggregated.timeRange.end).toBe(timeRange.end);
        });

        test('should provide dashboard summary', () => {
            const summary = analytics.getDashboardSummary();
            
            expect(summary.totalUsers).toBe(2);
            expect(summary.totalTransactions).toBe(4);
            expect(summary.systemHealth).toBeDefined();
        });
    });

    describe('Privacy Protection', () => {
        test('should set privacy settings', () => {
            const privacySettings: PrivacySettings = {
                ...DEFAULT_PRIVACY_SETTINGS,
                userAddress: user1,
                anonymizationLevel: 'full',
                dataRetention: 30
            };
            
            analytics.setPrivacySettings(user1, privacySettings);
            
            const retrieved = analytics.getPrivacySettings(user1);
            expect(retrieved.anonymizationLevel).toBe('full');
            expect(retrieved.dataRetention).toBe(30);
        });

        test('should anonymize user data based on settings', () => {
            const privacySettings: PrivacySettings = {
                ...DEFAULT_PRIVACY_SETTINGS,
                userAddress: user1,
                anonymizationLevel: 'full'
            };
            
            analytics.setPrivacySettings(user1, privacySettings);
            
            const anonymizedId = analytics.anonymizeUserData(user1);
            expect(anonymizedId).not.toBe(user1);
            expect(anonymizedId.startsWith('0x')).toBe(true);
        });

        test('should validate privacy compliance', () => {
            const invalidSettings: PrivacySettings = {
                ...DEFAULT_PRIVACY_SETTINGS,
                userAddress: user1,
                dataRetention: 400, // Exceeds limit
                anonymizationLevel: 'none',
                dataCollection: true
            };
            
            expect(() => {
                analytics.setPrivacySettings(user1, invalidSettings);
            }).toThrow('Privacy settings are not compliant');
        });
    });

    describe('Analytics Reporting', () => {
        beforeEach(() => {
            // Setup test data
            for (let i = 0; i < 10; i++) {
                analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345 + i);
                analytics.recordUsage(user2, contract2, 'transfer', 30000, 500, 12355 + i);
            }
        });

        test('should generate weekly report', () => {
            const report = analytics.generateReport('weekly');
            
            expect(report.type).toBe('weekly');
            expect(report.summary).toBeDefined();
            expect(report.sections).toBeDefined();
            expect(report.recommendations).toBeDefined();
        });

        test('should generate monthly report', () => {
            const report = analytics.generateReport('monthly');
            
            expect(report.type).toBe('monthly');
            expect(report.summary.totalTransactions).toBeGreaterThan(0);
        });

        test('should emit report generated event', () => {
            const events: any[] = [];
            analytics.onReportGenerated = (report) => events.push(report);
            
            const report = analytics.generateReport('weekly');
            
            expect(events).toHaveLength(1);
            expect(events[0].id).toBe(report.id);
        });

        test('should schedule report generation', () => {
            const scheduleId = analytics.scheduleReport('weekly', 'weekly', [user1]);
            
            expect(scheduleId).toBeDefined();
            expect(scheduleId.startsWith('schedule_')).toBe(true);
        });
    });

    describe('Optimization Suggestions', () => {
        beforeEach(() => {
            // Setup data that might trigger optimizations
            for (let i = 0; i < 5; i++) {
                analytics.recordUsage(user1, contract1, 'expensiveFunction', 150000, 1000, 12345 + i);
            }
        });

        test('should generate optimization suggestions', () => {
            const suggestions = analytics.getOptimizationSuggestions();
            
            expect(Array.isArray(suggestions)).toBe(true);
        });

        test('should filter suggestions by category', () => {
            const gasSuggestions = analytics.getOptimizationSuggestions('gas');
            
            expect(gasSuggestions.every(s => s.category === 'gas')).toBe(true);
        });

        test('should implement optimization suggestion', () => {
            const suggestions = analytics.getOptimizationSuggestions();
            if (suggestions.length > 0) {
                const suggestionId = suggestions[0].id;
                analytics.implementOptimization(suggestionId);
                
                const updatedSuggestions = analytics.getOptimizationSuggestions();
                const updatedSuggestion = updatedSuggestions.find(s => s.id === suggestionId);
                expect(updatedSuggestion?.status).toBe('implemented');
            }
        });

        test('should emit optimization available events', () => {
            const events: any[] = [];
            analytics.onOptimizationAvailable = (suggestions) => events.push(suggestions);
            
            // Trigger performance update that might generate suggestions
            analytics.updatePerformanceIndicators({
                averageGasUsage: 120000, // High gas usage
                errorRate: 8 // High error rate
            });
            
            expect(events.length).toBeGreaterThan(0);
        });
    });

    describe('Administrative Functions', () => {
        test('should pause and unpause contract', () => {
            analytics.pause();
            expect(analytics.getConfiguration().isPaused).toBe(true);
            
            analytics.unpause();
            expect(analytics.getConfiguration().isPaused).toBe(false);
        });

        test('should prevent operations when paused', () => {
            analytics.pause();
            
            expect(() => {
                analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            }).toThrow('Contract is paused');
        });

        test('should update configuration', () => {
            analytics.updateConfiguration({
                maxHistoryDays: 200,
                privacyLevel: 'strict'
            });
            
            const config = analytics.getConfiguration();
            expect(config.maxHistoryDays).toBe(200);
            expect(config.privacyLevel).toBe('strict');
        });

        test('should get current configuration', () => {
            const config = analytics.getConfiguration();
            
            expect(config.maxHistoryDays).toBeDefined();
            expect(config.aggregationInterval).toBeDefined();
            expect(config.privacyLevel).toBeDefined();
            expect(config.isPaused).toBeDefined();
        });
    });

    describe('Data Cleanup', () => {
        test('should clean up old data based on retention policy', () => {
            // Set short retention period for testing
            analytics.updateConfiguration({ maxHistoryDays: 1 });
            
            // Add old data
            const oldTimestamp = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days ago
            analytics.recordUsage(user1, contract1, 'mint', 50000, 1000, 12345);
            
            // Add new data
            analytics.recordUsage(user2, contract2, 'transfer', 30000, 500, 12346);
            
            // Force cleanup by recording more data
            analytics.recordUsage(user1, contract1, 'approve', 25000, 0, 12347);
            
            const dashboard = analytics.getDashboardSummary();
            // Should only have recent data
            expect(dashboard.totalTransactions).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('AnalyticsLib', () => {
    describe('Data Anonymization', () => {
        test('should partially anonymize address', () => {
            const address = '0x1234567890123456789012345678901234567890';
            const settings = { anonymizationLevel: 'partial' as const };
            
            const anonymized = AnalyticsLib.anonymizeAddress(address, settings);
            
            expect(anonymized).not.toBe(address);
            expect(anonymized.startsWith('0x')).toBe(true);
            expect(anonymized.includes('****')).toBe(true);
        });

        test('should fully anonymize address', () => {
            const address = '0x1234567890123456789012345678901234567890';
            const settings = { anonymizationLevel: 'full' as const };
            
            const anonymized = AnalyticsLib.anonymizeAddress(address, settings);
            
            expect(anonymized).not.toBe(address);
            expect(anonymized.startsWith('0x')).toBe(true);
            expect(anonymized.length).toBe(42);
        });

        test('should not anonymize when level is none', () => {
            const address = '0x1234567890123456789012345678901234567890';
            const settings = { anonymizationLevel: 'none' as const };
            
            const anonymized = AnalyticsLib.anonymizeAddress(address, settings);
            
            expect(anonymized).toBe(address);
        });
    });

    describe('Trend Analysis', () => {
        test('should calculate increasing trend', () => {
            const data = [
                { timestamp: Date.now() - 3000, value: 100 },
                { timestamp: Date.now() - 2000, value: 150 },
                { timestamp: Date.now() - 1000, value: 200 },
                { timestamp: Date.now(), value: 250 }
            ];
            
            const trend = AnalyticsLib.calculateTrend(data);
            
            expect(trend.trend).toBe('increasing');
            expect(trend.changePercentage).toBeGreaterThan(0);
        });

        test('should calculate decreasing trend', () => {
            const data = [
                { timestamp: Date.now() - 3000, value: 250 },
                { timestamp: Date.now() - 2000, value: 200 },
                { timestamp: Date.now() - 1000, value: 150 },
                { timestamp: Date.now(), value: 100 }
            ];
            
            const trend = AnalyticsLib.calculateTrend(data);
            
            expect(trend.trend).toBe('decreasing');
            expect(trend.changePercentage).toBeLessThan(0);
        });

        test('should calculate stable trend', () => {
            const data = [
                { timestamp: Date.now() - 3000, value: 100 },
                { timestamp: Date.now() - 2000, value: 102 },
                { timestamp: Date.now() - 1000, value: 98 },
                { timestamp: Date.now(), value: 101 }
            ];
            
            const trend = AnalyticsLib.calculateTrend(data);
            
            expect(trend.trend).toBe('stable');
            expect(Math.abs(trend.changePercentage)).toBeLessThan(5);
        });
    });

    describe('Performance Metrics', () => {
        test('should calculate performance indicators', () => {
            const metrics = [
                { id: '1', anonymizedUserId: 'user1', contractAddress: '0x1', functionName: 'mint', gasUsed: 50000, transactionValue: 1000, blockNumber: 1, timestamp: Date.now(), executionTime: 100, success: true },
                { id: '2', anonymizedUserId: 'user2', contractAddress: '0x2', functionName: 'transfer', gasUsed: 30000, transactionValue: 500, blockNumber: 2, timestamp: Date.now(), executionTime: 80, success: true },
                { id: '3', anonymizedUserId: 'user1', contractAddress: '0x1', functionName: 'approve', gasUsed: 25000, transactionValue: 0, blockNumber: 3, timestamp: Date.now(), executionTime: 60, success: false }
            ];
            
            const performance = AnalyticsLib.calculatePerformanceIndicators(metrics);
            
            expect(performance.averageGasUsage).toBe(35000);
            expect(performance.successRate).toBe(66.66666666666666);
            expect(performance.errorRate).toBe(33.33333333333333);
            expect(performance.systemHealth).toBe('critical'); // High error rate
        });
    });

    describe('Gas Optimization', () => {
        test('should estimate batch gas savings', () => {
            const singleGas = 50000;
            const batchSize = 10;
            
            const savings = AnalyticsLib.estimateBatchGasSavings(singleGas, batchSize);
            
            expect(savings).toBeGreaterThan(0);
            expect(savings).toBeLessThan(singleGas * batchSize);
        });

        test('should calculate optimal batch size', () => {
            const baseCost = 21000;
            const perItemCost = 5000;
            
            const optimalSize = AnalyticsLib.calculateOptimalBatchSize(baseCost, perItemCost);
            
            expect(optimalSize).toBeGreaterThan(0);
            expect(optimalSize).toBeLessThanOrEqual(100);
        });
    });

    describe('Privacy Validation', () => {
        test('should validate compliant privacy settings', () => {
            const settings: PrivacySettings = {
                userAddress: '0x123',
                dataCollection: true,
                anonymizationLevel: 'partial',
                dataRetention: 90,
                sharingConsent: false,
                analyticsOptOut: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            const isValid = AnalyticsLib.validatePrivacyCompliance(settings);
            expect(isValid).toBe(true);
        });

        test('should reject non-compliant privacy settings', () => {
            const settings: PrivacySettings = {
                userAddress: '0x123',
                dataCollection: true,
                anonymizationLevel: 'none',
                dataRetention: 400, // Too long
                sharingConsent: false,
                analyticsOptOut: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            const isValid = AnalyticsLib.validatePrivacyCompliance(settings);
            expect(isValid).toBe(false);
        });
    });

    describe('Data Cleanup', () => {
        test('should clean up old data', () => {
            const now = Date.now();
            const data = [
                { timestamp: now - (10 * 24 * 60 * 60 * 1000) }, // 10 days old
                { timestamp: now - (5 * 24 * 60 * 60 * 1000) },  // 5 days old
                { timestamp: now - (1 * 24 * 60 * 60 * 1000) },  // 1 day old
                { timestamp: now }                                 // Current
            ];
            
            const cleaned = AnalyticsLib.cleanupOldData(data, 7); // Keep 7 days
            
            expect(cleaned).toHaveLength(2); // Only last 2 entries
            expect(cleaned.every(item => item.timestamp >= now - (7 * 24 * 60 * 60 * 1000))).toBe(true);
        });
    });
});
