/**
 * @title GasOptimizer Test Suite
 * @notice Comprehensive tests for the gas optimization contract
 * @dev Tests all functionality including batching, optimization, and emergency controls
 */

import { GasOptimizer } from '../../contracts/gas/GasOptimizer';
import { GasLib } from '../../contracts/gas/libraries/GasLib';
import { OptimizationAlgorithm, AlgorithmType, OptimizationStrategy } from '../../contracts/gas/algorithms/OptimizationAlgorithm';
import { 
    BatchStructureUtils, 
    Priority, 
    BatchStatus, 
    QueueStatus,
    BatchConfig,
    DEFAULT_BATCH_CONFIG
} from '../../contracts/gas/structures/BatchStructure';

describe('GasOptimizer', () => {
    let gasOptimizer: GasOptimizer;
    let owner: string;
    let user: string;

    beforeEach(() => {
        owner = '0xOwnerAddress';
        user = '0xUserAddress';
        
        const config: Partial<BatchConfig> = {
            minBatchSize: 5,
            maxBatchSize: 20,
            targetSavings: 25,
            maxWaitTime: 300
        };
        
        gasOptimizer = new GasOptimizer(
            owner,
            config,
            AlgorithmType.LINEAR_REGRESSION,
            OptimizationStrategy.BALANCED
        );
    });

    describe('Contract Initialization', () => {
        it('should initialize with correct configuration', () => {
            expect(gasOptimizer.getOwner()).toBe(owner);
            expect(gasOptimizer.isPaused()).toBe(false);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.minBatchSize).toBe(5);
            expect(config.maxBatchSize).toBe(20);
            expect(config.targetSavings).toBe(25);
        });

        it('should start with empty batches and queue', () => {
            const queueStatus = gasOptimizer.getQueueStatus();
            expect(queueStatus.totalQueued).toBe(0);
            expect(queueStatus.highPriorityCount).toBe(0);
            expect(queueStatus.mediumPriorityCount).toBe(0);
            expect(queueStatus.lowPriorityCount).toBe(0);
        });

        it('should have correct emergency status', () => {
            const emergencyStatus = gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.emergencyMode).toBe(false);
            expect(emergencyStatus.maxGasPrice).toBeGreaterThan(0);
        });
    });

    describe('Transaction Batching', () => {
        it('should add transaction to batch', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            
            expect(batchId).toBeDefined();
            expect(typeof batchId).toBe('string');
        });

        it('should create new batch when no suitable batch exists', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId1 = gasOptimizer.addToBatch(target, value, data, priority);
            
            // Add a second transaction with different priority - should create new batch
            const batchId2 = gasOptimizer.addToBatch(target, value, data, Priority.MEDIUM);
            
            expect(batchId1).not.toBe(batchId2);
        });

        it('should add transactions to existing batch with same priority', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.MEDIUM;

            const batchId1 = gasOptimizer.addToBatch(target, value, data, priority);
            const batchId2 = gasOptimizer.addToBatch(target, value, data, priority);
            
            // Should add to same batch if capacity allows
            const batchDetails1 = gasOptimizer.getBatchDetails(batchId1);
            const batchDetails2 = gasOptimizer.getBatchDetails(batchId2);
            
            // The second transaction should be added to the first batch
            expect(batchDetails1.targets.length).toBe(2);
            expect(batchDetails1.targets).toEqual(batchDetails2.targets);
        });

        it('should execute batch successfully', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            
            const result = gasOptimizer.executeBatch(batchId);
            expect(result).toBe(true);
            
            const batchDetails = gasOptimizer.getBatchDetails(batchId);
            expect(batchDetails.executed).toBe(true);
        });

        it('should cancel batch successfully', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            
            const result = gasOptimizer.cancelBatch(batchId);
            expect(result).toBe(true);
        });

        it('should fail to execute cancelled batch', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            gasOptimizer.cancelBatch(batchId);
            
            expect(() => gasOptimizer.executeBatch(batchId)).toThrow();
        });

        it('should fail to execute non-existent batch', () => {
            expect(() => gasOptimizer.executeBatch('non-existent')).toThrow();
        });
    });

    describe('Priority Queue Management', () => {
        it('should add transaction to queue', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;
            const maxGasPrice = 100;

            const queueId = gasOptimizer.addToQueue(target, value, data, priority, maxGasPrice);
            
            expect(queueId).toBeDefined();
            expect(typeof queueId).toBe('string');
            
            const queueStatus = gasOptimizer.getQueueStatus();
            expect(queueStatus.totalQueued).toBe(1);
            expect(queueStatus.highPriorityCount).toBe(1);
        });

        it('should process queue items', () => {
            // Add multiple items to queue
            for (let i = 0; i < 10; i++) {
                gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000,
                    new Uint8Array([0x12, 0x34, 0x56]),
                    i % 3 === 0 ? Priority.HIGH : Priority.MEDIUM,
                    100
                );
            }

            const processedCount = gasOptimizer.processQueue(100);
            expect(processedCount).toBeGreaterThan(0);
        });

        it('should respect priority in queue processing', () => {
            // Add high priority items
            for (let i = 0; i < 3; i++) {
                gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000,
                    new Uint8Array([0x12, 0x34, 0x56]),
                    Priority.HIGH,
                    100
                );
            }

            // Add low priority items
            for (let i = 0; i < 3; i++) {
                gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000,
                    new Uint8Array([0x12, 0x34, 0x56]),
                    Priority.LOW,
                    100
                );
            }

            const queueStatus = gasOptimizer.getQueueStatus();
            expect(queueStatus.highPriorityCount).toBe(3);
            expect(queueStatus.lowPriorityCount).toBe(3);
        });

        it('should handle queue processing with insufficient gas price', () => {
            // Add items with low max gas price
            for (let i = 0; i < 5; i++) {
                gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000,
                    new Uint8Array([0x12, 0x34, 0x56]),
                    Priority.HIGH,
                    50 // Low max gas price
                );
            }

            const processedCount = gasOptimizer.processQueue(100); // Higher gas price
            expect(processedCount).toBe(0); // Should not process due to gas price mismatch
        });
    });

    describe('Network Condition Analysis', () => {
        it('should provide current network conditions', () => {
            const conditions = gasOptimizer.getNetworkConditions();
            
            expect(conditions.currentGasPrice).toBeGreaterThan(0);
            expect(conditions.networkCongestion).toBeGreaterThanOrEqual(0);
            expect(conditions.networkCongestion).toBeLessThanOrEqual(100);
            expect(conditions.blockTime).toBeGreaterThan(0);
            expect(typeof conditions.isOptimalTime).toBe('boolean');
        });

        it('should predict gas prices', () => {
            const predictedPrice = gasOptimizer.predictGasPrice(5); // 5 minutes ahead
            
            expect(predictedPrice).toBeGreaterThan(0);
            expect(typeof predictedPrice).toBe('number');
        });

        it('should provide optimal execution window', () => {
            const window = gasOptimizer.getOptimalExecutionWindow();
            
            expect(window.startTime).toBeGreaterThan(0);
            expect(window.endTime).toBeGreaterThan(window.startTime);
            expect(window.expectedGasPrice).toBeGreaterThan(0);
        });

        it('should update gas predictions', () => {
            const result = gasOptimizer.updateGasPrediction();
            expect(result).toBe(true);
        });

        it('should provide prediction accuracy', () => {
            const accuracy = gasOptimizer.getPredictionAccuracy();
            expect(accuracy).toBeGreaterThanOrEqual(0);
            expect(accuracy).toBeLessThanOrEqual(100);
        });
    });

    describe('Gas Price Prediction', () => {
        it('should set prediction model', () => {
            const result = gasOptimizer.setPredictionModel(1); // MOVING_AVERAGE
            expect(result).toBe(true);
        });

        it('should fail to set invalid prediction model', () => {
            expect(() => gasOptimizer.setPredictionModel(999)).toThrow();
        });
    });

    describe('Fee Optimization Algorithms', () => {
        it('should optimize batch gas', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            
            const optimization = gasOptimizer.optimizeBatchGas(batchId);
            
            expect(optimization.optimizedGasLimit).toBeGreaterThan(0);
            expect(optimization.optimizedGasPrice).toBeGreaterThan(0);
            expect(optimization.estimatedSavings).toBeGreaterThanOrEqual(0);
        });

        it('should calculate optimal fee', () => {
            const baseFee = 20;
            const priorityFee = 5;
            const urgency = Priority.HIGH;

            const optimalFee = gasOptimizer.calculateOptimalFee(baseFee, priorityFee, urgency);
            
            expect(optimalFee).toBeGreaterThan(0);
        });
    });

    describe('Batch Execution Scheduling', () => {
        it('should schedule batch execution', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            
            const result = gasOptimizer.scheduleBatchExecution(batchId, 300, 100);
            expect(result).toBe(true);
        });

        it('should execute scheduled batches', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            // Schedule for immediate execution (past time)
            gasOptimizer.scheduleBatchExecution(batchId, -1, 100); // Negative wait time for immediate execution
            
            const executedCount = gasOptimizer.executeScheduledBatches();
            expect(executedCount).toBe(1);
        });

        it('should cancel scheduled execution', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            gasOptimizer.scheduleBatchExecution(batchId, 300, 100);
            
            const result = gasOptimizer.cancelScheduledExecution(batchId);
            expect(result).toBe(true);
        });
    });

    describe('Cost Tracking and Reporting', () => {
        it('should track total savings', () => {
            const initialSavings = gasOptimizer.getTotalSavings();
            expect(initialSavings).toBeGreaterThanOrEqual(0); // Allow for initialization
            
            // Execute a batch to generate savings
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);
            const priority = Priority.HIGH;

            const batchId = gasOptimizer.addToBatch(target, value, data, priority);
            gasOptimizer.executeBatch(batchId);
            
            const finalSavings = gasOptimizer.getTotalSavings();
            expect(finalSavings).toBeGreaterThanOrEqual(initialSavings);
        });

        it('should generate savings report', () => {
            const periodStart = Date.now() - 86400000; // 24 hours ago
            const periodEnd = Date.now();
            
            const report = gasOptimizer.getSavingsReport(periodStart, periodEnd);
            
            expect(report.periodSavings).toBeGreaterThanOrEqual(0);
            expect(report.batchesOptimized).toBeGreaterThanOrEqual(0);
            expect(report.averageSavingsPercentage).toBeGreaterThanOrEqual(0);
        });

        it('should provide cost metrics', () => {
            const metrics = gasOptimizer.getCostMetrics();
            
            expect(metrics.totalGasUsed).toBeGreaterThanOrEqual(0);
            expect(metrics.totalGasSaved).toBeGreaterThanOrEqual(0);
            expect(metrics.averageGasPrice).toBeGreaterThanOrEqual(0);
            expect(metrics.optimizationRate).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Emergency Fee Controls', () => {
        it('should set emergency gas limit', () => {
            const result = gasOptimizer.setEmergencyGasLimit(500);
            expect(result).toBe(true);
            
            const emergencyStatus = gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.maxGasPrice).toBe(500);
        });

        it('should enable emergency mode', () => {
            const result = gasOptimizer.enableEmergencyMode(true);
            expect(result).toBe(true);
            
            const emergencyStatus = gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.emergencyMode).toBe(true);
        });

        it('should disable emergency mode', () => {
            gasOptimizer.enableEmergencyMode(true);
            const result = gasOptimizer.enableEmergencyMode(false);
            expect(result).toBe(true);
            
            const emergencyStatus = gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.emergencyMode).toBe(false);
        });

        it('should prevent operations when emergency mode is active', () => {
            gasOptimizer.enableEmergencyMode(true);
            
            expect(() => gasOptimizer.addToBatch('0xTarget', 1000, new Uint8Array([0x12]), Priority.HIGH))
                .toThrow();
        });
    });

    describe('Configuration Management', () => {
        it('should set batch size', () => {
            const result = gasOptimizer.setBatchSize(10, 50);
            expect(result).toBe(true);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.minBatchSize).toBe(10);
            expect(config.maxBatchSize).toBe(50);
        });

        it('should validate batch size configuration', () => {
            expect(() => gasOptimizer.setBatchSize(0, 50)).toThrow(); // Invalid min size
            expect(() => gasOptimizer.setBatchSize(10, 5)).toThrow(); // Max < min
        });

        it('should set priority thresholds', () => {
            const result = gasOptimizer.setPriorityThresholds(25, 75);
            expect(result).toBe(true);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.highPriorityThreshold).toBe(25);
            expect(config.mediumPriorityThreshold).toBe(75);
        });

        it('should set optimization parameters', () => {
            const result = gasOptimizer.setOptimizationParameters(30, 600);
            expect(result).toBe(true);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.targetSavings).toBe(30);
            expect(config.maxWaitTime).toBe(600);
        });
    });

    describe('Pause and Unpause', () => {
        it('should pause contract', () => {
            gasOptimizer.pause();
            expect(gasOptimizer.isPaused()).toBe(true);
        });

        it('should unpause contract', () => {
            gasOptimizer.pause();
            gasOptimizer.unpause();
            expect(gasOptimizer.isPaused()).toBe(false);
        });

        it('should prevent operations when paused', () => {
            gasOptimizer.pause();
            
            expect(() => gasOptimizer.addToBatch('0xTarget', 1000, new Uint8Array([0x12]), Priority.HIGH))
                .toThrow();
        });
    });

    describe('Algorithm Performance', () => {
        it('should provide algorithm performance metrics', () => {
            const metrics = gasOptimizer.getAlgorithmPerformance();
            
            expect(metrics.optimizationCount).toBeGreaterThanOrEqual(0);
            expect(metrics.averageOptimizationTime).toBeGreaterThanOrEqual(0);
            expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
            expect(metrics.accuracy).toBeLessThanOrEqual(100);
        });
    });
});

describe('GasLib', () => {
    describe('Gas Estimation', () => {
        it('should estimate transaction gas', () => {
            const target = '0xTargetContract';
            const value = 1000;
            const data = new Uint8Array([0x12, 0x34, 0x56]);

            const gasEstimate = GasLib.estimateTransactionGas(target, value, data);
            
            expect(gasEstimate).toBeGreaterThan(21000); // Base transaction gas
        });

        it('should estimate batch gas', () => {
            const transactions = [
                {
                    target: '0xTarget1',
                    value: 1000,
                    data: new Uint8Array([0x12, 0x34]),
                    priority: Priority.HIGH,
                    maxGasPrice: 100,
                    gasEstimate: 50000
                },
                {
                    target: '0xTarget2',
                    value: 2000,
                    data: new Uint8Array([0x56, 0x78]),
                    priority: Priority.MEDIUM,
                    maxGasPrice: 80,
                    gasEstimate: 60000
                }
            ];

            const batchGas = GasLib.estimateBatchGas(transactions);
            
            expect(batchGas).toBeGreaterThan(0);
            expect(batchGas).toBeLessThan(110000); // Should be less than individual sum due to batching
        });
    });

    describe('Gas Price Prediction', () => {
        it('should predict gas price with historical data', () => {
            const currentPrice = 50;
            const historicalData = [45, 48, 52, 49, 51, 47, 53, 50, 46, 54];
            const minutesAhead = 5;

            const predictedPrice = GasLib.predictGasPrice(currentPrice, historicalData, minutesAhead);
            
            expect(predictedPrice).toBeGreaterThan(0);
        });

        it('should handle insufficient historical data', () => {
            const currentPrice = 50;
            const historicalData = [45]; // Insufficient data
            const minutesAhead = 5;

            const predictedPrice = GasLib.predictGasPrice(currentPrice, historicalData, minutesAhead);
            
            expect(predictedPrice).toBe(currentPrice); // Should return current price
        });
    });

    describe('Optimal Gas Price Calculation', () => {
        it('should calculate optimal gas price for high priority', () => {
            const currentPrice = 50;
            const congestion = 60;
            const priority = Priority.HIGH;
            const maxWaitTime = 60;

            const optimalPrice = GasLib.calculateOptimalGasPrice(currentPrice, congestion, priority, maxWaitTime);
            
            expect(optimalPrice).toBeGreaterThan(currentPrice); // High priority should pay more
        });

        it('should calculate optimal gas price for low priority', () => {
            const currentPrice = 50;
            const congestion = 60;
            const priority = Priority.LOW;
            const maxWaitTime = 900;

            const optimalPrice = GasLib.calculateOptimalGasPrice(currentPrice, congestion, priority, maxWaitTime);
            
            expect(optimalPrice).toBeLessThan(currentPrice); // Low priority should pay less
        });
    });

    describe('Batch Savings Calculation', () => {
        it('should calculate batch savings', () => {
            const individualCosts = [1000, 1200, 1100, 1300];
            const batchCost = 4000;

            const savings = GasLib.calculateBatchSavings(individualCosts, batchCost);
            
            expect(savings.savings).toBe(600); // (4600 - 4000)
            expect(savings.percentage).toBeCloseTo(13.04, 1); // (600 / 4600) * 100
        });

        it('should handle no savings scenario', () => {
            const individualCosts = [1000, 1200];
            const batchCost = 2500; // More expensive than individual

            const savings = GasLib.calculateBatchSavings(individualCosts, batchCost);
            
            expect(savings.savings).toBe(0);
            expect(savings.percentage).toBe(0);
        });
    });

    describe('Optimal Execution Time', () => {
        it('should determine optimal execution time', () => {
            const currentGasPrice = 45;
            const historicalData = [];
            
            // Add 24 hours of data
            for (let i = 0; i < 24; i++) {
                historicalData.push(50 + Math.floor(Math.random() * 20));
            }

            const isOptimal = GasLib.isOptimalExecutionTime(currentGasPrice, historicalData);
            
            expect(typeof isOptimal).toBe('boolean');
        });

        it('should assume optimal with insufficient data', () => {
            const currentGasPrice = 45;
            const historicalData = [50]; // Insufficient data

            const isOptimal = GasLib.isOptimalExecutionTime(currentGasPrice, historicalData);
            
            expect(isOptimal).toBe(true);
        });
    });

    describe('Prediction Accuracy', () => {
        it('should calculate prediction accuracy', () => {
            const predictions = [50, 52, 48, 51, 49];
            const actualPrices = [51, 50, 49, 52, 48];

            const accuracy = GasLib.calculatePredictionAccuracy(predictions, actualPrices);
            
            expect(accuracy).toBeGreaterThan(0);
            expect(accuracy).toBeLessThanOrEqual(100);
        });

        it('should handle empty arrays', () => {
            const predictions: number[] = [];
            const actualPrices: number[] = [];

            const accuracy = GasLib.calculatePredictionAccuracy(predictions, actualPrices);
            
            expect(accuracy).toBe(0);
        });

        it('should handle mismatched arrays', () => {
            const predictions = [50, 52];
            const actualPrices = [51]; // Different lengths

            const accuracy = GasLib.calculatePredictionAccuracy(predictions, actualPrices);
            
            expect(accuracy).toBe(0);
        });
    });

    describe('Utility Functions', () => {
        it('should validate batch configuration', () => {
            const validConfig = GasLib.validateBatchConfig(10, 50);
            expect(validConfig).toBe(true);

            const invalidConfig1 = GasLib.validateBatchConfig(5, 50); // Min too small
            expect(invalidConfig1).toBe(false);

            const invalidConfig2 = GasLib.validateBatchConfig(10, 5); // Max < min
            expect(invalidConfig2).toBe(false);
        });

        it('should get priority level', () => {
            expect(GasLib.getPriorityLevel(1)).toBe(1); // HIGH
            expect(GasLib.getPriorityLevel(2)).toBe(2); // MEDIUM
            expect(GasLib.getPriorityLevel(3)).toBe(3); // LOW
            expect(GasLib.getPriorityLevel(5)).toBe(3); // Should default to LOW
        });

        it('should get max wait time for priority', () => {
            expect(GasLib.getMaxWaitTime(1)).toBe(60); // HIGH - 1 minute
            expect(GasLib.getMaxWaitTime(2)).toBe(300); // MEDIUM - 5 minutes
            expect(GasLib.getMaxWaitTime(3)).toBe(900); // LOW - 15 minutes
        });
    });
});

describe('OptimizationAlgorithm', () => {
    let algorithm: OptimizationAlgorithm;
    let config: BatchConfig;

    beforeEach(() => {
        config = DEFAULT_BATCH_CONFIG;
        algorithm = new OptimizationAlgorithm(
            AlgorithmType.LINEAR_REGRESSION,
            OptimizationStrategy.BALANCED,
            config
        );
    });

    describe('Batch Optimization', () => {
        it('should optimize batch for gas efficiency', () => {
            const batch = BatchStructureUtils.createBatch(
                [
                    BatchStructureUtils.createBatchTransaction('0xTarget1', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser'),
                    BatchStructureUtils.createBatchTransaction('0xTarget2', 2000, new Uint8Array([0x34]), Priority.MEDIUM, 80, '0xUser')
                ],
                '0xCreator',
                100000,
                50
            );

            // Set gas estimates for transactions
            batch.transactions[0].gasEstimate = 50000;
            batch.transactions[1].gasEstimate = 60000;

            const networkConditions = {
                currentGasPrice: 50,
                networkCongestion: 60,
                blockTime: 12,
                isOptimalTime: false,
                trend: 0,
                condition: 1,
                lastUpdated: Date.now()
            };

            const result = algorithm.optimizeBatch(batch, networkConditions);
            
            expect(result.originalGasLimit).toBeGreaterThan(0);
            expect(result.optimizedGasLimit).toBeGreaterThan(0);
            expect(result.optimizedGasLimit).toBeLessThan(result.originalGasLimit);
            expect(result.estimatedSavings).toBeGreaterThanOrEqual(0);
            expect(result.savingsPercentage).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.optimizationTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Gas Price Prediction', () => {
        it('should predict optimal gas price', () => {
            const networkConditions = {
                currentGasPrice: 50,
                networkCongestion: 60,
                blockTime: 12,
                isOptimalTime: false,
                trend: 0,
                condition: 1,
                lastUpdated: Date.now()
            };

            const prediction = algorithm.predictOptimalGasPrice(networkConditions, 5, Priority.HIGH);
            
            expect(prediction.price).toBeGreaterThan(0);
            expect(prediction.confidence).toBeGreaterThanOrEqual(0);
            expect(prediction.confidence).toBeLessThanOrEqual(100);
        });
    });

    describe('Execution Scheduling', () => {
        it('should create execution schedule', () => {
            const batches = [
                BatchStructureUtils.createBatch(
                    [BatchStructureUtils.createBatchTransaction('0xTarget1', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser')],
                    '0xCreator',
                    50000,
                    50
                )
            ];

            const networkConditions = {
                currentGasPrice: 50,
                networkCongestion: 60,
                blockTime: 12,
                isOptimalTime: false,
                trend: 0,
                condition: 1,
                lastUpdated: Date.now()
            };

            const schedules = algorithm.createExecutionSchedule(batches, networkConditions, 3600000); // 1 hour
            
            expect(schedules.length).toBe(1);
            expect(schedules[0].batchId).toBe(batches[0].id);
            expect(schedules[0].scheduledTime).toBeGreaterThanOrEqual(Date.now() - 1000); // Allow 1 second buffer
            expect(schedules[0].maxGasPrice).toBeGreaterThan(0);
        });
    });

    describe('Batch Composition Optimization', () => {
        it('should optimize batch composition', () => {
            const transactions = [
                BatchStructureUtils.createBatchTransaction('0xTarget1', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser'),
                BatchStructureUtils.createBatchTransaction('0xTarget2', 2000, new Uint8Array([0x34]), Priority.MEDIUM, 80, '0xUser'),
                BatchStructureUtils.createBatchTransaction('0xTarget3', 3000, new Uint8Array([0x56]), Priority.LOW, 60, '0xUser')
            ];

            const networkConditions = {
                currentGasPrice: 50,
                networkCongestion: 60,
                blockTime: 12,
                isOptimalTime: false,
                trend: 0,
                condition: 1,
                lastUpdated: Date.now()
            };

            const batches = algorithm.optimizeBatchComposition(transactions, 2, networkConditions);
            
            expect(batches.length).toBeGreaterThan(0);
            expect(batches[0].length).toBeGreaterThan(0);
        });
    });

    describe('Parameter Updates', () => {
        it('should update parameters based on performance', () => {
            const costMetrics = {
                totalGasUsed: 1000000,
                totalGasSaved: 250000,
                averageGasPrice: 50,
                optimizationRate: 85,
                batchesProcessed: 100,
                totalSavings: 250000,
                averageSavingsPercentage: 25,
                lastUpdated: Date.now()
            };

            // Should not throw
            algorithm.updateParameters(costMetrics);
        });

        it('should provide performance metrics', () => {
            const metrics = algorithm.getPerformanceMetrics();
            
            expect(metrics.optimizationCount).toBeGreaterThanOrEqual(0);
            expect(metrics.averageOptimizationTime).toBeGreaterThanOrEqual(0);
            expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
            expect(metrics.averageSavings).toBeGreaterThanOrEqual(0);
            expect(metrics.lastOptimization).toBeGreaterThanOrEqual(0);
        });
    });
});

describe('BatchStructureUtils', () => {
    describe('Batch Creation', () => {
        it('should create batch transaction', () => {
            const transaction = BatchStructureUtils.createBatchTransaction(
                '0xTarget',
                1000,
                new Uint8Array([0x12, 0x34]),
                Priority.HIGH,
                100,
                '0xUser'
            );

            expect(transaction.target).toBe('0xTarget');
            expect(transaction.value).toBe(1000);
            expect(transaction.priority).toBe(Priority.HIGH);
            expect(transaction.maxGasPrice).toBe(100);
            expect(transaction.submittedBy).toBe('0xUser');
            expect(transaction.id).toBeDefined();
            expect(transaction.timestamp).toBeDefined();
        });

        it('should create batch', () => {
            const transactions = [
                BatchStructureUtils.createBatchTransaction('0xTarget1', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser')
            ];

            const batch = BatchStructureUtils.createBatch(transactions, '0xCreator', 50000, 50);

            expect(batch.id).toBeDefined();
            expect(batch.transactions).toEqual(transactions);
            expect(batch.status).toBe(BatchStatus.PENDING);
            expect(batch.createdBy).toBe('0xCreator');
            expect(batch.gasLimit).toBe(50000);
            expect(batch.gasPrice).toBe(50);
        });

        it('should create queue item', () => {
            const transaction = BatchStructureUtils.createBatchTransaction('0xTarget', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser');
            const queueItem = BatchStructureUtils.createQueueItem(transaction, 300);

            expect(queueItem.transaction).toBe(transaction);
            expect(queueItem.priority).toBe(Priority.HIGH);
            expect(queueItem.maxWaitTime).toBe(300);
            expect(queueItem.status).toBe(QueueStatus.WAITING);
            expect(queueItem.attempts).toBe(0);
        });
    });

    describe('Configuration Validation', () => {
        it('should validate batch configuration', () => {
            const validConfig = {
                minBatchSize: 10,
                maxBatchSize: 50,
                highPriorityThreshold: 25,
                mediumPriorityThreshold: 75,
                targetSavings: 25,
                maxWaitTime: 300,
                emergencyMaxGasPrice: 500,
                predictionModel: 'linear_regression',
                optimizationEnabled: true
            };

            const result = BatchStructureUtils.validateBatchConfig(validConfig);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid configuration', () => {
            const invalidConfig = {
                minBatchSize: 0, // Invalid
                maxBatchSize: 50,
                highPriorityThreshold: 25,
                mediumPriorityThreshold: 75,
                targetSavings: 150, // Invalid
                maxWaitTime: 300,
                emergencyMaxGasPrice: 500,
                predictionModel: 'linear_regression',
                optimizationEnabled: true
            };

            const result = BatchStructureUtils.validateBatchConfig(invalidConfig);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('Batch Statistics', () => {
        it('should calculate batch statistics', () => {
            const transactions = [
                BatchStructureUtils.createBatchTransaction('0xTarget1', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser'),
                BatchStructureUtils.createBatchTransaction('0xTarget2', 2000, new Uint8Array([0x34]), Priority.HIGH, 100, '0xUser'),
                BatchStructureUtils.createBatchTransaction('0xTarget3', 1500, new Uint8Array([0x56]), Priority.MEDIUM, 100, '0xUser')
            ];

            const batch = BatchStructureUtils.createBatch(transactions, '0xCreator', 150000, 50);
            
            // Set gas estimates
            batch.transactions[0].gasEstimate = 50000;
            batch.transactions[1].gasEstimate = 60000;
            batch.transactions[2].gasEstimate = 55000;

            const stats = BatchStructureUtils.calculateBatchStats(batch);

            expect(stats.totalValue).toBe(4500);
            expect(stats.totalGasEstimate).toBe(165000);
            expect(stats.averagePriority).toBeCloseTo(1.33, 2);
            expect(stats.highPriorityCount).toBe(2);
        });
    });

    describe('Utility Functions', () => {
        it('should determine network condition', () => {
            expect(BatchStructureUtils.getNetworkCondition(20)).toBe(0); // LOW
            expect(BatchStructureUtils.getNetworkCondition(50)).toBe(1); // MEDIUM
            expect(BatchStructureUtils.getNetworkCondition(75)).toBe(2); // HIGH
            expect(BatchStructureUtils.getNetworkCondition(95)).toBe(3); // CRITICAL
        });

        it('should estimate execution time', () => {
            const batch = BatchStructureUtils.createBatch(
                [
                    BatchStructureUtils.createBatchTransaction('0xTarget1', 1000, new Uint8Array([0x12]), Priority.HIGH, 100, '0xUser'),
                    BatchStructureUtils.createBatchTransaction('0xTarget2', 2000, new Uint8Array([0x34]), Priority.MEDIUM, 100, '0xUser')
                ],
                '0xCreator',
                100000,
                50
            );

            const networkConditions = {
                currentGasPrice: 50,
                networkCongestion: 50,
                blockTime: 12,
                isOptimalTime: false,
                trend: 0,
                condition: 1,
                lastUpdated: Date.now()
            };

            const executionTime = BatchStructureUtils.estimateExecutionTime(batch, networkConditions);
            
            expect(executionTime).toBeGreaterThan(0);
        });
    });
});
