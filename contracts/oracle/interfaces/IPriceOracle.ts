import { Address, u128, u64, Bool, Vec } from '@stellar/stellar-sdk';

export interface IPriceOracle {
    // Core price feed methods
    submitPriceFeed(oracleId: Address, price: u128, timestamp: u64, signature: Buffer): void;
    getCurrentPrice(assetId: Address): u128;
    getHistoricalPrice(assetId: Address, timestamp: u64): u128;
    
    // Oracle management
    registerOracle(oracleAddress: Address, metadata: OracleMetadata): void;
    updateOracleReputation(oracleId: Address, reputationDelta: i64): void;
    deactivateOracle(oracleId: Address): void;
    
    // Aggregation and validation
    getAggregatedPrice(assetId: Address): u128;
    validatePriceFeed(price: u128, oracleId: Address): Bool;
    detectPriceDeviation(assetId: Address, newPrice: u128): Bool;
    
    // Query methods
    getOracleInfo(oracleId: Address): OracleInfo;
    getActiveOracles(): Vec<Address>;
    getPriceHistory(assetId: Address, fromTimestamp: u64, toTimestamp: u64): Vec<PriceDataPoint>;
    
    // Events
    event PriceFeedSubmitted(oracleId: Address, assetId: Address, price: u128, timestamp: u64);
    event PriceAggregated(assetId: Address, aggregatedPrice: u128, timestamp: u64);
    event OracleRegistered(oracleId: Address, metadata: OracleMetadata);
    event OracleReputationUpdated(oracleId: Address, newReputation: i64);
    event SuspiciousPriceDetected(oracleId: Address, assetId: Address, price: u128, deviation: u64);
}

export interface OracleMetadata {
    name: string;
    description: string;
    website: string;
    contact: string;
    fee: u64;
    minDelay: u64;
}

export interface OracleInfo {
    oracleId: Address;
    metadata: OracleMetadata;
    reputation: i64;
    isActive: Bool;
    lastSubmission: u64;
    totalSubmissions: u64;
    successfulSubmissions: u64;
}

export interface PriceDataPoint {
    price: u128;
    timestamp: u64;
    oracleId: Address;
    isValid: Bool;
}

export interface AggregationResult {
    weightedPrice: u128;
    totalWeight: u64;
    participatingOracles: u64;
    standardDeviation: u128;
    isValid: Bool;
}
