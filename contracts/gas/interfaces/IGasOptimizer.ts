/**
 * @title IGasOptimizer
 * @notice Interface for intelligent gas fee optimization contract
 * @dev Provides batching, priority queuing, and network condition analysis
 */

export interface IGasOptimizer {
    // Transaction Batching
    addToBatch(
        target: string,
        value: bigint,
        data: string,
        priority: number
    ): Promise<bigint>;
    
    executeBatch(batchId: bigint): Promise<boolean>;
    cancelBatch(batchId: bigint): Promise<boolean>;
    getBatchDetails(batchId: bigint): Promise<{
        targets: string[];
        values: bigint[];
        data: string[];
        priorities: number[];
        timestamp: bigint;
        executed: boolean;
    }>;
    
    // Priority Queue Management
    addToQueue(
        target: string,
        value: bigint,
        data: string,
        priority: number,
        maxGasPrice: bigint
    ): Promise<bigint>;
    
    processQueue(maxGasPrice: bigint): Promise<bigint>;
    getQueueStatus(): Promise<{
        totalQueued: bigint;
        highPriorityCount: bigint;
        mediumPriorityCount: bigint;
        lowPriorityCount: bigint;
    }>;
    
    // Network Condition Analysis
    getNetworkConditions(): Promise<{
        currentGasPrice: bigint;
        networkCongestion: bigint;
        blockTime: bigint;
        isOptimalTime: boolean;
    }>;
    
    predictGasPrice(minutesAhead: bigint): Promise<bigint>;
    getOptimalExecutionWindow(): Promise<{
        startTime: bigint;
        endTime: bigint;
        expectedGasPrice: bigint;
    }>;
    
    // Gas Price Prediction
    updateGasPrediction(): Promise<boolean>;
    getPredictionAccuracy(): Promise<bigint>;
    setPredictionModel(modelId: number): Promise<boolean>;
    
    // Fee Optimization Algorithms
    optimizeBatchGas(batchId: bigint): Promise<{
        optimizedGasLimit: bigint;
        optimizedGasPrice: bigint;
        estimatedSavings: bigint;
    }>;
    
    calculateOptimalFee(
        baseFee: bigint,
        priorityFee: bigint,
        urgency: number
    ): Promise<bigint>;
    
    // Batch Execution Scheduling
    scheduleBatchExecution(
        batchId: bigint,
        maxWaitTime: bigint,
        maxGasPrice: bigint
    ): Promise<boolean>;
    
    executeScheduledBatches(): Promise<bigint>;
    cancelScheduledExecution(batchId: bigint): Promise<boolean>;
    
    // Cost Tracking and Reporting
    getTotalSavings(): Promise<bigint>;
    getSavingsReport(periodStart: bigint, periodEnd: bigint): Promise<{
        periodSavings: bigint;
        batchesOptimized: bigint;
        averageSavingsPercentage: bigint;
    }>;
    
    getCostMetrics(): Promise<{
        totalGasUsed: bigint;
        totalGasSaved: bigint;
        averageGasPrice: bigint;
        optimizationRate: bigint;
    }>;
    
    // Emergency Fee Controls
    setEmergencyGasLimit(maxGasPrice: bigint): Promise<boolean>;
    enableEmergencyMode(enabled: boolean): Promise<boolean>;
    getEmergencyStatus(): Promise<{
        emergencyMode: boolean;
        maxGasPrice: bigint;
        lastTriggerTime: bigint;
    }>;
    
    // Configuration
    setBatchSize(minSize: bigint, maxSize: bigint): Promise<boolean>;
    setPriorityThresholds(
        highThreshold: bigint,
        mediumThreshold: bigint
    ): Promise<boolean>;
    setOptimizationParameters(
        targetSavings: bigint,
        maxWaitTime: bigint
    ): Promise<boolean>;

    // Events (represented as callbacks in TS interface for simulation)
    onBatchCreated?: (batchId: bigint, creator: string, transactionCount: bigint, priority: number) => void;
    onBatchExecuted?: (batchId: bigint, success: boolean, gasUsed: bigint, gasSaved: bigint) => void;
    onQueueProcessed?: (processedCount: bigint, gasPrice: bigint, timestamp: bigint) => void;
    onNetworkConditionUpdate?: (gasPrice: bigint, congestion: bigint, optimalTime: boolean) => void;
    onGasPredictionUpdated?: (predictedPrice: bigint, accuracy: bigint, timestamp: bigint) => void;
    onSavingsReported?: (batchId: bigint, gasSaved: bigint, savingsPercentage: bigint) => void;
    onEmergencyModeTriggered?: (enabled: boolean, maxGasPrice: bigint, triggeredBy: string) => void;
}

export interface GasOptimizationConfig {
    minBatchSize: bigint;
    maxBatchSize: bigint;
    highPriorityThreshold: bigint;
    mediumPriorityThreshold: bigint;
    targetSavings: bigint;
    maxWaitTime: bigint;
    emergencyMaxGasPrice: bigint;
    predictionModel: number;
}

export interface BatchTransaction {
    target: string;
    value: bigint;
    data: string;
    priority: number;
    maxGasPrice: bigint;
    gasEstimate: bigint;
}

export interface NetworkConditions {
    currentGasPrice: bigint;
    networkCongestion: bigint;
    blockTime: bigint;
    isOptimalTime: boolean;
    trend: number; // -1 decreasing, 0 stable, 1 increasing
}

export interface GasPrediction {
    predictedPrice: bigint;
    confidence: bigint;
    timeHorizon: bigint;
    accuracy: bigint;
}

export interface CostReport {
    periodSavings: bigint;
    batchesOptimized: bigint;
    averageSavingsPercentage: bigint;
    totalGasUsed: bigint;
    totalGasSaved: bigint;
    averageGasPrice: bigint;
    optimizationRate: bigint;
}

export interface EmergencyStatus {
    emergencyMode: boolean;
    maxGasPrice: bigint;
    lastTriggerTime: bigint;
    triggeredBy: string;
    reason: string;
}
