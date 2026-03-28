import { IBatchProcessor } from './interfaces/IBatchProcessor';
import { 
    Batch, 
    Transaction, 
    BatchStatus, 
    TransactionPriority, 
    TransactionType,
    BatchValidationResult, 
    BatchExecutionResult,
    BatchMetrics,
    BatchConfig,
    RollbackData
} from './structures/BatchStructure';
import { BatchingLib } from './libraries/BatchingLib';

/**
 * Main Batch Processor implementation
 * Handles transaction batching, validation, execution, and rollback
 */
export class BatchProcessor implements IBatchProcessor {
    
    // --- State Variables ---
    
    private batches: Map<string, Batch> = new Map();
    private batchNonce: number = 0;
    private transactionNonce: number = 0;
    private config: BatchConfig;
    private metrics: BatchMetrics;
    
    // --- Events ---
    
    public onBatchCreated?: (batch: Batch) => void;
    public onBatchValidated?: (batchId: string, result: BatchValidationResult) => void;
    public onBatchExecutionStarted?: (batchId: string) => void;
    public onBatchExecutionCompleted?: (batchId: string, result: BatchExecutionResult) => void;
    public onBatchRolledBack?: (batchId: string) => void;
    public onBatchCancelled?: (batchId: string, reason: string) => void;
    
    // --- Constructor ---
    
    constructor(config?: Partial<BatchConfig>) {
        this.config = {
            maxTransactionsPerBatch: 100,
            maxGasPerBatch: 50000000,
            validationTimeout: 30000, // 30 seconds
            executionTimeout: 300000, // 5 minutes
            emergencyCancelEnabled: true,
            rollbackEnabled: true,
            gasOptimization: {
                targetGasSavings: 40,
                maxBatchSize: 100,
                minBatchSize: 5,
                priorityThreshold: TransactionPriority.MEDIUM,
                gasPriceThreshold: 100
            },
            ...config
        };
        
        this.metrics = {
            totalBatches: 0,
            successfulBatches: 0,
            failedBatches: 0,
            averageGasSavings: 0,
            averageExecutionTime: 0,
            totalTransactionsProcessed: 0
        };
    }
    
    // --- Batch Creation and Management ---
    
    public createBatch(transactions: Transaction[], submitter: string): string {
        this.batchNonce++;
        const batchId = BatchingLib.generateBatchId(submitter, Date.now(), this.batchNonce);
        
        // Validate all transactions before creating batch
        const validTransactions = transactions.filter(tx => BatchingLib.validateTransaction(tx));
        
        if (validTransactions.length === 0) {
            throw new Error('No valid transactions provided');
        }
        
        if (validTransactions.length > this.config.maxTransactionsPerBatch) {
            throw new Error(`Batch size ${validTransactions.length} exceeds maximum ${this.config.maxTransactionsPerBatch}`);
        }
        
        // Determine batch priority based on highest priority transaction
        const batchPriority = Math.max(...validTransactions.map(tx => tx.priority)) as TransactionPriority;
        
        const batch: Batch = {
            id: batchId,
            transactions: validTransactions,
            status: BatchStatus.PENDING,
            submitter,
            timestamp: Date.now(),
            gasLimit: validTransactions.reduce((sum, tx) => sum + tx.gasLimit, 0),
            gasUsed: 0,
            priority: batchPriority,
            maxTransactions: this.config.maxTransactionsPerBatch
        };
        
        this.batches.set(batchId, batch);
        this.metrics.totalBatches++;
        
        if (this.onBatchCreated) {
            this.onBatchCreated(batch);
        }
        
        return batchId;
    }
    
    public addTransactionToBatch(batchId: string, transaction: Transaction): void {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        if (batch.status !== BatchStatus.PENDING) {
            throw new Error(`Cannot add transaction to batch with status ${batch.status}`);
        }
        
        if (!BatchingLib.validateTransaction(transaction)) {
            throw new Error('Invalid transaction');
        }
        
        if (batch.transactions.length >= batch.maxTransactions) {
            throw new Error('Batch is at maximum capacity');
        }
        
        batch.transactions.push(transaction);
        batch.gasLimit += transaction.gasLimit;
        
        // Update batch priority if needed
        const newPriority = Math.max(batch.priority, transaction.priority) as TransactionPriority;
        if (newPriority !== batch.priority) {
            batch.priority = newPriority;
        }
    }
    
    public removeTransactionFromBatch(batchId: string, transactionId: string): void {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        if (batch.status !== BatchStatus.PENDING) {
            throw new Error(`Cannot remove transaction from batch with status ${batch.status}`);
        }
        
        const transactionIndex = batch.transactions.findIndex(tx => tx.id === transactionId);
        if (transactionIndex === -1) {
            throw new Error(`Transaction ${transactionId} not found in batch`);
        }
        
        const removedTransaction = batch.transactions.splice(transactionIndex, 1)[0];
        batch.gasLimit -= removedTransaction.gasLimit;
        
        // Recalculate batch priority
        if (batch.transactions.length > 0) {
            batch.priority = Math.max(...batch.transactions.map(tx => tx.priority)) as TransactionPriority;
        }
    }
    
    public getBatch(batchId: string): Batch {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        return { ...batch };
    }
    
    public getBatches(status?: BatchStatus): Batch[] {
        const batches = Array.from(this.batches.values());
        if (status !== undefined) {
            return batches.filter(batch => batch.status === status);
        }
        return batches;
    }
    
    // --- Batch Validation ---
    
    public validateBatch(batchId: string): BatchValidationResult {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        batch.status = BatchStatus.VALIDATING;
        
        const validationResult = BatchingLib.validateBatch(batch, this.config.gasOptimization);
        
        if (validationResult.isValid) {
            batch.transactions = validationResult.optimizedTransactions;
            batch.gasLimit = validationResult.gasEstimate;
        }
        
        if (this.onBatchValidated) {
            this.onBatchValidated(batchId, validationResult);
        }
        
        return validationResult;
    }
    
    public validateTransaction(transaction: Transaction): boolean {
        return BatchingLib.validateTransaction(transaction);
    }
    
    // --- Batch Execution ---
    
    public async executeBatch(batchId: string): Promise<BatchExecutionResult> {
        return this.executeBatchWithPriority(batchId, TransactionPriority.MEDIUM);
    }
    
    public async executeBatchWithPriority(batchId: string, priority: TransactionPriority): Promise<BatchExecutionResult> {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        if (batch.status !== BatchStatus.VALIDATING && batch.status !== BatchStatus.PENDING) {
            throw new Error(`Batch ${batchId} is not in a valid state for execution`);
        }
        
        // Validate batch before execution
        const validationResult = this.validateBatch(batchId);
        if (!validationResult.isValid) {
            throw new Error(`Batch validation failed: ${validationResult.errors.join(', ')}`);
        }
        
        batch.status = BatchStatus.EXECUTING;
        batch.executionBlock = Date.now(); // Simulated block number
        
        if (this.onBatchExecutionStarted) {
            this.onBatchExecutionStarted(batchId);
        }
        
        const startTime = Date.now();
        const result: BatchExecutionResult = {
            batchId,
            success: false,
            executedTransactions: [],
            failedTransactions: [],
            gasUsed: 0,
            executionTime: 0,
            rollbackRequired: false
        };
        
        try {
            // Execute transactions in priority order
            const sortedTransactions = BatchingLib.sortTransactionsByPriority(batch.transactions);
            const rollbackData: RollbackData[] = [];
            
            for (const transaction of sortedTransactions) {
                try {
                    // Simulate transaction execution
                    const executionResult = await this.executeTransaction(transaction);
                    
                    if (executionResult.success) {
                        result.executedTransactions.push(transaction.id);
                        result.gasUsed += transaction.gasLimit;
                        
                        // Create rollback data if enabled
                        if (this.config.rollbackEnabled && BatchingLib.canRollback(transaction.type)) {
                            const rollbackItem = BatchingLib.createRollbackData(
                                transaction, 
                                executionResult.beforeState, 
                                executionResult.afterState
                            );
                            rollbackData.push(rollbackItem);
                        }
                    } else {
                        result.failedTransactions.push(transaction.id);
                        result.rollbackRequired = true;
                        break;
                    }
                } catch (error) {
                    result.failedTransactions.push(transaction.id);
                    result.rollbackRequired = true;
                    break;
                }
            }
            
            result.executionTime = Date.now() - startTime;
            result.success = result.failedTransactions.length === 0;
            
            batch.gasUsed = result.gasUsed;
            batch.rollbackData = rollbackData;
            
            if (result.success) {
                batch.status = BatchStatus.COMPLETED;
                this.metrics.successfulBatches++;
            } else {
                batch.status = BatchStatus.FAILED;
                this.metrics.failedBatches++;
                
                // Auto-rollback if enabled and required
                if (this.config.rollbackEnabled && result.rollbackRequired) {
                    await this.rollbackBatch(batchId);
                }
            }
            
            // Update metrics
            this.updateMetrics(result);
            
        } catch (error) {
            batch.status = BatchStatus.FAILED;
            this.metrics.failedBatches++;
            result.success = false;
            result.executionTime = Date.now() - startTime;
        }
        
        if (this.onBatchExecutionCompleted) {
            this.onBatchExecutionCompleted(batchId, result);
        }
        
        return result;
    }
    
    // --- Rollback and Emergency Functions ---
    
    public async rollbackBatch(batchId: string): Promise<boolean> {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        if (!this.config.rollbackEnabled) {
            throw new Error('Rollback is not enabled');
        }
        
        if (!batch.rollbackData || batch.rollbackData.length === 0) {
            throw new Error('No rollback data available for this batch');
        }
        
        try {
            // Execute rollback in reverse order
            const reversedRollbackData = [...batch.rollbackData].reverse();
            
            for (const rollbackItem of reversedRollbackData) {
                if (rollbackItem.canRollback) {
                    await this.executeRollback(rollbackItem);
                }
            }
            
            batch.status = BatchStatus.ROLLED_BACK;
            
            if (this.onBatchRolledBack) {
                this.onBatchRolledBack(batchId);
            }
            
            return true;
        } catch (error) {
            batch.status = BatchStatus.FAILED;
            return false;
        }
    }
    
    public emergencyCancelBatch(batchId: string, reason: string): void {
        if (!this.config.emergencyCancelEnabled) {
            throw new Error('Emergency cancellation is not enabled');
        }
        
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        if (batch.status === BatchStatus.COMPLETED) {
            throw new Error('Cannot cancel a completed batch');
        }
        
        batch.status = BatchStatus.CANCELLED;
        batch.failureReason = reason;
        
        if (this.onBatchCancelled) {
            this.onBatchCancelled(batchId, reason);
        }
    }
    
    // --- Gas Optimization ---
    
    public optimizeBatchGas(batchId: string): BatchValidationResult {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        const optimizedTransactions = BatchingLib.optimizeTransactions(
            batch.transactions, 
            this.config.gasOptimization
        );
        
        const gasEstimate = BatchingLib.estimateGasCost(optimizedTransactions);
        const gasSavings = BatchingLib.calculateGasSavings(batch.transactions, optimizedTransactions);
        
        return {
            isValid: true,
            errors: [],
            warnings: gasSavings < this.config.gasOptimization.targetGasSavings 
                ? [`Gas savings ${gasSavings.toFixed(2)}% below target ${this.config.gasOptimization.targetGasSavings}%`]
                : [],
            gasEstimate,
            optimizedTransactions
        };
    }
    
    public estimateBatchGas(batchId: string): number {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        return BatchingLib.estimateGasCost(batch.transactions);
    }
    
    // --- Status and Monitoring ---
    
    public getBatchStatus(batchId: string): BatchStatus {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        return batch.status;
    }
    
    public getBatchMetrics(): BatchMetrics {
        return { ...this.metrics };
    }
    
    public getTransactionsByPriority(batchId: string, priority: TransactionPriority): Transaction[] {
        const batch = this.batches.get(batchId);
        if (!batch) {
            throw new Error(`Batch ${batchId} not found`);
        }
        
        return batch.transactions.filter(tx => tx.priority === priority);
    }
    
    // --- Configuration ---
    
    public updateConfig(config: Partial<BatchConfig>): void {
        this.config = { ...this.config, ...config };
    }
    
    public getConfig(): BatchConfig {
        return { ...this.config };
    }
    
    // --- Private Helper Methods ---
    
    private async executeTransaction(transaction: Transaction): Promise<{success: boolean, beforeState: any, afterState: any}> {
        // Simulate transaction execution
        // In a real implementation, this would interact with the blockchain
        
        const beforeState = {
            balance: 1000,
            nonce: this.transactionNonce
        };
        
        // Simulate execution delay
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const afterState = {
            balance: beforeState.balance - (transaction.value || 0),
            nonce: beforeState.nonce + 1
        };
        
        // Simulate occasional failures for testing - but make it more predictable
        // Only fail if the transaction ID contains "fail" for deterministic testing
        const shouldFail = transaction.id.includes('fail');
        const success = !shouldFail;
        
        return { success, beforeState, afterState };
    }
    
    private async executeRollback(rollbackData: RollbackData): Promise<void> {
        // Simulate rollback execution
        await new Promise(resolve => setTimeout(resolve, 5));
        
        // In a real implementation, this would restore the beforeState
        console.log(`Rolling back transaction ${rollbackData.transactionId}`);
    }
    
    private updateMetrics(result: BatchExecutionResult): void {
        this.metrics.totalTransactionsProcessed += result.executedTransactions.length;
        
        // Update average execution time
        const totalExecutionTime = this.metrics.averageExecutionTime * (this.metrics.successfulBatches + this.metrics.failedBatches - 1);
        this.metrics.averageExecutionTime = (totalExecutionTime + result.executionTime) / (this.metrics.successfulBatches + this.metrics.failedBatches);
        
        // Update average gas savings (simplified calculation)
        const currentGasSavings = 40; // Placeholder - would calculate actual savings
        const totalGasSavings = this.metrics.averageGasSavings * (this.metrics.successfulBatches - 1);
        this.metrics.averageGasSavings = (totalGasSavings + currentGasSavings) / this.metrics.successfulBatches;
    }
}
