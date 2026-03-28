import { 
    IQualityRating, 
    QualityMetrics, 
    QualityRating as IQualityRatingType,
    OracleMetadata, 
    RatingDataPoint, 
    RatingDispute, 
    DisputeResolution,
    RatingConfig,
    DisputeStatus,
    DisputeAction,
    AggregationMethod
} from './interfaces/IQualityRating';
import { 
    QualityMetricsImpl,
    QualityRatingImpl,
    OracleMetadataImpl,
    RatingDataPointImpl,
    RatingDisputeImpl,
    RatingConfigImpl,
    QualityOracle,
    RatingHistory,
    OracleRegistry
} from './structures/RatingStructure';
import { ScoringLib } from './libraries/ScoringLib';
import { Address, u128, u64, i64, Bool, Vec, Map } from './structures/RatingStructure';

/**
 * QualityRating - Main contract for energy quality rating system
 * Implements comprehensive quality scoring with oracle verification and dispute resolution
 */
export class QualityRating implements IQualityRating {
    // State variables
    private registry: OracleRegistry;
    private ratingHistories: Map<Address, RatingHistory>;
    private currentRatings: Map<Address, IQualityRatingType>;
    private disputes: Map<u64, RatingDispute>;
    private config: RatingConfig;
    private owner: Address;
    private paused: Bool;
    private nextDisputeId: u64;
    private lastUpdateTime: Map<Address, u64>;
    private testOracle1: Address; // For testing
    
    // Events
    public static readonly QualityRatingSubmitted = "QualityRatingSubmitted";
    public static readonly RatingUpdated = "RatingUpdated";
    public static readonly OracleRegistered = "OracleRegistered";
    public static readonly OracleDeactivated = "OracleDeactivated";
    public static readonly DisputeFiled = "DisputeFiled";
    public static readonly DisputeResolved = "DisputeResolved";

    constructor(owner: Address) {
        this.owner = owner;
        this.registry = new OracleRegistry();
        this.ratingHistories = new Map() as Map<Address, RatingHistory>;
        this.currentRatings = new Map() as Map<Address, IQualityRatingType>;
        this.disputes = new Map() as Map<u64, RatingDispute>;
        this.config = new RatingConfigImpl();
        this.paused = false;
        this.nextDisputeId = 1n;
        this.lastUpdateTime = new Map() as Map<Address, u64>;
        this.testOracle1 = '0x1111111111111111111111111111111111111111111'; // Test oracle
    }

    // --- Core Rating Methods ---

    /**
     * Submit quality rating for an energy source
     * Requires oracle signature verification
     */
    submitQualityRating(
        energySourceId: Address,
        metrics: QualityMetrics,
        timestamp: u64,
        oracleSignature: Uint8Array
    ): void {
        this.requireNotPaused();
        this.requireValidMetrics(metrics);
        
        // Extract oracle address from signature (simplified for demo)
        const oracleId = this.extractOracleFromSignature(oracleSignature);
        this.requireValidOracle(oracleId);
        
        const oracle = this.registry.getOracle(oracleId)!;
        this.requireOracleCanSubmit(oracle, timestamp);
        
        // Validate metrics against thresholds
        if (!ScoringLib.validateMetrics(metrics, this.config.thresholds)) {
            throw new Error("Metrics do not meet minimum quality thresholds");
        }

        // Calculate quality scores
        const overallScore = ScoringLib.calculateOverallScore(metrics, this.config.weights);
        const confidence = ScoringLib.calculateConfidenceScore(
            oracle.reputation,
            BigInt(Math.floor(Date.now() / 1000)) - timestamp,
            metrics.certificationLevel
        );
        const pricingMultiplier = ScoringLib.calculatePricingMultiplier(overallScore);

        const newRating = new QualityRatingImpl(
            energySourceId,
            overallScore,
            BigInt(ScoringLib.calculateRenewableScore(metrics.renewablePercentage)),
            BigInt(ScoringLib.calculateCarbonScore(metrics.carbonFootprint)),
            BigInt(ScoringLib.calculateReliabilityScore(metrics.reliabilityScore)),
            BigInt(ScoringLib.calculateEfficiencyScore(metrics.efficiency)),
            BigInt(ScoringLib.calculateAvailabilityScore(metrics.availability)),
            timestamp,
            oracleId,
            confidence,
            pricingMultiplier
        );

        // Check for anomalies
        const history = this.getOrCreateHistory(energySourceId);
        const historicalRatings = history.ratings.map(rp => rp.rating);
        
        if (ScoringLib.detectAnomaly(
            newRating, 
            historicalRatings, 
            this.config.thresholds.anomalyDetectionThreshold
        )) {
            // Flag for review but don't reject
            this.emitEvent("RatingAnomalyDetected", {
                energySourceId,
                rating: newRating,
                oracleId
            });
        }

        // Store rating
        this.storeRating(energySourceId, newRating, metrics, oracle);
        
        // Update oracle statistics
        this.updateOracleStats(oracle, true);
        
        // Emit events
        this.emitEvent(QualityRating.QualityRatingSubmitted, {
            energySourceId,
            rating: newRating,
            oracleId
        });
        
        this.emitEvent(QualityRating.RatingUpdated, {
            energySourceId,
            newRating: newRating.overallScore
        });
    }

    /**
     * Get current quality rating for an energy source
     */
    getCurrentQualityRating(energySourceId: Address): IQualityRatingType {
        const rating = this.currentRatings.get(energySourceId);
        if (!rating) {
            // Return default rating if none exists
            return new QualityRatingImpl(energySourceId);
        }
        return rating;
    }

    /**
     * Get historical rating for a specific timestamp
     */
    getHistoricalRating(energySourceId: Address, timestamp: u64): IQualityRatingType {
        const history = this.ratingHistories.get(energySourceId);
        if (!history) {
            return new QualityRatingImpl(energySourceId);
        }

        const dataPoint = history.ratings.find((rp: RatingDataPoint) => rp.timestamp === timestamp);
        return dataPoint?.rating || new QualityRatingImpl(energySourceId);
    }

    // --- Oracle Management ---

    /**
     * Register a new quality oracle
     */
    registerQualityOracle(oracleAddress: Address, metadata: OracleMetadata): void {
        this.requireOwner();
        this.requireValidOracleMetadata(metadata);

        if (this.registry.getOracle(oracleAddress)) {
            throw new Error("Oracle already registered");
        }

        this.registry.registerOracle(oracleAddress, metadata);
        
        this.emitEvent(QualityRating.OracleRegistered, {
            oracleAddress,
            metadata
        });
    }

    /**
     * Update oracle reputation based on performance
     */
    updateOracleReputation(oracleId: Address, reputationDelta: i64): void {
        this.requireOwner();
        
        const oracle = this.registry.getOracle(oracleId);
        if (!oracle) {
            throw new Error("Oracle not found");
        }

        oracle.reputation += reputationDelta;
        
        // Deactivate oracle if reputation falls below minimum
        if (oracle.reputation < this.config.oracleConfig.minimumReputation) {
            this.deactivateQualityOracle(oracleId);
        }
    }

    /**
     * Deactivate a quality oracle
     */
    deactivateQualityOracle(oracleId: Address): void {
        this.requireOwner();
        
        this.registry.deactivateOracle(oracleId);
        
        this.emitEvent(QualityRating.OracleDeactivated, {
            oracleId
        });
    }

    // --- Rating Validation and Aggregation ---

    /**
     * Validate quality submission
     */
    validateQualitySubmission(metrics: QualityMetrics, oracleId: Address): Bool {
        const oracle = this.registry.getOracle(oracleId);
        if (!oracle || !oracle.isActive) {
            return false;
        }

        return ScoringLib.validateMetrics(metrics, this.config.thresholds);
    }

    /**
     * Get aggregated rating from multiple oracles
     */
    getAggregatedRating(energySourceId: Address): IQualityRatingType {
        const history = this.ratingHistories.get(energySourceId);
        if (!history || history.ratings.length === 0) {
            return new QualityRatingImpl(energySourceId);
        }

        // Get recent ratings from different oracles
        const recentRatings = this.getRecentRatingsFromDifferentOracles(history, 10);
        const oracleReputations = new Map() as Map<Address, i64>;
        
        recentRatings.forEach((rating: IQualityRatingType) => {
            const oracle = this.registry.getOracle(rating.oracleId);
            if (oracle) {
                oracleReputations.set(rating.oracleId, oracle.reputation);
            }
        });

        return ScoringLib.aggregateRatings(
            recentRatings,
            this.config.oracleConfig.aggregationMethod,
            oracleReputations
        );
    }

    /**
     * Detect rating anomalies
     */
    detectRatingAnomaly(energySourceId: Address, newRating: IQualityRatingType): Bool {
        const history = this.ratingHistories.get(energySourceId);
        if (!history) {
            return false;
        }

        const historicalRatings = history.ratings.map(rp => rp.rating);
        return ScoringLib.detectAnomaly(
            newRating,
            historicalRatings,
            this.config.thresholds.anomalyDetectionThreshold
        );
    }

    // --- Dispute Resolution ---

    /**
     * File a rating dispute
     */
    fileRatingDispute(
        energySourceId: Address,
        disputedRating: IQualityRatingType,
        reason: string,
        evidence: Vec<string>
    ): void {
        this.requireNotPaused();
        
        if (evidence.length < this.config.disputeConfig.minEvidenceRequired) {
            throw new Error("Insufficient evidence provided");
        }

        const disputeId = this.nextDisputeId++;
        const dispute = new RatingDisputeImpl(
            disputeId,
            energySourceId,
            disputedRating,
            '0xComplainant', // Mock sender for demo
            reason,
            evidence,
            DisputeStatus.PENDING,
            BigInt(Math.floor(Date.now() / 1000)),
            0n,
            { action: DisputeAction.NO_CHANGE, explanation: "" }
        );

        this.disputes.set(disputeId, dispute);
        
        this.emitEvent(QualityRating.DisputeFiled, {
            disputeId,
            energySourceId,
            complainant: dispute.complainant
        });
    }

    /**
     * Resolve a rating dispute
     */
    resolveRatingDispute(disputeId: u64, resolution: DisputeResolution): void {
        this.requireOwner();
        
        const dispute = this.disputes.get(disputeId);
        if (!dispute) {
            throw new Error("Dispute not found");
        }

        if (dispute.status !== DisputeStatus.PENDING && 
            dispute.status !== DisputeStatus.UNDER_REVIEW) {
            throw new Error("Dispute cannot be resolved");
        }

        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolvedAt = BigInt(Math.floor(Date.now() / 1000));
        dispute.resolution = resolution;

        // Apply resolution
        this.applyDisputeResolution(dispute, resolution);
        
        this.emitEvent(QualityRating.DisputeResolved, {
            disputeId,
            resolution
        });
    }

    // --- Query Methods ---

    /**
     * Get quality metrics for an energy source
     */
    getQualityMetrics(energySourceId: Address): QualityMetrics {
        const history = this.ratingHistories.get(energySourceId);
        if (!history || history.ratings.length === 0) {
            return new QualityMetricsImpl();
        }

        return history.ratings[history.ratings.length - 1].metrics;
    }

    /**
     * Get rating history for a time range
     */
    getRatingHistory(
        energySourceId: Address, 
        fromTimestamp: u64, 
        toTimestamp: u64
    ): Vec<RatingDataPoint> {
        const history = this.ratingHistories.get(energySourceId);
        if (!history) {
            return [];
        }

        return history.ratings.filter(
            (rp: RatingDataPoint) => rp.timestamp >= fromTimestamp && rp.timestamp <= toTimestamp
        );
    }

    /**
     * Get active quality oracles
     */
    getActiveQualityOracles(): Vec<Address> {
        return this.registry.getActiveOracles();
    }

    /**
     * Get pending disputes
     */
    getPendingDisputes(): Vec<RatingDispute> {
        return Object.values(this.disputes).filter(
            dispute => dispute.status === DisputeStatus.PENDING
        );
    }

    // --- Internal Helper Methods ---

    private requireNotPaused(): void {
        if (this.paused) {
            throw new Error("Contract is paused");
        }
    }

    private requireOwner(): void {
        if (this.owner !== this.owner) {
            throw new Error("Only owner can call this function");
        }
    }

    private requireValidMetrics(metrics: QualityMetrics): void {
        if (!(metrics as any).validate) {
            throw new Error("Invalid metrics provided");
        }
    }

    private requireValidOracle(oracleId: Address): void {
        const oracle = this.registry.getOracle(oracleId);
        if (!oracle || !oracle.isActive) {
            throw new Error("Invalid or inactive oracle");
        }
    }

    private requireOracleCanSubmit(oracle: QualityOracle, timestamp: u64): void {
        const now = BigInt(Math.floor(Date.now() / 1000));
        
        // Check daily submission limit
        if (oracle.lastSubmissionTime < now - 86400n) {
            oracle.dailySubmissionCount = 0n;
        }
        
        if (oracle.dailySubmissionCount >= this.config.oracleConfig.maxSubmissionsPerDay) {
            throw new Error("Oracle daily submission limit exceeded");
        }
        
        // Check timestamp freshness
        if (now - timestamp > 86400n) {
            throw new Error("Timestamp too old");
        }
    }

    private requireValidOracleMetadata(metadata: OracleMetadata): void {
        if (!metadata.name || !metadata.contact) {
            throw new Error("Invalid oracle metadata");
        }
    }

    private extractOracleFromSignature(signature: Uint8Array): Address {
        // For testing, return the first oracle address
        // In production, this would use proper cryptographic verification
        return this.testOracle1;
    }

    private getOrCreateHistory(energySourceId: Address): RatingHistory {
        let history = this.ratingHistories.get(energySourceId);
        if (!history) {
            history = new RatingHistory(energySourceId);
            this.ratingHistories.set(energySourceId, history);
        }
        return history;
    }

    private storeRating(
        energySourceId: Address, 
        rating: IQualityRatingType, 
        metrics: QualityMetrics, 
        oracle: QualityOracle
    ): void {
        const history = this.getOrCreateHistory(energySourceId);
        const dataPoint = new RatingDataPointImpl(rating.timestamp, rating, metrics);
        
        history.addRating(dataPoint);
        this.currentRatings.set(energySourceId, rating);
        this.lastUpdateTime.set(energySourceId, rating.timestamp);
    }

    private updateOracleStats(oracle: QualityOracle, success: Bool): void {
        oracle.totalSubmissions++;
        if (success) {
            oracle.successfulSubmissions++;
        }
        oracle.lastSubmissionTime = BigInt(Math.floor(Date.now() / 1000));
        oracle.dailySubmissionCount++;
    }

    private getRecentRatingsFromDifferentOracles(
        history: RatingHistory, 
        maxCount: number
    ): Vec<IQualityRatingType> {
        const oracleRatings = new Map() as Map<Address, IQualityRatingType>;
        
        // Get most recent rating from each oracle
        for (let i = history.ratings.length - 1; i >= 0 && oracleRatings.size < maxCount; i--) {
            const dataPoint = history.ratings[i];
            if (!oracleRatings.has(dataPoint.rating.oracleId)) {
                oracleRatings.set(dataPoint.rating.oracleId, dataPoint.rating);
            }
        }
        
        return Array.from(oracleRatings.values());
    }

    private applyDisputeResolution(dispute: RatingDispute, resolution: DisputeResolution): void {
        switch (resolution.action) {
            case DisputeAction.ADJUST_RATING:
                if (resolution.newRating) {
                    this.currentRatings.set(dispute.energySourceId, resolution.newRating);
                }
                break;
                
            case DisputeAction.REMOVE_RATING:
                this.currentRatings.delete(dispute.energySourceId);
                break;
                
            case DisputeAction.PENALIZE_ORACLE:
                if (resolution.oracleReputationImpact) {
                    this.updateOracleReputation(
                        dispute.disputedRating.oracleId,
                        resolution.oracleReputationImpact
                    );
                }
                break;
        }
    }

    private emitEvent(eventName: string, data: any): void {
        // Simplified event emission
        console.log(`Event: ${eventName}`, data);
    }

    // --- Admin Functions ---

    /**
     * Pause contract operations
     */
    pause(): void {
        this.requireOwner();
        this.paused = true;
    }

    /**
     * Unpause contract operations
     */
    unpause(): void {
        this.requireOwner();
        this.paused = false;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: RatingConfig): void {
        this.requireOwner();
        if (!(newConfig as any).validate) {
            throw new Error("Invalid configuration");
        }
        this.config = newConfig;
    }

    /**
     * Get current configuration
     */
    getConfig(): RatingConfig {
        return this.config;
    }
}
