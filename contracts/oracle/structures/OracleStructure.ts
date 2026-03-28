// Type definitions for the price oracle system
export type Address = string;
export type u128 = bigint;
export type u64 = number;
export type i64 = number;
export type Bool = boolean;
export type Vec<T> = T[];
export type Map<K, V> = { [key: string]: V };
export type Set<T> = { [key: string]: boolean };

export class OracleRegistry {
    oracles: Map<Address, Oracle>;
    activeOracles: Set<Address>;
    assetOracles: Map<Address, Vec<Address>>;
    
    constructor() {
        this.oracles = {} as Map<Address, Oracle>;
        this.activeOracles = {} as Set<Address>;
        this.assetOracles = {} as Map<Address, Vec<Address>>;
    }
}

export class Oracle {
    id: Address;
    metadata: OracleMetadata;
    reputation: i64;
    isActive: Bool;
    lastSubmission: u64;
    totalSubmissions: u64;
    successfulSubmissions: u64;
    slashCount: u64;
    registeredAt: u64;
    
    constructor(
        id: Address,
        metadata: OracleMetadata,
        initialReputation: i64 = 100
    ) {
        this.id = id;
        this.metadata = metadata;
        this.reputation = initialReputation;
        this.isActive = true;
        this.lastSubmission = 0;
        this.totalSubmissions = 0;
        this.successfulSubmissions = 0;
        this.slashCount = 0;
        this.registeredAt = Date.now();
    }
    
    getSuccessRate(): u64 {
        if (this.totalSubmissions === 0) return 0;
        return (this.successfulSubmissions * 100) / this.totalSubmissions;
    }
    
    getWeight(): u64 {
        // Weight based on reputation and success rate
        const baseWeight = this.reputation > 0 ? this.reputation : 0;
        const successBonus = this.getSuccessRate() / 10;
        return baseWeight + successBonus;
    }
    
    canSubmit(minDelay: u64): Bool {
        const now = Date.now();
        return this.isActive && 
               (now - this.lastSubmission) >= minDelay &&
               this.reputation > 0;
    }
}

export class OracleMetadata {
    name: string;
    description: string;
    website: string;
    contact: string;
    fee: u64;
    minDelay: u64;
    supportedAssets: Vec<Address>;
    
    constructor(
        name: string,
        description: string,
        website: string,
        contact: string,
        fee: u64,
        minDelay: u64,
        supportedAssets: Vec<Address>
    ) {
        this.name = name;
        this.description = description;
        this.website = website;
        this.contact = contact;
        this.fee = fee;
        this.minDelay = minDelay;
        this.supportedAssets = supportedAssets;
    }
}

export class PriceFeed {
    oracleId: Address;
    assetId: Address;
    price: u128;
    timestamp: u64;
    signature: Uint8Array;
    isValid: Bool;
    deviationScore: u64;
    
    constructor(
        oracleId: Address,
        assetId: Address,
        price: u128,
        timestamp: u64,
        signature: Uint8Array
    ) {
        this.oracleId = oracleId;
        this.assetId = assetId;
        this.price = price;
        this.timestamp = timestamp;
        this.signature = signature;
        this.isValid = false;
        this.deviationScore = 0;
    }
    
    isExpired(maxAge: u64): Bool {
        const now = Date.now();
        return (now - this.timestamp) > maxAge;
    }
}

export class PriceHistory {
    assetId: Address;
    dataPoints: Vec<PriceDataPoint>;
    maxSize: u64;
    
    constructor(assetId: Address, maxSize: u64 = 1000) {
        this.assetId = assetId;
        this.dataPoints = [] as Vec<PriceDataPoint>;
        this.maxSize = maxSize;
    }
    
    addDataPoint(dataPoint: PriceDataPoint): void {
        this.dataPoints.push(dataPoint);
        
        if (this.dataPoints.length > this.maxSize) {
            this.dataPoints.shift();
        }
    }
    
    getLatestPrice(): u128 {
        if (this.dataPoints.length === 0) return 0n;
        return this.dataPoints[this.dataPoints.length - 1].price;
    }
    
    getPriceAt(timestamp: u64): u128 {
        for (let i = this.dataPoints.length - 1; i >= 0; i--) {
            if (this.dataPoints[i].timestamp <= timestamp) {
                return this.dataPoints[i].price;
            }
        }
        return 0n;
    }
    
    getAveragePrice(fromTimestamp: u64, toTimestamp: u64): u128 {
        let sum = 0n;
        let count = 0;
        
        for (const dataPoint of this.dataPoints) {
            if (dataPoint.timestamp >= fromTimestamp && 
                dataPoint.timestamp <= toTimestamp &&
                dataPoint.isValid) {
                sum += BigInt(dataPoint.price);
                count++;
            }
        }
        
        return count > 0 ? sum / BigInt(count) : 0n;
    }
}

export class PriceDataPoint {
    price: u128;
    timestamp: u64;
    oracleId: Address;
    isValid: Bool;
    weight: u64;
    
    constructor(
        price: u128,
        timestamp: u64,
        oracleId: Address,
        isValid: Bool,
        weight: u64 = 1
    ) {
        this.price = price;
        this.timestamp = timestamp;
        this.oracleId = oracleId;
        this.isValid = isValid;
        this.weight = weight;
    }
}

export class AggregationResult {
    weightedPrice: u128;
    totalWeight: u64;
    participatingOracles: u64;
    standardDeviation: u128;
    isValid: Bool;
    confidence: u64;
    
    constructor() {
        this.weightedPrice = 0n;
        this.totalWeight = 0;
        this.participatingOracles = 0;
        this.standardDeviation = 0n;
        this.isValid = false;
        this.confidence = 0;
    }
    
    calculateConfidence(): u64 {
        if (this.participatingOracles === 0) return 0;
        
        // Confidence based on number of oracles and standard deviation
        const oracleConfidence = Math.min(this.participatingOracles * 10, 100);
        const deviationPenalty = Math.min(Number(this.standardDeviation) / 100, 50);
        
        return Math.max(oracleConfidence - deviationPenalty, 0);
    }
}

export class DeviationThreshold {
    assetId: Address;
    maxDeviationPercent: u64;
    windowSize: u64;
    minSamples: u64;
    
    constructor(
        assetId: Address,
        maxDeviationPercent: u64 = 500, // 5%
        windowSize: u64 = 3600, // 1 hour
        minSamples: u64 = 3
    ) {
        this.assetId = assetId;
        this.maxDeviationPercent = maxDeviationPercent;
        this.windowSize = windowSize;
        this.minSamples = minSamples;
    }
}

export class OracleConfig {
    maxOraclesPerAsset: u64;
    minReputationThreshold: i64;
    maxPriceAge: u64;
    aggregationInterval: u64;
    slashThreshold: u64;
    rewardMultiplier: u128;
    automatedUpdates: Bool;
    
    constructor() {
        this.maxOraclesPerAsset = 10;
        this.minReputationThreshold = 50;
        this.maxPriceAge = 300; // 5 minutes
        this.aggregationInterval = 300; // 5 minutes
        this.slashThreshold = 1000; // 10%
        this.rewardMultiplier = 1000000n; // For precision
        this.automatedUpdates = false; // Disabled by default
    }
}
