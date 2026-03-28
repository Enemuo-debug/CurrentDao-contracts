import { 
    IPriceOracle, 
    OracleMetadata, 
    OracleInfo, 
    PriceDataPoint, 
    AggregationResult 
} from './interfaces/IPriceOracle';
import { 
    OracleRegistry, 
    Oracle, 
    PriceFeed, 
    PriceHistory, 
    DeviationThreshold, 
    OracleConfig 
} from './structures/OracleStructure';
import { AggregationLib } from './libraries/AggregationLib';
import { Address, u128, u64, i64, Bool, Vec, Map } from './structures/OracleStructure';

export class PriceOracle implements IPriceOracle {
    private registry: OracleRegistry;
    private priceHistories: Map<Address, PriceHistory>;
    private deviationThresholds: Map<Address, DeviationThreshold>;
    private config: OracleConfig;
    private owner: Address;
    private paused: Bool;
    private lastAggregationTime: Map<Address, u64>;
    
    constructor(owner: Address) {
        this.owner = owner;
        this.registry = new OracleRegistry();
        this.priceHistories = {} as Map<Address, PriceHistory>;
        this.deviationThresholds = {} as Map<Address, DeviationThreshold>;
        this.config = new OracleConfig();
        this.paused = false;
        this.lastAggregationTime = {} as Map<Address, u64>;
    }
    
    // --- Core Price Feed Methods ---
    
    submitPriceFeed(
        oracleId: Address, 
        price: u128, 
        timestamp: u64, 
        signature: Uint8Array
    ): void {
        this.requireNotPaused();
        this.requireValidOracle(oracleId);
        
        const oracle = this.registry.oracles[oracleId as string];
        this.requireOracleCanSubmit(oracle, timestamp);
        
        const feed = new PriceFeed(oracleId, this.getAssetIdFromOracle(oracleId), price, timestamp, signature);
        
        // Validate the price feed
        feed.isValid = this.validatePriceFeed(price, oracleId);
        
        if (feed.isValid) {
            // Store the price feed
            this.storePriceFeed(feed);
            
            // Update oracle statistics
            this.updateOracleStats(oracle, true);
            
            // Check for aggregation trigger
            this.checkAggregationTrigger(feed.assetId);
            
            // Emit event
            this.emitPriceFeedSubmitted(oracleId, feed.assetId, price, timestamp);
        } else {
            // Handle invalid submission
            this.handleInvalidSubmission(oracle, feed);
        }
    }
    
    getCurrentPrice(assetId: Address): u128 {
        const history = this.priceHistories[assetId as string];
        if (!history) {
            return 0n;
        }
        
        return history.getLatestPrice();
    }
    
    getHistoricalPrice(assetId: Address, timestamp: u64): u128 {
        const history = this.priceHistories[assetId as string];
        if (!history) {
            return 0n;
        }
        
        return history.getPriceAt(timestamp);
    }
    
    // --- Oracle Management ---
    
    registerOracle(oracleAddress: Address, metadata: OracleMetadata): void {
        this.requireOwner();
        this.requireNotPaused();
        
        if (this.registry.oracles[oracleAddress as string]) {
            throw new Error("Oracle already registered");
        }
        
        const oracle = new Oracle(oracleAddress, metadata);
        this.registry.oracles[oracleAddress as string] = oracle;
        this.registry.activeOracles[oracleAddress as string] = true;
        
        // Add oracle to supported assets
        for (const assetId of metadata.supportedAssets) {
            if (!this.registry.assetOracles[assetId as string]) {
                this.registry.assetOracles[assetId as string] = [];
            }
            
            const assetOracles = this.registry.assetOracles[assetId as string];
            if (assetOracles.length >= this.config.maxOraclesPerAsset) {
                throw new Error("Maximum oracles reached for asset");
            }
            
            if (!assetOracles.includes(oracleAddress)) {
                assetOracles.push(oracleAddress);
            }
            
            // Initialize price history if needed
            if (!this.priceHistories[assetId as string]) {
                this.priceHistories[assetId as string] = new PriceHistory(assetId);
            }
            
            // Initialize deviation threshold if needed
            if (!this.deviationThresholds[assetId as string]) {
                this.deviationThresholds[assetId as string] = new DeviationThreshold(assetId);
            }
        }
        
        this.emitOracleRegistered(oracleAddress, metadata);
    }
    
    updateOracleReputation(oracleId: Address, reputationDelta: i64): void {
        this.requireOwner();
        
        const oracle = this.registry.oracles[oracleId as string];
        if (!oracle) {
            throw new Error("Oracle not found");
        }
        
        const newReputation = oracle.reputation + reputationDelta;
        
        // Deactivate if reputation falls below threshold
        if (newReputation < this.config.minReputationThreshold) {
            oracle.isActive = false;
            this.registry.activeOracles[oracleId as string] = false;
        }
        
        oracle.reputation = newReputation;
        
        this.emitOracleReputationUpdated(oracleId, newReputation);
    }
    
    deactivateOracle(oracleId: Address): void {
        this.requireOwner();
        
        const oracle = this.registry.oracles[oracleId as string];
        if (!oracle) {
            throw new Error("Oracle not found");
        }
        
        oracle.isActive = false;
        this.registry.activeOracles[oracleId as string] = false;
    }
    
    // --- Aggregation and Validation ---
    
    getAggregatedPrice(assetId: Address): u128 {
        const history = this.priceHistories[assetId as string];
        if (!history) {
            return 0n;
        }
        
        const assetOracles = this.registry.assetOracles[assetId as string];
        if (!assetOracles || assetOracles.length === 0) {
            return 0n;
        }
        
        // Get recent price feeds from active oracles
        const recentFeeds: Vec<PriceFeed> = [];
        const now = Date.now();
        
        for (const oracleId of assetOracles) {
            const oracle = this.registry.oracles[oracleId as string];
            if (!oracle || !oracle.isActive) continue;
            
            // Get the latest feed from this oracle
            const latestFeed = this.getLatestFeedFromOracle(oracleId, assetId);
            if (latestFeed && 
                latestFeed.isValid && 
                (now - latestFeed.timestamp) <= this.config.maxPriceAge * 1000) {
                recentFeeds.push(latestFeed);
            }
        }
        
        // Calculate aggregated price
        const result = AggregationLib.calculateWeightedAverage(recentFeeds, this.registry.oracles);
        
        if (result.isValid) {
            return result.weightedPrice;
        }
        
        return 0n;
    }
    
    validatePriceFeed(price: u128, oracleId: Address): Bool {
        const oracle = this.registry.oracles[oracleId as string];
        if (!oracle) {
            return false;
        }
        
        // Get other recent feeds for comparison
        const otherFeeds = this.getOtherRecentFeeds(oracleId, oracle.metadata.supportedAssets[0]);
        
        // Use aggregation library to validate
        return AggregationLib.validatePriceFeed(
            new PriceFeed(oracleId, oracle.metadata.supportedAssets[0], price, Date.now(), new Uint8Array()),
            otherFeeds,
            this.config.slashThreshold
        );
    }
    
    detectPriceDeviation(assetId: Address, newPrice: u128): Bool {
        const history = this.priceHistories[assetId as string];
        const threshold = this.deviationThresholds[assetId as string];
        
        if (!history || !threshold) {
            return false;
        }
        
        return AggregationLib.detectPriceDeviation(newPrice, history, threshold);
    }
    
    // --- Query Methods ---
    
    getOracleInfo(oracleId: Address): OracleInfo {
        const oracle = this.registry.oracles[oracleId as string];
        if (!oracle) {
            throw new Error("Oracle not found");
        }
        
        return {
            oracleId: oracle.id,
            metadata: oracle.metadata,
            reputation: oracle.reputation,
            isActive: oracle.isActive,
            lastSubmission: oracle.lastSubmission,
            totalSubmissions: oracle.totalSubmissions,
            successfulSubmissions: oracle.successfulSubmissions
        };
    }
    
    getActiveOracles(): Vec<Address> {
        return Object.keys(this.registry.activeOracles).filter(
            oracleId => this.registry.activeOracles[oracleId]
        ) as Vec<Address>;
    }
    
    getPriceHistory(
        assetId: Address, 
        fromTimestamp: u64, 
        toTimestamp: u64
    ): Vec<PriceDataPoint> {
        const history = this.priceHistories[assetId as string];
        if (!history) {
            return [];
        }
        
        return history.dataPoints.filter(
            point => point.timestamp >= fromTimestamp && point.timestamp <= toTimestamp
        );
    }
    
    // --- Admin Functions ---
    
    pause(): void {
        this.requireOwner();
        this.paused = true;
    }
    
    unpause(): void {
        this.requireOwner();
        this.paused = false;
    }
    
    updateConfig(newConfig: Partial<OracleConfig>): void {
        this.requireOwner();
        Object.assign(this.config, newConfig);
    }
    
    setDeviationThreshold(assetId: Address, threshold: DeviationThreshold): void {
        this.requireOwner();
        this.deviationThresholds[assetId as string] = threshold;
    }
    
    // --- Internal Helper Functions ---
    
    private requireOwner(): void {
        // In a real implementation, this would check msg.sender
        // For now, we'll assume the check is done elsewhere
    }
    
    private requireNotPaused(): void {
        if (this.paused) {
            throw new Error("Contract is paused");
        }
    }
    
    private requireValidOracle(oracleId: Address): void {
        const oracle = this.registry.oracles[oracleId as string];
        if (!oracle) {
            throw new Error("Oracle not registered");
        }
        if (!oracle.isActive) {
            throw new Error("Oracle is not active");
        }
    }
    
    private requireOracleCanSubmit(oracle: Oracle, timestamp: u64): void {
        if (!oracle.canSubmit(oracle.metadata.minDelay)) {
            throw new Error("Oracle cannot submit yet");
        }
    }
    
    private getAssetIdFromOracle(oracleId: Address): Address {
        const oracle = this.registry.oracles[oracleId as string];
        if (!oracle || oracle.metadata.supportedAssets.length === 0) {
            throw new Error("No supported assets for oracle");
        }
        return oracle.metadata.supportedAssets[0];
    }
    
    private storePriceFeed(feed: PriceFeed): void {
        const history = this.priceHistories[feed.assetId as string];
        if (!history) {
            throw new Error("Price history not found for asset");
        }
        
        const dataPoint = new PriceDataPoint(
            feed.price,
            feed.timestamp,
            feed.oracleId,
            feed.isValid,
            this.registry.oracles[feed.oracleId as string]?.getWeight() || 0
        );
        
        history.addDataPoint(dataPoint);
    }
    
    private updateOracleStats(oracle: Oracle, success: Bool): void {
        oracle.totalSubmissions++;
        oracle.lastSubmission = Date.now();
        
        if (success) {
            oracle.successfulSubmissions++;
        }
    }
    
    private checkAggregationTrigger(assetId: Address): void {
        const now = Date.now();
        const lastAggregation = this.lastAggregationTime[assetId as string] || 0;
        
        // Automated aggregation every 5 minutes (300 seconds)
        if ((now - lastAggregation) >= this.config.aggregationInterval * 1000) {
            this.performAggregation(assetId);
            this.lastAggregationTime[assetId as string] = now;
            
            // Schedule next aggregation if automated updates are enabled
            if (this.config.automatedUpdates) {
                this.scheduleNextAggregation(assetId);
            }
        }
    }
    
    private scheduleNextAggregation(assetId: Address): void {
        // In a real implementation, this would use a blockchain timer or external keeper
        // For now, we'll use setTimeout for demonstration
        setTimeout(() => {
            if (!this.paused) {
                this.checkAggregationTrigger(assetId);
            }
        }, this.config.aggregationInterval * 1000);
    }
    
    /**
     * Force immediate aggregation for an asset
     */
    forceAggregation(assetId: Address): void {
        this.requireNotPaused();
        this.performAggregation(assetId);
        this.lastAggregationTime[assetId as string] = Date.now();
    }
    
    /**
     * Enable automated price updates
     */
    enableAutomatedUpdates(): void {
        this.requireOwner();
        this.config.automatedUpdates = true;
        
        // Start aggregation for all supported assets
        for (const assetId in this.registry.assetOracles) {
            this.scheduleNextAggregation(assetId as Address);
        }
    }
    
    /**
     * Disable automated price updates
     */
    disableAutomatedUpdates(): void {
        this.requireOwner();
        this.config.automatedUpdates = false;
    }
    
    private performAggregation(assetId: Address): void {
        const aggregatedPrice = this.getAggregatedPrice(assetId);
        
        if (aggregatedPrice > 0n) {
            const history = this.priceHistories[assetId as string];
            const dataPoint = new PriceDataPoint(
                aggregatedPrice,
                Date.now(),
                "AGGREGATION" as Address,
                true,
                100 // High weight for aggregated prices
            );
            
            history.addDataPoint(dataPoint);
            this.emitPriceAggregated(assetId, aggregatedPrice, dataPoint.timestamp);
        }
    }
    
    private getLatestFeedFromOracle(oracleId: Address, assetId: Address): PriceFeed | null {
        const history = this.priceHistories[assetId as string];
        if (!history) {
            return null;
        }
        
        // Find the latest data point from this oracle
        for (let i = history.dataPoints.length - 1; i >= 0; i--) {
            const point = history.dataPoints[i];
            if (point.oracleId === oracleId) {
                return new PriceFeed(
                    oracleId,
                    assetId,
                    point.price,
                    point.timestamp,
                    new Uint8Array()
                );
            }
        }
        
        return null;
    }
    
    private getOtherRecentFeeds(excludeOracleId: Address, assetId: Address): Vec<PriceFeed> {
        const history = this.priceHistories[assetId as string];
        if (!history) {
            return [];
        }
        
        const now = Date.now();
        const feeds: Vec<PriceFeed> = [];
        
        for (const point of history.dataPoints) {
            if (point.oracleId !== excludeOracleId && 
                point.isValid && 
                (now - point.timestamp) <= this.config.maxPriceAge * 1000) {
                feeds.push(new PriceFeed(
                    point.oracleId,
                    assetId,
                    point.price,
                    point.timestamp,
                    new Uint8Array()
                ));
            }
        }
        
        return feeds;
    }
    
    private handleInvalidSubmission(oracle: Oracle, feed: PriceFeed): void {
        oracle.slashCount++;
        this.updateOracleStats(oracle, false);
        
        // Check if oracle should be slashed
        if (oracle.slashCount >= 3) {
            this.updateOracleReputation(oracle.id, -50);
        }
        
        this.emitSuspiciousPriceDetected(oracle.id, feed.assetId, feed.price, 0);
    }
    
    // --- Events ---
    
    private emitPriceFeedSubmitted(oracleId: Address, assetId: Address, price: u128, timestamp: u64): void {
        // In a real implementation, this would emit an event
        console.log(`PriceFeedSubmitted: ${oracleId}, ${assetId}, ${price}, ${timestamp}`);
    }
    
    private emitPriceAggregated(assetId: Address, aggregatedPrice: u128, timestamp: u64): void {
        // In a real implementation, this would emit an event
        console.log(`PriceAggregated: ${assetId}, ${aggregatedPrice}, ${timestamp}`);
    }
    
    private emitOracleRegistered(oracleId: Address, metadata: OracleMetadata): void {
        // In a real implementation, this would emit an event
        console.log(`OracleRegistered: ${oracleId}, ${metadata.name}`);
    }
    
    private emitOracleReputationUpdated(oracleId: Address, newReputation: i64): void {
        // In a real implementation, this would emit an event
        console.log(`OracleReputationUpdated: ${oracleId}, ${newReputation}`);
    }
    
    private emitSuspiciousPriceDetected(oracleId: Address, assetId: Address, price: u128, deviation: u64): void {
        // In a real implementation, this would emit an event
        console.log(`SuspiciousPriceDetected: ${oracleId}, ${assetId}, ${price}, ${deviation}`);
    }
}
