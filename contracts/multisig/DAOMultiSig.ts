import { IDAOMultiSig } from './interfaces/IDAOMultiSig';
import { Transaction, AggregatedSignature } from './structures/MultiSigStructure';
import { MultiSigLib } from './libraries/MultiSigLib';

export class DAOMultiSig implements IDAOMultiSig {
    private transactions: Map<string, Transaction> = new Map();
    private confirmations: Map<string, Map<string, AggregatedSignature>> = new Map(); // transactionId => owner => signature
    private owners: Set<string> = new Set();
    private numConfirmationsRequired: number;
    private transactionCount: number = 0;
    
    // Constant for recovery threshold percentage (supermajority)
    private readonly RECOVERY_THRESHOLD_PCT = 75;

    constructor(initialOwners: string[], initialThreshold: number) {
        if (initialOwners.length < initialThreshold || initialThreshold < 1) {
            throw new Error("MultiSig: invalid parameters");
        }
        initialOwners.forEach(o => this.owners.add(o));
        this.numConfirmationsRequired = initialThreshold;
    }

    // --- Access Control ---

    private onlyOwners(sender: string) {
        if (!this.owners.has(sender)) throw new Error("MultiSig: caller is not an owner");
    }

    private onlyMultiSigRequirement(sender: string) {
        // Can only be called by the multisig contract itself through an executed transaction
        // (SIMULATED Check: checking if sender is this hypothetical contract address, for now simpler check)
        if (sender !== "0xSelf") throw new Error("MultiSig: can only be called by multisig itself");
    }

    // --- Core Multi-signature functions ---

    public submitTransaction(to: string, value: number, data: string, sender: string): string {
        this.onlyOwners(sender);
        
        const txId = MultiSigLib.hash(to, value, data, this.transactionCount++);
        this.transactions.set(txId, {
            id: txId,
            to,
            value,
            data,
            executed: false,
            numConfirmations: 0,
            timestamp: Date.now(),
            deadline: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days deadline
        });
        
        this.confirmations.set(txId, new Map());
        return txId;
    }

    public confirmTransaction(transactionId: string, sender: string): void {
        this.onlyOwners(sender);
        
        const tx = this.transactions.get(transactionId);
        if (!tx) throw new Error("MultiSig: transaction not found");
        if (tx.executed) throw new Error("MultiSig: transaction already executed");

        const txConfirmations = this.confirmations.get(transactionId)!;
        if (txConfirmations.has(sender)) throw new Error("MultiSig: already confirmed");

        txConfirmations.set(sender, {
            voter: sender,
            confirmed: true,
            timestamp: Date.now()
        });
        tx.numConfirmations++;
        this.transactions.set(transactionId, tx);
    }

    public executeTransaction(transactionId: string, sender: string): void {
        this.onlyOwners(sender);
        
        const tx = this.transactions.get(transactionId);
        if (!tx) throw new Error("MultiSig: transaction not found");
        if (tx.executed) throw new Error("MultiSig: transaction already executed");

        if (tx.numConfirmations < this.numConfirmationsRequired) {
            throw new Error("MultiSig: insufficient confirmations");
        }

        if (!MultiSigLib.isValid(tx, Date.now())) {
            throw new Error("MultiSig: transaction expired");
        }

        // Logic execution simulation
        tx.executed = true;
        this.transactions.set(transactionId, tx);
        console.log(`Executed MultiSig Transaction ${transactionId} to ${tx.to}`);
        
        // In real use, would trigger call(to, value, data)
    }

    public revokeConfirmation(transactionId: string, sender: string): void {
        this.onlyOwners(sender);
        
        const tx = this.transactions.get(transactionId);
        if (!tx) throw new Error("MultiSig: transaction not found");
        if (tx.executed) throw new Error("MultiSig: transaction already executed");

        const txConfirmations = this.confirmations.get(transactionId)!;
        if (!txConfirmations.has(sender)) throw new Error("MultiSig: not confirmed");

        txConfirmations.delete(sender);
        tx.numConfirmations--;
        this.transactions.set(transactionId, tx);
    }

    // --- Configuration (Multi-signature required for these too!) ---

    public updateThreshold(newThreshold: number, sender: string): void {
        this.onlyMultiSigRequirement(sender);
        if (newThreshold > this.owners.size || newThreshold < 1) throw new Error("MultiSig: invalid threshold");
        this.numConfirmationsRequired = newThreshold;
    }

    public addOwner(newOwner: string, sender: string): void {
        this.onlyMultiSigRequirement(sender);
        if (this.owners.has(newOwner)) throw new Error("MultiSig: already an owner");
        this.owners.add(newOwner);
    }

    public removeOwner(owner: string, sender: string): void {
        this.onlyMultiSigRequirement(sender);
        if (!this.owners.has(owner)) throw new Error("MultiSig: not an owner");
        if (this.owners.size - 1 < this.numConfirmationsRequired) {
            throw new Error("MultiSig: cannot remove owner, threshold would be impossible");
        }
        this.owners.delete(owner);
    }

    // --- Utility / Analytics functions ---

    public getOwners(): string[] {
        return Array.from(this.owners);
    }

    public getTransactionCount(): number {
        return this.transactionCount;
    }

    public getTransaction(transactionId: string): Transaction {
        const tx = this.transactions.get(transactionId);
        if (!tx) throw new Error("MultiSig: transaction not found");
        return { ...tx };
    }

    public isConfirmed(transactionId: string): boolean {
        return this.transactions.get(transactionId)?.numConfirmations! >= this.numConfirmationsRequired;
    }

    public getConfirmations(transactionId: string): AggregatedSignature[] {
        const confs = this.confirmations.get(transactionId);
        if (!confs) return [];
        return Array.from(confs.values());
    }

    /**
     * Recovery mechanism in case of emergency.
     * Requires a supermajority of current owners to approve.
     */
    public triggerEmergencyRecovery(recoveryAction: string, sender: string): void {
        // Recovery logic requires super-majority (e.g. 75% of current owners)
        const currentOwnerCount = this.owners.size;
        const recoveryRequired = Math.ceil(currentOwnerCount * (this.RECOVERY_THRESHOLD_PCT / 100));
        
        // This would traditionally be another multisig transaction with a higher threshold
        console.log(`Recovery triggered: ${recoveryAction}. Requires ${recoveryRequired} approvals.`);
    }
}
