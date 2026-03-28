/**
 * Batch structure definitions for transaction batching system
 */

export enum BatchStatus {
    PENDING = 'pending',
    VALIDATING = 'validating',
    EXECUTING = 'executing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
    ROLLED_BACK = 'rolled_back'
}

export enum TransactionPriority {
    LOW = 0,
    MEDIUM = 1,
    HIGH = 2,
    URGENT = 3,
    EMERGENCY = 4
}

export enum TransactionType {
    TRANSFER = 'transfer',
    APPROVE = 'approve',
    MINT = 'mint',
    BURN = 'burn',
    STAKE = 'stake',
    UNSTAKE = 'unstake',
    SWAP = 'swap',
    CUSTOM = 'custom'
}

export interface Transaction {
    id: string;
    type: TransactionType;
    from: string;
    to: string;
    value?: number;
    data?: string;
    priority: TransactionPriority;
    gasLimit: number;
    timestamp: number;
    nonce: number;
    signature?: string;
}

export interface Batch {
    id: string;
    transactions: Transaction[];
    status: BatchStatus;
    submitter: string;
    timestamp: number;
    gasLimit: number;
    gasUsed: number;
    priority: TransactionPriority;
    maxTransactions: number;
    executionBlock?: number;
    failureReason?: string;
    rollbackData?: RollbackData[];
}

export interface RollbackData {
    transactionId: string;
    beforeState: any;
    afterState: any;
    canRollback: boolean;
}

export interface BatchValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    gasEstimate: number;
    optimizedTransactions: Transaction[];
}

export interface BatchExecutionResult {
    batchId: string;
    success: boolean;
    executedTransactions: string[];
    failedTransactions: string[];
    gasUsed: number;
    executionTime: number;
    rollbackRequired: boolean;
}

export interface BatchMetrics {
    totalBatches: number;
    successfulBatches: number;
    failedBatches: number;
    averageGasSavings: number;
    averageExecutionTime: number;
    totalTransactionsProcessed: number;
}

export interface GasOptimizationConfig {
    targetGasSavings: number;
    maxBatchSize: number;
    minBatchSize: number;
    priorityThreshold: TransactionPriority;
    gasPriceThreshold: number;
}

export interface BatchConfig {
    maxTransactionsPerBatch: number;
    maxGasPerBatch: number;
    validationTimeout: number;
    executionTimeout: number;
    emergencyCancelEnabled: boolean;
    rollbackEnabled: boolean;
    gasOptimization: GasOptimizationConfig;
}
