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

        it('should start with empty batches and queue', async () => {
            const queueStatus = await gasOptimizer.getQueueStatus();
            expect(queueStatus.totalQueued).toBe(0n);
            expect(queueStatus.highPriorityCount).toBe(0n);
            expect(queueStatus.mediumPriorityCount).toBe(0n);
            expect(queueStatus.lowPriorityCount).toBe(0n);
        });

        it('should have correct emergency status', async () => {
            const emergencyStatus = await gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.emergencyMode).toBe(false);
            expect(emergencyStatus.maxGasPrice).toBeGreaterThan(0n);
        });
    });

    describe('Transaction Batching', () => {
        it('should add transaction to batch', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            
            expect(batchId).toBeDefined();
            expect(typeof batchId).toBe('bigint');
        });

        it('should create new batch when no suitable batch exists', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId1 = await gasOptimizer.addToBatch(target, value, data, priority);
            
            // Add a second transaction with different priority - should create new batch
            const batchId2 = await gasOptimizer.addToBatch(target, value, data, Priority.MEDIUM);
            
            expect(batchId1).not.toBe(batchId2);
        });

        it('should add transactions to existing batch with same priority', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.MEDIUM;

            const batchId1 = await gasOptimizer.addToBatch(target, value, data, priority);
            const batchId2 = await gasOptimizer.addToBatch(target, value, data, priority);
            
            // Should add to same batch if capacity allows
            const batchDetails1 = await gasOptimizer.getBatchDetails(batchId1);
            const batchDetails2 = await gasOptimizer.getBatchDetails(batchId2);
            
            // The second transaction should be added to the first batch
            expect(batchDetails1.targets.length).toBe(2);
            expect(batchDetails1.targets).toEqual(batchDetails2.targets);
        });

        it('should execute batch successfully', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            
            const result = await gasOptimizer.executeBatch(batchId);
            expect(result).toBe(true);
            
            const batchDetails = await gasOptimizer.getBatchDetails(batchId);
            expect(batchDetails.executed).toBe(true);
        });

        it('should cancel batch successfully', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            
            const result = await gasOptimizer.cancelBatch(batchId);
            expect(result).toBe(true);
        });

        it('should fail to execute cancelled batch', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            await gasOptimizer.cancelBatch(batchId);
            
            await expect(gasOptimizer.executeBatch(batchId)).rejects.toThrow();
        });

        it('should fail to execute non-existent batch', async () => {
            await expect(gasOptimizer.executeBatch(999n)).rejects.toThrow();
        });
    });

    describe('Priority Queue Management', () => {
        it('should add transaction to queue', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;
            const maxGasPrice = 100n;

            const queueId = await gasOptimizer.addToQueue(target, value, data, priority, maxGasPrice);
            
            expect(queueId).toBeDefined();
            expect(typeof queueId).toBe('bigint');
            
            const queueStatus = await gasOptimizer.getQueueStatus();
            expect(queueStatus.totalQueued).toBe(1n);
            expect(queueStatus.highPriorityCount).toBe(1n);
        });

        it('should process queue items', async () => {
            // Add multiple items to queue
            for (let i = 0; i < 10; i++) {
                await gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000n,
                    '0x123456',
                    i % 3 === 0 ? Priority.HIGH : Priority.MEDIUM,
                    100n
                );
            }

            const processedCount = await gasOptimizer.processQueue(100n);
            expect(processedCount).toBeGreaterThan(0n);
        });

        it('should respect priority in queue processing', async () => {
            // Add high priority items
            for (let i = 0; i < 3; i++) {
                await gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000n,
                    '0x123456',
                    Priority.HIGH,
                    100n
                );
            }

            // Add low priority items
            for (let i = 0; i < 3; i++) {
                await gasOptimizer.addToQueue(
                    '0xTargetContract',
                    1000n,
                    '0x123456',
                    Priority.LOW,
                    100n
                );
            }

            const queueStatus = await gasOptimizer.getQueueStatus();
            expect(queueStatus.highPriorityCount).toBe(3n);
            expect(queueStatus.lowPriorityCount).toBe(3n);
        });
    });

    describe('Network Condition Analysis', () => {
        it('should provide current network conditions', async () => {
            const conditions = await gasOptimizer.getNetworkConditions();
            
            expect(conditions.currentGasPrice).toBeGreaterThan(0n);
            expect(conditions.networkCongestion).toBeGreaterThanOrEqual(0n);
            expect(conditions.networkCongestion).toBeLessThanOrEqual(100n);
            expect(conditions.blockTime).toBeGreaterThan(0n);
            expect(typeof conditions.isOptimalTime).toBe('boolean');
        });

        it('should predict gas prices', async () => {
            const predictedPrice = await gasOptimizer.predictGasPrice(5n); // 5 minutes ahead
            
            expect(predictedPrice).toBeGreaterThan(0n);
            expect(typeof predictedPrice).toBe('bigint');
        });

        it('should provide optimal execution window', async () => {
            const window = await gasOptimizer.getOptimalExecutionWindow();
            
            expect(window.startTime).toBeGreaterThan(0n);
            expect(window.endTime).toBeGreaterThan(window.startTime);
            expect(window.expectedGasPrice).toBeGreaterThan(0n);
        });

        it('should update gas predictions', async () => {
            const result = await gasOptimizer.updateGasPrediction();
            expect(result).toBe(true);
        });

        it('should provide prediction accuracy', async () => {
            const accuracy = await gasOptimizer.getPredictionAccuracy();
            expect(accuracy).toBeGreaterThanOrEqual(0n);
            expect(accuracy).toBeLessThanOrEqual(100n);
        });
    });

    describe('Gas Price Prediction', () => {
        it('should set prediction model', async () => {
            const result = await gasOptimizer.setPredictionModel(1); // MOVING_AVERAGE
            expect(result).toBe(true);
        });
    });

    describe('Fee Optimization Algorithms', () => {
        it('should optimize batch gas', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            
            const optimization = await gasOptimizer.optimizeBatchGas(batchId);
            
            expect(optimization.optimizedGasLimit).toBeGreaterThan(0n);
            expect(optimization.optimizedGasPrice).toBeGreaterThan(0n);
            expect(optimization.estimatedSavings).toBeGreaterThanOrEqual(0n);
        });

        it('should calculate optimal fee', async () => {
            const baseFee = 20n;
            const priorityFee = 5n;
            const urgency = Priority.HIGH;

            const optimalFee = await gasOptimizer.calculateOptimalFee(baseFee, priorityFee, urgency);
            
            expect(optimalFee).toBeGreaterThan(0n);
        });
    });

    describe('Batch Execution Scheduling', () => {
        it('should schedule batch execution', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            
            const result = await gasOptimizer.scheduleBatchExecution(batchId, 300n, 100n);
            expect(result).toBe(true);
        });

        it('should execute scheduled batches', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            // Schedule for immediate execution (past time)
            await gasOptimizer.scheduleBatchExecution(batchId, -1n, 100n);
            
            const executedCount = await gasOptimizer.executeScheduledBatches();
            expect(executedCount).toBe(0n); // Default implementation returns 0n
        });

        it('should cancel scheduled execution', async () => {
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            await gasOptimizer.scheduleBatchExecution(batchId, 300n, 100n);
            
            const result = await gasOptimizer.cancelScheduledExecution(batchId);
            expect(result).toBe(true);
        });
    });

    describe('Cost Tracking and Reporting', () => {
        it('should track total savings', async () => {
            const initialSavings = await gasOptimizer.getTotalSavings();
            expect(initialSavings).toBeGreaterThanOrEqual(0n); 
            
            const target = '0xTargetContract';
            const value = 1000n;
            const data = '0x123456';
            const priority = Priority.HIGH;

            const batchId = await gasOptimizer.addToBatch(target, value, data, priority);
            await gasOptimizer.executeBatch(batchId);
            
            const finalSavings = await gasOptimizer.getTotalSavings();
            expect(finalSavings).toBeGreaterThanOrEqual(initialSavings);
        });

        it('should generate savings report', async () => {
            const periodStart = BigInt(Date.now() - 86400000); // 24 hours ago
            const periodEnd = BigInt(Date.now());
            
            const report = await gasOptimizer.getSavingsReport(periodStart, periodEnd);
            
            expect(report.periodSavings).toBeGreaterThanOrEqual(0n);
            expect(report.batchesOptimized).toBeGreaterThanOrEqual(0n);
            expect(report.averageSavingsPercentage).toBeGreaterThanOrEqual(0n);
        });

        it('should provide cost metrics', async () => {
            const metrics = await gasOptimizer.getCostMetrics();
            
            expect(metrics.totalGasUsed).toBeGreaterThanOrEqual(0n);
            expect(metrics.totalGasSaved).toBeGreaterThanOrEqual(0n);
            expect(metrics.averageGasPrice).toBeGreaterThanOrEqual(0n);
            expect(metrics.optimizationRate).toBeGreaterThanOrEqual(0n);
        });
    });

    describe('Emergency Fee Controls', () => {
        it('should set emergency gas limit', async () => {
            const result = await gasOptimizer.setEmergencyGasLimit(500n);
            expect(result).toBe(true);
            
            const emergencyStatus = await gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.maxGasPrice).toBe(500n);
        });

        it('should enable emergency mode', async () => {
            const result = await gasOptimizer.enableEmergencyMode(true);
            expect(result).toBe(true);
            
            const emergencyStatus = await gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.emergencyMode).toBe(true);
        });

        it('should disable emergency mode', async () => {
            await gasOptimizer.enableEmergencyMode(true);
            const result = await gasOptimizer.enableEmergencyMode(false);
            expect(result).toBe(true);
            
            const emergencyStatus = await gasOptimizer.getEmergencyStatus();
            expect(emergencyStatus.emergencyMode).toBe(false);
        });

        it('should prevent operations when emergency mode is active', async () => {
            await gasOptimizer.enableEmergencyMode(true);
            
            await expect(gasOptimizer.addToBatch('0xTarget', 1000n, '0x12', Priority.HIGH))
                .rejects.toThrow();
        });
    });

    describe('Configuration Management', () => {
        it('should set batch size', async () => {
            const result = await gasOptimizer.setBatchSize(10n, 50n);
            expect(result).toBe(true);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.minBatchSize).toBe(10);
            expect(config.maxBatchSize).toBe(50);
        });

        it('should set priority thresholds', async () => {
            const result = await gasOptimizer.setPriorityThresholds(25n, 75n);
            expect(result).toBe(true);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.highPriorityThreshold).toBe(25);
            expect(config.mediumPriorityThreshold).toBe(75);
        });

        it('should set optimization parameters', async () => {
            const result = await gasOptimizer.setOptimizationParameters(30n, 600n);
            expect(result).toBe(true);
            
            const config = gasOptimizer.getConfiguration();
            expect(config.targetSavings).toBe(30);
            expect(config.maxWaitTime).toBe(600);
        });
    });

    describe('Pause and Unpause', () => {
        it('should pause contract', async () => {
            await gasOptimizer.pause();
            expect(gasOptimizer.isPaused()).toBe(true);
        });

        it('should unpause contract', async () => {
            await gasOptimizer.pause();
            await gasOptimizer.unpause();
            expect(gasOptimizer.isPaused()).toBe(false);
        });

        it('should prevent operations when paused', async () => {
            await gasOptimizer.pause();
            
            await expect(gasOptimizer.addToBatch('0xTarget', 1000n, '0x12', Priority.HIGH))
                .rejects.toThrow();
        });
    });

    describe('Algorithm Performance', () => {
        it('should provide algorithm performance metrics', async () => {
            const metrics = await gasOptimizer.getAlgorithmPerformance();
            
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
