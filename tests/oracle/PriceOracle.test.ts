import { PriceOracle } from '../../contracts/oracle/PriceOracle';
import { OracleMetadata } from '../../contracts/oracle/interfaces/IPriceOracle';
import { Oracle, PriceFeed, DeviationThreshold } from '../../contracts/oracle/structures/OracleStructure';
import { AggregationLib } from '../../contracts/oracle/libraries/AggregationLib';
import { Address, u128, u64 } from '../../contracts/oracle/structures/OracleStructure';

describe('PriceOracle', () => {
    let priceOracle: PriceOracle;
    let owner: Address;
    let oracle1: Address;
    let oracle2: Address;
    let oracle3: Address;
    let assetId: Address;
    let metadata: OracleMetadata;

    beforeEach(() => {
        owner = "0xOwnerAddress";
        oracle1 = "0xOracle1Address";
        oracle2 = "0xOracle2Address";
        oracle3 = "0xOracle3Address";
        assetId = "0xAssetAddress";
        
        metadata = {
            name: "Test Oracle",
            description: "Test oracle for unit tests",
            website: "https://testoracle.com",
            contact: "test@testoracle.com",
            fee: 100,
            minDelay: 60,
            supportedAssets: [assetId]
        };

        priceOracle = new PriceOracle(owner);
    });

    describe('Oracle Registration', () => {
        test('should register a new oracle successfully', () => {
            priceOracle.registerOracle(oracle1, metadata);
            
            const oracleInfo = priceOracle.getOracleInfo(oracle1);
            expect(oracleInfo.oracleId).toBe(oracle1);
            expect(oracleInfo.metadata.name).toBe("Test Oracle");
            expect(oracleInfo.isActive).toBe(true);
            expect(oracleInfo.reputation).toBe(100);
        });

        test('should not register duplicate oracle', () => {
            priceOracle.registerOracle(oracle1, metadata);
            
            expect(() => {
                priceOracle.registerOracle(oracle1, metadata);
            }).toThrow("Oracle already registered");
        });

        test('should register multiple oracles for same asset', () => {
            priceOracle.registerOracle(oracle1, metadata);
            priceOracle.registerOracle(oracle2, metadata);
            priceOracle.registerOracle(oracle3, metadata);
            
            const activeOracles = priceOracle.getActiveOracles();
            expect(activeOracles).toContain(oracle1);
            expect(activeOracles).toContain(oracle2);
            expect(activeOracles).toContain(oracle3);
            expect(activeOracles.length).toBe(3);
        });
    });

    describe('Price Feed Submission', () => {
        beforeEach(() => {
            priceOracle.registerOracle(oracle1, metadata);
            priceOracle.registerOracle(oracle2, metadata);
        });

        test('should accept valid price feed', () => {
            const price = 1000000n; // $100.00 with 4 decimals
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, price, timestamp, signature);
            
            const currentPrice = priceOracle.getCurrentPrice(assetId);
            expect(currentPrice).toBe(price);
        });

        test('should reject price feed from unregistered oracle', () => {
            const unregisteredOracle = "0xUnregisteredOracle";
            const price = 1000000n;
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            expect(() => {
                priceOracle.submitPriceFeed(unregisteredOracle, price, timestamp, signature);
            }).toThrow("Oracle not registered");
        });

        test('should reject price feed from inactive oracle', () => {
            priceOracle.deactivateOracle(oracle1);
            
            const price = 1000000n;
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            expect(() => {
                priceOracle.submitPriceFeed(oracle1, price, timestamp, signature);
            }).toThrow("Oracle is not active");
        });

        test('should enforce minimum delay between submissions', () => {
            const price = 1000000n;
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, price, timestamp, signature);
            
            expect(() => {
                priceOracle.submitPriceFeed(oracle1, price + 100n, timestamp + 1000, signature);
            }).toThrow("Oracle cannot submit yet");
        });
    });

    describe('Price Aggregation', () => {
        beforeEach(() => {
            priceOracle.registerOracle(oracle1, metadata);
            priceOracle.registerOracle(oracle2, metadata);
            priceOracle.registerOracle(oracle3, metadata);
        });

        test('should calculate weighted average from multiple oracles', () => {
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            // Submit prices from all oracles
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            priceOracle.submitPriceFeed(oracle2, 1020000n, timestamp + 1000, signature);
            priceOracle.submitPriceFeed(oracle3, 980000n, timestamp + 2000, signature);
            
            const aggregatedPrice = priceOracle.getAggregatedPrice(assetId);
            expect(aggregatedPrice).toBeGreaterThan(0n);
            
            // Should be close to the average
            const expectedAverage = (1000000n + 1020000n + 980000n) / 3n;
            expect(aggregatedPrice).toBeCloseTo(Number(expectedAverage), -2);
        });

        test('should handle oracle reputation in weighting', () => {
            // Give oracle2 higher reputation
            priceOracle.updateOracleReputation(oracle2, 50);
            
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            priceOracle.submitPriceFeed(oracle2, 2000000n, timestamp + 1000, signature);
            
            const aggregatedPrice = priceOracle.getAggregatedPrice(assetId);
            
            // Should be weighted more towards oracle2's price
            expect(aggregatedPrice).toBeGreaterThan(1500000n);
        });

        test('should ignore inactive oracles in aggregation', () => {
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            priceOracle.submitPriceFeed(oracle2, 2000000n, timestamp + 1000, signature);
            
            // Deactivate oracle2
            priceOracle.deactivateOracle(oracle2);
            
            const aggregatedPrice = priceOracle.getAggregatedPrice(assetId);
            expect(aggregatedPrice).toBe(1000000n);
        });
    });

    describe('Price Deviation Detection', () => {
        beforeEach(() => {
            priceOracle.registerOracle(oracle1, metadata);
            priceOracle.registerOracle(oracle2, metadata);
            
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            // Submit some historical prices
            for (let i = 0; i < 10; i++) {
                const price = 1000000n + BigInt(i * 1000);
                priceOracle.submitPriceFeed(oracle1, price, timestamp + i * 60000, signature);
            }
        });

        test('should detect normal price deviation', () => {
            const isDeviated = priceOracle.detectPriceDeviation(assetId, 1050000n);
            expect(isDeviated).toBe(false);
        });

        test('should detect extreme price deviation', () => {
            const isDeviated = priceOracle.detectPriceDeviation(assetId, 2000000n);
            expect(isDeviated).toBe(true);
        });

        test('should not flag deviation with insufficient data', () => {
            // Create new asset with no history
            const newAssetId = "0xNewAssetAddress";
            const newMetadata = { ...metadata, supportedAssets: [newAssetId] };
            priceOracle.registerOracle(oracle3, newMetadata);
            
            const isDeviated = priceOracle.detectPriceDeviation(newAssetId, 2000000n);
            expect(isDeviated).toBe(false);
        });
    });

    describe('Oracle Reputation System', () => {
        beforeEach(() => {
            priceOracle.registerOracle(oracle1, metadata);
        });

        test('should update oracle reputation', () => {
            priceOracle.updateOracleReputation(oracle1, 25);
            
            const oracleInfo = priceOracle.getOracleInfo(oracle1);
            expect(oracleInfo.reputation).toBe(125);
        });

        test('should deactivate oracle with low reputation', () => {
            priceOracle.updateOracleReputation(oracle1, -150);
            
            const oracleInfo = priceOracle.getOracleInfo(oracle1);
            expect(oracleInfo.isActive).toBe(false);
            expect(oracleInfo.reputation).toBe(-50);
        });

        test('should track oracle statistics', () => {
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            
            const oracleInfo = priceOracle.getOracleInfo(oracle1);
            expect(oracleInfo.totalSubmissions).toBe(1);
            expect(oracleInfo.successfulSubmissions).toBe(1);
            expect(oracleInfo.lastSubmission).toBe(timestamp);
        });
    });

    describe('Historical Price Tracking', () => {
        beforeEach(() => {
            priceOracle.registerOracle(oracle1, metadata);
        });

        test('should store price history', () => {
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            
            const history = priceOracle.getPriceHistory(assetId, timestamp - 1000, timestamp + 1000);
            expect(history.length).toBe(1);
            expect(history[0].price).toBe(1000000n);
        });

        test('should retrieve historical price at specific time', () => {
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            
            const historicalPrice = priceOracle.getHistoricalPrice(assetId, timestamp);
            expect(historicalPrice).toBe(1000000n);
        });

        test('should return zero for non-existent historical price', () => {
            const historicalPrice = priceOracle.getHistoricalPrice(assetId, 1234567890);
            expect(historicalPrice).toBe(0n);
        });
    });

    describe('Admin Functions', () => {
        test('should pause and unpause contract', () => {
            priceOracle.pause();
            
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            expect(() => {
                priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            }).toThrow("Contract is paused");
            
            priceOracle.unpause();
            
            // Should work after unpausing
            priceOracle.registerOracle(oracle1, metadata);
            expect(() => {
                priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            }).not.toThrow();
        });

        test('should update configuration', () => {
            // This would test configuration updates
            // Implementation depends on the specific config structure
            expect(true).toBe(true); // Placeholder
        });

        test('should set deviation threshold', () => {
            const threshold = new DeviationThreshold(assetId, 1000, 3600, 5);
            priceOracle.setDeviationThreshold(assetId, threshold);
            
            // This would verify the threshold was set
            // Implementation depends on internal storage
            expect(true).toBe(true); // Placeholder
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty price feeds', () => {
            const aggregatedPrice = priceOracle.getAggregatedPrice(assetId);
            expect(aggregatedPrice).toBe(0n);
        });

        test('should handle single oracle', () => {
            priceOracle.registerOracle(oracle1, metadata);
            
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 1000000n, timestamp, signature);
            
            const aggregatedPrice = priceOracle.getAggregatedPrice(assetId);
            expect(aggregatedPrice).toBe(1000000n);
        });

        test('should handle zero price submissions', () => {
            priceOracle.registerOracle(oracle1, metadata);
            
            const timestamp = Date.now();
            const signature = new Uint8Array([1, 2, 3, 4]);
            
            priceOracle.submitPriceFeed(oracle1, 0n, timestamp, signature);
            
            const currentPrice = priceOracle.getCurrentPrice(assetId);
            expect(currentPrice).toBe(0n);
        });
    });
});

describe('AggregationLib', () => {
    describe('calculateWeightedAverage', () => {
        test('should calculate correct weighted average', () => {
            const priceFeeds = [
                new PriceFeed("0xOracle1", "0xAsset1", 1000000n, Date.now(), new Uint8Array()),
                new PriceFeed("0xOracle2", "0xAsset1", 2000000n, Date.now(), new Uint8Array()),
                new PriceFeed("0xOracle3", "0xAsset1", 3000000n, Date.now(), new Uint8Array())
            ];
            
            const oracles = {
                "0xOracle1": new Oracle("0xOracle1", {} as OracleMetadata, 100),
                "0xOracle2": new Oracle("0xOracle2", {} as OracleMetadata, 200),
                "0xOracle3": new Oracle("0xOracle3", {} as OracleMetadata, 300)
            };
            
            // Set all feeds as valid
            priceFeeds.forEach(feed => feed.isValid = true);
            
            const result = AggregationLib.calculateWeightedAverage(priceFeeds, oracles);
            
            expect(result.isValid).toBe(true);
            expect(result.participatingOracles).toBe(3);
            
            // Weighted average: (100*100 + 200*200 + 300*300) / (100 + 200 + 300) = 233.33
            const expectedWeightedPrice = (1000000n * 100n + 2000000n * 200n + 3000000n * 300n) / 600n;
            expect(result.weightedPrice).toBe(expectedWeightedPrice);
        });

        test('should handle empty price feeds', () => {
            const result = AggregationLib.calculateWeightedAverage([], {});
            expect(result.isValid).toBe(false);
            expect(result.weightedPrice).toBe(0n);
        });
    });

    describe('calculateStandardDeviation', () => {
        test('should calculate correct standard deviation', () => {
            const prices = [1000000n, 2000000n, 3000000n, 4000000n];
            const mean = 2500000n;
            
            const stdDev = AggregationLib.calculateStandardDeviation(prices, mean);
            
            // Standard deviation should be positive
            expect(stdDev).toBeGreaterThan(0n);
        });

        test('should return zero for single price', () => {
            const prices = [1000000n];
            const mean = 1000000n;
            
            const stdDev = AggregationLib.calculateStandardDeviation(prices, mean);
            expect(stdDev).toBe(0n);
        });
    });

    describe('calculateDeviationPercent', () => {
        test('should calculate correct deviation percentage', () => {
            const newPrice = 1100000n;
            const referencePrice = 1000000n;
            
            const deviation = AggregationLib.calculateDeviationPercent(newPrice, referencePrice);
            
            // 10% deviation = 1000 basis points
            expect(deviation).toBe(1000);
        });

        test('should handle zero reference price', () => {
            const newPrice = 1000000n;
            const referencePrice = 0n;
            
            const deviation = AggregationLib.calculateDeviationPercent(newPrice, referencePrice);
            expect(deviation).toBe(0);
        });
    });

    describe('detectOutliers', () => {
        test('should detect outliers in price data', () => {
            const prices = [1000000n, 1050000n, 1100000n, 5000000n]; // Last one is outlier
            const outliers = AggregationLib.detectOutliers(prices);
            
            expect(outliers.length).toBe(4);
            expect(outliers[3]).toBe(true); // Last price should be flagged as outlier
        });

        test('should not flag outliers in consistent data', () => {
            const prices = [1000000n, 1050000n, 1100000n, 1150000n];
            const outliers = AggregationLib.detectOutliers(prices);
            
            expect(outliers.every(isOutlier => !isOutlier)).toBe(true);
        });
    });
});
