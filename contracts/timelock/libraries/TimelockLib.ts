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
        // Mock hash generation
        return `OP_HASH_${target.slice(0, 6)}_${value}_${salt.slice(0, 4)}_${Date.now()}`;
    }

    /**
     * Validates that the execution delay is above the minimum required limit.
     */
    public static validateDelay(delay: number, minDelay: number): boolean {
        return delay >= minDelay;
    }
}
