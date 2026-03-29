import { Transaction } from '../structures/MultiSigStructure';

export class MultiSigLib {
    /**
     * Checks if a transaction has enough confirmations.
     */
    public static isReady(transaction: Transaction, threshold: number): boolean {
        return transaction.numConfirmations >= threshold && !transaction.executed;
    }

    /**
     * Hashes transaction details to generate a unique ID.
     */
    public static hash(to: string, value: number, data: string, nonce: number): string {
        // Mock hash generation
        return `MS_TX_${to.slice(0, 6)}_${value}_${nonce}_${Date.now()}`;
    }

    /**
     * Checks if a transaction is still valid to be executed.
     */
    public static isValid(transaction: Transaction, currentTime: number): boolean {
        return currentTime <= transaction.deadline && !transaction.executed;
    }
}
