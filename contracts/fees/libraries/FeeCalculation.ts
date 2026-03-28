import { FeeType, FeeStructure, FeeTier, FeeExemption, FeeCalculationContext } from '../structures/FeeStructure';

export interface FeeCalculationResult {
    totalFee: number;
    baseFee: number;
    dynamicAdjustment: number;
    volumeDiscount: number;
    exemptionDiscount: number;
    effectiveRate: number; // In basis points
    tierUsed?: string;
    breakdown: {
        fixed: number;
        percentage: number;
        adjustments: Array<{
            type: 'DYNAMIC' | 'VOLUME' | 'EXEMPTION';
            amount: number;
            description: string;
        }>;
    };
    gasEstimate: number;
}

export class FeeCalculation {
    private static readonly BASIS_POINTS = 10000;
    private static readonly GAS_BASE = 21000;
    private static readonly GAS_PER_CALCULATION = 5000;

    /**
     * Calculate fee based on structure, context, and various adjustments
     */
    public static calculateFee(
        structure: FeeStructure,
        context: FeeCalculationContext
    ): FeeCalculationResult {
        const baseResult = this.calculateBaseFee(structure, context.amount);
        const dynamicAdjustment = this.calculateDynamicAdjustment(structure, context);
        const volumeDiscount = this.calculateVolumeDiscount(structure, context);
        const exemptionDiscount = this.calculateExemptionDiscount(structure, context);

        let totalFee = baseResult.fixed + baseResult.percentage;
        const adjustments: Array<{ type: 'DYNAMIC' | 'VOLUME' | 'EXEMPTION'; amount: number; description: string }> = [];

        // Apply dynamic adjustment
        if (dynamicAdjustment !== 0) {
            const adjustmentAmount = totalFee * (dynamicAdjustment / this.BASIS_POINTS);
            totalFee += adjustmentAmount;
            adjustments.push({
                type: 'DYNAMIC',
                amount: adjustmentAmount,
                description: `Network congestion adjustment: ${dynamicAdjustment / 100}%`
            });
        }

        // Apply volume discount
        if (volumeDiscount > 0) {
            const discountAmount = totalFee * (volumeDiscount / this.BASIS_POINTS);
            totalFee -= discountAmount;
            adjustments.push({
                type: 'VOLUME',
                amount: -discountAmount,
                description: `Volume discount: ${volumeDiscount / 100}%`
            });
        }

        // Apply exemption discount
        if (exemptionDiscount > 0) {
            let discountAmount: number;
            if (exemptionDiscount === Number.MAX_SAFE_INTEGER) {
                // Full exemption - waive entire fee
                discountAmount = totalFee;
                totalFee = 0; // Set to 0 directly for full exemption
            } else if (context.exemption?.exemptionType === 'FIXED') {
                discountAmount = Math.min(exemptionDiscount, totalFee);
                totalFee -= discountAmount;
            } else {
                discountAmount = totalFee * (exemptionDiscount / this.BASIS_POINTS);
                totalFee -= discountAmount;
            }
            
            // Only apply min/max constraints if not fully exempted
            if (totalFee > 0) {
                totalFee = Math.max(structure.minFee, Math.min(structure.maxFee, totalFee));
            }
            
            adjustments.push({
                type: 'EXEMPTION',
                amount: -discountAmount,
                description: `Exemption discount: ${exemptionDiscount / 100}%`
            });
        } else {
            // Apply min/max constraints if no exemption
            totalFee = Math.max(structure.minFee, Math.min(structure.maxFee, totalFee));
        }

        const effectiveRate = context.amount > 0 ? (totalFee / context.amount) * this.BASIS_POINTS : 0;

        return {
            totalFee,
            baseFee: baseResult.fixed + baseResult.percentage,
            dynamicAdjustment,
            volumeDiscount,
            exemptionDiscount,
            effectiveRate,
            tierUsed: context.userTier?.id,
            breakdown: {
                fixed: baseResult.fixed,
                percentage: baseResult.percentage,
                adjustments
            },
            gasEstimate: this.estimateGasCost(structure.feeType)
        };
    }

    /**
     * Calculate base fee without any adjustments
     */
    private static calculateBaseFee(structure: FeeStructure, amount: number): { fixed: number; percentage: number } {
        switch (structure.feeType) {
            case FeeType.FIXED:
                return { fixed: structure.baseFee, percentage: 0 };

            case FeeType.PERCENTAGE:
                return { fixed: 0, percentage: (amount * structure.percentageFee) / this.BASIS_POINTS };

            case FeeType.TIERED:
                return this.calculateTieredFee(structure, amount);

            case FeeType.HYBRID:
                return {
                    fixed: structure.baseFee,
                    percentage: (amount * structure.percentageFee) / this.BASIS_POINTS
                };

            default:
                throw new Error(`Unsupported fee type: ${structure.feeType}`);
        }
    }

    /**
     * Calculate tiered fee based on volume tiers
     */
    private static calculateTieredFee(structure: FeeStructure, amount: number): { fixed: number; percentage: number } {
        // For transactions under $100, use fixed fee
        if (amount < 100) {
            return { fixed: structure.baseFee, percentage: 0 };
        }

        // Find applicable tier
        const applicableTier = structure.tiers
            .filter(tier => amount >= tier.minVolume && (tier.maxVolume === undefined || amount <= tier.maxVolume))
            .sort((a, b) => b.priority - a.priority)[0];

        if (applicableTier) {
            const discountMultiplier = (this.BASIS_POINTS - applicableTier.discountPercentage) / this.BASIS_POINTS;
            const basePercentage = (amount * structure.percentageFee) / this.BASIS_POINTS;
            return { fixed: 0, percentage: basePercentage * discountMultiplier };
        }

        // Default to percentage fee if no tier applies
        return { fixed: 0, percentage: (amount * structure.percentageFee) / this.BASIS_POINTS };
    }

    /**
     * Calculate dynamic adjustment based on network congestion
     */
    private static calculateDynamicAdjustment(structure: FeeStructure, context: FeeCalculationContext): number {
        if (!structure.dynamicAdjustment.enabled) {
            return 0;
        }

        const congestionLevel = context.networkCongestion / 100; // Convert to 0-1 scale
        const multiplier = structure.dynamicAdjustment.congestionMultiplier;
        
        // Calculate adjustment based on congestion
        let adjustment = congestionLevel * (multiplier - 1) * this.BASIS_POINTS;
        
        // Clamp to min/max rates
        const minRate = structure.dynamicAdjustment.minRate;
        const maxRate = structure.dynamicAdjustment.maxRate;
        
        adjustment = Math.max(minRate - structure.percentageFee, Math.min(maxRate - structure.percentageFee, adjustment));
        
        return Math.round(adjustment);
    }

    /**
     * Calculate volume discount for user
     */
    private static calculateVolumeDiscount(structure: FeeStructure, context: FeeCalculationContext): number {
        const userVolume = context.userVolume;
        const thresholds = structure.volumeThresholds.discountThresholds;
        
        // Find the highest applicable discount
        let discount = 0;
        for (const threshold of thresholds) {
            if (userVolume >= threshold.volume) {
                discount = Math.max(discount, threshold.discount);
            }
        }
        
        return discount;
    }

    /**
     * Calculate exemption discount
     */
    private static calculateExemptionDiscount(structure: FeeStructure, context: FeeCalculationContext): number {
        if (!context.exemption || !context.exemption.isActive) {
            return 0;
        }

        // Check if exemption has expired
        if (context.exemption.expiresAt && context.exemption.expiresAt < context.timestamp) {
            return 0;
        }

        // For FULL exemption, return a special value to indicate full waiver
        if (context.exemption.exemptionType === 'FULL') {
            return Number.MAX_SAFE_INTEGER;
        }

        return context.exemption.value;
    }

    /**
     * Estimate gas cost for fee calculation
     */
    private static estimateGasCost(feeType: FeeType): number {
        switch (feeType) {
            case FeeType.FIXED:
                return this.GAS_BASE + this.GAS_PER_CALCULATION;
            case FeeType.PERCENTAGE:
                return this.GAS_BASE + this.GAS_PER_CALCULATION * 1.2;
            case FeeType.TIERED:
                return this.GAS_BASE + this.GAS_PER_CALCULATION * 1.5;
            case FeeType.HYBRID:
                return this.GAS_BASE + this.GAS_PER_CALCULATION * 1.3;
            default:
                return this.GAS_BASE + this.GAS_PER_CALCULATION;
        }
    }

    /**
     * Batch calculate fees for multiple transactions (gas optimization)
     */
    public static batchCalculateFees(
        structures: FeeStructure[],
        contexts: FeeCalculationContext[]
    ): FeeCalculationResult[] {
        if (structures.length !== contexts.length) {
            throw new Error('Structures and contexts arrays must have the same length');
        }

        // Batch optimization: shared calculations
        const results: FeeCalculationResult[] = [];
        const batchGasBase = this.GAS_BASE; // One-time base cost for batch
        
        for (let i = 0; i < structures.length; i++) {
            const result = this.calculateFee(structures[i], contexts[i]);
            // Reduce gas cost for batch operations (30% discount)
            result.gasEstimate = Math.round(result.gasEstimate * 0.7);
            results.push(result);
        }

        return results;
    }

    /**
     * Optimize fee calculation for common scenarios
     */
    public static optimizeFeeCalculation(
        structure: FeeStructure,
        contexts: FeeCalculationContext[]
    ): { results: FeeCalculationResult[]; optimizationMetrics: any } {
        const startTime = Date.now();
        
        // Group contexts by similar properties for optimization
        const groupedContexts = this.groupContextsBySimilarity(contexts);
        const results: FeeCalculationResult[] = [];
        
        let totalGasSaved = 0;
        
        for (const group of groupedContexts) {
            if (group.length === 1) {
                // Single calculation
                const result = this.calculateFee(structure, group[0]);
                results.push(result);
            } else {
                // Batch calculation for similar contexts
                const structures = Array(group.length).fill(structure);
                const batchResults = this.batchCalculateFees(structures, group);
                results.push(...batchResults);
                
                // Calculate gas savings
                const individualGasCost = group.length * this.estimateGasCost(structure.feeType);
                const batchGasCost = batchResults.reduce((sum, r) => sum + r.gasEstimate, 0);
                totalGasSaved += individualGasCost - batchGasCost;
            }
        }
        
        const endTime = Date.now();
        const averageTime = (endTime - startTime) / contexts.length;
        
        return {
            results,
            optimizationMetrics: {
                totalGasSaved,
                averageCalculationTime: averageTime,
                batchEfficiency: totalGasSaved > 0 ? (totalGasSaved / (totalGasSaved + results.reduce((sum, r) => sum + r.gasEstimate, 0))) * 100 : 0,
                cacheHitRate: groupedContexts.filter(g => g.length > 1).length / groupedContexts.length * 100
            }
        };
    }

    /**
     * Group contexts by similar properties for batch optimization
     */
    private static groupContextsBySimilarity(contexts: FeeCalculationContext[]): FeeCalculationContext[][] {
        const groups: Map<string, FeeCalculationContext[]> = new Map();
        
        for (const context of contexts) {
            // Create a key based on similar properties
            const key = `${context.transactionType}_${Math.floor(context.networkCongestion / 10) * 10}_${context.userTier?.id || 'no-tier'}`;
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(context);
        }
        
        return Array.from(groups.values());
    }

    /**
     * Validate fee calculation parameters
     */
    public static validateParameters(structure: FeeStructure, context: FeeCalculationContext): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        if (context.amount < 0) {
            errors.push('Amount cannot be negative');
        }
        
        if (context.networkCongestion < 0 || context.networkCongestion > 100) {
            errors.push('Network congestion must be between 0 and 100');
        }
        
        if (structure.percentageFee < 0 || structure.percentageFee > this.BASIS_POINTS) {
            errors.push('Percentage fee must be between 0 and 10000 basis points');
        }
        
        if (structure.minFee < 0 || structure.maxFee < 0) {
            errors.push('Min and max fees cannot be negative');
        }
        
        if (structure.minFee > structure.maxFee) {
            errors.push('Min fee cannot be greater than max fee');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
