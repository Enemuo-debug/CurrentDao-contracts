import { 
    Batch, 
    Transaction, 
    BatchStatus, 
    TransactionPriority, 
    BatchValidationResult, 
    BatchExecutionResult,
    BatchMetrics,
    BatchConfig
} from '../structures/BatchStructure';

/**
 * Interface for Transaction Batch Processor
 * Provides methods for creating, validating, executing, and managing transaction batches
 */
export interface IBatchProcessor {
    
    // --- Batch Creation and Management ---
    
    /**
     * Creates a new batch with the given transactions
     * @param transactions Array of transactions to include in the batch
     * @param submitter Address of the batch submitter
     * @returns The ID of the created batch
     */
    createBatch(transactions: Transaction[], submitter: string): string;
    
    /**
     * Adds a transaction to an existing batch
     * @param batchId ID of the batch to add to
     * @param transaction Transaction to add
     */
    addTransactionToBatch(batchId: string, transaction: Transaction): void;
    
    /**
     * Removes a transaction from a batch
     * @param batchId ID of the batch
     * @param transactionId ID of the transaction to remove
     */
    removeTransactionFromBatch(batchId: string, transactionId: string): void;
    
    /**
     * Gets batch information by ID
     * @param batchId ID of the batch
     * @returns The batch object
     */
    getBatch(batchId: string): Batch;
    
    /**
     * Gets all batches with optional status filter
     * @param status Optional status filter
     * @returns Array of batches
     */
    getBatches(status?: BatchStatus): Batch[];
    
    // --- Batch Validation ---
    
    /**
     * Validates a batch before execution
     * @param batchId ID of the batch to validate
     * @returns Validation result with gas estimate and optimized transactions
     */
    validateBatch(batchId: string): BatchValidationResult;
    
    /**
     * Validates individual transaction
     * @param transaction Transaction to validate
     * @returns True if valid, false otherwise
     */
    validateTransaction(transaction: Transaction): boolean;
    
    // --- Batch Execution ---
    
    /**
     * Executes a validated batch
     * @param batchId ID of the batch to execute
     * @returns Execution result
     */
    executeBatch(batchId: string): Promise<BatchExecutionResult>;
    
    /**
     * Executes batch with priority handling
     * @param batchId ID of the batch
     * @param priority Priority of execution
     * @returns Execution result
     */
    executeBatchWithPriority(batchId: string, priority: TransactionPriority): Promise<BatchExecutionResult>;
    
    // --- Rollback and Emergency Functions ---
    
    /**
     * Rolls back a partially executed batch
     * @param batchId ID of the batch to rollback
     * @returns True if rollback successful
     */
    rollbackBatch(batchId: string): Promise<boolean>;
    
    /**
     * Emergency cancellation of a batch
     * @param batchId ID of the batch to cancel
     * @param reason Reason for cancellation
     */
    emergencyCancelBatch(batchId: string, reason: string): void;
    
    // --- Gas Optimization ---
    
    /**
     * Optimizes gas usage for a batch
     * @param batchId ID of the batch to optimize
     * @returns Optimized transactions and gas savings estimate
     */
    optimizeBatchGas(batchId: string): BatchValidationResult;
    
    /**
     * Estimates gas cost for batch execution
     * @param batchId ID of the batch
     * @returns Estimated gas cost
     */
    estimateBatchGas(batchId: string): number;
    
    // --- Status and Monitoring ---
    
    /**
     * Gets the current status of a batch
     * @param batchId ID of the batch
     * @returns Current batch status
     */
    getBatchStatus(batchId: string): BatchStatus;
    
    /**
     * Gets batch processing metrics
     * @returns Batch metrics
     */
    getBatchMetrics(): BatchMetrics;
    
    /**
     * Gets transactions in a batch by priority
     * @param batchId ID of the batch
     * @param priority Priority level to filter by
     * @returns Array of transactions with specified priority
     */
    getTransactionsByPriority(batchId: string, priority: TransactionPriority): Transaction[];
    
    // --- Configuration ---
    
    /**
     * Updates batch processor configuration
     * @param config New configuration
     */
    updateConfig(config: Partial<BatchConfig>): void;
    
    /**
     * Gets current configuration
     * @returns Current batch processor configuration
     */
    getConfig(): BatchConfig;
    
    // --- Events ---
    
    /**
     * Event emitted when a batch is created
     */
    onBatchCreated?: (batch: Batch) => void;
    
    /**
     * Event emitted when a batch is validated
     */
    onBatchValidated?: (batchId: string, result: BatchValidationResult) => void;
    
    /**
     * Event emitted when a batch execution starts
     */
    onBatchExecutionStarted?: (batchId: string) => void;
    
    /**
     * Event emitted when a batch execution completes
     */
    onBatchExecutionCompleted?: (batchId: string, result: BatchExecutionResult) => void;
    
    /**
     * Event emitted when a batch is rolled back
     */
    onBatchRolledBack?: (batchId: string) => void;
    
    /**
     * Event emitted when a batch is cancelled
     */
    onBatchCancelled?: (batchId: string, reason: string) => void;
}
