// BatchTransaction interface definition
export interface BatchTransaction {
    target: string;
    value: number;
    data: Uint8Array;
    priority: number;
    maxGasPrice: number;
    gasEstimate: number;
}

/**
 * @title GasLib
 * @notice Library for gas optimization utilities and calculations
 * @dev Provides helper functions for gas estimation, prediction, and optimization
 */
export class GasLib {
    // Constants for gas calculations
    private static readonly BASE_TX_GAS: number = 21000;
    private static readonly MIN_BATCH_SIZE: number = 10;
    private static readonly MAX_BATCH_SIZE: number = 100;
    private static readonly PREDICTION_WINDOW: number = 300; // 5 minutes in seconds
    private static readonly ACCURACY_THRESHOLD: number = 90; // 90% accuracy requirement
    
    // Priority levels
    private static readonly PRIORITY_HIGH: number = 1;
    private static readonly PRIORITY_MEDIUM: number = 2;
    private static readonly PRIORITY_LOW: number = 3;
    
    // Network congestion thresholds
    private static readonly CONGESTION_LOW: number = 30;
    private static readonly CONGESTION_MEDIUM: number = 60;
    private static readonly CONGESTION_HIGH: number = 90;
    
    /**
     * @notice Estimates gas required for a transaction
     * @param target Target contract address
     * @param value ETH value to send
     * @data Transaction calldata
     * @return Estimated gas limit
     */
    static estimateTransactionGas(
        target: string,
        value: number,
        data: Uint8Array
    ): number {
        let gasEstimate: number = this.BASE_TX_GAS;
        
        // Add gas for calldata (16 gas per byte for zero bytes, 68 for non-zero)
        for (let i = 0; i < data.length; i++) {
            if (data[i] == 0) {
                gasEstimate += 16;
            } else {
                gasEstimate += 68;
            }
        }
        
        // Add gas for contract execution (estimated based on operation complexity)
        gasEstimate += this.estimateContractExecutionGas(target, data);
        
        // Add buffer for safety (10%)
        gasEstimate = gasEstimate * 110 / 100;
        
        return gasEstimate;
    }
    
    /**
     * @notice Estimates gas for batch execution
     * @param transactions Array of batch transactions
     * @return Total estimated gas for batch
     */
    static estimateBatchGas(transactions: BatchTransaction[]): number {
        let totalGas: number = 0;
        
        for (let i = 0; i < transactions.length; i++) {
            totalGas += this.estimateTransactionGas(
                transactions[i].target,
                transactions[i].value,
                transactions[i].data
            );
        }
        
        // Batch execution overhead (reduced per-transaction cost)
        let batchOverhead: number = this.BASE_TX_GAS * 2; // Base cost for batch transaction
        let perTxOverhead: number = this.BASE_TX_GAS / 2; // Reduced per-transaction overhead
        
        totalGas += batchOverhead + (perTxOverhead * transactions.length);
        
        return totalGas;
    }
    
    /**
     * @notice Predicts gas price for future time
     * @param currentPrice Current gas price
     * @param historicalData Array of historical gas prices
     * @param minutesAhead Minutes to predict ahead
     * @return Predicted gas price
     */
    static predictGasPrice(
        currentPrice: number,
        historicalData: number[],
        minutesAhead: number
    ): number {
        if (historicalData.length < 10) {
            return currentPrice; // Not enough data for prediction
        }
        
        // Calculate moving average
        let movingAvg: number = 0;
        let dataPoints: number = Math.min(historicalData.length, 20);
        
        for (let i = 0; i < dataPoints; i++) {
            movingAvg += historicalData[historicalData.length - 1 - i];
        }
        movingAvg /= dataPoints;
        
        // Calculate trend (simple linear regression)
        let trend: number = this.calculateTrend(historicalData);
        
        // Apply trend prediction
        let predictedPrice: number = movingAvg;
        if (trend > 0) {
            predictedPrice = predictedPrice * (100 + (trend * minutesAhead / 10)) / 100;
        } else if (trend < 0) {
            predictedPrice = predictedPrice * (100 + (trend * minutesAhead / 10)) / 100;
        }
        
        // Apply volatility adjustment
        let volatility: number = this.calculateVolatility(historicalData);
        let adjustment: number = volatility * minutesAhead / 60; // Adjust for time horizon
        
        if (trend > 0) {
            predictedPrice += adjustment;
        } else {
            predictedPrice = Math.max(predictedPrice - adjustment, currentPrice / 2);
        }
        
        return predictedPrice;
    }
    
    /**
     * @notice Calculates optimal gas price based on network conditions
     * @param currentPrice Current gas price
     * @param congestion Network congestion level (0-100)
     * @param priority Transaction priority
     * @param maxWaitTime Maximum willing to wait (seconds)
     * @return Optimal gas price
     */
    static calculateOptimalGasPrice(
        currentPrice: number,
        congestion: number,
        priority: number,
        maxWaitTime: number
    ): number {
        let basePrice: number = currentPrice;
        
        // Priority multiplier
        let priorityMultiplier: number = 100;
        if (priority == this.PRIORITY_HIGH) {
            priorityMultiplier = 150; // 50% premium for high priority
        } else if (priority == this.PRIORITY_MEDIUM) {
            priorityMultiplier = 120; // 20% premium for medium priority
        }
        
        // Congestion adjustment
        let congestionMultiplier: number = 100;
        if (congestion > this.CONGESTION_HIGH) {
            congestionMultiplier = 180; // 80% increase for high congestion
        } else if (congestion > this.CONGESTION_MEDIUM) {
            congestionMultiplier = 140; // 40% increase for medium congestion
        } else if (congestion > this.CONGESTION_LOW) {
            congestionMultiplier = 110; // 10% increase for low congestion
        }
        
        // Wait time discount (willing to wait longer = lower price)
        let waitDiscount: number = 100;
        if (maxWaitTime > 300) { // More than 5 minutes
            waitDiscount = 70; // 30% discount
        } else if (maxWaitTime > 120) { // More than 2 minutes
            waitDiscount = 85; // 15% discount
        } else if (maxWaitTime > 60) { // More than 1 minute
            waitDiscount = 95; // 5% discount
        }
        
        let optimalPrice: number = basePrice;
        optimalPrice = optimalPrice * priorityMultiplier / 100;
        optimalPrice = optimalPrice * congestionMultiplier / 100;
        optimalPrice = optimalPrice * waitDiscount / 100;
        
        return optimalPrice;
    }
    
    /**
     * @notice Calculates potential savings from batching
     * @param individualCosts Array of individual transaction costs
     * @param batchCost Cost of executing as batch
     * @return Savings amount and percentage
     */
    static calculateBatchSavings(
        individualCosts: number[],
        batchCost: number
    ): { savings: number, percentage: number } {
        let totalIndividualCost: number = 0;
        
        for (let i = 0; i < individualCosts.length; i++) {
            totalIndividualCost += individualCosts[i];
        }
        
        if (totalIndividualCost <= batchCost) {
            return { savings: 0, percentage: 0 };
        }
        
        let savings: number = totalIndividualCost - batchCost;
        let percentage: number = (savings * 100) / totalIndividualCost;
        
        return { savings, percentage };
    }
    
    /**
     * @notice Determines if current time is optimal for execution
     * @param currentGasPrice Current gas price
     * @param historicalData Historical gas prices
     * @return Whether current time is optimal
     */
    static isOptimalExecutionTime(
        currentGasPrice: number,
        historicalData: number[]
    ): boolean {
        if (historicalData.length < 24) { // Need at least 24 data points (hourly for a day)
            return true; // Assume optimal if insufficient data
        }
        
        // Calculate 24-hour average
        let dayAverage: number = 0;
        for (let i = 0; i < 24; i++) {
            dayAverage += historicalData[historicalData.length - 1 - i];
        }
        dayAverage /= 24;
        
        // Current price should be below daily average for optimal time
        return currentGasPrice < dayAverage;
    }
    
    /**
     * @notice Calculates gas prediction accuracy
     * @param predictions Array of predicted prices
     * @param actualPrices Array of actual prices
     * @return Accuracy percentage
     */
    static calculatePredictionAccuracy(
        predictions: number[],
        actualPrices: number[]
    ): number {
        if (predictions.length != actualPrices.length || predictions.length == 0) {
            return 0;
        }
        
        let totalError: number = 0;
        let totalActual: number = 0;
        
        for (let i = 0; i < predictions.length; i++) {
            let error: number = Math.abs(predictions[i] - actualPrices[i]);
            totalError += error;
            totalActual += actualPrices[i];
        }
        
        if (totalActual == 0) return 0;
        
        let meanAbsolutePercentageError: number = (totalError * 100) / totalActual;
        let accuracy: number = 100 - meanAbsolutePercentageError;
        
        return Math.min(accuracy, 100);
    }
    
    /**
     * @notice Estimates contract execution gas based on function signature
     * @param target Contract address
     * @param data Transaction calldata
     * @return Estimated execution gas
     */
    private static estimateContractExecutionGas(
        target: string,
        data: Uint8Array
    ): number {
        // This is a simplified estimation
        // In practice, this would use more sophisticated analysis
        
        if (data.length < 4) {
            return 0; // No function selector
        }
        
        // Extract function selector (first 4 bytes)
        let selector: number = 0;
        for (let i = 0; i < 4; i++) {
            selector = (selector << 8) | data[i];
        }
        
        // Estimate based on common function patterns
        // This would be enhanced with actual contract analysis
        switch (selector) {
            case 0xa9059cbb: // transfer
                return 50000;
            case 0x095ea7b3: // approve
                return 45000;
            case 0x70a08231: // balanceOf
                return 20000;
            case 0x23b872dd: // transferFrom
                return 65000;
            default:
                return 80000; // Default estimation for unknown functions
        }
    }
    
    /**
     * @notice Calculates trend from historical data
     * @param data Array of historical values
     * @return Trend value (positive = increasing, negative = decreasing)
     */
    private static calculateTrend(data: number[]): number {
        if (data.length < 2) return 0;
        
        let n: number = Math.min(data.length, 20);
        let sumX: number = 0;
        let sumY: number = 0;
        let sumXY: number = 0;
        let sumX2: number = 0;
        
        for (let i = 0; i < n; i++) {
            let x: number = i;
            let y: number = data[data.length - 1 - i];
            
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        
        let numerator: number = n * sumXY - sumX * sumY;
        let denominator: number = n * sumX2 - sumX * sumX;
        
        if (denominator == 0) return 0;
        
        return numerator / denominator;
    }
    
    /**
     * @notice Calculates volatility from historical data
     * @param data Array of historical values
     * @return Volatility measure
     */
    private static calculateVolatility(data: number[]): number {
        if (data.length < 2) return 0;
        
        let n: number = Math.min(data.length, 20);
        let mean: number = 0;
        
        // Calculate mean
        for (let i = 0; i < n; i++) {
            mean += data[data.length - 1 - i];
        }
        mean /= n;
        
        // Calculate standard deviation
        let variance: number = 0;
        for (let i = 0; i < n; i++) {
            let diff: number = data[data.length - 1 - i] - mean;
            variance += diff * diff;
        }
        variance /= n;
        
        // Return standard deviation as percentage of mean
        if (mean == 0) return 0;
        return (Math.sqrt(variance) * 100) / mean;
    }
    
    /**
     * @notice Validates batch configuration
     * @param minSize Minimum batch size
     * @param maxSize Maximum batch size
     * @return Whether configuration is valid
     */
    static validateBatchConfig(minSize: number, maxSize: number): boolean {
        return minSize >= this.MIN_BATCH_SIZE &&
               maxSize <= this.MAX_BATCH_SIZE &&
               minSize <= maxSize;
    }
    
    /**
     * @notice Gets priority level from numeric value
     * @param priority Priority numeric value
     * @return Priority level constant
     */
    static getPriorityLevel(priority: number): number {
        if (priority <= this.PRIORITY_HIGH) {
            return this.PRIORITY_HIGH;
        } else if (priority <= this.PRIORITY_MEDIUM) {
            return this.PRIORITY_MEDIUM;
        } else {
            return this.PRIORITY_LOW;
        }
    }
    
    /**
     * @notice Calculates maximum wait time based on priority
     * @param priority Priority level
     * @return Maximum wait time in seconds
     */
    static getMaxWaitTime(priority: number): number {
        switch (priority) {
            case this.PRIORITY_HIGH:
                return 60; // 1 minute
            case this.PRIORITY_MEDIUM:
                return 300; // 5 minutes
            case this.PRIORITY_LOW:
                return 900; // 15 minutes
            default:
                return 300;
        }
    }
}
