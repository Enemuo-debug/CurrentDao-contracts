/**
 * Comprehensive fee structure definitions for the fee management system
 */

export enum FeeType {
    FIXED = 'FIXED',
    PERCENTAGE = 'PERCENTAGE',
    TIERED = 'TIERED',
    HYBRID = 'HYBRID'
}

export enum ExemptionType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED = 'FIXED',
    FULL = 'FULL'
}

export interface FeeTier {
    id: string;
    name: string;
    minVolume: number;
    maxVolume?: number;
    discountPercentage: number;
    priority: number;
}

export interface FeeStructure {
    id: string;
    transactionType: string;
    feeType: FeeType;
    baseFee: number; // For fixed fees
    percentageFee: number; // For percentage fees (in basis points, 10000 = 100%)
    minFee: number;
    maxFee: number;
    tiers: FeeTier[];
    dynamicAdjustment: {
        enabled: boolean;
        minRate: number;
        maxRate: number;
        congestionMultiplier: number;
    };
    volumeThresholds: {
        discountThresholds: Array<{ volume: number; discount: number }>;
        resetPeriod: 'daily' | 'weekly' | 'monthly';
    };
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface FeeDistribution {
    transactionType: string;
    recipients: Array<{
        address: string;
        percentage: number; // In basis points
        name: string;
    }>;
    totalPercentage: number; // Should equal 10000 (100%)
}

export interface FeeExemption {
    id: string;
    userAddress: string;
    transactionType: string;
    exemptionType: ExemptionType;
    value: number; // Percentage (basis points) or fixed amount
    createdAt: number;
    expiresAt?: number;
    isActive: boolean;
    reason?: string;
    createdBy: string;
}

export interface HistoricalFeeRecord {
    id: string;
    userAddress: string;
    transactionType: string;
    amount: number;
    feeAmount: number;
    effectiveFeeRate: number; // In basis points
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

export interface UserVolumeRecord {
    userAddress: string;
    transactionType: string;
    period: 'daily' | 'weekly' | 'monthly';
    volume: number;
    timestamp: number;
    lastUpdated: number;
}

export interface NetworkCongestionData {
    level: number; // 0-100
    timestamp: number;
    blockHeight?: number;
    gasPrice?: number;
    tps?: number; // Transactions per second
}

export interface FeeCalculationContext {
    userAddress: string;
    transactionType: string;
    amount: number;
    networkCongestion: number;
    userTier?: FeeTier;
    exemption?: FeeExemption;
    userVolume: number;
    timestamp: number;
}

export interface FeeOptimizationMetrics {
    totalGasSaved: number;
    averageCalculationTime: number;
    batchEfficiency: number;
    cacheHitRate: number;
    lastOptimized: number;
}

// Default fee structures for common transaction types
export const DEFAULT_FEE_STRUCTURES: Record<string, Partial<FeeStructure>> = {
    TRADE: {
        feeType: FeeType.TIERED,
        baseFee: 1,
        percentageFee: 50, // 0.5%
        minFee: 0.5,
        maxFee: 100,
        dynamicAdjustment: {
            enabled: true,
            minRate: 25, // 0.25%
            maxRate: 250, // 2.5%
            congestionMultiplier: 1.5
        },
        volumeThresholds: {
            discountThresholds: [
                { volume: 1000, discount: 500 }, // 5% discount for $1000+ volume
                { volume: 10000, discount: 1000 }, // 10% discount for $10000+ volume
                { volume: 100000, discount: 2000 } // 20% discount for $100000+ volume
            ],
            resetPeriod: 'monthly'
        }
    },
    TRANSFER: {
        feeType: FeeType.HYBRID,
        baseFee: 0.5,
        percentageFee: 10, // 0.1%
        minFee: 0.1,
        maxFee: 10,
        dynamicAdjustment: {
            enabled: false,
            minRate: 10,
            maxRate: 50,
            congestionMultiplier: 1.2
        },
        volumeThresholds: {
            discountThresholds: [
                { volume: 500, discount: 200 }, // 2% discount
                { volume: 5000, discount: 500 } // 5% discount
            ],
            resetPeriod: 'monthly'
        }
    },
    STAKING: {
        feeType: FeeType.FIXED,
        baseFee: 2,
        percentageFee: 0,
        minFee: 2,
        maxFee: 2,
        dynamicAdjustment: {
            enabled: false,
            minRate: 0,
            maxRate: 0,
            congestionMultiplier: 1
        },
        volumeThresholds: {
            discountThresholds: [],
            resetPeriod: 'monthly'
        }
    }
};

// Default fee distribution
export const DEFAULT_FEE_DISTRIBUTION: Record<string, FeeDistribution> = {
    TRADE: {
        transactionType: 'TRADE',
        recipients: [
            { address: 'treasury', percentage: 5000, name: 'Treasury' }, // 50%
            { address: 'validators', percentage: 3000, name: 'Validators' }, // 30%
            { address: 'developers', percentage: 2000, name: 'Developers' } // 20%
        ],
        totalPercentage: 10000
    },
    TRANSFER: {
        transactionType: 'TRANSFER',
        recipients: [
            { address: 'treasury', percentage: 6000, name: 'Treasury' }, // 60%
            { address: 'validators', percentage: 4000, name: 'Validators' } // 40%
        ],
        totalPercentage: 10000
    },
    STAKING: {
        transactionType: 'STAKING',
        recipients: [
            { address: 'treasury', percentage: 7000, name: 'Treasury' }, // 70%
            { address: 'validators', percentage: 3000, name: 'Validators' } // 30%
        ],
        totalPercentage: 10000
    }
};
