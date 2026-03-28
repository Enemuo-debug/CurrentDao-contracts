// Type definitions for the Quality Rating System
export type Address = string;
export type u128 = bigint;
export type u64 = bigint;
export type i64 = bigint;
export type Bool = boolean;
export type Vec<T> = T[];
export type Map<K, V> = globalThis.Map<K, V>;

// Import interfaces for consistency
import {
    QualityMetrics,
    QualityRating,
    OracleMetadata,
    RatingDataPoint,
    RatingDispute,
    DisputeResolution,
    DisputeStatus,
    DisputeAction,
    RatingConfig,
    RatingWeights,
    RatingThresholds,
    DisputeConfig,
    OracleConfig,
    AggregationMethod
} from '../interfaces/IQualityRating';

// Core data structures
export class QualityMetricsImpl implements QualityMetrics {
    renewablePercentage: u64;
    carbonFootprint: u64;
    reliabilityScore: u64;
    efficiency: u64;
    availability: u64;
    responseTime: u64;
    qualityStandard: string;
    certificationLevel: u64;

    constructor(
        renewablePercentage: u64 = 0n,
        carbonFootprint: u64 = 0n,
        reliabilityScore: u64 = 0n,
        efficiency: u64 = 0n,
        availability: u64 = 0n,
        responseTime: u64 = 0n,
        qualityStandard: string = "",
        certificationLevel: u64 = 0n
    ) {
        this.renewablePercentage = renewablePercentage;
        this.carbonFootprint = carbonFootprint;
        this.reliabilityScore = reliabilityScore;
        this.efficiency = efficiency;
        this.availability = availability;
        this.responseTime = responseTime;
        this.qualityStandard = qualityStandard;
        this.certificationLevel = certificationLevel;
    }

    validate(): Bool {
        return (
            this.renewablePercentage <= 10000n && // 0-100%
            this.carbonFootprint >= 0n &&
            this.reliabilityScore <= 100n && // 0-100%
            this.efficiency <= 10000n && // 0-100%
            this.availability <= 10000n && // 0-100%
            this.certificationLevel <= 10n // 0-10
        );
    }
}

export class QualityRatingImpl implements QualityRating {
    energySourceId: Address;
    overallScore: u64;
    renewableScore: u64;
    carbonScore: u64;
    reliabilityScore: u64;
    efficiencyScore: u64;
    availabilityScore: u64;
    timestamp: u64;
    oracleId: Address;
    confidence: u64;
    pricingMultiplier: u128;

    constructor(
        energySourceId: Address = "",
        overallScore: u64 = 0n,
        renewableScore: u64 = 0n,
        carbonScore: u64 = 0n,
        reliabilityScore: u64 = 0n,
        efficiencyScore: u64 = 0n,
        availabilityScore: u64 = 0n,
        timestamp: u64 = 0n,
        oracleId: Address = "",
        confidence: u64 = 0n,
        pricingMultiplier: u128 = 10000n // 1.0x in basis points
    ) {
        this.energySourceId = energySourceId;
        this.overallScore = overallScore;
        this.renewableScore = renewableScore;
        this.carbonScore = carbonScore;
        this.reliabilityScore = reliabilityScore;
        this.efficiencyScore = efficiencyScore;
        this.availabilityScore = availabilityScore;
        this.timestamp = timestamp;
        this.oracleId = oracleId;
        this.confidence = confidence;
        this.pricingMultiplier = pricingMultiplier;
    }

    validate(): Bool {
        return (
            this.overallScore <= 10000n && // 0-100%
            this.renewableScore <= 10000n &&
            this.carbonScore <= 10000n &&
            this.reliabilityScore <= 10000n &&
            this.efficiencyScore <= 10000n &&
            this.availabilityScore <= 10000n &&
            this.confidence <= 10000n &&
            this.pricingMultiplier >= 5000n && // Minimum 0.5x
            this.pricingMultiplier <= 50000n  // Maximum 5.0x
        );
    }
}

export class OracleMetadataImpl implements OracleMetadata {
    name: string;
    description: string;
    website: string;
    contact: string;
    fee: u64;
    reputation: i64;
    specialization: Vec<string>;
    certification: string;

    constructor(
        name: string = "",
        description: string = "",
        website: string = "",
        contact: string = "",
        fee: u64 = 0n,
        reputation: i64 = 0n,
        specialization: Vec<string> = [],
        certification: string = ""
    ) {
        this.name = name;
        this.description = description;
        this.website = website;
        this.contact = contact;
        this.fee = fee;
        this.reputation = reputation;
        this.specialization = specialization;
        this.certification = certification;
    }
}

export class RatingDataPointImpl implements RatingDataPoint {
    timestamp: u64;
    rating: QualityRating;
    metrics: QualityMetrics;

    constructor(
        timestamp: u64 = 0n,
        rating: QualityRating = new QualityRatingImpl(),
        metrics: QualityMetrics = new QualityMetricsImpl()
    ) {
        this.timestamp = timestamp;
        this.rating = rating;
        this.metrics = metrics;
    }
}

export class RatingDisputeImpl implements RatingDispute {
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

    constructor(
        disputeId: u64 = 0n,
        energySourceId: Address = "",
        disputedRating: QualityRating = new QualityRatingImpl(),
        complainant: Address = "",
        reason: string = "",
        evidence: Vec<string> = [],
        status: DisputeStatus = DisputeStatus.PENDING,
        filedAt: u64 = 0n,
        resolvedAt: u64 = 0n,
        resolution: DisputeResolution = {
            action: DisputeAction.NO_CHANGE,
            explanation: ""
        }
    ) {
        this.disputeId = disputeId;
        this.energySourceId = energySourceId;
        this.disputedRating = disputedRating;
        this.complainant = complainant;
        this.reason = reason;
        this.evidence = evidence;
        this.status = status;
        this.filedAt = filedAt;
        this.resolvedAt = resolvedAt;
        this.resolution = resolution;
    }
}

// Configuration structures
export class RatingWeightsImpl implements RatingWeights {
    renewableWeight: u64;
    carbonWeight: u64;
    reliabilityWeight: u64;
    efficiencyWeight: u64;
    availabilityWeight: u64;

    constructor(
        renewableWeight: u64 = 3000n, // 30%
        carbonWeight: u64 = 2500n,    // 25%
        reliabilityWeight: u64 = 2000n, // 20%
        efficiencyWeight: u64 = 1500n,   // 15%
        availabilityWeight: u64 = 1000n  // 10%
    ) {
        this.renewableWeight = renewableWeight;
        this.carbonWeight = carbonWeight;
        this.reliabilityWeight = reliabilityWeight;
        this.efficiencyWeight = efficiencyWeight;
        this.availabilityWeight = availabilityWeight;
    }

    validate(): Bool {
        const total = this.renewableWeight + this.carbonWeight + 
                     this.reliabilityWeight + this.efficiencyWeight + 
                     this.availabilityWeight;
        return total === 10000n; // Must sum to 100%
    }
}

export class RatingThresholdsImpl implements RatingThresholds {
    minimumRenewable: u64;
    maximumCarbonFootprint: u64;
    minimumReliability: u64;
    minimumEfficiency: u64;
    minimumAvailability: u64;
    anomalyDetectionThreshold: u64;

    constructor(
        minimumRenewable: u64 = 1000n,      // 10%
        maximumCarbonFootprint: u64 = 500n, // 500 gCO2/kWh
        minimumReliability: u64 = 70n,      // 70%
        minimumEfficiency: u64 = 8000n,    // 80%
        minimumAvailability: u64 = 9000n,  // 90%
        anomalyDetectionThreshold: u64 = 2000n // 20%
    ) {
        this.minimumRenewable = minimumRenewable;
        this.maximumCarbonFootprint = maximumCarbonFootprint;
        this.minimumReliability = minimumReliability;
        this.minimumEfficiency = minimumEfficiency;
        this.minimumAvailability = minimumAvailability;
        this.anomalyDetectionThreshold = anomalyDetectionThreshold;
    }
}

export class DisputeConfigImpl implements DisputeConfig {
    disputeFee: u128;
    maxDisputeDuration: u64;
    minEvidenceRequired: u64;
    autoResolveThreshold: u64;

    constructor(
        disputeFee: u128 = 1000000000000000n, // 0.001 ETH
        maxDisputeDuration: u64 = 604800n,    // 7 days
        minEvidenceRequired: u64 = 1n,
        autoResolveThreshold: u64 = 8000n     // 80%
    ) {
        this.disputeFee = disputeFee;
        this.maxDisputeDuration = maxDisputeDuration;
        this.minEvidenceRequired = minEvidenceRequired;
        this.autoResolveThreshold = autoResolveThreshold;
    }
}

export class OracleConfigImpl implements OracleConfig {
    minimumReputation: i64;
    maxSubmissionsPerDay: u64;
    signatureVerification: Bool;
    aggregationMethod: AggregationMethod;

    constructor(
        minimumReputation: i64 = 0n,
        maxSubmissionsPerDay: u64 = 100n,
        signatureVerification: Bool = true,
        aggregationMethod: AggregationMethod = AggregationMethod.REPUTATION_WEIGHTED
    ) {
        this.minimumReputation = minimumReputation;
        this.maxSubmissionsPerDay = maxSubmissionsPerDay;
        this.signatureVerification = signatureVerification;
        this.aggregationMethod = aggregationMethod;
    }
}

export class RatingConfigImpl implements RatingConfig {
    weights: RatingWeights;
    thresholds: RatingThresholds;
    disputeConfig: DisputeConfig;
    oracleConfig: OracleConfig;

    constructor(
        weights: RatingWeights = new RatingWeightsImpl(),
        thresholds: RatingThresholds = new RatingThresholdsImpl(),
        disputeConfig: DisputeConfig = new DisputeConfigImpl(),
        oracleConfig: OracleConfig = new OracleConfigImpl()
    ) {
        this.weights = weights;
        this.thresholds = thresholds;
        this.disputeConfig = disputeConfig;
        this.oracleConfig = oracleConfig;
    }

    validate(): Bool {
        return this.weights.validate();
    }
}

// Registry structures
export class QualityOracle {
    address: Address;
    metadata: OracleMetadata;
    isActive: Bool;
    registeredAt: u64;
    lastSubmissionTime: u64;
    dailySubmissionCount: u64;
    totalSubmissions: u64;
    successfulSubmissions: u64;
    reputation: i64;

    constructor(
        address: Address = "",
        metadata: OracleMetadata = new OracleMetadataImpl(),
        isActive: Bool = true,
        registeredAt: u64 = 0n,
        lastSubmissionTime: u64 = 0n,
        dailySubmissionCount: u64 = 0n,
        totalSubmissions: u64 = 0n,
        successfulSubmissions: u64 = 0n,
        reputation: i64 = 0n
    ) {
        this.address = address;
        this.metadata = metadata;
        this.isActive = isActive;
        this.registeredAt = registeredAt;
        this.lastSubmissionTime = lastSubmissionTime;
        this.dailySubmissionCount = dailySubmissionCount;
        this.totalSubmissions = totalSubmissions;
        this.successfulSubmissions = successfulSubmissions;
        this.reputation = reputation;
    }
}

export class RatingHistory {
    energySourceId: Address;
    ratings: Vec<RatingDataPoint>;
    maxHistorySize: u64;

    constructor(
        energySourceId: Address = "",
        maxHistorySize: u64 = 1000n
    ) {
        this.energySourceId = energySourceId;
        this.ratings = [];
        this.maxHistorySize = maxHistorySize;
    }

    addRating(dataPoint: RatingDataPoint): void {
        this.ratings.push(dataPoint);
        
        // Keep only the most recent ratings
        if (this.ratings.length > Number(this.maxHistorySize)) {
            this.ratings = this.ratings.slice(-Number(this.maxHistorySize));
        }
    }

    getLatestRating(): QualityRating | null {
        if (this.ratings.length === 0) return null;
        return this.ratings[this.ratings.length - 1].rating;
    }

    getAverageRating(days: u64): u64 {
        if (this.ratings.length === 0) return 0n;
        
        const cutoffTime = Date.now() / 1000 - Number(days * 86400n);
        const recentRatings = this.ratings.filter(rp => rp.timestamp >= cutoffTime);
        
        if (recentRatings.length === 0) return 0n;
        
        const sum = recentRatings.reduce((acc, rp) => acc + rp.rating.overallScore, 0n);
        return sum / BigInt(recentRatings.length);
    }
}

export class OracleRegistry {
    oracles: Map<Address, QualityOracle>;
    activeOracles: Vec<Address>;

    constructor() {
        this.oracles = new Map();
        this.activeOracles = [];
    }

    registerOracle(address: Address, metadata: OracleMetadata): void {
        const oracle = new QualityOracle(
            address,
            metadata,
            true,
            BigInt(Math.floor(Date.now() / 1000))
        );
        
        this.oracles.set(address, oracle);
        this.activeOracles.push(address);
    }

    getOracle(address: Address): QualityOracle | null {
        return this.oracles.get(address) || null;
    }

    deactivateOracle(address: Address): void {
        const oracle = this.oracles.get(address);
        if (oracle) {
            oracle.isActive = false;
            this.activeOracles = this.activeOracles.filter(addr => addr !== address);
        }
    }

    getActiveOracles(): Vec<Address> {
        return this.activeOracles.filter(addr => {
            const oracle = this.oracles.get(addr);
            return oracle && oracle.isActive;
        });
    }
}
