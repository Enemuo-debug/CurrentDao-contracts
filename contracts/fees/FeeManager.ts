import { IFeeManager } from './interfaces/IFeeManager';
import { 
    FeeType, 
    FeeStructure, 
    FeeTier, 
    FeeDistribution, 
    FeeExemption, 
    HistoricalFeeRecord, 
    UserVolumeRecord,
    NetworkCongestionData,
    FeeCalculationContext,
    FeeOptimizationMetrics,
    ExemptionType,
    DEFAULT_FEE_STRUCTURES,
    DEFAULT_FEE_DISTRIBUTION
} from './structures/FeeStructure';
import { FeeCalculation, FeeCalculationResult } from './libraries/FeeCalculation';

/**
 * Comprehensive fee management system implementing IFeeManager
 * Supports multiple fee types, tiered structures, and dynamic adjustments
 */
export class FeeManager implements IFeeManager {
    private owner: string;
    private paused: boolean = false;
    private networkCongestionLevel: number = 0;
    
    // Storage
    private feeStructures: Map<string, FeeStructure> = new Map();
    private feeDistributions: Map<string, FeeDistribution> = new Map();
    private exemptions: Map<string, FeeExemption> = new Map();
    private userVolumes: Map<string, UserVolumeRecord> = new Map();
    private feeHistory: Map<string, HistoricalFeeRecord[]> = new Map();
    private userTiers: Map<string, Map<string, FeeTier>> = new Map(); // userAddress -> transactionType -> tier
    private networkCongestionHistory: NetworkCongestionData[] = [];
    private optimizationMetrics: FeeOptimizationMetrics = {
        totalGasSaved: 0,
        averageCalculationTime: 0,
        batchEfficiency: 0,
        cacheHitRate: 0,
        lastOptimized: Date.now()
    };

    // Events
    public onFeeCalculated?: (result: FeeCalculationResult) => void;
    public onFeeDistributed?: (transactionType: string, amounts: Map<string, number>) => void;
    public onExemptionCreated?: (exemption: FeeExemption) => void;
    public onExemptionRevoked?: (exemptionId: string) => void;
    public onNetworkCongestionUpdated?: (newLevel: number) => void;
    public onFeeStructureUpdated?: (transactionType: string, structure: FeeStructure) => void;

    constructor(owner: string) {
        this.owner = owner;
        this.initializeDefaultStructures();
    }

    // --- Core fee calculation methods ---

    public calculateFee(
        amount: number,
        userAddress: string,
        transactionType: string,
        networkCongestion?: number
    ): FeeCalculationResult {
        this.requireNotPaused();
        
        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        const congestion = networkCongestion ?? this.networkCongestionLevel;
        const userTier = this.getUserTier(userAddress, transactionType);
        const userVolume = this.getUserVolume(userAddress, transactionType);
        const exemption = this.getBestExemption(userAddress, transactionType);

        const context: FeeCalculationContext = {
            userAddress,
            transactionType,
            amount,
            networkCongestion: congestion,
            userTier: userTier || undefined,
            exemption: exemption || undefined,
            userVolume,
            timestamp: Date.now()
        };

        const validation = FeeCalculation.validateParameters(structure, context);
        if (!validation.isValid) {
            throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
        }

        const result = FeeCalculation.calculateFee(structure, context);
        
        // Update optimization metrics
        this.updateOptimizationMetrics(result.gasEstimate);
        
        // Emit event
        this.onFeeCalculated?.(result);
        
        return result;
    }

    public calculateFeeWithExemption(
        amount: number,
        userAddress: string,
        transactionType: string,
        exemptionId?: string,
        networkCongestion?: number
    ): FeeCalculationResult {
        let exemption: FeeExemption | undefined;
        
        if (exemptionId) {
            exemption = this.getExemption(exemptionId) || undefined;
            if (!exemption || !this.isExemptionValid(exemptionId)) {
                throw new Error(`Invalid or expired exemption: ${exemptionId}`);
            }
        }

        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        const congestion = networkCongestion ?? this.networkCongestionLevel;
        const userTier = this.getUserTier(userAddress, transactionType);
        const userVolume = this.getUserVolume(userAddress, transactionType);

        const context: FeeCalculationContext = {
            userAddress,
            transactionType,
            amount,
            networkCongestion: congestion,
            userTier: userTier || undefined,
            exemption,
            userVolume,
            timestamp: Date.now()
        };

        const result = FeeCalculation.calculateFee(structure, context);
        
        this.updateOptimizationMetrics(result.gasEstimate);
        this.onFeeCalculated?.(result);
        
        return result;
    }

    // --- Fee structure management ---

    public setFeeStructure(transactionType: string, structure: FeeStructure): void {
        this.requireOwner();
        this.requireNotPaused();
        
        structure.transactionType = transactionType;
        structure.updatedAt = Date.now();
        
        this.feeStructures.set(transactionType, structure);
        this.onFeeStructureUpdated?.(transactionType, structure);
    }

    public getFeeStructure(transactionType: string): FeeStructure | null {
        return this.feeStructures.get(transactionType) || null;
    }

    public updateFeeStructure(transactionType: string, updates: Partial<FeeStructure>): void {
        this.requireOwner();
        this.requireNotPaused();
        
        const existing = this.getFeeStructure(transactionType);
        if (!existing) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        const updated: FeeStructure = {
            ...existing,
            ...updates,
            transactionType,
            updatedAt: Date.now()
        };

        this.feeStructures.set(transactionType, updated);
        this.onFeeStructureUpdated?.(transactionType, updated);
    }

    // --- Tier management ---

    public addFeeTier(transactionType: string, tier: FeeTier): void {
        this.requireOwner();
        this.requireNotPaused();
        
        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        structure.tiers.push(tier);
        structure.tiers.sort((a, b) => a.priority - b.priority);
        
        this.feeStructures.set(transactionType, structure);
        this.onFeeStructureUpdated?.(transactionType, structure);
    }

    public removeFeeTier(transactionType: string, tierIndex: number): void {
        this.requireOwner();
        this.requireNotPaused();
        
        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        if (tierIndex < 0 || tierIndex >= structure.tiers.length) {
            throw new Error(`Invalid tier index: ${tierIndex}`);
        }

        structure.tiers.splice(tierIndex, 1);
        this.feeStructures.set(transactionType, structure);
        this.onFeeStructureUpdated?.(transactionType, structure);
    }

    public updateFeeTier(transactionType: string, tierIndex: number, updates: Partial<FeeTier>): void {
        this.requireOwner();
        this.requireNotPaused();
        
        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        if (tierIndex < 0 || tierIndex >= structure.tiers.length) {
            throw new Error(`Invalid tier index: ${tierIndex}`);
        }

        structure.tiers[tierIndex] = { ...structure.tiers[tierIndex], ...updates };
        this.feeStructures.set(transactionType, structure);
        this.onFeeStructureUpdated?.(transactionType, structure);
    }

    public getUserTier(userAddress: string, transactionType: string): FeeTier | null {
        const userTiers = this.userTiers.get(userAddress);
        if (!userTiers) {
            return null;
        }
        
        return userTiers.get(transactionType) || null;
    }

    public setUserTier(userAddress: string, transactionType: string, tier: FeeTier): void {
        this.requireOwner();
        
        if (!this.userTiers.has(userAddress)) {
            this.userTiers.set(userAddress, new Map());
        }
        
        this.userTiers.get(userAddress)!.set(transactionType, tier);
    }

    // --- Dynamic fee adjustment ---

    public setNetworkCongestionLevel(congestionLevel: number): void {
        this.requireOwner();
        
        if (congestionLevel < 0 || congestionLevel > 100) {
            throw new Error('Network congestion level must be between 0 and 100');
        }

        this.networkCongestionLevel = congestionLevel;
        
        // Record in history
        this.networkCongestionHistory.push({
            level: congestionLevel,
            timestamp: Date.now()
        });

        // Keep only last 1000 records
        if (this.networkCongestionHistory.length > 1000) {
            this.networkCongestionHistory = this.networkCongestionHistory.slice(-1000);
        }

        this.onNetworkCongestionUpdated?.(congestionLevel);
    }

    public getNetworkCongestionLevel(): number {
        return this.networkCongestionLevel;
    }

    public enableDynamicFees(transactionType: string, enabled: boolean): void {
        this.requireOwner();
        this.requireNotPaused();
        
        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            throw new Error(`Fee structure not found for transaction type: ${transactionType}`);
        }

        structure.dynamicAdjustment.enabled = enabled;
        structure.updatedAt = Date.now();
        
        this.feeStructures.set(transactionType, structure);
        this.onFeeStructureUpdated?.(transactionType, structure);
    }

    public isDynamicFeesEnabled(transactionType: string): boolean {
        const structure = this.getFeeStructure(transactionType);
        return structure?.dynamicAdjustment.enabled || false;
    }

    // --- Fee distribution management ---

    public setFeeDistribution(transactionType: string, distribution: FeeDistribution): void {
        this.requireOwner();
        this.requireNotPaused();
        
        // Validate total percentage equals 100%
        if (distribution.totalPercentage !== 10000) {
            throw new Error('Total distribution percentage must equal 10000 (100%)');
        }

        this.feeDistributions.set(transactionType, distribution);
    }

    public getFeeDistribution(transactionType: string): FeeDistribution | null {
        return this.feeDistributions.get(transactionType) || null;
    }

    public distributeFees(transactionType: string, totalFee: number): void {
        this.requireNotPaused();
        
        const distribution = this.getFeeDistribution(transactionType);
        if (!distribution) {
            throw new Error(`Fee distribution not found for transaction type: ${transactionType}`);
        }

        const amounts = new Map<string, number>();
        
        for (const recipient of distribution.recipients) {
            const amount = (totalFee * recipient.percentage) / 10000;
            amounts.set(recipient.address, amount);
        }

        this.onFeeDistributed?.(transactionType, amounts);
    }

    // --- Fee exemption management ---

    public createExemption(
        userAddress: string,
        transactionType: string,
        exemptionType: 'PERCENTAGE' | 'FIXED' | 'FULL',
        value: number,
        expiresAt?: number
    ): string {
        this.requireOwner();
        this.requireNotPaused();
        
        const exemptionId = `exemption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const exemption: FeeExemption = {
            id: exemptionId,
            userAddress,
            transactionType,
            exemptionType: exemptionType as ExemptionType,
            value,
            createdAt: Date.now(),
            expiresAt,
            isActive: true,
            createdBy: this.owner
        };

        this.exemptions.set(exemptionId, exemption);
        this.onExemptionCreated?.(exemption);
        
        return exemptionId;
    }

    public revokeExemption(exemptionId: string): void {
        this.requireOwner();
        
        const exemption = this.exemptions.get(exemptionId);
        if (!exemption) {
            throw new Error(`Exemption not found: ${exemptionId}`);
        }

        exemption.isActive = false;
        this.exemptions.set(exemptionId, exemption);
        this.onExemptionRevoked?.(exemptionId);
    }

    public getExemption(exemptionId: string): FeeExemption | null {
        return this.exemptions.get(exemptionId) || null;
    }

    public getUserExemptions(userAddress: string): FeeExemption[] {
        return Array.from(this.exemptions.values())
            .filter(exemption => exemption.userAddress === userAddress && exemption.isActive);
    }

    public isExemptionValid(exemptionId: string): boolean {
        const exemption = this.getExemption(exemptionId);
        if (!exemption || !exemption.isActive) {
            return false;
        }

        if (exemption.expiresAt && exemption.expiresAt < Date.now()) {
            return false;
        }

        return true;
    }

    private getBestExemption(userAddress: string, transactionType: string): FeeExemption | undefined {
        const userExemptions = this.getUserExemptions(userAddress)
            .filter(exemption => exemption.transactionType === transactionType || exemption.transactionType === '*')
            .filter(exemption => this.isExemptionValid(exemption.id));

        // Return the exemption with the highest value
        return userExemptions.sort((a, b) => b.value - a.value)[0];
    }

    // --- Historical tracking ---

    public recordFeePayment(
        userAddress: string,
        transactionType: string,
        amount: number,
        feeAmount: number,
        tierUsed: string,
        networkCongestion: number
    ): void {
        const record: HistoricalFeeRecord = {
            id: `fee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userAddress,
            transactionType,
            amount,
            feeAmount,
            effectiveFeeRate: amount > 0 ? (feeAmount / amount) * 10000 : 0,
            tierUsed,
            networkCongestion,
            timestamp: Date.now(),
            discounts: [],
            gasUsed: 0
        };

        if (!this.feeHistory.has(userAddress)) {
            this.feeHistory.set(userAddress, []);
        }

        const userHistory = this.feeHistory.get(userAddress)!;
        userHistory.push(record);

        // Keep only last 1000 records per user
        if (userHistory.length > 1000) {
            userHistory.splice(0, userHistory.length - 1000);
        }

        this.feeHistory.set(userAddress, userHistory);
    }

    public getUserFeeHistory(userAddress: string, limit?: number): HistoricalFeeRecord[] {
        const history = this.feeHistory.get(userAddress) || [];
        return limit ? history.slice(-limit) : history;
    }

    public getFeeStatistics(transactionType: string, timeRange?: { start: number; end: number }): {
        totalFees: number;
        averageFee: number;
        totalTransactions: number;
        volumeDiscounted: number;
    } {
        let totalFees = 0;
        let totalTransactions = 0;
        let volumeDiscounted = 0;

        for (const userHistory of this.feeHistory.values()) {
            for (const record of userHistory) {
                if (record.transactionType !== transactionType) {
                    continue;
                }

                if (timeRange && (record.timestamp < timeRange.start || record.timestamp > timeRange.end)) {
                    continue;
                }

                totalFees += record.feeAmount;
                totalTransactions++;
                
                if (record.discounts.some(d => d.type === 'VOLUME')) {
                    volumeDiscounted++;
                }
            }
        }

        return {
            totalFees,
            averageFee: totalTransactions > 0 ? totalFees / totalTransactions : 0,
            totalTransactions,
            volumeDiscounted
        };
    }

    // --- Volume and discount tracking ---

    public updateUserVolume(userAddress: string, transactionType: string, amount: number): void {
        const key = `${userAddress}_${transactionType}_monthly`;
        const existing = this.userVolumes.get(key);
        
        const record: UserVolumeRecord = {
            userAddress,
            transactionType,
            period: 'monthly',
            volume: (existing?.volume || 0) + amount,
            timestamp: Date.now(),
            lastUpdated: Date.now()
        };

        this.userVolumes.set(key, record);
    }

    public getUserVolume(userAddress: string, transactionType: string, period: 'daily' | 'weekly' | 'monthly' = 'monthly'): number {
        const key = `${userAddress}_${transactionType}_${period}`;
        const record = this.userVolumes.get(key);
        
        if (!record) {
            return 0;
        }

        // Reset volume if period has expired
        const now = Date.now();
        const periodMs = period === 'daily' ? 24 * 60 * 60 * 1000 : 
                        period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 
                        30 * 24 * 60 * 60 * 1000;

        if (now - record.lastUpdated > periodMs) {
            this.userVolumes.delete(key);
            return 0;
        }

        return record.volume;
    }

    public calculateVolumeDiscount(userAddress: string, transactionType: string, baseFee: number): number {
        const structure = this.getFeeStructure(transactionType);
        if (!structure) {
            return 0;
        }

        const userVolume = this.getUserVolume(userAddress, transactionType);
        const thresholds = structure.volumeThresholds.discountThresholds;
        
        let discount = 0;
        for (const threshold of thresholds) {
            if (userVolume >= threshold.volume) {
                discount = Math.max(discount, threshold.discount);
            }
        }
        
        return (baseFee * discount) / 10000;
    }

    // --- Gas optimization ---

    public batchCalculateFees(
        requests: Array<{
            amount: number;
            userAddress: string;
            transactionType: string;
            networkCongestion?: number;
        }>
    ): FeeCalculationResult[] {
        this.requireNotPaused();
        
        const structures: FeeStructure[] = [];
        const contexts: FeeCalculationContext[] = [];
        
        for (const request of requests) {
            const structure = this.getFeeStructure(request.transactionType);
            if (!structure) {
                throw new Error(`Fee structure not found for transaction type: ${request.transactionType}`);
            }
            
            structures.push(structure);
            
            const context: FeeCalculationContext = {
                userAddress: request.userAddress,
                transactionType: request.transactionType,
                amount: request.amount,
                networkCongestion: request.networkCongestion ?? this.networkCongestionLevel,
                userTier: this.getUserTier(request.userAddress, request.transactionType) || undefined,
                exemption: this.getBestExemption(request.userAddress, request.transactionType) || undefined,
                userVolume: this.getUserVolume(request.userAddress, request.transactionType),
                timestamp: Date.now()
            };
            
            contexts.push(context);
        }

        const results = FeeCalculation.batchCalculateFees(structures, contexts);
        
        // Update optimization metrics
        const totalGasSaved = results.reduce((sum, result) => sum + (result.gasEstimate * 0.3), 0);
        this.optimizationMetrics.totalGasSaved += totalGasSaved;
        this.optimizationMetrics.lastOptimized = Date.now();
        
        return results;
    }

    // --- Administrative functions ---

    public pause(): void {
        this.requireOwner();
        this.paused = true;
    }

    public unpause(): void {
        this.requireOwner();
        this.paused = false;
    }

    public isPaused(): boolean {
        return this.paused;
    }

    public transferOwnership(newOwner: string): void {
        this.requireOwner();
        if (!newOwner) {
            throw new Error('New owner cannot be empty');
        }
        this.owner = newOwner;
    }

    public getOwner(): string {
        return this.owner;
    }

    // --- Private helper methods ---

    private requireOwner(): void {
        // In a real implementation, this would check the caller's address
        // For now, we'll assume this is called by the owner
    }

    private requireNotPaused(): void {
        if (this.paused) {
            throw new Error('Contract is paused');
        }
    }

    private initializeDefaultStructures(): void {
        // Initialize default fee structures
        for (const [transactionType, defaultStructure] of Object.entries(DEFAULT_FEE_STRUCTURES)) {
            const structure: FeeStructure = {
                id: `default_${transactionType}`,
                transactionType,
                feeType: defaultStructure.feeType!,
                baseFee: defaultStructure.baseFee!,
                percentageFee: defaultStructure.percentageFee!,
                minFee: defaultStructure.minFee!,
                maxFee: defaultStructure.maxFee!,
                tiers: defaultStructure.tiers || [],
                dynamicAdjustment: defaultStructure.dynamicAdjustment!,
                volumeThresholds: defaultStructure.volumeThresholds!,
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            this.feeStructures.set(transactionType, structure);
        }

        // Initialize default fee distributions
        for (const [transactionType, distribution] of Object.entries(DEFAULT_FEE_DISTRIBUTION)) {
            this.feeDistributions.set(transactionType, distribution);
        }
    }

    private updateOptimizationMetrics(gasEstimate: number): void {
        this.optimizationMetrics.averageCalculationTime = 
            (this.optimizationMetrics.averageCalculationTime + Date.now()) / 2;
    }

    // --- Public getters for monitoring ---

    public getOptimizationMetrics(): FeeOptimizationMetrics {
        return { ...this.optimizationMetrics };
    }

    public getNetworkCongestionHistory(limit?: number): NetworkCongestionData[] {
        return limit ? this.networkCongestionHistory.slice(-limit) : this.networkCongestionHistory;
    }

    public getAllFeeStructures(): Map<string, FeeStructure> {
        return new Map(this.feeStructures);
    }

    public getAllFeeDistributions(): Map<string, FeeDistribution> {
        return new Map(this.feeDistributions);
    }

    public getAllExemptions(): Map<string, FeeExemption> {
        return new Map(this.exemptions);
    }
}
