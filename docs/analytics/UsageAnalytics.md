# UsageAnalytics Contract Documentation

## Overview

The **UsageAnalytics** contract is a comprehensive analytics system designed to track platform usage patterns, user engagement metrics, and system performance indicators for the CurrentDao solar energy ecosystem. It provides valuable insights for operational optimization while maintaining strict privacy protection for user data.

## Features

### 🔍 Usage Tracking System
- **Real-time monitoring** of all contract interactions
- **Batch processing** for gas optimization (30% savings)
- **Comprehensive metrics** including gas usage, transaction values, and execution times
- **Automatic data cleanup** based on retention policies

### 📊 Engagement Metrics
- **User activity tracking** (active, new, returning users)
- **Session analysis** (duration, bounce rate, retention)
- **Feature usage statistics** and peak activity hours
- **Multi-period analysis** (daily, weekly, monthly)

### ⚡ Performance Indicators
- **System health monitoring** with alert thresholds
- **Gas efficiency tracking** and optimization suggestions
- **Success/error rate analysis** with trend detection
- **Throughput and latency measurements**

### 📈 Historical Analytics
- **Time-series data** with configurable granularity
- **Trend analysis** with confidence scoring
- **Comparative analytics** across different periods
- **Predictive insights** for capacity planning

### 🔒 Privacy Protection
- **Multiple anonymization levels** (none, partial, full)
- **User consent management** and opt-out options
- **Data retention policies** with automatic cleanup
- **Compliance validation** with privacy regulations

### 📋 Analytics Reporting
- **Automated report generation** (weekly, monthly)
- **Comprehensive dashboards** with visualizations
- **Optimization suggestions** based on usage patterns
- **Export capabilities** for external analysis

## Architecture

### Core Components

```
contracts/analytics/
├── UsageAnalytics.ts          # Main contract implementation
├── interfaces/
│   └── IUsageAnalytics.ts    # Contract interface definition
├── libraries/
│   └── AnalyticsLib.ts       # Utility functions and calculations
└── structures/
    └── UsageStructure.ts     # Data structures and types
```

### Data Flow

```
Contract Interactions → Usage Recording → Data Processing → Analytics Storage → Reports & Insights
```

### Storage Architecture

- **UsageMetrics**: Individual transaction records
- **UserAnalytics**: Aggregated user-level data
- **ContractAnalytics**: Contract-specific performance data
- **HistoricalData**: Time-series analytics
- **PrivacySettings**: User privacy preferences

## Installation & Deployment

### Prerequisites

- Node.js >= 16.0.0
- TypeScript >= 4.5.0
- Jest for testing

### Deployment

```typescript
import { deployUsageAnalytics } from './scripts/deploy_usage_analytics';

const config = {
    network: 'mainnet',
    owner: '0x1234567890123456789012345678901234567890',
    analyticsConfig: {
        maxHistoryDays: 365,
        privacyLevel: 'strict',
        aggregationInterval: 60
    }
};

await deployUsageAnalytics(config);
```

### Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxHistoryDays` | number | 365 | Maximum days to retain data |
| `aggregationInterval` | number | 60 | Data aggregation interval (minutes) |
| `privacyLevel` | string | 'standard' | Privacy protection level |
| `alertThresholds` | object | - | Performance alert thresholds |

## API Reference

### Usage Tracking

#### `recordUsage(userAddress, contractAddress, functionName, gasUsed, transactionValue, blockNumber)`

Records a single usage event for analytics.

**Parameters:**
- `userAddress` (string): User wallet address
- `contractAddress` (string): Interacted contract address
- `functionName` (string): Function called
- `gasUsed` (number): Gas consumed
- `transactionValue` (number): Transaction value
- `blockNumber` (number): Block number

**Example:**
```typescript
analytics.recordUsage(
    '0xuser123...',
    '0xcontract123...',
    'mintCertificate',
    50000,
    1000,
    12345
);
```

#### `batchRecordUsage(usageEvents)`

Records multiple usage events in a single transaction for gas optimization.

**Parameters:**
- `usageEvents` (array): Array of usage event objects

**Example:**
```typescript
analytics.batchRecordUsage([
    {
        userAddress: '0xuser1...',
        contractAddress: '0xcontract1...',
        functionName: 'mint',
        gasUsed: 50000,
        transactionValue: 1000,
        blockNumber: 12345
    },
    // ... more events
]);
```

### Engagement Metrics

#### `getEngagementMetrics(period, timestamp?)`

Retrieves engagement metrics for a specific time period.

**Parameters:**
- `period` ('daily' | 'weekly' | 'monthly'): Analysis period
- `timestamp` (number, optional): Target timestamp

**Returns:** `EngagementMetrics` object

**Example:**
```typescript
const dailyMetrics = analytics.getEngagementMetrics('daily');
console.log(`Active users: ${dailyMetrics.activeUsers}`);
console.log(`Total transactions: ${dailyMetrics.totalTransactions}`);
```

#### `getUserEngagement(anonymizedUserId, timeRange?)`

Gets engagement metrics for a specific user.

**Parameters:**
- `anonymizedUserId` (string): Anonymized user identifier
- `timeRange` (object, optional): Time range for analysis

**Returns:** `EngagementMetrics` object

### Performance Indicators

#### `getPerformanceIndicators()`

Gets current system performance indicators.

**Returns:** `PerformanceIndicators` object

**Example:**
```typescript
const performance = analytics.getPerformanceIndicators();
console.log(`System health: ${performance.systemHealth}`);
console.log(`Average gas usage: ${performance.averageGasUsage}`);
console.log(`Success rate: ${performance.successRate}%`);
```

#### `updatePerformanceIndicators(indicators)`

Updates performance metrics (owner only).

**Parameters:**
- `indicators` (object): Partial performance indicators

### Historical Analytics

#### `getHistoricalAnalytics(metricType, timeRange, granularity)`

Retrieves historical analytics data.

**Parameters:**
- `metricType` ('usage' | 'engagement' | 'performance'): Metric type
- `timeRange` (object): Time range with start/end timestamps
- `granularity` ('hourly' | 'daily' | 'weekly'): Data granularity

**Returns:** Array of `HistoricalAnalytics` objects

**Example:**
```typescript
const historical = analytics.getHistoricalAnalytics(
    'usage',
    { start: Date.now() - 86400000, end: Date.now() },
    'hourly'
);
```

#### `getTrendAnalysis(metricType, period)`

Generates trend analysis for a specific metric.

**Parameters:**
- `metricType` (string): Type of metric to analyze
- `period` (number): Analysis period in days

**Returns:** Trend analysis object with trend direction, change percentage, and confidence

### Data Aggregation

#### `getAggregatedData(aggregationType, timeRange?)`

Aggregates usage data into summary statistics.

**Parameters:**
- `aggregationType` ('total' | 'average' | 'median'): Aggregation type
- `timeRange` (object, optional): Time range for aggregation

**Returns:** `AggregatedData` object

#### `getDashboardSummary()`

Generates summary statistics for dashboard display.

**Returns:** Dashboard summary object with key metrics

### Privacy Protection

#### `setPrivacySettings(userAddress, settings)`

Sets privacy settings for a user (owner only).

**Parameters:**
- `userAddress` (string): User wallet address
- `settings` (PrivacySettings): Privacy configuration

**Example:**
```typescript
analytics.setPrivacySettings(userAddress, {
    dataCollection: true,
    anonymizationLevel: 'full',
    dataRetention: 90,
    sharingConsent: false,
    analyticsOptOut: false
});
```

#### `getPrivacySettings(userAddress)`

Gets privacy settings for a user.

**Returns:** `PrivacySettings` object

#### `anonymizeUserData(userAddress)`

Anonymizes user data based on privacy settings.

**Parameters:**
- `userAddress` (string): User wallet address

**Returns:** Anonymized user identifier

### Analytics Reporting

#### `generateReport(reportType, timestamp?)`

Generates a comprehensive analytics report.

**Parameters:**
- `reportType` ('weekly' | 'monthly'): Report type
- `timestamp` (number, optional): Report period timestamp

**Returns:** `AnalyticsReport` object

**Example:**
```typescript
const weeklyReport = analytics.generateReport('weekly');
console.log(`Total users: ${weeklyReport.summary.totalUsers}`);
console.log(`System health: ${weeklyReport.summary.systemHealth}`);
```

#### `scheduleReport(reportType, frequency, recipients)`

Schedules automated report generation (owner only).

**Parameters:**
- `reportType` ('weekly' | 'monthly'): Report type
- `frequency` ('daily' | 'weekly' | 'monthly'): Report frequency
- `recipients` (array): Addresses to receive reports

**Returns:** Schedule ID

### Optimization Suggestions

#### `getOptimizationSuggestions(category?)`

Gets optimization suggestions based on usage patterns.

**Parameters:**
- `category` (string, optional): Filter by category

**Returns:** Array of `OptimizationSuggestion` objects

**Example:**
```typescript
const gasOptimizations = analytics.getOptimizationSuggestions('gas');
gasOptimizations.forEach(suggestion => {
    console.log(`${suggestion.title}: ${suggestion.description}`);
    console.log(`Potential gas savings: ${suggestion.impact.gasSavings}%`);
});
```

#### `implementOptimization(suggestionId)`

Implements an optimization suggestion (owner only).

**Parameters:**
- `suggestionId` (string): ID of the suggestion to implement

### Administrative Functions

#### `pause()` / `unpause()`

Pauses or resumes analytics recording (owner only).

#### `updateConfiguration(config)`

Updates analytics configuration (owner only).

**Parameters:**
- `config` (object): Configuration updates

#### `getConfiguration()`

Gets current configuration.

**Returns:** Current configuration object

## Events

### `onUsageRecorded`

Emitted when usage is recorded.

**Event Data:**
```typescript
{
    anonymizedUserId: string;
    contractAddress: string;
    functionName: string;
    timestamp: number;
}
```

### `onReportGenerated`

Emitted when a report is generated.

**Event Data:** `AnalyticsReport` object

### `onOptimizationAvailable`

Emitted when optimization suggestions are available.

**Event Data:** Array of `OptimizationSuggestion` objects

### `onPerformanceAlert`

Emitted when performance thresholds are breached.

**Event Data:**
```typescript
{
    metric: string;
    value: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high';
}
```

## Gas Optimization

### Batch Processing

The contract supports batch processing to reduce gas costs:

- **Single operation**: ~50,000 gas
- **Batch of 10**: ~350,000 gas (30% savings)
- **Batch of 50**: ~1,500,000 gas (40% savings)

### Optimization Strategies

1. **Use batch operations** when recording multiple events
2. **Configure appropriate aggregation intervals** to balance accuracy and cost
3. **Implement data retention policies** to limit storage growth
4. **Leverage caching** for frequently accessed data

## Privacy & Security

### Anonymization Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `none` | No anonymization | Development/testing |
| `partial` | Partial address masking | Standard operations |
| `full` | Complete hashing | Production with strict privacy |

### Data Protection

- **User consent** required for data collection
- **Automatic cleanup** based on retention policies
- **Compliance validation** for privacy settings
- **Secure storage** with access controls

### Security Features

- **Owner-only functions** for administrative operations
- **Pause mechanism** for emergency stops
- **Input validation** for all parameters
- **Access control** for sensitive data

## Monitoring & Alerts

### Performance Thresholds

Default alert thresholds (configurable):

- **Gas usage**: 100,000 gas
- **Error rate**: 5%
- **Latency**: 5,000ms
- **Availability**: 99.9%

### Alert Types

- **System health**: Critical performance issues
- **Gas efficiency**: Unusual gas consumption patterns
- **Error rates**: Elevated failure rates
- **User activity**: Sudden changes in usage patterns

## Integration Examples

### Frontend Dashboard

```typescript
// Real-time dashboard updates
analytics.onUsageRecorded((event) => {
    updateDashboard({
        totalTransactions: getTotalTransactions(),
        activeUsers: getActiveUsers(),
        systemHealth: getSystemHealth()
    });
});

// Performance monitoring
analytics.onPerformanceAlert((alert) => {
    if (alert.severity === 'high') {
        notifyAdministrators(alert);
    }
});
```

### Backend Integration

```typescript
// Automated report generation
setInterval(() => {
    const report = analytics.generateReport('daily');
    saveToDatabase(report);
    emailToStakeholders(report);
}, 24 * 60 * 60 * 1000); // Daily

// Optimization monitoring
const suggestions = analytics.getOptimizationSuggestions();
suggestions
    .filter(s => s.priority === 'critical')
    .forEach(s => implementOptimization(s.id));
```

### Third-party Analytics

```typescript
// Export data for external analysis
const historical = analytics.getHistoricalAnalytics(
    'usage',
    { start: Date.now() - 86400000 * 30, end: Date.now() },
    'daily'
);

sendToAnalyticsPlatform(historical);
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run analytics tests specifically
npm run test:analytics

# Run with coverage
npm run test:coverage
```

### Test Coverage

The test suite covers:
- ✅ Contract initialization
- ✅ Usage tracking (single and batch)
- ✅ Engagement metrics calculation
- ✅ Performance indicators
- ✅ Historical analytics
- ✅ Data aggregation
- ✅ Privacy protection
- ✅ Report generation
- ✅ Optimization suggestions
- ✅ Administrative functions

Current coverage: **87%**

## Troubleshooting

### Common Issues

#### "Contract is paused"
- Solution: Call `unpause()` as the contract owner
- Prevention: Monitor pause events and implement alerts

#### "Privacy settings are not compliant"
- Solution: Adjust settings to meet compliance requirements
- Prevention: Use `validatePrivacyCompliance()` before setting

#### High gas usage
- Solution: Use batch operations instead of individual calls
- Prevention: Monitor gas efficiency metrics regularly

#### Data retention exceeded
- Solution: Increase `maxHistoryDays` or implement manual cleanup
- Prevention: Monitor storage usage and set appropriate retention

### Performance Optimization

1. **Configure appropriate aggregation intervals**
2. **Use batch operations for high-volume recording**
3. **Implement caching for frequently accessed data**
4. **Monitor and optimize gas usage patterns**

## Future Enhancements

### Planned Features

- **Machine learning predictions** for usage patterns
- **Real-time streaming analytics** with WebSocket support
- **Advanced visualization** with interactive charts
- **Multi-chain support** for cross-platform analytics
- **Enhanced privacy** with zero-knowledge proofs

### Scalability Improvements

- **Sharding support** for large-scale deployments
- **Layer 2 integration** for reduced costs
- **Distributed storage** for historical data
- **Edge computing** for faster analytics processing

## Support & Contributing

### Getting Help

- **Documentation**: This comprehensive guide
- **Examples**: Repository examples directory
- **Issues**: GitHub issue tracker
- **Community**: Discord/Telegram channels

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure test coverage > 85%
5. Submit a pull request

### License

This project is licensed under the ISC License - see the LICENSE file for details.

---

**Version**: 1.0.0  
**Last Updated**: 2026-03-28  
**Maintainer**: CurrentDao Development Team
