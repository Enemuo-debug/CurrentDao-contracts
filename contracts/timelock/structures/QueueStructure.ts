export enum OperationStatus {
    Pending,
    Ready,
    Executed,
    Canceled
}

export interface Operation {
    id: string; // Hash of target, value, data, salt, etc.
    target: string;
    value: number;
    data: string;
    predecessor: string; // Dependency for execution
    salt: string;
    delay: number;
    timestamp: number; // When it was queued
    eta: number; // Earliest execution time
    status: OperationStatus;
}
