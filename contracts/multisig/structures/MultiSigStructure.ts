export interface Transaction {
    id: string;
    to: string;
    value: number;
    data: string;
    executed: boolean;
    numConfirmations: number;
    timestamp: number;
    deadline: number;
}

export interface MultiSigConfig {
    owners: string[];
    numConfirmationsRequired: number;
    transactionCount: number;
}

export interface AggregatedSignature {
    voter: string;
    confirmed: boolean;
    timestamp: number;
}
