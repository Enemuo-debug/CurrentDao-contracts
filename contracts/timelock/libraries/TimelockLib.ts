import { Operation, OperationStatus } from '../structures/QueueStructure';

export class TimelockLib {
    /**
     * Checks if an operation is ready for execution based on current time.
     */
    public static isReady(operation: Operation, currentTime: number): boolean {
        return operation.status === OperationStatus.Pending && 
               currentTime >= operation.eta;
    }

    /**
     * Hashes operation details to generate a unique ID.
     */
    public static hash(target: string, value: number, data: string, predecessor: string, salt: string): string {
        // Deterministic mock hash generation
        return `OP_HASH_${target.slice(0, 10)}_${value}_${data.slice(0, 10)}_${predecessor.slice(0, 10)}_${salt.slice(0, 10)}`;
    }

    /**
     * Validates that the execution delay is above the minimum required limit.
     */
    public static validateDelay(delay: number, minDelay: number): boolean {
        return delay >= minDelay;
    }
}
