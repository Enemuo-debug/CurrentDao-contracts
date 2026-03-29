import { Operation, OperationStatus } from '../structures/QueueStructure';

export interface ITimelockController {
    getMinDelay(): number;
    schedule(target: string, value: number, data: string, predecessor: string, salt: string, delay: number, caller: string): string;
    execute(target: string, value: number, data: string, predecessor: string, salt: string, caller: string): void;
    cancel(id: string, caller: string): void;
    isOperationPending(id: string): boolean;
    isOperationReady(id: string): boolean;
    updateDelay(newDelay: number, caller: string): void;
    hashOperation(target: string, value: number, data: string, predecessor: string, salt: string): string;
}
