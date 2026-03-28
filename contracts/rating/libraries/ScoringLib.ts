import { QualityMetrics, QualityRating, RatingWeights, RatingThresholds } from '../interfaces/IQualityRating';
import { QualityMetricsImpl, QualityRatingImpl } from '../structures/RatingStructure';
import { Address, u128, u64, i64, Bool, Vec } from '../structures/RatingStructure';

/**
 * ScoringLib - Library for calculating energy quality scores
 * Implements fair and transparent scoring algorithms for multiple quality metrics
 */
export class ScoringLib {
    
    /**
     * Calculate overall quality score from individual metrics
     * Uses weighted average approach with configurable weights
     */
    static calculateOverallScore(
        metrics: QualityMetrics,
        weights: RatingWeights
    ): u64 {
        const renewableScore = BigInt(this.calculateRenewableScore(metrics.renewablePercentage));
        const carbonScore = BigInt(this.calculateCarbonScore(metrics.carbonFootprint));
        const reliabilityScore = BigInt(this.calculateReliabilityScore(metrics.reliabilityScore));
        const efficiencyScore = BigInt(this.calculateEfficiencyScore(metrics.efficiency));
        const availabilityScore = BigInt(this.calculateAvailabilityScore(metrics.availability));

        // Weighted average calculation (all values in basis points)
        const renewableWeight = Number(weights.renewableWeight);
        const carbonWeight = Number(weights.carbonWeight);
        const reliabilityWeight = Number(weights.reliabilityWeight);
        const efficiencyWeight = Number(weights.efficiencyWeight);
        const availabilityWeight = Number(weights.availabilityWeight);
        
        const weightedSum = 
            (renewableScore * renewableWeight) +
            (carbonScore * carbonWeight) +
            (reliabilityScore * reliabilityWeight) +
            (efficiencyScore * efficiencyWeight) +
            (availabilityScore * availabilityWeight);

        return BigInt(Math.floor(weightedSum / 10000)); // Divide by total weight (100%)
    }

    /**
     * Calculate renewable energy score (0-10000 basis points)
     * Higher renewable percentage = higher score
     */
    static calculateRenewableScore(renewablePercentage: u64): number {
        // Direct mapping: 0% renewable = 0 score, 100% renewable = 10000 score
        return Math.min(Number(renewablePercentage), 10000);
    }

    /**
     * Calculate carbon footprint score (0-10000 basis points)
     * Lower carbon footprint = higher score
     * Uses inverse logarithmic scaling
     */
    static calculateCarbonScore(carbonFootprint: u64): number {
        if (carbonFootprint === 0n) return 10000; // Zero carbon = perfect score
        
        // Reference: 500 gCO2/kWh = 5000 score (50%)
        // Uses logarithmic scaling for better distribution
        const reference = 500n; // gCO2/kWh
        const maxScore = 10000n;
        
        if (carbonFootprint <= reference) {
            return Number(maxScore - (carbonFootprint * maxScore) / (reference * 2n));
        } else {
            // Logarithmic penalty for high carbon footprint
            const ratio = Number(carbonFootprint / reference);
            const penalty = Math.log10(ratio) * 2000; // Logarithmic penalty
            return Math.max(0, Number(maxScore - BigInt(Math.floor(penalty * 100))));
        }
    }

    /**
     * Calculate reliability score (0-10000 basis points)
     * Direct mapping from reliability percentage
     */
    static calculateReliabilityScore(reliabilityScore: u64): number {
        // Convert from 0-100 scale to 0-10000 scale
        return Number(reliabilityScore * 100n);
    }

    /**
     * Calculate efficiency score (0-10000 basis points)
     * Higher efficiency = higher score
     */
    static calculateEfficiencyScore(efficiency: u64): number {
        // Direct mapping: already in basis points
        return Math.min(Number(efficiency), 10000);
    }

    /**
     * Calculate availability score (0-10000 basis points)
     * Higher availability = higher score
     */
    static calculateAvailabilityScore(availability: u64): number {
        // Direct mapping: already in basis points
        return Math.min(Number(availability), 10000);
    }

    /**
     * Calculate confidence score based on oracle reputation and data freshness
     */
    static calculateConfidenceScore(
        oracleReputation: i64,
        dataAge: u64, // seconds since data collection
        certificationLevel: u64
    ): u64 {
        let confidence = 5000n; // Base confidence (50%)

        // Reputation factor (-1000 to +1000 basis points)
        const reputationFactor = BigInt(Math.min(Math.max(Number(oracleReputation), -1000), 1000));
        confidence += reputationFactor;

        // Data freshness factor (newer data = higher confidence)
        const maxAge = 86400n; // 24 hours
        if (dataAge < maxAge) {
            const freshnessBonus = ((maxAge - dataAge) * 2000n) / maxAge;
            confidence += freshnessBonus;
        }

        // Certification level factor (0-10 scale)
        const certificationBonus = certificationLevel * 100n; // Max 1000 basis points
        confidence += certificationBonus;

        return BigInt(Math.min(Math.max(Number(confidence), 0), 10000));
    }

    /**
     * Calculate pricing multiplier based on quality score
     * Higher quality = premium pricing multiplier
     */
    static calculatePricingMultiplier(qualityScore: u64): u128 {
        // Base multiplier: 1.0x (10000 basis points)
        const baseMultiplier = 10000n;
        
        // Premium scaling: 80-100 score gets 1.0x to 2.0x multiplier
        // Below 80 gets reduced multiplier down to 0.5x
        if (qualityScore >= 8000n) {
            // Premium tier: 1.0x to 2.0x
            const premiumBonus = ((qualityScore - 8000n) * 10000n) / 2000n;
            return baseMultiplier + premiumBonus;
        } else {
            // Discount tier: 0.5x to 1.0x
            const discount = ((8000n - qualityScore) * 5000n) / 8000n;
            return baseMultiplier - discount;
        }
    }

    /**
     * Validate quality metrics against thresholds
     */
    static validateMetrics(
        metrics: QualityMetrics,
        thresholds: RatingThresholds
    ): Bool {
        return (
            metrics.renewablePercentage >= thresholds.minimumRenewable &&
            metrics.carbonFootprint <= thresholds.maximumCarbonFootprint &&
            metrics.reliabilityScore >= thresholds.minimumReliability &&
            metrics.efficiency >= thresholds.minimumEfficiency &&
            metrics.availability >= thresholds.minimumAvailability
        );
    }

    /**
     * Detect rating anomalies using statistical methods
     */
    static detectAnomaly(
        newRating: QualityRating,
        historicalRatings: Vec<QualityRating>,
        threshold: u64
    ): Bool {
        if (historicalRatings.length < 3) return false; // Need sufficient history

        // Calculate moving average of recent ratings
        const recentRatings = historicalRatings.slice(-10); // Last 10 ratings
        const averageScore = recentRatings.reduce((sum, r) => sum + r.overallScore, 0n) / BigInt(recentRatings.length);

        // Calculate percentage difference
        const difference = newRating.overallScore > averageScore 
            ? newRating.overallScore - averageScore
            : averageScore - newRating.overallScore;
        
        const percentageDifference = (difference * 10000n) / averageScore;

        return percentageDifference > threshold;
    }

    /**
     * Aggregate multiple ratings using specified method
     */
    static aggregateRatings(
        ratings: Vec<QualityRating>,
        method: string,
        oracleReputations: Map<Address, i64>
    ): QualityRating {
        if (ratings.length === 0) {
            return new QualityRatingImpl();
        }

        if (ratings.length === 1) {
            return ratings[0];
        }

        switch (method) {
            case 'WEIGHTED_AVERAGE':
                return this.weightedAverageAggregation(ratings);
            case 'MEDIAN':
                return this.medianAggregation(ratings);
            case 'REPUTATION_WEIGHTED':
                return this.reputationWeightedAggregation(ratings, oracleReputations);
            default:
                return this.weightedAverageAggregation(ratings);
        }
    }

    /**
     * Weighted average aggregation (equal weights)
     */
    private static weightedAverageAggregation(ratings: Vec<QualityRating>): QualityRating {
        const count = BigInt(ratings.length);
        
        const overallScore = ratings.reduce((sum, r) => sum + r.overallScore, 0n) / count;
        const renewableScore = ratings.reduce((sum, r) => sum + r.renewableScore, 0n) / count;
        const carbonScore = ratings.reduce((sum, r) => sum + r.carbonScore, 0n) / count;
        const reliabilityScore = ratings.reduce((sum, r) => sum + r.reliabilityScore, 0n) / count;
        const efficiencyScore = ratings.reduce((sum, r) => sum + r.efficiencyScore, 0n) / count;
        const availabilityScore = ratings.reduce((sum, r) => sum + r.availabilityScore, 0n) / count;
        const confidence = ratings.reduce((sum, r) => sum + r.confidence, 0n) / count;

        return new QualityRatingImpl(
            ratings[0].energySourceId,
            overallScore,
            renewableScore,
            carbonScore,
            reliabilityScore,
            efficiencyScore,
            availabilityScore,
            ratings[0].timestamp,
            ratings[0].oracleId,
            confidence,
            this.calculatePricingMultiplier(overallScore)
        );
    }

    /**
     * Median aggregation
     */
    private static medianAggregation(ratings: Vec<QualityRating>): QualityRating {
        const sortedRatings = [...ratings].sort((a, b) => 
            Number(a.overallScore - b.overallScore)
        );
        
        const median = sortedRatings[Math.floor(sortedRatings.length / 2)];
        
        return new QualityRatingImpl(
            median.energySourceId,
            median.overallScore,
            median.renewableScore,
            median.carbonScore,
            median.reliabilityScore,
            median.efficiencyScore,
            median.availabilityScore,
            median.timestamp,
            median.oracleId,
            median.confidence,
            this.calculatePricingMultiplier(median.overallScore)
        );
    }

    /**
     * Reputation-weighted aggregation
     */
    private static reputationWeightedAggregation(
        ratings: Vec<QualityRating>,
        oracleReputations: Map<Address, i64>
    ): QualityRating {
        let totalWeight = 0n;
        let weightedOverall = 0n;
        let weightedRenewable = 0n;
        let weightedCarbon = 0n;
        let weightedReliability = 0n;
        let weightedEfficiency = 0n;
        let weightedAvailability = 0n;
        let weightedConfidence = 0n;

        for (const rating of ratings) {
            const reputation = oracleReputations.get(rating.oracleId) || 0n;
            const weight = BigInt(Math.max(Number(reputation + 1000n), 100)); // Minimum weight to avoid zero
            
            totalWeight += weight;
            weightedOverall += rating.overallScore * weight;
            weightedRenewable += rating.renewableScore * weight;
            weightedCarbon += rating.carbonScore * weight;
            weightedReliability += rating.reliabilityScore * weight;
            weightedEfficiency += rating.efficiencyScore * weight;
            weightedAvailability += rating.availabilityScore * weight;
            weightedConfidence += rating.confidence * weight;
        }

        return new QualityRatingImpl(
            ratings[0].energySourceId,
            weightedOverall / totalWeight,
            weightedRenewable / totalWeight,
            weightedCarbon / totalWeight,
            weightedReliability / totalWeight,
            weightedEfficiency / totalWeight,
            weightedAvailability / totalWeight,
            ratings[0].timestamp,
            ratings[0].oracleId,
            weightedConfidence / totalWeight,
            this.calculatePricingMultiplier(weightedOverall / totalWeight)
        );
    }

    /**
     * Calculate trend analysis for historical ratings
     */
    static calculateTrend(
        historicalRatings: Vec<QualityRating>,
        periodDays: u64
    ): 'improving' | 'declining' | 'stable' {
        if (historicalRatings.length < 2) return 'stable';

        const cutoffTime = BigInt(Math.floor(Date.now() / 1000)) - (periodDays * 86400n);
        const recentRatings = historicalRatings.filter(r => r.timestamp >= cutoffTime);

        if (recentRatings.length < 2) return 'stable';

        // Simple linear regression to determine trend
        const n = BigInt(recentRatings.length);
        let sumX = 0n;
        let sumY = 0n;
        let sumXY = 0n;
        let sumX2 = 0n;

        recentRatings.forEach((rating, index) => {
            const x = BigInt(index);
            const y = rating.overallScore;
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        if (slope > 50n) return 'improving'; // Positive trend
        if (slope < -50n) return 'declining'; // Negative trend
        return 'stable';
    }

    /**
     * Gas-optimized scoring calculation for batch operations
     */
    static batchCalculateScores(
        metricsArray: Vec<QualityMetrics>,
        weights: RatingWeights
    ): Vec<u64> {
        return metricsArray.map(metrics => 
            this.calculateOverallScore(metrics, weights)
        );
    }
}
