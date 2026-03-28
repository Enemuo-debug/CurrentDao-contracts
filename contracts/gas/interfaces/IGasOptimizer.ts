/**
 * @title IGasOptimizer
 * @notice Interface for intelligent gas fee optimization contract
 * @dev Provides batching, priority queuing, and network condition analysis
 */
export interface IGasOptimizer {
    // Transaction Batching
    function addToBatch(
        target: address,
        value: u256,
        data: Calldata,
        priority: u8
    ) returns (u256 batchId);
    
    function executeBatch(u256 batchId) returns (bool success);
    function cancelBatch(u256 batchId) returns (bool cancelled);
    function getBatchDetails(u256 batchId) returns (
        address[] targets,
        u256[] values,
        bytes[] data,
        u8[] priorities,
        u256 timestamp,
        bool executed
    );
    
    // Priority Queue Management
    function addToQueue(
        target: address,
        value: u256,
        data: Calldata,
        priority: u8,
        maxGasPrice: u256
    ) returns (u256 queueId);
    
    function processQueue(u256 maxGasPrice) returns (u256 processedCount);
    function getQueueStatus() returns (
        u256 totalQueued,
        u256 highPriorityCount,
        u256 mediumPriorityCount,
        u256 lowPriorityCount
    );
    
    // Network Condition Analysis
    function getNetworkConditions() returns (
        u256 currentGasPrice,
        u256 networkCongestion,
        u256 blockTime,
        bool isOptimalTime
    );
    
    function predictGasPrice(u256 minutesAhead) returns (u256 predictedPrice);
    function getOptimalExecutionWindow() returns (
        u256 startTime,
        u256 endTime,
        u256 expectedGasPrice
    );
    
    // Gas Price Prediction
    function updateGasPrediction() returns (bool updated);
    function getPredictionAccuracy() returns (u256 accuracy);
    function setPredictionModel(u8 modelId) returns (bool set);
    
    // Fee Optimization Algorithms
    function optimizeBatchGas(u256 batchId) returns (
        u256 optimizedGasLimit,
        u256 optimizedGasPrice,
        u256 estimatedSavings
    );
    
    function calculateOptimalFee(
        u256 baseFee,
        u256 priorityFee,
        u8 urgency
    ) returns (u256 optimalFee);
    
    // Batch Execution Scheduling
    function scheduleBatchExecution(
        u256 batchId,
        u256 maxWaitTime,
        u256 maxGasPrice
    ) returns (bool scheduled);
    
    function executeScheduledBatches() returns (u256 executedCount);
    function cancelScheduledExecution(u256 batchId) returns (bool cancelled);
    
    // Cost Tracking and Reporting
    function getTotalSavings() returns (u256 totalSavings);
    function getSavingsReport(u256 periodStart, u256 periodEnd) returns (
        u256 periodSavings,
        u256 batchesOptimized,
        u256 averageSavingsPercentage
    );
    
    function getCostMetrics() returns (
        u256 totalGasUsed,
        u256 totalGasSaved,
        u256 averageGasPrice,
        u256 optimizationRate
    );
    
    // Emergency Fee Controls
    function setEmergencyGasLimit(u256 maxGasPrice) returns (bool set);
    function enableEmergencyMode(bool enabled) returns (bool activated);
    function getEmergencyStatus() returns (
        bool emergencyMode,
        u256 maxGasPrice,
        u256 lastTriggerTime
    );
    
    // Configuration
    function setBatchSize(u256 minSize, u256 maxSize) returns (bool updated);
    function setPriorityThresholds(
        u256 highThreshold,
        u256 mediumThreshold
    ) returns (bool updated);
    function setOptimizationParameters(
        u256 targetSavings,
        u256 maxWaitTime
    ) returns (bool updated);
    
    // Events
    event BatchCreated(
        u256 indexed batchId,
        address indexed creator,
        u256 transactionCount,
        u8 priority
    );
    
    event BatchExecuted(
        u256 indexed batchId,
        bool success,
        u256 gasUsed,
        u256 gasSaved
    );
    
    event QueueProcessed(
        u256 processedCount,
        u256 gasPrice,
        u256 timestamp
    );
    
    event NetworkConditionUpdate(
        u256 gasPrice,
        u256 congestion,
        bool optimalTime
    );
    
    event GasPredictionUpdated(
        u256 predictedPrice,
        u256 accuracy,
        u256 timestamp
    );
    
    event SavingsReported(
        u256 batchId,
        u256 gasSaved,
        u256 savingsPercentage
    );
    
    event EmergencyModeTriggered(
        bool enabled,
        u256 maxGasPrice,
        address indexed triggeredBy
    );
}

export interface GasOptimizationConfig {
    minBatchSize: u256;
    maxBatchSize: u256;
    highPriorityThreshold: u256;
    mediumPriorityThreshold: u256;
    targetSavings: u256;
    maxWaitTime: u256;
    emergencyMaxGasPrice: u256;
    predictionModel: u8;
}

export interface BatchTransaction {
    target: address;
    value: u256;
    data: Calldata;
    priority: u8;
    maxGasPrice: u256;
    gasEstimate: u256;
}

export interface NetworkConditions {
    currentGasPrice: u256;
    networkCongestion: u256;
    blockTime: u256;
    isOptimalTime: bool;
    trend: i8; // -1 decreasing, 0 stable, 1 increasing
}

export interface GasPrediction {
    predictedPrice: u256;
    confidence: u256;
    timeHorizon: u256;
    accuracy: u256;
}

export interface CostReport {
    periodSavings: u256;
    batchesOptimized: u256;
    averageSavingsPercentage: u256;
    totalGasUsed: u256;
    totalGasSaved: u256;
    averageGasPrice: u256;
    optimizationRate: u256;
}

export interface EmergencyStatus {
    emergencyMode: bool;
    maxGasPrice: u256;
    lastTriggerTime: u256;
    triggeredBy: address;
    reason: string;
}
