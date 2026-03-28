import { 
    Address, 
    u128, 
    u64, 
    Vec, 
    PriceFeed, 
    Oracle, 
    AggregationResult, 
    DeviationThreshold,
    PriceHistory,
    PriceDataPoint
} from '../structures/OracleStructure';

export class AggregationLib {
    
    /**
     * Calculates weighted average price from multiple oracle feeds
     * Gas optimized: early termination, minimal loops, efficient calculations
     */
    static calculateWeightedAverage(
        priceFeeds: Vec<PriceFeed>,
        oracles: Map<Address, Oracle>
    ): AggregationResult {
        const result = new AggregationResult();
        
        if (priceFeeds.length === 0) {
            return result;
        }
        
        // Pre-allocate arrays with known size for gas efficiency
        const validPrices: u128[] = [];
        const weights: u64[] = [];
        let weightedSum = 0n;
        let totalWeight = 0;
        
        // Single loop through feeds for validation and calculation
        for (let i = 0; i < priceFeeds.length; i++) {
            const feed = priceFeeds[i];
            const oracle = (oracles as any)[feed.oracleId as string] || oracles.get?.(feed.oracleId);
            
            // Skip invalid feeds early to save gas
            if (!oracle?.isActive || !feed.isValid) {
                continue;
            }
            
            const weight = oracle.getWeight();
            // Skip zero-weight oracles
            if (weight === 0) {
                continue;
            }
            
            const price = feed.price;
            validPrices.push(price);
            weights.push(weight);
            
            // Accumulate weighted sum using BigInt arithmetic
            weightedSum += price * BigInt(weight);
            totalWeight += weight;
            
            // Early termination if we have enough oracles (gas optimization)
            if (validPrices.length >= 5) {
                break;
            }
        }
        
        if (totalWeight === 0 || validPrices.length === 0) {
            return result;
        }
        
        // Calculate final weighted price
        result.weightedPrice = weightedSum / BigInt(totalWeight);
        result.totalWeight = totalWeight;
        result.participatingOracles = validPrices.length;
        
        // Calculate standard deviation only if needed (gas optimization)
        if (validPrices.length > 1) {
            result.standardDeviation = this.calculateStandardDeviationOptimized(validPrices, result.weightedPrice);
        }
        
        result.isValid = true;
        result.confidence = this.calculateConfidenceOptimized(result, validPrices.length);
        
        return result;
    }
    
    /**
     * Gas optimized standard deviation calculation
     */
    static calculateStandardDeviationOptimized(prices: Vec<u128>, mean: u128): u128 {
        if (prices.length <= 1) {
            return 0n;
        }
        
        let sumSquaredDifferences = 0n;
        
        // Use for loop with early termination for gas efficiency
        for (let i = 0; i < prices.length; i++) {
            const price = prices[i];
            const difference = price > mean ? price - mean : mean - price;
            sumSquaredDifferences += difference * difference;
            
            // Early termination if variance gets too high (gas optimization)
            if (i > 10 && sumSquaredDifferences > 1000000000000n) {
                break;
            }
        }
        
        const variance = sumSquaredDifferences / BigInt(prices.length);
        return this.sqrtOptimized(variance);
    }
    
    /**
     * Gas optimized square root using binary search
     */
    static sqrtOptimized(value: u128): u128 {
        if (value === 0n) return 0n;
        if (value < 0n) throw new Error("Cannot calculate square root of negative number");
        
        // Binary search approach for gas efficiency
        let low = 0n;
        let high = value;
        let mid = (low + high) / 2n;
        
        while (low <= high) {
            const square = mid * mid;
            
            if (square === value) {
                return mid;
            } else if (square < value) {
                low = mid + 1n;
            } else {
                high = mid - 1n;
            }
            
            mid = (low + high) / 2n;
        }
        
        return high;
    }
    
    /**
     * Gas optimized confidence calculation
     */
    static calculateConfidenceOptimized(result: AggregationResult, oracleCount: number): u64 {
        let confidence = 50; // Base confidence
        
        // Boost for multiple oracles
        if (oracleCount >= 5) {
            confidence += 30;
        } else if (oracleCount >= 3) {
            confidence += 15;
        } else if (oracleCount >= 2) {
            confidence += 5;
        }
        
        // Penalty for high deviation
        if (result.weightedPrice > 0n) {
            const deviationPercent = Number((result.standardDeviation * 10000n) / result.weightedPrice);
            if (deviationPercent > 500) { // >5%
                confidence -= 20;
            } else if (deviationPercent > 200) { // >2%
                confidence -= 10;
            }
        }
        
        return Math.max(Math.min(confidence, 100), 0);
    }
    
    /**
     * Square root approximation for BigInt
     */
    static sqrt(value: u128): u128 {
        if (value === 0n) return 0n;
        if (value < 0n) throw new Error("Cannot calculate square root of negative number");
        
        let x = value;
        let y = (x + 1n) / 2n;
        
        while (y < x) {
            x = y;
            y = (x + value / x) / 2n;
        }
        
        return x;
    }
    
    /**
     * Detects price deviation from historical data
     */
    static detectPriceDeviation(
        newPrice: u128,
        priceHistory: PriceHistory,
        threshold: DeviationThreshold
    ): boolean {
        const now = Date.now();
        const windowStart = now - threshold.windowSize * 1000;
        
        const historicalPrices: u128[] = [];
        
        for (const dataPoint of priceHistory.dataPoints) {
            if (dataPoint.timestamp >= windowStart && 
                dataPoint.timestamp <= now &&
                dataPoint.isValid) {
                historicalPrices.push(dataPoint.price);
            }
        }
        
        if (historicalPrices.length < threshold.minSamples) {
            return false; // Not enough data to detect deviation
        }
        
        const averagePrice = this.calculateAverage(historicalPrices);
        const deviationPercent = this.calculateDeviationPercent(newPrice, averagePrice);
        
        return deviationPercent > threshold.maxDeviationPercent;
    }
    
    /**
     * Calculates average of prices
     */
    static calculateAverage(prices: Vec<u128>): u128 {
        if (prices.length === 0) return 0n;
        
        let sum = 0n;
        for (const price of prices) {
            sum += price;
        }
        
        return sum / BigInt(prices.length);
    }
    
    /**
     * Calculates deviation percentage
     */
    static calculateDeviationPercent(newPrice: u128, referencePrice: u128): u64 {
        if (referencePrice === 0n) return 0;
        
        const difference = newPrice > referencePrice ? 
            newPrice - referencePrice : 
            referencePrice - newPrice;
        
        return Number((difference * 10000n) / referencePrice); // Basis points (0.01% precision)
    }
    
    /**
     * Validates price feed against other feeds
     */
    static validatePriceFeed(
        targetFeed: PriceFeed,
        otherFeeds: Vec<PriceFeed>,
        maxDeviationPercent: u64
    ): boolean {
        if (otherFeeds.length === 0) {
            return true; // No other feeds to compare against
        }
        
        const validOtherFeeds = otherFeeds.filter(feed => 
            feed.oracleId !== targetFeed.oracleId && feed.isValid
        );
        
        if (validOtherFeeds.length === 0) {
            return true;
        }
        
        const averageOtherPrice = this.calculateAverage(
            validOtherFeeds.map(feed => feed.price)
        );
        
        const deviationPercent = this.calculateDeviationPercent(
            targetFeed.price, 
            averageOtherPrice
        );
        
        return deviationPercent <= maxDeviationPercent;
    }
    
    /**
     * Median-based aggregation (alternative to weighted average)
     */
    static calculateMedian(prices: Vec<u128>): u128 {
        if (prices.length === 0) return 0n;
        
        const sortedPrices = [...prices].sort((a, b) => 
            a < b ? -1 : a > b ? 1 : 0
        );
        
        const mid = Math.floor(sortedPrices.length / 2);
        
        if (sortedPrices.length % 2 === 0) {
            return (sortedPrices[mid - 1] + sortedPrices[mid]) / 2n;
        } else {
            return sortedPrices[mid];
        }
    }
    
    /**
     * Time-weighted average price (TWAP)
     */
    static calculateTWAP(
        priceHistory: PriceHistory,
        duration: u64
    ): u128 {
        const now = Date.now();
        const startTime = now - duration * 1000;
        
        let weightedSum = 0n;
        let totalTime = 0;
        
        for (let i = 1; i < priceHistory.dataPoints.length; i++) {
            const currentPoint = priceHistory.dataPoints[i];
            const previousPoint = priceHistory.dataPoints[i - 1];
            
            if (currentPoint.timestamp > startTime && currentPoint.isValid) {
                const timeDiff = Math.min(
                    currentPoint.timestamp - previousPoint.timestamp,
                    now - startTime
                );
                
                weightedSum += currentPoint.price * BigInt(timeDiff);
                totalTime += timeDiff;
            }
        }
        
        return totalTime > 0 ? weightedSum / BigInt(totalTime) : 0n;
    }
    
    /**
     * Exponential moving average
     */
    static calculateEMA(
        priceHistory: PriceHistory,
        period: u64,
        smoothing: u64 = 2
    ): u128 {
        if (priceHistory.dataPoints.length === 0) return 0n;
        
        const multiplier = Number(smoothing) / (Number(period) + 1);
        let ema = priceHistory.dataPoints[0].price;
        
        for (let i = 1; i < priceHistory.dataPoints.length; i++) {
            const currentPrice = priceHistory.dataPoints[i].price;
            ema = (currentPrice * BigInt(Math.floor(multiplier * 10000)) + 
                   ema * BigInt(Math.floor((1 - multiplier) * 10000))) / 10000n;
        }
        
        return ema;
    }
    
    /**
     * Outlier detection using IQR method
     */
    static detectOutliers(prices: Vec<u128>): Vec<boolean> {
        if (prices.length < 4) {
            return prices.map(() => false);
        }
        
        const sortedPrices = [...prices].sort((a, b) => 
            a < b ? -1 : a > b ? 1 : 0
        );
        
        const q1Index = Math.floor(sortedPrices.length * 0.25);
        const q3Index = Math.floor(sortedPrices.length * 0.75);
        
        const q1 = sortedPrices[q1Index];
        const q3 = sortedPrices[q3Index];
        const iqr = q3 - q1;
        
        const lowerBound = q1 - iqr * 15n / 10n; // 1.5 * IQR
        const upperBound = q3 + iqr * 15n / 10n;
        
        return prices.map(price => 
            price < lowerBound || price > upperBound
        );
    }
    
    /**
     * Confidence score based on multiple factors
     */
    static calculateConfidenceScore(
        result: AggregationResult,
        deviationThreshold: DeviationThreshold,
        recentVolatility: u64
    ): u64 {
        let confidence = result.confidence;
        
        // Adjust for volatility
        if (recentVolatility > 1000) { // High volatility (>10%)
            confidence = Math.floor(confidence * 0.7);
        } else if (recentVolatility > 500) { // Medium volatility (>5%)
            confidence = Math.floor(confidence * 0.85);
        }
        
        // Adjust for number of oracles
        if (result.participatingOracles >= 5) {
            confidence = Math.min(confidence + 10, 100);
        } else if (result.participatingOracles <= 2) {
            confidence = Math.floor(confidence * 0.6);
        }
        
        // Adjust for standard deviation
        if (result.standardDeviation > result.weightedPrice / 20n) { // >5% deviation
            confidence = Math.floor(confidence * 0.8);
        }
        
        return Math.max(confidence, 0);
    }
}
