/**
 * @title BatchStructure
 * @notice Data structures for gas optimization batch management
 * @dev Defines interfaces and types for transaction batching and optimization
 */

// Priority levels
export enum Priority {
    HIGH = 1,
    MEDIUM = 2,
    LOW = 3
}

// Batch status
export enum BatchStatus {
    PENDING = 0,
    SCHEDULED = 1,
    EXECUTING = 2,
    EXECUTED = 3,
    FAILED = 4,
    CANCELLED = 5
}

// Queue status
export enum QueueStatus {
    WAITING = 0,
    PROCESSING = 1,
    COMPLETED = 2,
    FAILED = 3
}

// Network condition levels
export enum NetworkCondition {
    LOW = 0,
    MEDIUM = 1,
    HIGH = 2,
    CRITICAL = 3
}

// Batch transaction structure
export interface BatchTransaction {
    id: string;
    target: string;
    value: number;
    data: Uint8Array;
    priority: Priority;
    maxGasPrice: number;
    gasEstimate: number;
    timestamp: number;
    submittedBy: string;
    nonce?: number;
}

// Complete batch structure
export interface Batch {
    id: string;
    transactions: BatchTransaction[];
    status: BatchStatus;
    createdAt: number;
    scheduledAt?: number;
    executedAt?: number;
    gasLimit: number;
    gasPrice: number;
    gasUsed?: number;
    savings?: number;
    savingsPercentage?: number;
    createdBy: string;
    executionHash?: string;
    failureReason?: string;
}

// Priority queue item
export interface QueueItem {
    id: string;
    transaction: BatchTransaction;
    priority: Priority;
    maxWaitTime: number;
    submittedAt: number;
    attempts: number;
    lastAttempt?: number;
    status: QueueStatus;
}

// Network conditions data
export interface NetworkConditions {
    currentGasPrice: number;
    networkCongestion: number;
    blockTime: number;
    isOptimalTime: boolean;
    trend: number; // -1 decreasing, 0 stable, 1 increasing
    condition: NetworkCondition;
    lastUpdated: number;
}

// Gas prediction data
export interface GasPrediction {
    predictedPrice: number;
    confidence: number;
    timeHorizon: number;
    accuracy: number;
    modelUsed: string;
    timestamp: number;
}

// Batch execution schedule
export interface ExecutionSchedule {
    batchId: string;
    scheduledTime: number;
    maxGasPrice: number;
    priority: Priority;
    estimatedDuration: number;
    status: BatchStatus;
}

// Cost tracking data
export interface CostMetrics {
    totalGasUsed: number;
    totalGasSaved: number;
    averageGasPrice: number;
    optimizationRate: number;
    batchesProcessed: number;
    totalSavings: number;
    averageSavingsPercentage: number;
    lastUpdated: number;
}

// Savings report data
export interface SavingsReport {
    periodStart: number;
    periodEnd: number;
    periodSavings: number;
    batchesOptimized: number;
    averageSavingsPercentage: number;
    totalTransactions: number;
    averageGasPrice: number;
    networkConditions: NetworkConditions;
}

// Emergency status
export interface EmergencyStatus {
    emergencyMode: boolean;
    maxGasPrice: number;
    lastTriggerTime: number;
    triggeredBy: string;
    reason: string;
    autoDisable: boolean;
}

// Batch configuration
export interface BatchConfig {
    minBatchSize: number;
    maxBatchSize: number;
    highPriorityThreshold: number;
    mediumPriorityThreshold: number;
    targetSavings: number;
    maxWaitTime: number;
    emergencyMaxGasPrice: number;
    predictionModel: string;
    optimizationEnabled: boolean;
}

// Gas optimization result
export interface OptimizationResult {
    originalGasLimit: number;
    optimizedGasLimit: number;
    originalGasPrice: number;
    optimizedGasPrice: number;
    estimatedSavings: number;
    savingsPercentage: number;
    confidence: number;
    optimizationTime: number;
}

// Queue statistics
export interface QueueStats {
    totalQueued: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
    averageWaitTime: number;
    processedCount: number;
    failedCount: number;
    lastProcessed: number;
}

// Batch execution metrics
export interface ExecutionMetrics {
    executionTime: number;
    gasUsed: number;
    gasPrice: number;
    success: boolean;
    error?: string;
    transactionsExecuted: number;
    savings: number;
}

// Historical data point
export interface HistoricalDataPoint {
    timestamp: number;
    gasPrice: number;
    blockTime: number;
    congestion: number;
    batchSize: number;
    savings: number;
}

// Prediction model configuration
export interface PredictionModel {
    id: string;
    name: string;
    algorithm: string;
    accuracy: number;
    confidence: number;
    parameters: Map<string, number>;
    enabled: boolean;
    lastTrained: number;
}

// Optimization algorithm configuration
export interface OptimizationConfig {
    algorithm: string;
    parameters: Map<string, number>;
    targetSavings: number;
    maxExecutionTime: number;
    riskTolerance: number;
    enabled: boolean;
}

// Batch validation result
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    gasEstimate: number;
    confidence: number;
}

// Fee breakdown structure
export interface FeeBreakdown {
    baseFee: number;
    priorityFee: number;
    l1Fee: number;
    batchDiscount: number;
    totalFee: number;
    savings: number;
}

// Default configurations
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
    minBatchSize: 10,
    maxBatchSize: 100,
    highPriorityThreshold: 50,
    mediumPriorityThreshold: 100,
    targetSavings: 25,
    maxWaitTime: 300,
    emergencyMaxGasPrice: 1000,
    predictionModel: 'linear_regression',
    optimizationEnabled: true
};

export const DEFAULT_NETWORK_CONDITIONS: NetworkConditions = {
    currentGasPrice: 20,
    networkCongestion: 50,
    blockTime: 12,
    isOptimalTime: false,
    trend: 0,
    condition: NetworkCondition.MEDIUM,
    lastUpdated: Date.now()
};

export const DEFAULT_COST_METRICS: CostMetrics = {
    totalGasUsed: 0,
    totalGasSaved: 0,
    averageGasPrice: 0,
    optimizationRate: 0,
    batchesProcessed: 0,
    totalSavings: 0,
    averageSavingsPercentage: 0,
    lastUpdated: Date.now()
};

export const DEFAULT_EMERGENCY_STATUS: EmergencyStatus = {
    emergencyMode: false,
    maxGasPrice: 500,
    lastTriggerTime: 0,
    triggeredBy: '',
    reason: '',
    autoDisable: false
};

// Utility functions for batch structures
export class BatchStructureUtils {
    /**
     * Creates a new batch transaction
     */
    static createBatchTransaction(
        target: string,
        value: number,
        data: Uint8Array,
        priority: Priority,
        maxGasPrice: number,
        submittedBy: string
    ): BatchTransaction {
        return {
            id: this.generateTransactionId(),
            target,
            value,
            data,
            priority,
            maxGasPrice,
            gasEstimate: 0, // Will be calculated later
            timestamp: Date.now(),
            submittedBy
        };
    }

    /**
     * Creates a new batch
     */
    static createBatch(
        transactions: BatchTransaction[],
        createdBy: string,
        gasLimit: number,
        gasPrice: number
    ): Batch {
        return {
            id: this.generateBatchId(),
            transactions,
            status: BatchStatus.PENDING,
            createdAt: Date.now(),
            gasLimit,
            gasPrice,
            createdBy
        };
    }

    /**
     * Creates a queue item
     */
    static createQueueItem(
        transaction: BatchTransaction,
        maxWaitTime: number
    ): QueueItem {
        return {
            id: this.generateQueueId(),
            transaction,
            priority: transaction.priority,
            maxWaitTime,
            submittedAt: Date.now(),
            attempts: 0,
            status: QueueStatus.WAITING
        };
    }

    /**
     * Validates batch configuration
     */
    static validateBatchConfig(config: BatchConfig): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (config.minBatchSize < 1) {
            errors.push('Minimum batch size must be at least 1');
        }

        if (config.maxBatchSize < config.minBatchSize) {
            errors.push('Maximum batch size must be greater than minimum batch size');
        }

        if (config.targetSavings < 0 || config.targetSavings > 100) {
            errors.push('Target savings must be between 0 and 100 percent');
        }

        if (config.maxWaitTime < 0) {
            errors.push('Maximum wait time cannot be negative');
        }

        if (config.minBatchSize < 10) {
            warnings.push('Small batch sizes may not provide optimal savings');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            gasEstimate: 0,
            confidence: errors.length === 0 ? 100 : 0
        };
    }

    /**
     * Calculates batch statistics
     */
    static calculateBatchStats(batch: Batch): {
        totalValue: number;
        totalGasEstimate: number;
        averagePriority: number;
        highPriorityCount: number;
    } {
        const totalValue = batch.transactions.reduce((sum, tx) => sum + tx.value, 0);
        const totalGasEstimate = batch.transactions.reduce((sum, tx) => sum + tx.gasEstimate, 0);
        const averagePriority = batch.transactions.reduce((sum, tx) => sum + tx.priority, 0) / batch.transactions.length;
        const highPriorityCount = batch.transactions.filter(tx => tx.priority === Priority.HIGH).length;

        return {
            totalValue,
            totalGasEstimate,
            averagePriority,
            highPriorityCount
        };
    }

    /**
     * Determines network condition from congestion level
     */
    static getNetworkCondition(networkCongestion: number): NetworkCondition {
        if (networkCongestion < 30) return NetworkCondition.LOW;
        if (networkCongestion < 60) return NetworkCondition.MEDIUM;
        if (networkCongestion < 90) return NetworkCondition.HIGH;
        return NetworkCondition.CRITICAL;
    }

    /**
     * Generates unique transaction ID
     */
    private static generateTransactionId(): string {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generates unique batch ID
     */
    private static generateBatchId(): string {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generates unique queue ID
     */
    private static generateQueueId(): string {
        return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Serializes batch for storage
     */
    static serializeBatch(batch: Batch): string {
        return JSON.stringify({
            ...batch,
            transactions: batch.transactions.map(tx => ({
                ...tx,
                data: Array.from(tx.data)
            }))
        });
    }

    /**
     * Deserializes batch from storage
     */
    static deserializeBatch(data: string): Batch {
        const parsed = JSON.parse(data);
        return {
            ...parsed,
            transactions: parsed.transactions.map((tx: any) => ({
                ...tx,
                data: new Uint8Array(tx.data)
            }))
        };
    }

    /**
     * Clones batch transaction
     */
    static cloneTransaction(tx: BatchTransaction): BatchTransaction {
        return {
            ...tx,
            data: new Uint8Array(tx.data)
        };
    }

    /**
     * Merges multiple batches
     */
    static mergeBatches(batches: Batch[], createdBy: string): Batch {
        const allTransactions = batches.flatMap(batch => batch.transactions);
        const totalGasEstimate = allTransactions.reduce((sum, tx) => sum + tx.gasEstimate, 0);
        const avgGasPrice = batches.reduce((sum, batch) => sum + batch.gasPrice, 0) / batches.length;

        return this.createBatch(allTransactions, createdBy, totalGasEstimate, avgGasPrice);
    }

    /**
     * Filters transactions by priority
     */
    static filterByPriority(transactions: BatchTransaction[], priority: Priority): BatchTransaction[] {
        return transactions.filter(tx => tx.priority === priority);
    }

    /**
     * Sorts transactions by priority and timestamp
     */
    static sortTransactions(transactions: BatchTransaction[]): BatchTransaction[] {
        return transactions.sort((a, b) => {
            if (a.priority !== b.priority) {
                return a.priority - b.priority; // Lower number = higher priority
            }
            return a.timestamp - b.timestamp; // Earlier timestamp first
        });
    }

    /**
     * Calculates batch execution time estimate
     */
    static estimateExecutionTime(batch: Batch, networkConditions: NetworkConditions): number {
        const baseTime = 1000; // 1 second base time
        const perTxTime = 50; // 50ms per transaction
        const networkMultiplier = 1 - (networkConditions.networkCongestion / 200); // Reduce based on congestion
        
        return baseTime + (batch.transactions.length * perTxTime * networkMultiplier);
    }
}
