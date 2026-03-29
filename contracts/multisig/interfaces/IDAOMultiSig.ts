import { Transaction, AggregatedSignature } from '../structures/MultiSigStructure';

export interface IDAOMultiSig {
    submitTransaction(to: string, value: number, data: string, sender: string): string;
    confirmTransaction(transactionId: string, sender: string): void;
    executeTransaction(transactionId: string, sender: string): void;
    revokeConfirmation(transactionId: string, sender: string): void;
    getOwners(): string[];
    getTransactionCount(): number;
    getTransaction(transactionId: string): Transaction;
    isConfirmed(transactionId: string): boolean;
    getConfirmations(transactionId: string): AggregatedSignature[];
    updateThreshold(newThreshold: number, sender: string): void;
    addOwner(newOwner: string, sender: string): void;
    removeOwner(owner: string, sender: string): void;
}
