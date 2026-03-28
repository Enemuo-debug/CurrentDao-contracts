# Energy Quality Rating System

## Overview

The Energy Quality Rating System is a comprehensive smart contract solution that evaluates and scores energy sources based on multiple quality metrics. It provides transparent, oracle-verified quality assessments that enable premium pricing for high-quality energy and ensure fair market dynamics.

## Features

### 🎯 Core Functionality
- **Multi-Metric Scoring**: Evaluates energy based on renewable percentage, carbon footprint, reliability, efficiency, and availability
- **Oracle Verification**: Requires certified oracles to submit and validate quality data
- **Real-Time Updates**: Rating updates under 50ms with gas optimization
- **Historical Tracking**: Maintains comprehensive rating history for trend analysis
- **Premium Pricing**: Automatic pricing multipliers based on quality scores

### 🛡️ Security & Reliability
- **Dispute Resolution**: Comprehensive system for challenging and resolving rating disputes
- **Anomaly Detection**: Statistical analysis to identify unusual rating patterns
- **Reputation System**: Oracle reputation tracking and management
- **Access Control**: Role-based permissions for different operations

### ⚡ Performance
- **Gas Optimization**: Optimized algorithms for cost-effective operations
- **Batch Processing**: Support for bulk rating calculations
- **Caching**: Intelligent caching for frequently accessed data
- **Scalability**: Designed to handle high-volume rating submissions

## Architecture

### Contract Structure

```
contracts/rating/
├── QualityRating.ts          # Main contract implementation
├── interfaces/
│   └── IQualityRating.ts     # Contract interface and types
├── libraries/
│   └── ScoringLib.ts         # Scoring algorithms and utilities
└── structures/
    └── RatingStructure.ts    # Data structures and implementations
```

### Key Components

1. **QualityRating Contract**: Main contract handling all rating operations
2. **ScoringLib**: Library containing scoring algorithms and validation logic
3. **Oracle Registry**: Manages oracle registration and reputation
4. **Rating History**: Stores historical rating data for analysis
5. **Dispute System**: Handles rating disputes and resolutions

## Quality Metrics

### 1. Renewable Percentage (30% weight)
- **Range**: 0-100%
- **Scoring**: Linear mapping (0% = 0 points, 100% = 10000 points)
- **Impact**: Higher renewable percentage increases overall score

### 2. Carbon Footprint (25% weight)
- **Range**: 0-∞ gCO2/kWh
- **Scoring**: Inverse logarithmic scaling
- **Reference**: 500 gCO2/kWh = 50% score
- **Impact**: Lower carbon footprint increases score

### 3. Reliability (20% weight)
- **Range**: 0-100%
- **Scoring**: Direct linear mapping
- **Definition**: Consistency of energy delivery
- **Impact**: Higher reliability increases score

### 4. Efficiency (15% weight)
- **Range**: 0-100%
- **Scoring**: Direct linear mapping
- **Definition**: Energy conversion efficiency
- **Impact**: Higher efficiency increases score

### 5. Availability (10% weight)
- **Range**: 0-100%
- **Scoring**: Direct linear mapping
- **Definition**: Percentage of time energy is available
- **Impact**: Higher availability increases score

## Scoring Algorithm

### Overall Score Calculation

The overall quality score is calculated using a weighted average:

```
Overall Score = (RenewableScore × 0.30) + 
               (CarbonScore × 0.25) + 
               (ReliabilityScore × 0.20) + 
               (EfficiencyScore × 0.15) + 
               (AvailabilityScore × 0.10)
```

### Confidence Score

Confidence is calculated based on:
- **Oracle Reputation**: -10% to +10% impact
- **Data Freshness**: Newer data increases confidence
- **Certification Level**: Higher certification = higher confidence

### Pricing Multiplier

Based on overall quality score:
- **80-100%**: 1.0x to 2.0x premium pricing
- **Below 80%**: 0.5x to 1.0x discounted pricing

## Oracle System

### Oracle Registration

Oracles must provide:
- Name and description
- Website and contact information
- Service fee structure
- Specialization areas
- Certification credentials

### Reputation Management

- **Initial Reputation**: Set during registration
- **Reputation Updates**: Based on submission accuracy
- **Minimum Reputation**: Required to remain active
- **Reputation Impact**: Affects aggregation weight

### Submission Limits

- **Daily Limit**: Configurable (default: 100 submissions/day)
- **Timestamp Freshness**: Data must be within 24 hours
- **Signature Verification**: Cryptographic validation required

## Dispute Resolution

### Filing a Dispute

Requirements:
- Dispute fee (configurable, default: 0.001 ETH)
- Minimum evidence (configurable, default: 1 piece)
- Specific reason for dispute
- Supporting evidence documentation

### Dispute Process

1. **Submission**: User files dispute with evidence
2. **Review**: System or authorized reviewers examine the case
3. **Resolution**: One of the following actions:
   - No change to rating
   - Adjust rating
   - Remove rating
   - Penalize oracle

### Resolution Timeline

- **Maximum Duration**: 7 days (configurable)
- **Auto-Resolution**: Available for clear cases
- **Appeals**: Limited appeal process available

## API Reference

### Core Functions

#### `submitQualityRating`
```typescript
submitQualityRating(
    energySourceId: Address,
    metrics: QualityMetrics,
    timestamp: u64,
    oracleSignature: Uint8Array
): void
```
Submits a new quality rating for an energy source.

#### `getCurrentQualityRating`
```typescript
getCurrentQualityRating(energySourceId: Address): QualityRating
```
Retrieves the current quality rating for an energy source.

#### `getHistoricalRating`
```typescript
getHistoricalRating(energySourceId: Address, timestamp: u64): QualityRating
```
Retrieves a historical rating at a specific timestamp.

#### `fileRatingDispute`
```typescript
fileRatingDispute(
    energySourceId: Address,
    disputedRating: QualityRating,
    reason: string,
    evidence: Vec<string>
): void
```
Files a dispute against a specific rating.

### Oracle Management

#### `registerQualityOracle`
```typescript
registerQualityOracle(oracleAddress: Address, metadata: OracleMetadata): void
```
Registers a new quality oracle (owner only).

#### `updateOracleReputation`
```typescript
updateOracleReputation(oracleId: Address, reputationDelta: i64): void
```
Updates oracle reputation based on performance.

#### `deactivateQualityOracle`
```typescript
deactivateQualityOracle(oracleId: Address): void
```
Deactivates an oracle (owner only).

### Query Functions

#### `getQualityMetrics`
```typescript
getQualityMetrics(energySourceId: Address): QualityMetrics
```
Retrieves the latest quality metrics for an energy source.

#### `getRatingHistory`
```typescript
getRatingHistory(
    energySourceId: Address,
    fromTimestamp: u64,
    toTimestamp: u64
): Vec<RatingDataPoint>
```
Retrieves rating history for a time range.

#### `getActiveQualityOracles`
```typescript
getActiveQualityOracles(): Vec<Address>
```
Retrieves list of active quality oracles.

## Configuration

### Rating Weights
```typescript
interface RatingWeights {
    renewableWeight: u64;      // Default: 3000 (30%)
    carbonWeight: u64;         // Default: 2500 (25%)
    reliabilityWeight: u64;   // Default: 2000 (20%)
    efficiencyWeight: u64;    // Default: 1500 (15%)
    availabilityWeight: u64;  // Default: 1000 (10%)
}
```

### Rating Thresholds
```typescript
interface RatingThresholds {
    minimumRenewable: u64;           // Default: 1000 (10%)
    maximumCarbonFootprint: u64;     // Default: 500 gCO2/kWh
    minimumReliability: u64;         // Default: 70%
    minimumEfficiency: u64;         // Default: 8000 (80%)
    minimumAvailability: u64;        // Default: 9000 (90%)
    anomalyDetectionThreshold: u64;  // Default: 2000 (20%)
}
```

### Dispute Configuration
```typescript
interface DisputeConfig {
    disputeFee: u128;           // Default: 0.001 ETH
    maxDisputeDuration: u64;    // Default: 604800 (7 days)
    minEvidenceRequired: u64;  // Default: 1
    autoResolveThreshold: u64;  // Default: 8000 (80%)
}
```

## Deployment

### Prerequisites
- Node.js 16+
- TypeScript 4.9+
- Access to target network (development/testnet/mainnet)

### Deployment Steps

1. **Configure Deployment**
```typescript
import { deployRatingSystem } from './scripts/deploy_rating';

const contract = await deployRatingSystem('development');
```

2. **Custom Configuration**
```typescript
const customConfig = {
    network: 'mainnet',
    owner: '0x...',
    initialOracles: [...],
    enableAdvancedFeatures: true,
    gasOptimization: true
};

const deployer = new QualityRatingDeployer(customConfig);
const contract = await deployer.deploy();
```

3. **Verification**
```typescript
const deploymentInfo = deployer.getDeploymentInfo();
console.log('Deployment Hash:', deploymentInfo.hash);
```

### Gas Optimization

The system includes several gas optimization features:
- **Batch Processing**: Multiple ratings in single transaction
- **Efficient Storage**: Optimized data structures
- **Lazy Loading**: Load data only when needed
- **Caching**: Cache frequently accessed data

## Testing

### Running Tests
```bash
npm test -- tests/rating/QualityRating.test.ts
```

### Test Coverage
The test suite covers:
- Contract initialization and configuration
- Oracle registration and management
- Quality rating submission and validation
- Dispute resolution process
- Anomaly detection
- Gas optimization
- Edge cases and error handling

### Performance Testing
- Rating submission latency: < 50ms
- Gas usage optimization: < 2M gas per operation
- Throughput: 100+ ratings per second

## Security Considerations

### Oracle Security
- **Signature Verification**: Cryptographic validation of oracle submissions
- **Reputation System**: Automatic deactivation of low-reputation oracles
- **Rate Limiting**: Daily submission limits prevent spam
- **Access Control**: Owner-only functions for critical operations

### Data Integrity
- **Input Validation**: Comprehensive validation of all inputs
- **Threshold Enforcement**: Minimum quality requirements
- **Anomaly Detection**: Statistical analysis for unusual patterns
- **Historical Tracking**: Immutable audit trail

### Dispute Security
- **Evidence Requirements**: Minimum evidence for dispute filing
- **Fee Structure**: Economic deterrent against frivolous disputes
- **Time Limits**: Resolution deadlines prevent indefinite disputes
- **Appeal Process**: Limited appeals to prevent abuse

## Integration

### With Pricing System

The quality rating system integrates seamlessly with pricing systems:

```typescript
const rating = qualityRating.getCurrentQualityRating(energySourceId);
const priceMultiplier = rating.pricingMultiplier;
const finalPrice = basePrice * priceMultiplier / 10000n;
```

### With Energy Certificate System

```typescript
// Link quality rating to energy certificates
const certificate = energyCertificate.getCertificate(certificateId);
const quality = qualityRating.getCurrentQualityRating(certificate.energySourceId);

certificate.qualityRating = quality.overallScore;
certificate.pricingMultiplier = quality.pricingMultiplier;
```

## Monitoring and Analytics

### Key Metrics
- **Rating Submission Volume**: Track number of ratings submitted
- **Oracle Performance**: Monitor oracle accuracy and reputation
- **Dispute Resolution Time**: Track dispute processing efficiency
- **Quality Trends**: Analyze quality improvements over time

### Events
- `QualityRatingSubmitted`: New rating submitted
- `RatingUpdated`: Rating updated for energy source
- `OracleRegistered`: New oracle registered
- `DisputeFiled`: New dispute filed
- `DisputeResolved`: Dispute resolution completed

## Future Enhancements

### Planned Features
- **Machine Learning**: Advanced anomaly detection using ML models
- **Cross-Chain Support**: Multi-chain rating aggregation
- **Dynamic Weights**: Adaptive scoring weights based on market conditions
- **Advanced Analytics**: Comprehensive dashboard and reporting tools

### Research Areas
- **Alternative Scoring Models**: Explore different scoring algorithms
- **Decentralized Oracle Networks**: Integration with external oracle networks
- **Token Incentives**: Token-based rewards for high-quality submissions
- **Governance Integration**: DAO-based parameter management

## Support and Contributing

### Getting Help
- **Documentation**: Complete API documentation and examples
- **Community**: Active community support and discussions
- **Issues**: Bug reports and feature requests via GitHub

### Contributing
- **Code Style**: Follow established TypeScript conventions
- **Testing**: Maintain >90% test coverage
- **Documentation**: Update documentation for all changes
- **Security**: Follow security best practices

## License

This project is licensed under the ISC License. See LICENSE file for details.

---

**Last Updated**: March 28, 2026
**Version**: 1.0.0
**Contract Address**: (Deployed to network-specific addresses)
