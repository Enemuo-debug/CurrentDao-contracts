import { 
    Transaction, 
    Batch, 
    TransactionPriority, 
    TransactionType,
    BatchValidationResult,
    GasOptimizationConfig
} from '../structures/BatchStructure';

/**
 * Library of utility functions for transaction batching
 */
export class BatchingLib {
    
    /**
     * Generates a unique batch ID
     * @param submitter Address of the batch submitter
     * @param timestamp Current timestamp
     * @param nonce Unique nonce
     * @returns Unique batch ID
     */
    static generateBatchId(submitter: string, timestamp: number, nonce: number): string {
        return `batch_${submitter}_${timestamp}_${nonce}`;
    }
    
    /**
     * Generates a unique transaction ID
     * @param from Address of the transaction sender
     * @param timestamp Current timestamp
     * @param nonce Unique nonce
     * @returns Unique transaction ID
     */
    static generateTransactionId(from: string, timestamp: number, nonce: number): string {
        return `tx_${from}_${timestamp}_${nonce}`;
    }
    
    /**
     * Sorts transactions by priority (highest first)
     * @param transactions Array of transactions to sort
     * @returns Sorted transactions
     */
    static sortTransactionsByPriority(transactions: Transaction[]): Transaction[] {
        return [...transactions].sort((a, b) => b.priority - a.priority);
    }
    
    /**
     * Groups transactions by priority level
     * @param transactions Array of transactions
     * @returns Object with transactions grouped by priority
     */
    static groupTransactionsByPriority(transactions: Transaction[]): Record<TransactionPriority, Transaction[]> {
        const groups: Record<TransactionPriority, Transaction[]> = {
            [TransactionPriority.LOW]: [],
            [TransactionPriority.MEDIUM]: [],
            [TransactionPriority.HIGH]: [],
            [TransactionPriority.URGENT]: [],
            [TransactionPriority.EMERGENCY]: []
        };
        
        transactions.forEach(tx => {
            groups[tx.priority].push(tx);
        });
        
        return groups;
    }
    
    /**
     * Validates a single transaction
     * @param transaction Transaction to validate
     * @returns True if valid, false otherwise
     */
    static validateTransaction(transaction: Transaction): boolean {
        // Check required fields
        if (!transaction.id || !transaction.from || !transaction.type) {
            return false;
        }
        
        // Check addresses are not empty
        if (!transaction.from.trim() || (transaction.to && !transaction.to.trim())) {
            return false;
        }
        
        // Check gas limit is reasonable
        if (transaction.gasLimit <= 0 || transaction.gasLimit > 10000000) {
            return false;
        }
        
        // Check nonce is non-negative
        if (transaction.nonce < 0) {
            return false;
        }
        
        // Check timestamp is reasonable
        const now = Date.now();
        if (transaction.timestamp > now + 3600000) { // Allow 1 hour in future
            return false;
        }
        
        return true;
    }
    
    /**
     * Validates a batch of transactions
     * @param batch Batch to validate
     * @param config Gas optimization configuration
     * @returns Validation result
     */
    static validateBatch(batch: Batch, config: GasOptimizationConfig): BatchValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Check batch size
        if (batch.transactions.length === 0) {
            errors.push('Batch cannot be empty');
        }
        
        if (batch.transactions.length > config.maxBatchSize) {
            errors.push(`Batch size ${batch.transactions.length} exceeds maximum ${config.maxBatchSize}`);
        }
        
        if (batch.transactions.length < config.minBatchSize) {
            warnings.push(`Batch size ${batch.transactions.length} is below minimum ${config.minBatchSize}`);
        }
        
        // Validate individual transactions
        const validTransactions: Transaction[] = [];
        batch.transactions.forEach(tx => {
            if (this.validateTransaction(tx)) {
                validTransactions.push(tx);
            } else {
                errors.push(`Invalid transaction: ${tx.id}`);
            }
        });
        
        // Check gas limit
        const totalGasLimit = validTransactions.reduce((sum, tx) => sum + tx.gasLimit, 0);
        if (totalGasLimit > 50000000) { // 50M gas limit
            errors.push(`Total gas limit ${totalGasLimit} exceeds maximum`);
        }
        
        // Check for duplicate transaction IDs
        const transactionIds = validTransactions.map(tx => tx.id);
        const duplicateIds = transactionIds.filter((id, index) => transactionIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            errors.push(`Duplicate transaction IDs: ${duplicateIds.join(', ')}`);
        }
        
        // Optimize transactions
        const optimizedTransactions = this.optimizeTransactions(validTransactions, config);
        const gasEstimate = this.estimateGasCost(optimizedTransactions);
        const gasSavings = this.calculateGasSavings(validTransactions, optimizedTransactions);
        
        if (gasSavings < config.targetGasSavings) {
            warnings.push(`Gas savings ${gasSavings.toFixed(2)}% below target ${config.targetGasSavings}%`);
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            gasEstimate,
            optimizedTransactions
        };
    }
    
    /**
     * Optimizes transactions for gas efficiency
     * @param transactions Array of transactions to optimize
     * @param config Gas optimization configuration
     * @returns Optimized transactions
     */
    static optimizeTransactions(transactions: Transaction[], config: GasOptimizationConfig): Transaction[] {
        // Sort by priority first
        let optimized = this.sortTransactionsByPriority(transactions);
        
        // Group similar transactions together for better batching
        optimized = this.groupSimilarTransactions(optimized);
        
        // Adjust gas limits based on transaction type
        optimized = optimized.map(tx => ({
            ...tx,
            gasLimit: this.optimizeGasLimit(tx)
        }));
        
        // Filter out low priority transactions if gas price is high
        if (config.gasPriceThreshold > 0) {
            optimized = optimized.filter(tx => 
                tx.priority >= config.priorityThreshold || 
                tx.priority === TransactionPriority.EMERGENCY
            );
        }
        
        return optimized;
    }
    
    /**
     * Groups similar transactions together
     * @param transactions Array of transactions
     * @returns Grouped transactions
     */
    static groupSimilarTransactions(transactions: Transaction[]): Transaction[] {
        const groups: Record<TransactionType, Transaction[]> = {
            [TransactionType.TRANSFER]: [],
            [TransactionType.APPROVE]: [],
            [TransactionType.MINT]: [],
            [TransactionType.BURN]: [],
            [TransactionType.STAKE]: [],
            [TransactionType.UNSTAKE]: [],
            [TransactionType.SWAP]: [],
            [TransactionType.CUSTOM]: []
        };
        
        // Group by transaction type
        transactions.forEach(tx => {
            groups[tx.type].push(tx);
        });
        
        // Concatenate groups in priority order
        const priorityOrder = [
            TransactionPriority.EMERGENCY,
            TransactionPriority.URGENT,
            TransactionPriority.HIGH,
            TransactionPriority.MEDIUM,
            TransactionPriority.LOW
        ];
        
        const result: Transaction[] = [];
        priorityOrder.forEach(priority => {
            Object.values(groups).forEach(group => {
                const priorityTransactions = group.filter(tx => tx.priority === priority);
                result.push(...priorityTransactions);
            });
        });
        
        return result;
    }
    
    /**
     * Optimizes gas limit for a specific transaction
     * @param transaction Transaction to optimize
     * @returns Optimized gas limit
     */
    static optimizeGasLimit(transaction: Transaction): number {
        const baseGasLimits: Record<TransactionType, number> = {
            [TransactionType.TRANSFER]: 21000,
            [TransactionType.APPROVE]: 45000,
            [TransactionType.MINT]: 80000,
            [TransactionType.BURN]: 50000,
            [TransactionType.STAKE]: 100000,
            [TransactionType.UNSTAKE]: 90000,
            [TransactionType.SWAP]: 150000,
            [TransactionType.CUSTOM]: 100000
        };
        
        const baseLimit = baseGasLimits[transaction.type] || 100000;
        
        // Add buffer based on transaction complexity
        let buffer = 0.2; // 20% buffer
        if (transaction.data && transaction.data.length > 0) {
            buffer += Math.min(transaction.data.length / 1000, 0.5); // Up to 50% extra for data
        }
        
        return Math.floor(baseLimit * (1 + buffer));
    }
    
    /**
     * Estimates total gas cost for transactions
     * @param transactions Array of transactions
     * @returns Total gas estimate
     */
    static estimateGasCost(transactions: Transaction[]): number {
        return transactions.reduce((total, tx) => total + tx.gasLimit, 0);
    }
    
    /**
     * Calculates gas savings percentage
     * @param originalTransactions Original transactions
     * @param optimizedTransactions Optimized transactions
     * @returns Gas savings percentage
     */
    static calculateGasSavings(originalTransactions: Transaction[], optimizedTransactions: Transaction[]): number {
        const originalGas = this.estimateGasCost(originalTransactions);
        const optimizedGas = this.estimateGasCost(optimizedTransactions);
        
        if (originalGas === 0) return 0;
        
        return ((originalGas - optimizedGas) / originalGas) * 100;
    }
    
    /**
     * Calculates batch execution time estimate
     * @param transactions Array of transactions
     * @returns Estimated execution time in milliseconds
     */
    static estimateExecutionTime(transactions: Transaction[]): number {
        const baseTimePerTransaction = 50; // 50ms base per transaction
        const complexityMultiplier: Record<TransactionType, number> = {
            [TransactionType.TRANSFER]: 1.0,
            [TransactionType.APPROVE]: 1.2,
            [TransactionType.MINT]: 1.5,
            [TransactionType.BURN]: 1.3,
            [TransactionType.STAKE]: 2.0,
            [TransactionType.UNSTAKE]: 1.8,
            [TransactionType.SWAP]: 2.5,
            [TransactionType.CUSTOM]: 2.0
        };
        
        return transactions.reduce((total, tx) => {
            const multiplier = complexityMultiplier[tx.type] || 1.0;
            return total + (baseTimePerTransaction * multiplier);
        }, 0);
    }
    
    /**
     * Creates rollback data for a transaction
     * @param transaction Transaction to create rollback data for
     * @param beforeState State before transaction execution
     * @param afterState State after transaction execution
     * @returns Rollback data
     */
    static createRollbackData(
        transaction: Transaction, 
        beforeState: any, 
        afterState: any
    ): any {
        return {
            transactionId: transaction.id,
            beforeState: JSON.parse(JSON.stringify(beforeState)), // Deep clone
            afterState: JSON.parse(JSON.stringify(afterState)), // Deep clone
            canRollback: true,
            timestamp: Date.now()
        };
    }
    
    /**
     * Checks if a transaction can be rolled back
     * @param transactionType Type of transaction
     * @returns True if rollback is possible
     */
    static canRollback(transactionType: TransactionType): boolean {
        const nonRollbackableTypes = [
            TransactionType.BURN,
            TransactionType.CUSTOM
        ];
        
        return !nonRollbackableTypes.includes(transactionType);
    }
    
    /**
     * Generates a batch hash for integrity verification
     * @param batch Batch to hash
     * @returns Batch hash
     */
    static generateBatchHash(batch: Batch): string {
        const data = {
            id: batch.id,
            transactions: batch.transactions.map(tx => ({
                id: tx.id,
                type: tx.type,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                priority: tx.priority
            })),
            submitter: batch.submitter,
            timestamp: batch.timestamp
        };
        
        // Simple hash function - in production, use proper cryptographic hash
        return btoa(JSON.stringify(data)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 64);
    }
}
