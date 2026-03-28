# Fee Management System Documentation

## Overview

The CurrentDao Fee Management System is a comprehensive, flexible fee infrastructure that supports multiple fee types, tiered structures, and dynamic adjustments based on market conditions. This system is designed to provide transparent, efficient, and configurable fee calculations for all transaction types within the CurrentDao ecosystem.

## Table of Contents

1. [Architecture](#architecture)
2. [Fee Types](#fee-types)
3. [Tiered Structures](#tiered-structures)
4. [Dynamic Adjustments](#dynamic-adjustments)
5. [Fee Distribution](#fee-distribution)
6. [Exemption System](#exemption-system)
7. [Historical Tracking](#historical-tracking)
8. [Gas Optimization](#gas-optimization)
9. [API Reference](#api-reference)
10. [Deployment](#deployment)
11. [Security Considerations](#security-considerations)
12. [Best Practices](#best-practices)

## Architecture

The fee management system consists of several key components:

```
contracts/fees/
├── FeeManager.ts              # Main contract implementation
├── interfaces/
│   └── IFeeManager.ts        # Interface definition
├── libraries/
│   └── FeeCalculation.ts     # Fee calculation algorithms
└── structures/
    └── FeeStructure.ts       # Data structures and enums
```

### Core Components

- **FeeManager**: Main contract implementing the complete fee management logic
- **FeeCalculation**: Library containing optimized fee calculation algorithms
- **FeeStructure**: Comprehensive data structures for fee configuration
- **IFeeManager**: Interface defining all fee management operations

## Fee Types

The system supports four primary fee types:

### 1. Fixed Fees
- Applied as a constant amount regardless of transaction value
- Ideal for small transactions under $100
- Example: $1 fee for all trades under $100

### 2. Percentage Fees
- Calculated as a percentage of transaction value
- Range: 0.5% - 2.5% based on volume and market conditions
- Example: 0.5% of transaction amount

### 3. Tiered Fees
- Volume-based fee structures with multiple tiers
- Discounts increase with trading volume
- Example: Bronze (0%), Silver (5%), Gold (10%), Platinum (20%)

### 4. Hybrid Fees
- Combination of fixed and percentage components
- Provides flexibility for complex pricing scenarios
- Example: $0.50 + 0.1% of transaction amount

## Tiered Structures

### Default Tiers

| Tier | Volume Range | Discount | Priority |
|------|-------------|----------|----------|
| Bronze | $0 - $999 | 0% | 3 |
| Silver | $1,000 - $9,999 | 5% | 2 |
| Gold | $10,000 - $99,999 | 10% | 1 |
| Platinum | $100,000+ | 20% | 0 |

### Volume Tracking

- **Period**: Monthly reset cycle
- **Calculation**: Cumulative volume per user per transaction type
- **Persistence**: Stored in UserVolumeRecord structures
- **Reset**: Automatic reset at the beginning of each period

## Dynamic Adjustments

### Network Congestion Response

The system automatically adjusts fees based on network congestion levels:

- **Congestion Range**: 0-100 (0 = no congestion, 100 = maximum congestion)
- **Adjustment Formula**: `fee * (1 + congestion_level * multiplier)`
- **Rate Limits**: Bounded by min/max rate configurations
- **Real-time Updates**: Congestion levels updated by oracle or admin

### Configuration Parameters

```typescript
dynamicAdjustment: {
    enabled: boolean;        // Enable/disable dynamic adjustments
    minRate: number;         // Minimum fee rate (basis points)
    maxRate: number;         // Maximum fee rate (basis points)
    congestionMultiplier: number; // Multiplier for congestion impact
}
```

## Fee Distribution

### Default Distribution Model

| Transaction Type | Treasury | Validators | Developers |
|------------------|----------|------------|------------|
| Trade | 50% | 30% | 20% |
| Transfer | 60% | 40% | 0% |
| Staking | 70% | 30% | 0% |

### Distribution Process

1. Fee calculation completed
2. Total fee amount determined
3. Distribution applied according to configuration
4. Funds transferred to recipient addresses
5. Distribution events emitted for tracking

### Custom Distributions

Administrators can configure custom distributions:

```typescript
const customDistribution: FeeDistribution = {
    transactionType: 'CUSTOM',
    recipients: [
        { address: '0x...', percentage: 6000, name: 'Treasury' },
        { address: '0x...', percentage: 4000, name: 'Operations' }
    ],
    totalPercentage: 10000  // Must equal 100%
};
```

## Exemption System

### Exemption Types

1. **Percentage Exemptions**: Reduce fee by a percentage
2. **Fixed Exemptions**: Reduce fee by a fixed amount
3. **Full Exemptions**: Completely waive fees

### Exemption Properties

```typescript
interface FeeExemption {
    id: string;
    userAddress: string;
    transactionType: string;
    exemptionType: 'PERCENTAGE' | 'FIXED' | 'FULL';
    value: number;
    createdAt: number;
    expiresAt?: number;
    isActive: boolean;
    reason?: string;
    createdBy: string;
}
```

### Use Cases

- **Promotional Periods**: Temporary fee discounts for new users
- **VIP Programs**: Permanent exemptions for high-value users
- **Special Events**: Limited-time fee waivers
- **Development**: Testing and debugging exemptions

## Historical Tracking

### Data Collection

The system tracks comprehensive fee data:

```typescript
interface HistoricalFeeRecord {
    id: string;
    userAddress: string;
    transactionType: string;
    amount: number;
    feeAmount: number;
    effectiveFeeRate: number;
    tierUsed: string;
    networkCongestion: number;
    timestamp: number;
    discounts: Array<{
        type: 'VOLUME' | 'EXEMPTION' | 'DYNAMIC';
        amount: number;
        description: string;
    }>;
    gasUsed: number;
}
```

### Analytics Capabilities

- **Fee Statistics**: Total fees, average fees, transaction counts
- **Volume Analysis**: Discount utilization, tier progression
- **Network Impact**: Congestion effects on fee revenue
- **User Behavior**: Fee sensitivity, exemption usage patterns

### Data Retention

- **Per User**: Last 1,000 transactions
- **System-wide**: Configurable retention periods
- **Aggregation**: Daily/weekly/monthly summaries
- **Privacy**: User data anonymization options

## Gas Optimization

### Batch Processing

The system implements several gas optimization strategies:

#### 1. Batch Fee Calculations
```typescript
const requests = [
    { amount: 1000, userAddress: '0x...', transactionType: 'TRADE' },
    { amount: 2000, userAddress: '0x...', transactionType: 'TRADE' }
];
const results = feeManager.batchCalculateFees(requests);
```

#### 2. Context Grouping
- Similar transactions grouped together
- Shared calculations to reduce redundancy
- Up to 30% gas savings for batch operations

#### 3. Caching Mechanisms
- Fee structure caching
- User tier caching
- Volume discount caching

### Gas Estimates

| Operation | Gas Cost (Estimate) | Optimized Cost |
|-----------|-------------------|----------------|
| Single Fee Calculation | 26,000 | 26,000 |
| Batch Calculation (10) | 260,000 | 182,000 |
| Tier Assignment | 15,000 | 15,000 |
| Exemption Creation | 25,000 | 25,000 |

## API Reference

### Core Methods

#### calculateFee()
```typescript
calculateFee(
    amount: number,
    userAddress: string,
    transactionType: string,
    networkCongestion?: number
): FeeCalculationResult
```

Calculates the fee for a single transaction.

#### calculateFeeWithExemption()
```typescript
calculateFeeWithExemption(
    amount: number,
    userAddress: string,
    transactionType: string,
    exemptionId?: string,
    networkCongestion?: number
): FeeCalculationResult
```

Calculates fee with a specific exemption applied.

#### batchCalculateFees()
```typescript
batchCalculateFees(
    requests: Array<{
        amount: number;
        userAddress: string;
        transactionType: string;
        networkCongestion?: number;
    }>
): FeeCalculationResult[]
```

Calculates fees for multiple transactions in a batch.

### Administrative Methods

#### setFeeStructure()
```typescript
setFeeStructure(transactionType: string, structure: FeeStructure): void
```

Sets or updates the fee structure for a transaction type.

#### createExemption()
```typescript
createExemption(
    userAddress: string,
    transactionType: string,
    exemptionType: 'PERCENTAGE' | 'FIXED' | 'FULL',
    value: number,
    expiresAt?: number
): string
```

Creates a new fee exemption.

#### setNetworkCongestionLevel()
```typescript
setNetworkCongestionLevel(congestionLevel: number): void
```

Updates the current network congestion level (0-100).

### Events

The system emits events for all major operations:

```typescript
onFeeCalculated?: (result: FeeCalculationResult) => void;
onFeeDistributed?: (transactionType: string, amounts: Map<string, number>) => void;
onExemptionCreated?: (exemption: FeeExemption) => void;
onExemptionRevoked?: (exemptionId: string) => void;
onNetworkCongestionUpdated?: (newLevel: number) => void;
onFeeStructureUpdated?: (transactionType: string, structure: FeeStructure) => void;
```

## Deployment

### Prerequisites

- Node.js 16+ and npm
- TypeScript compiler
- Access to target network (development/testnet/mainnet)

### Deployment Steps

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
```bash
# Set environment variables for mainnet deployment
export MAINNET_OWNER="0x..."
export MAINNET_TREASURY="0x..."
export MAINNET_VALIDATORS="0x..."
export MAINNET_DEVELOPERS="0x..."
```

3. **Deploy to Network**
```bash
# Development
npm run deploy:fees development

# Testnet
npm run deploy:fees testnet

# Mainnet
npm run deploy:fees mainnet
```

4. **Verify Deployment**
```bash
npm run verify:fees <deployment-hash>
```

### Configuration Files

Deployment configurations are stored in `deployments/` directory:

```json
{
  "network": "mainnet",
  "contractAddress": "0x...",
  "blockNumber": 12345678,
  "transactionHash": "0x...",
  "timestamp": 1640995200000,
  "gasUsed": 3150000
}
```

## Security Considerations

### Access Control

- **Owner-only Functions**: Critical administrative functions restricted to contract owner
- **Pause Mechanism**: Emergency pause capability to halt all operations
- **Transfer Ownership**: Secure ownership transfer process

### Input Validation

- **Amount Validation**: Negative amounts rejected
- **Rate Limits**: Fee rates bounded within safe ranges
- **Address Validation**: Proper address format verification
- **Parameter Ranges**: Network congestion levels validated (0-100)

### Reentrancy Protection

- **State Updates First**: State changes before external calls
- **Checks-Effects-Interactions Pattern**: Proper execution order
- **Reentrancy Guards**: Protection against recursive calls

### Mathematical Safety

- **Overflow Protection**: Safe arithmetic operations
- **Precision Handling**: Proper basis point calculations
- **Rounding Consistency**: Deterministic rounding behavior

## Best Practices

### For Developers

1. **Use Batch Operations**: Leverage batch fee calculations for gas efficiency
2. **Cache Results**: Cache fee calculations when possible
3. **Handle Events**: Listen to fee events for real-time updates
4. **Validate Inputs**: Always validate user inputs before fee calculations

### For Administrators

1. **Monitor Gas Usage**: Track optimization metrics regularly
2. **Review Distributions**: Periodically audit fee distribution configurations
3. **Update Congestion**: Keep network congestion levels current
4. **Manage Exemptions**: Regularly review and clean up expired exemptions

### For Users

1. **Understand Tiers**: Know your current tier and benefits
2. **Track Volume**: Monitor your trading volume for tier progression
3. **Check Exemptions**: Verify active exemptions before transactions
4. **Monitor Fees**: Review fee history for cost optimization

## Integration Examples

### Basic Integration

```typescript
import { FeeManager } from './contracts/fees/FeeManager';

// Initialize fee manager
const feeManager = new FeeManager('0xowner');

// Calculate fee for a trade
const feeResult = feeManager.calculateFee(1000, '0xuser', 'TRADE');
console.log(`Fee: $${feeResult.totalFee}`);

// Record the payment
feeManager.recordFeePayment(
    '0xuser',
    'TRADE',
    1000,
    feeResult.totalFee,
    feeResult.tierUsed || 'standard',
    feeManager.getNetworkCongestionLevel()
);
```

### Advanced Integration with Events

```typescript
// Set up event listeners
feeManager.onFeeCalculated = (result) => {
    console.log(`Fee calculated: $${result.totalFee} for ${result.effectiveRate/100}%`);
};

feeManager.onFeeDistributed = (transactionType, amounts) => {
    console.log(`Fees distributed for ${transactionType}:`, Object.fromEntries(amounts));
};

// Batch calculation for multiple trades
const trades = [
    { amount: 1000, userAddress: '0xuser1', transactionType: 'TRADE' },
    { amount: 2000, userAddress: '0xuser2', transactionType: 'TRADE' }
];

const results = feeManager.batchCalculateFees(trades);
```

### Custom Fee Structure

```typescript
// Create custom fee structure for NFT trading
const nftFeeStructure = {
    feeType: FeeType.HYBRID,
    baseFee: 2.5,
    percentageFee: 25, // 0.25%
    minFee: 1,
    maxFee: 50,
    dynamicAdjustment: {
        enabled: true,
        minRate: 15,
        maxRate: 100,
        congestionMultiplier: 1.3
    },
    volumeThresholds: {
        discountThresholds: [
            { volume: 5000, discount: 300 }, // 3% discount
            { volume: 25000, discount: 750 } // 7.5% discount
        ],
        resetPeriod: 'monthly'
    }
};

feeManager.setFeeStructure('NFT_TRADE', nftFeeStructure);
```

## Troubleshooting

### Common Issues

1. **High Gas Costs**
   - Use batch operations
   - Check optimization metrics
   - Review fee structure complexity

2. **Incorrect Fee Calculations**
   - Verify fee structure configuration
   - Check user tier assignments
   - Validate exemption status

3. **Distribution Failures**
   - Verify recipient addresses
   - Check distribution percentages sum to 100%
   - Ensure sufficient contract balance

4. **Performance Issues**
   - Monitor historical data size
   - Implement data pruning
   - Use caching strategies

### Debug Tools

```typescript
// Get optimization metrics
const metrics = feeManager.getOptimizationMetrics();
console.log('Gas optimization metrics:', metrics);

// Get fee statistics
const stats = feeManager.getFeeStatistics('TRADE');
console.log('Trade fee statistics:', stats);

// Check user's current tier
const tier = feeManager.getUserTier('0xuser', 'TRADE');
console.log('User tier:', tier);
```

## Version History

### v1.0.0 (Current)
- Initial release with core fee management functionality
- Support for all four fee types
- Dynamic adjustment mechanisms
- Comprehensive exemption system
- Gas optimization features
- Full historical tracking

### Future Roadmap
- Cross-chain fee support
- Advanced analytics dashboard
- Machine learning-based fee optimization
- Automated tier progression
- Enhanced security features

## Support

For technical support and questions:

- **Documentation**: This document and inline code comments
- **Issues**: GitHub repository issue tracker
- **Community**: CurrentDao Discord server
- **Security**: Report security vulnerabilities privately

---

*This documentation is part of the CurrentDao ecosystem and is regularly updated. Last updated: March 2026*
