import { BatchProcessor } from '../../contracts/batching/BatchProcessor';
import { 
    Transaction, 
    TransactionType, 
    TransactionPriority, 
    BatchStatus,
    BatchConfig 
} from '../../contracts/batching/structures/BatchStructure';
import { BatchingLib } from '../../contracts/batching/libraries/BatchingLib';

describe('BatchProcessor', () => {
    let batchProcessor: BatchProcessor;
    let mockConfig: Partial<BatchConfig>;

    beforeEach(() => {
        mockConfig = {
            maxTransactionsPerBatch: 50,
            maxGasPerBatch: 25000000,
            validationTimeout: 5000,
            executionTimeout: 60000,
            emergencyCancelEnabled: true,
            rollbackEnabled: true,
            gasOptimization: {
                targetGasSavings: 30,
                maxBatchSize: 50,
                minBatchSize: 2,
                priorityThreshold: TransactionPriority.MEDIUM,
                gasPriceThreshold: 50
            }
        };
        
        batchProcessor = new BatchProcessor(mockConfig);
    });

    describe('Batch Creation', () => {
        test('should create a batch with valid transactions', () => {
            const transactions = createMockTransactions(5);
            const submitter = '0x1234567890123456789012345678901234567890';
            
            const batchId = batchProcessor.createBatch(transactions, submitter);
            
            expect(batchId).toBeDefined();
            expect(typeof batchId).toBe('string');
            
            const batch = batchProcessor.getBatch(batchId);
            expect(batch.id).toBe(batchId);
            expect(batch.submitter).toBe(submitter);
            expect(batch.transactions).toHaveLength(5);
            expect(batch.status).toBe(BatchStatus.PENDING);
        });

        test('should throw error when creating batch with no valid transactions', () => {
            const invalidTransactions = [
                createMockTransaction('', TransactionType.TRANSFER) // Empty from address
            ];
            
            expect(() => {
                batchProcessor.createBatch(invalidTransactions, '0x123');
            }).toThrow('No valid transactions provided');
        });

        test('should throw error when batch size exceeds maximum', () => {
            const transactions = createMockTransactions(60); // Exceeds max of 50
            
            expect(() => {
                batchProcessor.createBatch(transactions, '0x123');
            }).toThrow('Batch size 60 exceeds maximum 50');
        });

        test('should set correct batch priority based on highest priority transaction', () => {
            const transactions = [
                createMockTransaction('0x123', TransactionType.TRANSFER, TransactionPriority.LOW),
                createMockTransaction('0x123', TransactionType.TRANSFER, TransactionPriority.HIGH),
                createMockTransaction('0x123', TransactionType.TRANSFER, TransactionPriority.MEDIUM)
            ];
            
            const batchId = batchProcessor.createBatch(transactions, '0x123');
            const batch = batchProcessor.getBatch(batchId);
            
            expect(batch.priority).toBe(TransactionPriority.HIGH);
        });
    });

    describe('Transaction Management', () => {
        let batchId: string;

        beforeEach(() => {
            const transactions = createMockTransactions(3);
            batchId = batchProcessor.createBatch(transactions, '0x123');
        });

        test('should add transaction to pending batch', () => {
            const newTransaction = createMockTransaction('0x123', TransactionType.TRANSFER);
            
            batchProcessor.addTransactionToBatch(batchId, newTransaction);
            
            const batch = batchProcessor.getBatch(batchId);
            expect(batch.transactions).toHaveLength(4);
            expect(batch.transactions).toContainEqual(newTransaction);
        });

        test('should throw error when adding transaction to non-pending batch', () => {
            batchProcessor.validateBatch(batchId);
            
            const newTransaction = createMockTransaction('0x123', TransactionType.TRANSFER);
            
            expect(() => {
                batchProcessor.addTransactionToBatch(batchId, newTransaction);
            }).toThrow('Cannot add transaction to batch with status validating');
        });

        test('should remove transaction from pending batch', () => {
            const batch = batchProcessor.getBatch(batchId);
            const transactionToRemove = batch.transactions[0];
            
            batchProcessor.removeTransactionFromBatch(batchId, transactionToRemove.id);
            
            const updatedBatch = batchProcessor.getBatch(batchId);
            expect(updatedBatch.transactions).toHaveLength(2);
            expect(updatedBatch.transactions).not.toContainEqual(transactionToRemove);
        });

        test('should throw error when removing transaction from non-pending batch', () => {
            batchProcessor.validateBatch(batchId);
            
            const batch = batchProcessor.getBatch(batchId);
            const transactionToRemove = batch.transactions[0];
            
            expect(() => {
                batchProcessor.removeTransactionFromBatch(batchId, transactionToRemove.id);
            }).toThrow('Cannot remove transaction from batch with status validating');
        });
    });

    describe('Batch Validation', () => {
        let batchId: string;

        beforeEach(() => {
            const transactions = createMockTransactions(5);
            batchId = batchProcessor.createBatch(transactions, '0x123');
        });

        test('should validate batch successfully', () => {
            const result = batchProcessor.validateBatch(batchId);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.gasEstimate).toBeGreaterThan(0);
            expect(result.optimizedTransactions).toBeDefined();
        });

        test('should fail validation for batch with invalid transactions', () => {
            // Create a batch with one valid and one invalid transaction
            const mixedTransactions = [
                createMockTransaction('0x123', TransactionType.TRANSFER), // Valid
                createMockTransaction('', TransactionType.TRANSFER) // Invalid - empty from address
            ];
            const mixedBatchId = batchProcessor.createBatch(mixedTransactions, '0x123');
            
            // Manually add an invalid transaction to the batch after creation
            const batch = batchProcessor.getBatch(mixedBatchId);
            batch.transactions.push(createMockTransaction('', TransactionType.TRANSFER));
            
            const result = batchProcessor.validateBatch(mixedBatchId);
            
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should optimize transactions during validation', () => {
            const result = batchProcessor.validateBatch(batchId);
            
            expect(result.optimizedTransactions).toBeDefined();
            expect(result.optimizedTransactions.length).toBeGreaterThan(0);
            expect(result.gasEstimate).toBeGreaterThan(0);
        });
    });

    describe('Batch Execution', () => {
        let batchId: string;

        beforeEach(() => {
            const transactions = createMockTransactions(5);
            batchId = batchProcessor.createBatch(transactions, '0x123');
        });

        test('should execute batch successfully', async () => {
            const result = await batchProcessor.executeBatch(batchId);
            
            expect(result.success).toBe(true);
            expect(result.executedTransactions).toHaveLength(5);
            expect(result.failedTransactions).toHaveLength(0);
            expect(result.gasUsed).toBeGreaterThan(0);
            expect(result.executionTime).toBeGreaterThan(0);
            
            const batch = batchProcessor.getBatch(batchId);
            expect(batch.status).toBe(BatchStatus.COMPLETED);
        });

        test('should execute batch with priority', async () => {
            const result = await batchProcessor.executeBatchWithPriority(batchId, TransactionPriority.HIGH);
            
            expect(result.success).toBe(true);
            expect(result.executedTransactions).toHaveLength(5);
        });

        test('should handle execution failure and rollback', async () => {
            // Mock a transaction that will fail
            const failingTransactions = [
                createMockTransaction('0x123', TransactionType.TRANSFER),
                createMockTransaction('0x123', TransactionType.TRANSFER)
            ];
            
            // Override the executeTransaction method to simulate failure
            const originalExecute = (batchProcessor as any).executeTransaction;
            (batchProcessor as any).executeTransaction = jest.fn().mockImplementation(() => {
                return Promise.resolve({ success: false, beforeState: {}, afterState: {} });
            });
            
            const failBatchId = batchProcessor.createBatch(failingTransactions, '0x123');
            const result = await batchProcessor.executeBatch(failBatchId);
            
            expect(result.success).toBe(false);
            expect(result.failedTransactions.length).toBeGreaterThan(0);
            expect(result.rollbackRequired).toBe(true);
            
            // Restore original method
            (batchProcessor as any).executeTransaction = originalExecute;
        });

        test('should throw error when executing non-existent batch', async () => {
            await expect(batchProcessor.executeBatch('non-existent')).rejects.toThrow('Batch non-existent not found');
        });
    });

    describe('Emergency Functions', () => {
        let batchId: string;

        beforeEach(() => {
            const transactions = createMockTransactions(5);
            batchId = batchProcessor.createBatch(transactions, '0x123');
        });

        test('should emergency cancel batch', () => {
            const reason = 'Security threat detected';
            
            batchProcessor.emergencyCancelBatch(batchId, reason);
            
            const batch = batchProcessor.getBatch(batchId);
            expect(batch.status).toBe(BatchStatus.CANCELLED);
            expect(batch.failureReason).toBe(reason);
        });

        test('should throw error when cancelling completed batch', async () => {
            await batchProcessor.executeBatch(batchId);
            
            expect(() => {
                batchProcessor.emergencyCancelBatch(batchId, 'Test');
            }).toThrow('Cannot cancel a completed batch');
        });

        test('should rollback failed batch', async () => {
            // Execute batch first to generate rollback data
            await batchProcessor.executeBatch(batchId);
            
            // Manually set status to failed for testing
            const batch = batchProcessor.getBatch(batchId);
            batch.status = BatchStatus.FAILED;
            
            const rollbackResult = await batchProcessor.rollbackBatch(batchId);
            
            expect(rollbackResult).toBe(true);
            
            const updatedBatch = batchProcessor.getBatch(batchId);
            expect(updatedBatch.status).toBe(BatchStatus.ROLLED_BACK);
        });
    });

    describe('Gas Optimization', () => {
        let batchId: string;

        beforeEach(() => {
            const transactions = createMockTransactions(10);
            batchId = batchProcessor.createBatch(transactions, '0x123');
        });

        test('should optimize batch gas usage', () => {
            const result = batchProcessor.optimizeBatchGas(batchId);
            
            expect(result.isValid).toBe(true);
            expect(result.optimizedTransactions).toBeDefined();
            expect(result.gasEstimate).toBeGreaterThan(0);
        });

        test('should estimate batch gas cost', () => {
            const gasEstimate = batchProcessor.estimateBatchGas(batchId);
            
            expect(gasEstimate).toBeGreaterThan(0);
            expect(typeof gasEstimate).toBe('number');
        });
    });

    describe('Status and Monitoring', () => {
        let batchId: string;

        beforeEach(() => {
            const transactions = createMockTransactions(5);
            batchId = batchProcessor.createBatch(transactions, '0x123');
        });

        test('should get batch status', () => {
            const status = batchProcessor.getBatchStatus(batchId);
            expect(status).toBe(BatchStatus.PENDING);
        });

        test('should get batch metrics', () => {
            const metrics = batchProcessor.getBatchMetrics();
            
            expect(metrics.totalBatches).toBe(1);
            expect(metrics.successfulBatches).toBe(0);
            expect(metrics.failedBatches).toBe(0);
            expect(metrics.totalTransactionsProcessed).toBe(0);
        });

        test('should get transactions by priority', () => {
            const highPriorityTxs = batchProcessor.getTransactionsByPriority(batchId, TransactionPriority.MEDIUM);
            
            expect(highPriorityTxs).toBeDefined();
            expect(Array.isArray(highPriorityTxs)).toBe(true);
        });

        test('should get batches by status', () => {
            const pendingBatches = batchProcessor.getBatches(BatchStatus.PENDING);
            
            expect(pendingBatches).toHaveLength(1);
            expect(pendingBatches[0].status).toBe(BatchStatus.PENDING);
        });

        test('should get all batches when no status specified', () => {
            const allBatches = batchProcessor.getBatches();
            
            expect(allBatches).toHaveLength(1);
        });
    });

    describe('Configuration', () => {
        test('should update configuration', () => {
            const newConfig = {
                maxTransactionsPerBatch: 75,
                emergencyCancelEnabled: false
            };
            
            batchProcessor.updateConfig(newConfig);
            
            const config = batchProcessor.getConfig();
            expect(config.maxTransactionsPerBatch).toBe(75);
            expect(config.emergencyCancelEnabled).toBe(false);
        });

        test('should get current configuration', () => {
            const config = batchProcessor.getConfig();
            
            expect(config.maxTransactionsPerBatch).toBe(50);
            expect(config.emergencyCancelEnabled).toBe(true);
            expect(config.rollbackEnabled).toBe(true);
            expect(config.gasOptimization).toBeDefined();
        });
    });

    describe('Events', () => {
        test('should emit batch created event', () => {
            const mockCallback = jest.fn();
            batchProcessor.onBatchCreated = mockCallback;
            
            const transactions = createMockTransactions(3);
            const batchId = batchProcessor.createBatch(transactions, '0x123');
            
            expect(mockCallback).toHaveBeenCalled();
            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
                id: batchId,
                submitter: '0x123'
            }));
        });

        test('should emit batch validated event', () => {
            const mockCallback = jest.fn();
            batchProcessor.onBatchValidated = mockCallback;
            
            const transactions = createMockTransactions(3);
            const batchId = batchProcessor.createBatch(transactions, '0x123');
            
            batchProcessor.validateBatch(batchId);
            
            expect(mockCallback).toHaveBeenCalledWith(batchId, expect.any(Object));
        });

        test('should emit batch execution completed event', async () => {
            const mockCallback = jest.fn();
            batchProcessor.onBatchExecutionCompleted = mockCallback;
            
            const transactions = createMockTransactions(3);
            const batchId = batchProcessor.createBatch(transactions, '0x123');
            
            await batchProcessor.executeBatch(batchId);
            
            expect(mockCallback).toHaveBeenCalledWith(batchId, expect.any(Object));
        });
    });
});

// Helper Functions

function createMockTransactions(count: number): Transaction[] {
    const transactions: Transaction[] = [];
    for (let i = 0; i < count; i++) {
        transactions.push(createMockTransaction(
            `0x${i.toString().padStart(40, '0')}`,
            TransactionType.TRANSFER,
            TransactionPriority.MEDIUM
        ));
    }
    return transactions;
}

function createMockTransaction(
    from: string, 
    type: TransactionType = TransactionType.TRANSFER,
    priority: TransactionPriority = TransactionPriority.MEDIUM
): Transaction {
    const timestamp = Date.now();
    const nonce = Math.floor(Math.random() * 1000000);
    
    return {
        id: BatchingLib.generateTransactionId(from, timestamp, nonce),
        type,
        from,
        to: `0x${Math.random().toString(16).substr(2, 40)}`,
        value: Math.floor(Math.random() * 1000),
        priority,
        gasLimit: 21000 + Math.floor(Math.random() * 50000),
        timestamp,
        nonce
    };
}
