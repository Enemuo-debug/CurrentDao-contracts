import { Address, u128, u64, i64, Bool, Vec } from '../structures/RatingStructure';

export interface IQualityRating {
    // Core rating methods
    submitQualityRating(
        energySourceId: Address,
        metrics: QualityMetrics,
        timestamp: u64,
        oracleSignature: Uint8Array
    ): void;
    
    getCurrentQualityRating(energySourceId: Address): QualityRating;
    getHistoricalRating(energySourceId: Address, timestamp: u64): QualityRating;
    
    // Oracle management
    registerQualityOracle(oracleAddress: Address, metadata: OracleMetadata): void;
    updateOracleReputation(oracleId: Address, reputationDelta: i64): void;
    deactivateQualityOracle(oracleId: Address): void;
    
    // Rating validation and aggregation
    validateQualitySubmission(metrics: QualityMetrics, oracleId: Address): Bool;
    getAggregatedRating(energySourceId: Address): QualityRating;
    detectRatingAnomaly(energySourceId: Address, newRating: QualityRating): Bool;
    
    // Dispute resolution
    fileRatingDispute(
        energySourceId: Address,
        disputedRating: QualityRating,
        reason: string,
        evidence: Vec<string>
    ): void;
    resolveRatingDispute(disputeId: u64, resolution: DisputeResolution): void;
    
    // Query methods
    getQualityMetrics(energySourceId: Address): QualityMetrics;
    getRatingHistory(energySourceId: Address, fromTimestamp: u64, toTimestamp: u64): Vec<RatingDataPoint>;
    getActiveQualityOracles(): Vec<Address>;
    getPendingDisputes(): Vec<RatingDispute>;
}

export interface QualityMetrics {
    renewablePercentage: u64;        // 0-10000 (0.00% - 100.00%)
    carbonFootprint: u64;            // gCO2/kWh
    reliabilityScore: u64;           // 0-100 (0% - 100%)
    efficiency: u64;                 // 0-10000 (0.00% - 100.00%)
    availability: u64;               // 0-10000 (0.00% - 100.00%)
    responseTime: u64;               // milliseconds
    qualityStandard: string;         // ISO/IEC standard identifier
    certificationLevel: u64;        // 0-10 (0 - No certification, 10 - Highest)
}

export interface QualityRating {
    energySourceId: Address;
    overallScore: u64;               // 0-10000 (0.00 - 100.00)
    renewableScore: u64;             // 0-10000
    carbonScore: u64;                // 0-10000
    reliabilityScore: u64;           // 0-10000
    efficiencyScore: u64;            // 0-10000
    availabilityScore: u64;          // 0-10000
    timestamp: u64;
    oracleId: Address;
    confidence: u64;                 // 0-10000 (0.00% - 100.00%)
    pricingMultiplier: u128;         // Premium pricing factor (basis points)
}

export interface OracleMetadata {
    name: string;
    description: string;
    website: string;
    contact: string;
    fee: u64;
    reputation: i64;
    specialization: Vec<string>;
    certification: string;
}

export interface RatingDataPoint {
    timestamp: u64;
    rating: QualityRating;
    metrics: QualityMetrics;
}

export interface RatingDispute {
    disputeId: u64;
    energySourceId: Address;
    disputedRating: QualityRating;
    complainant: Address;
    reason: string;
    evidence: Vec<string>;
    status: DisputeStatus;
    filedAt: u64;
    resolvedAt: u64;
    resolution: DisputeResolution;
}

export interface DisputeResolution {
    action: DisputeAction;
    newRating?: QualityRating;
    penaltyAmount?: u128;
    oracleReputationImpact?: i64;
    explanation: string;
}

export enum DisputeStatus {
    PENDING = "PENDING",
    UNDER_REVIEW = "UNDER_REVIEW",
    RESOLVED = "RESOLVED",
    REJECTED = "REJECTED"
}

export enum DisputeAction {
    NO_CHANGE = "NO_CHANGE",
    ADJUST_RATING = "ADJUST_RATING",
    REMOVE_RATING = "REMOVE_RATING",
    PENALIZE_ORACLE = "PENALIZE_ORACLE"
}

export interface RatingConfig {
    weights: RatingWeights;
    thresholds: RatingThresholds;
    disputeConfig: DisputeConfig;
    oracleConfig: OracleConfig;
    validate(): Bool;
}

export interface RatingWeights {
    renewableWeight: u64;            // 0-10000 (basis points)
    carbonWeight: u64;
    reliabilityWeight: u64;
    efficiencyWeight: u64;
    availabilityWeight: u64;
    validate(): Bool;
}

export interface RatingThresholds {
    minimumRenewable: u64;           // 0-10000
    maximumCarbonFootprint: u64;
    minimumReliability: u64;
    minimumEfficiency: u64;
    minimumAvailability: u64;
    anomalyDetectionThreshold: u64;  // 0-10000
}

export interface DisputeConfig {
    disputeFee: u128;
    maxDisputeDuration: u64;         // seconds
    minEvidenceRequired: u64;
    autoResolveThreshold: u64;       // 0-10000
}

export interface OracleConfig {
    minimumReputation: i64;
    maxSubmissionsPerDay: u64;
    signatureVerification: Bool;
    aggregationMethod: AggregationMethod;
}

export enum AggregationMethod {
    WEIGHTED_AVERAGE = "WEIGHTED_AVERAGE",
    MEDIAN = "MEDIAN",
    REPUTATION_WEIGHTED = "REPUTATION_WEIGHTED"
}
