import { ITimelockController } from './interfaces/ITimelockController';
import { Operation, OperationStatus } from './structures/QueueStructure';
import { TimelockLib } from './libraries/TimelockLib';

export class TimelockController implements ITimelockController {
    private operations: Map<string, Operation> = new Map();
    private minDelay: number;
    private proposers: Set<string> = new Set();
    private executors: Set<string> = new Set();
    private cancellers: Set<string> = new Set();
    private admin: string;

    constructor(minDelay: number, proposers: string[], executors: string[], admin: string) {
        this.minDelay = minDelay;
        this.admin = admin;
        proposers.forEach(p => this.proposers.add(p));
        executors.forEach(e => this.executors.add(e));
        // Admin acts as initial canceller unless otherwise specified
        this.cancellers.add(admin);
    }

    // --- Access Control ---

    private onlyProposer(caller: string) {
        if (!this.proposers.has(caller) && caller !== this.admin) throw new Error("Timelock: caller is not a proposer");
    }

    private onlyExecutor(caller: string) {
        if (!this.executors.has(caller) && caller !== this.admin) throw new Error("Timelock: caller is not an executor");
    }

    private onlyCanceller(caller: string) {
        if (!this.cancellers.has(caller) && caller !== this.admin) throw new Error("Timelock: caller is not a canceller");
    }

    private onlyAdmin(caller: string) {
        if (caller !== this.admin) throw new Error("Timelock: caller is not an admin");
    }

    // --- Operations ---

    public getMinDelay(): number {
        return this.minDelay;
    }

    public schedule(target: string, value: number, data: string, predecessor: string, salt: string, delay: number, caller: string): string {
        this.onlyProposer(caller);
        
        if (delay < this.minDelay) throw new Error("Timelock: delay below minimum");

        const id = this.hashOperation(target, value, data, predecessor, salt);
        if (this.operations.has(id)) throw new Error("Timelock: operation already scheduled");

        const timestamp = Date.now();
        const eta = timestamp + delay;

        const operation: Operation = {
            id,
            target,
            value,
            data,
            predecessor,
            salt,
            delay,
            timestamp,
            eta,
            status: OperationStatus.Pending
        };

        this.operations.set(id, operation);
        return id;
    }

    public execute(target: string, value: number, data: string, predecessor: string, salt: string, caller: string): void {
        this.onlyExecutor(caller);

        const id = this.hashOperation(target, value, data, predecessor, salt);
        const op = this.operations.get(id);
        if (!op) throw new Error("Timelock: operation not found");

        if (op.status !== OperationStatus.Pending) throw new Error("Timelock: operation already executed or canceled");
        if (Date.now() < op.eta) throw new Error("Timelock: operation delay not passed");

        // Verify predecessor if any
        if (predecessor && predecessor !== "0x0" && !this.isOperationExecuted(predecessor)) {
            throw new Error("Timelock: predecessor operation not executed");
        }

        // Execution Logic Simulation
        op.status = OperationStatus.Executed;
        this.operations.set(id, op);
        console.log(`Executed scheduled operation with ID ${id} at target ${target}`);
    }

    public cancel(id: string, caller: string): void {
        this.onlyCanceller(caller);

        const op = this.operations.get(id);
        if (!op) throw new Error("Timelock: operation not found");
        if (op.status !== OperationStatus.Pending) throw new Error("Timelock: operation not pending");

        op.status = OperationStatus.Canceled;
        this.operations.set(id, op);
    }

    public hashOperation(target: string, value: number, data: string, predecessor: string, salt: string): string {
        return TimelockLib.hash(target, value, data, predecessor, salt);
    }

    public isOperationPending(id: string): boolean {
        return this.operations.get(id)?.status === OperationStatus.Pending;
    }

    public isOperationReady(id: string): boolean {
        const op = this.operations.get(id);
        return op ? TimelockLib.isReady(op, Date.now()) : false;
    }

    public isOperationExecuted(id: string): boolean {
        return this.operations.get(id)?.status === OperationStatus.Executed;
    }

    public updateDelay(newDelay: number, caller: string): void {
        this.onlyAdmin(caller);
        this.minDelay = newDelay;
    }

    public grantRole(role: 'PROPOSER' | 'EXECUTOR' | 'CANCELLER', account: string, caller: string) {
        this.onlyAdmin(caller);
        if (role === 'PROPOSER') this.proposers.add(account);
        else if (role === 'EXECUTOR') this.executors.add(account);
        else if (role === 'CANCELLER') this.cancellers.add(account);
    }
}
