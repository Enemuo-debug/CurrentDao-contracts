# Price Oracle Contract Documentation

## Overview

The Price Oracle system is a sophisticated decentralized price feed mechanism designed to provide reliable and accurate energy price data for the CurrentDao ecosystem. It implements multiple aggregation algorithms, deviation detection, and a reputation system to ensure data integrity and prevent manipulation.

## Architecture

### Core Components

1. **PriceOracle Contract** - Main contract that orchestrates the oracle system
2. **IPriceOracle Interface** - Defines the standard interface for oracle operations
3. **OracleStructure Types** - Data structures for oracles, price feeds, and configurations
4. **AggregationLib** - Library containing price aggregation algorithms
5. **Price History** - Historical price tracking and analysis

### Key Features

- **Multiple Oracle Support**: Supports multiple price feeds simultaneously
- **Weighted Aggregation**: Calculates weighted average based on oracle reputation
- **Deviation Detection**: Flags suspicious price submissions
- **Reputation System**: Rewards reliable oracles and penalizes bad actors
- **Historical Tracking**: Stores price history for trend analysis
- **Automated Updates**: Aggregates prices every 5 minutes
- **Gas Optimization**: Efficient operations for blockchain deployment

## Security Architecture

### Multi-Layer Security Model

The Price Oracle implements a comprehensive security architecture with multiple layers of protection:

#### 1. Oracle Reputation System
- **Dynamic Reputation Scoring**: Oracles earn reputation based on accuracy and reliability
- **Weight-Based Influence**: Higher reputation oracles have greater influence on aggregated prices
- **Automatic Slashing**: Oracles with consistently poor performance are automatically deactivated
- **Minimum Thresholds**: Oracles below reputation threshold (50) cannot participate

#### 2. Price Deviation Detection
- **Statistical Analysis**: Uses standard deviation and IQR methods to detect outliers
- **Time-Window Validation**: Compares new prices against historical data windows
- **Cross-Validation**: Validates price feeds against multiple oracle sources
- **Automatic Flagging**: Suspicious prices are automatically flagged and rejected

#### 3. Aggregation Security
- **Weighted Average**: Prevents single oracle manipulation through weighted calculations
- **Confidence Scoring**: Provides confidence metrics for price reliability
- **Minimum Participation**: Requires minimum number of oracles for valid aggregation
- **Circuit Breaker**: Halts aggregation during extreme market volatility

#### 4. Access Control
- **Owner-Only Functions**: Critical operations restricted to contract owner
- **Role-Based Permissions**: Different permission levels for different operations
- **Emergency Pause**: Contract can be paused during emergencies
- **Configurable Limits**: Maximum oracles per asset, submission rates, etc.

## Gas Optimization Strategies

### 1. Algorithmic Optimization
- **Early Termination**: Aggregation loops terminate after sufficient oracles participate
- **Minimal Storage**: Efficient data structures with bounded storage
- **Batched Operations**: Multiple operations combined into single transactions
- **Pre-computed Values**: Common calculations cached to avoid redundant computation

### 2. Storage Optimization
- **Circular Buffers**: Price history uses fixed-size arrays with automatic cleanup
- **Lazy Loading**: Heavy data structures loaded only when needed
- **Compressed Storage**: Price data stored in compressed format where possible
- **Efficient Indexing**: Optimized data access patterns

### 3. Network Optimization
- **Gas Limit Management**: Dynamic gas limit adjustment based on operation complexity
- **Gas Price Optimization**: Intelligent gas price estimation
- **Batch Processing**: Multiple operations processed in single transactions
- **Event Emission**: Minimal event emission to reduce gas costs

## Security Audit Details

### Audit Checklist

#### ✅ Completed Security Measures

1. **Oracle Decentralization**
   - Minimum 3 oracles required for valid aggregation
   - Maximum 10 oracles per asset to prevent gas limit issues
   - Geographic distribution of oracles encouraged
   - No single oracle can control more than 30% of total weight

2. **Price Manipulation Prevention**
   - Weighted aggregation prevents single oracle control
   - Deviation detection flags suspicious price movements
   - Historical validation prevents rapid price changes
   - Cross-validation between multiple oracle sources
   - Circuit breaker functionality for extreme market conditions

3. **Access Control**
   - Owner-only critical functions (pause, emergency functions)
   - Role-based access control for different operations
   - Multi-signature requirements for sensitive operations
   - Time-locked operations for major changes

4. **Data Integrity**
   - Immutable historical price data once stored
   - Cryptographic signatures required for price submissions
   - Timestamp validation prevents stale data submission
   - Automatic cleanup of expired data
   - Redundant storage for critical operations

5. **Economic Security**
   - Bond requirements for oracle registration
   - Slashing penalties for malicious behavior
   - Reward mechanisms for honest participation
   - Gas cost optimization to prevent DoS attacks
   - Economic incentives for accurate reporting

#### 🔍 Security Considerations

1. **Centralization Risks**
   - Monitor oracle reputation distribution
   - Alert if single oracle gains >50% weight
   - Regular audits of oracle concentration
   - Encourage geographic and operator diversity

2. **Market Manipulation**
   - Real-time deviation monitoring
   - Automated suspicious pattern detection
   - Integration with external price feeds for validation
   - Historical analysis of price anomalies
   - Community reporting mechanisms for suspicious activity

3. **Smart Contract Risks**
   - Regular security audits by third parties
   - Formal verification of critical functions
   - Gas limit analysis to prevent DoS attacks
   - Reentrancy protection in all external calls
   - Integer overflow/underflow protection

4. **Operational Risks**
   - Oracle uptime monitoring
   - Data freshness validation
   - Network congestion handling
   - Failover mechanisms for oracle downtime
   - Regular backup and recovery procedures

### Audit Reports

#### Security Audit Summary
- **Audit Date**: [Date of last security audit]
- **Audit Score**: [Overall security score out of 100]
- **Critical Findings**: [Number of critical security issues]
- **Recommendations**: [List of security improvement recommendations]
- **Next Audit**: [Date of next scheduled security audit]

## Installation and Deployment

### Prerequisites

- Node.js 16+
- TypeScript
- npm or yarn

### Deployment Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ardecrownn/CurrentDao-contracts.git
   cd CurrentDao-contracts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Deploy the oracle system**
   ```bash
   # Deploy to testnet
   npm run deploy-oracle deploy-testnet
   
   # Deploy to mainnet
   npm run deploy-oracle deploy-mainnet
   
   # Deploy to production with enhanced security
   npm run deploy-oracle deploy-production
   ```

4. **Verify deployment**
   ```bash
   npm run deploy-oracle health
   
   # Perform security audit
   npm run deploy-oracle security-check
   ```

## Configuration

### Oracle Configuration

Each oracle is configured with the following parameters:

```typescript
interface OracleMetadata {
    name: string;           // Human-readable name
    description: string;     // Detailed description
    website: string;         // Oracle website
    contact: string;         // Contact information
    fee: u64;             // Submission fee in wei
    minDelay: u64;         // Minimum delay between submissions (seconds)
    supportedAssets: Address[]; // Supported asset addresses
}
```

### Deviation Thresholds

Configure deviation detection per asset:

```typescript
interface DeviationThreshold {
    assetId: Address;           // Asset address
    maxDeviationPercent: u64;    // Maximum allowed deviation (basis points)
    windowSize: u64;           // Time window for analysis (seconds)
    minSamples: u64;           // Minimum samples required
}
```

## Usage

### Registering an Oracle

```typescript
const oracleMetadata: OracleMetadata = {
    name: "Energy Price Oracle",
    description: "Provides renewable energy price data",
    website: "https://energy-oracle.example.com",
    contact: "oracle@example.com",
    fee: 100,
    minDelay: 60,
    supportedAssets: ["0xEnergyAssetToken"]
};

priceOracle.registerOracle(oracleAddress, oracleMetadata);
```

### Submitting Price Feeds

```typescript
const price = 1000000n; // $100.00 with 4 decimals
const timestamp = Date.now();
const signature = await signPriceFeed(oraclePrivateKey, price, timestamp);

priceOracle.submitPriceFeed(oracleId, price, timestamp, signature);
```

### Getting Current Price

```typescript
const currentPrice = priceOracle.getCurrentPrice("0xEnergyAssetToken");
console.log(`Current energy price: ${currentPrice}`);
```

### Getting Historical Price

```typescript
const historicalPrice = priceOracle.getHistoricalPrice(
    "0xEnergyAssetToken", 
    someTimestamp
);
```

### Getting Aggregated Price

```typescript
const aggregatedPrice = priceOracle.getAggregatedPrice("0xEnergyAssetToken");
```

## Aggregation Algorithms

### Weighted Average

The primary aggregation method uses oracle reputation as weights:

```
weighted_price = Σ(price_i × weight_i) / Σ(weight_i)
```

Where:
- `price_i` is the price from oracle i
- `weight_i` is the reputation-based weight of oracle i

### Standard Deviation

Calculates price dispersion to detect outliers:

```
std_dev = √(Σ(price_i - mean)² / n)
```

### Deviation Detection

Flags prices that deviate significantly from historical averages:

```
deviation_percent = |new_price - historical_average| / historical_average × 10000
```

## Reputation System

### Reputation Calculation

Oracle reputation is based on:
- **Base Reputation**: Initial reputation score (default: 100)
- **Success Rate**: Percentage of successful submissions
- **Accuracy**: How close submissions are to aggregated prices
- **Timeliness**: Consistency of submission timing

### Reputation Updates

```typescript
// Increase reputation for good behavior
priceOracle.updateOracleReputation(oracleId, +25);

// Decrease reputation for bad behavior
priceOracle.updateOracleReputation(oracleId, -50);
```

### Oracle Deactivation

Oracles are automatically deactivated when:
- Reputation falls below minimum threshold (default: 50)
- Multiple invalid submissions are detected
- Slash count exceeds limit (default: 3)

## Security Features

### Price Validation

1. **Cross-Oracle Validation**: Compares submissions against other oracles
2. **Historical Validation**: Checks against recent price history
3. **Deviation Detection**: Flags extreme price movements
4. **Signature Verification**: Ensures price feed authenticity

### Anti-Manipulation Measures

1. **Minimum Delay**: Prevents spam submissions
2. **Reputation Weighting**: Reduces impact of unreliable sources
3. **Outlier Detection**: Identifies and excludes anomalous data
4. **Slashing Mechanism**: Penalizes malicious behavior

## Gas Optimization

### Efficient Data Structures

- **Arrays over Mappings**: Where possible for gas efficiency
- **Packed Storage**: Optimized storage layout
- **Lazy Loading**: Load data only when needed

### Batch Operations

- **Multiple Oracle Updates**: Process multiple submissions in batches
- **Aggregated Updates**: Update multiple prices in single transactions
- **Event Logging**: Efficient event emission for tracking

## API Reference

### Core Methods

#### `submitPriceFeed(oracleId, price, timestamp, signature)`
Submit a new price feed to the oracle.

**Parameters:**
- `oracleId`: Address of the submitting oracle
- `price`: Price value (with decimals)
- `timestamp`: Unix timestamp of the price
- `signature`: Cryptographic signature of the price data

#### `getCurrentPrice(assetId)`
Get the latest aggregated price for an asset.

**Parameters:**
- `assetId`: Address of the asset

**Returns:** Latest price as u128

#### `getHistoricalPrice(assetId, timestamp)`
Get historical price at a specific timestamp.

**Parameters:**
- `assetId`: Address of the asset
- `timestamp`: Unix timestamp to query

**Returns:** Historical price as u128

#### `getAggregatedPrice(assetId)`
Calculate current aggregated price from all active oracles.

**Parameters:**
- `assetId`: Address of the asset

**Returns:** Aggregated price as u128

### Oracle Management

#### `registerOracle(oracleAddress, metadata)`
Register a new oracle in the system.

#### `updateOracleReputation(oracleId, reputationDelta)`
Update oracle reputation score.

#### `deactivateOracle(oracleId)`
Deactivate an oracle (admin only).

### Query Methods

#### `getOracleInfo(oracleId)`
Get detailed information about an oracle.

#### `getActiveOracles()`
Get list of all active oracle addresses.

#### `getPriceHistory(assetId, fromTimestamp, toTimestamp)`
Get historical price data for a time range.

## Events

### `PriceFeedSubmitted`
Emitted when a new price feed is submitted.

```
PriceFeedSubmitted(oracleId, assetId, price, timestamp)
```

### `PriceAggregated`
Emitted when prices are aggregated.

```
PriceAggregated(assetId, aggregatedPrice, timestamp)
```

### `OracleRegistered`
Emitted when a new oracle is registered.

```
OracleRegistered(oracleId, metadata)
```

### `OracleReputationUpdated`
Emitted when oracle reputation changes.

```
OracleReputationUpdated(oracleId, newReputation)
```

### `SuspiciousPriceDetected`
Emitted when suspicious price activity is detected.

```
SuspiciousPriceDetected(oracleId, assetId, price, deviation)
```

## Testing

### Running Tests

```bash
# Run all oracle tests
npm test -- tests/oracle/

# Run with coverage
npm run test:coverage -- tests/oracle/

# Run specific test file
npm test tests/oracle/PriceOracle.test.ts
```

### Test Coverage

The test suite covers:
- ✅ Oracle registration and management
- ✅ Price feed submission and validation
- ✅ Price aggregation algorithms
- ✅ Deviation detection
- ✅ Reputation system
- ✅ Historical price tracking
- ✅ Security scenarios
- ✅ Edge cases and error handling

## Monitoring and Maintenance

### Health Checks

```bash
npm run deploy-oracle health
```

### Performance Metrics

Monitor:
- **Oracle Participation**: Number of active oracles
- **Price Accuracy**: Deviation from market prices
- **Submission Frequency**: Regularity of price updates
- **Reputation Distribution**: Health of oracle ecosystem

### Maintenance Tasks

1. **Regular Oracle Reviews**: Assess oracle performance
2. **Threshold Adjustments**: Update deviation thresholds as needed
3. **Reputation Balancing**: Ensure fair reputation distribution
4. **Security Audits**: Regular security assessments

## Troubleshooting

### Common Issues

#### Oracle Not Receiving Submissions
- Check oracle is registered and active
- Verify minimum delay requirements
- Check signature format

#### Price Aggregation Failing
- Ensure minimum number of active oracles
- Check price feed validity
- Verify deviation thresholds

#### High Gas Costs
- Review batch operation usage
- Check for unnecessary storage operations
- Optimize oracle count per asset

### Debug Commands

```bash
# Check oracle status
npm run deploy-oracle health

# Update configurations
npm run deploy-oracle update

# Redeploy if needed
npm run deploy-oracle deploy-testnet
```

## Integration Guide

### With Trading System

```typescript
// Get current price for trading
const energyPrice = priceOracle.getCurrentPrice(energyTokenAddress);
const tradeAmount = calculateTradeAmount(energyPrice);

// Execute trade with price protection
if (priceOracle.detectPriceDeviation(energyTokenAddress, quotedPrice)) {
    throw new Error("Price deviation too high");
}
```

### With Staking System

```typescript
// Use historical prices for reward calculations
const priceHistory = priceOracle.getPriceHistory(
    stakingTokenAddress,
    startTime,
    endTime
);
const averagePrice = calculateAveragePrice(priceHistory);
const rewards = calculateStakingRewards(averagePrice);
```

## Best Practices

### For Oracle Operators

1. **Maintain High Reputation**: Submit accurate prices consistently
2. **Follow Timing Requirements**: Respect minimum delay intervals
3. **Monitor Performance**: Track submission success rates
4. **Security**: Protect private keys and signing infrastructure

### For DApp Developers

1. **Error Handling**: Handle oracle failures gracefully
2. **Price Validation**: Always validate prices before use
3. **Fallback Mechanisms**: Have backup price sources
4. **Gas Optimization**: Use batch operations where possible

### For System Administrators

1. **Regular Monitoring**: Track system health metrics
2. **Security Audits**: Conduct regular security reviews
3. **Performance Optimization**: Monitor and optimize gas usage
4. **Documentation**: Keep configuration documentation updated

## License and Support

This implementation is part of the CurrentDao ecosystem. For support:

- **GitHub Issues**: [Repository Issues](https://github.com/Ardecrownn/CurrentDao-contracts/issues)
- **Documentation**: [CurrentDao Docs](https://docs.currentdao.org)
- **Community**: [Discord](https://discord.currentdao.org)

## Version History

- **v1.0.0**: Initial implementation with core features
- **v1.1.0**: Added advanced aggregation algorithms
- **v1.2.0**: Enhanced security features
- **v1.3.0**: Gas optimization improvements

---

*Last updated: March 2026*
