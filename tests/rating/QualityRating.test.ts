import { QualityRating } from '../../contracts/rating/QualityRating';
import { ScoringLib } from '../../contracts/rating/libraries/ScoringLib';
import { 
    QualityMetricsImpl, 
    QualityRatingImpl, 
    OracleMetadataImpl,
    RatingConfigImpl,
    RatingWeightsImpl,
    RatingThresholdsImpl
} from '../../contracts/rating/structures/RatingStructure';
import { 
    QualityMetrics, 
    OracleMetadata, 
    RatingConfig,
    DisputeStatus,
    DisputeAction
} from '../../contracts/rating/interfaces/IQualityRating';
import { Address, u64, u128, i64 } from '../../contracts/rating/structures/RatingStructure';

describe('QualityRating System', () => {
    let qualityRating: QualityRating;
    let owner: Address;
    let oracle1: Address;
    let oracle2: Address;
    let energySource1: Address;
    let energySource2: Address;

    beforeEach(() => {
        owner = '0x1234567890123456789012345678901234567890';
        oracle1 = '0x111111111111111111111111111111111111111111';
        oracle2 = '0x2222222222222222222222222222222222222222';
        energySource1 = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
        energySource2 = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
        
        qualityRating = new QualityRating(owner);
        
        // Register test oracles
        const oracleMetadata = new OracleMetadataImpl(
            'Test Oracle',
            'Test oracle for quality ratings',
            'https://testoracle.com',
            'contact@testoracle.com',
            1000n, // fee
            100n,  // reputation
            ['energy', 'quality'],
            'ISO-9001'
        );
        
        qualityRating.registerQualityOracle(oracle1, oracleMetadata);
        qualityRating.registerQualityOracle(oracle2, oracleMetadata);
    });

    describe('Contract Initialization', () => {
        test('should initialize with correct owner', () => {
            expect(qualityRating['owner']).toBe(owner);
        });

        test('should start unpaused', () => {
            expect(qualityRating['paused']).toBe(false);
        });

        test('should initialize with default config', () => {
            const config = qualityRating.getConfig();
            expect(config).toBeInstanceOf(RatingConfigImpl);
        });
    });

    describe('Oracle Management', () => {
        test('should register oracle successfully', () => {
            const newOracle = '0x3333333333333333333333333333333333333333';
            const metadata = new OracleMetadataImpl(
                'New Oracle',
                'New test oracle',
                'https://neworacle.com',
                'contact@neworacle.com',
                500n,
                50n,
                ['energy'],
                'ISO-9001'
            );

            expect(() => {
                qualityRating.registerQualityOracle(newOracle, metadata);
            }).not.toThrow();

            const activeOracles = qualityRating.getActiveQualityOracles();
            expect(activeOracles).toContain(newOracle);
        });

        test('should not register duplicate oracle', () => {
            const metadata = new OracleMetadataImpl();
            
            expect(() => {
                qualityRating.registerQualityOracle(oracle1, metadata);
            }).toThrow('Oracle already registered');
        });

        test('should deactivate oracle', () => {
            qualityRating.deactivateQualityOracle(oracle1);
            
            const activeOracles = qualityRating.getActiveQualityOracles();
            expect(activeOracles).not.toContain(oracle1);
        });

        test('should update oracle reputation', () => {
            qualityRating.updateOracleReputation(oracle1, 50n);
            
            const activeOracles = qualityRating.getActiveQualityOracles();
            // Oracle should still be active with increased reputation
            expect(activeOracles).toContain(oracle1);
        });

        test('should deactivate oracle with low reputation', () => {
            // Set very low reputation
            qualityRating.updateOracleReputation(oracle1, -1000n);
            
            const activeOracles = qualityRating.getActiveQualityOracles();
            expect(activeOracles).not.toContain(oracle1);
        });
    });

    describe('Quality Rating Submission', () => {
        test('should submit quality rating successfully', () => {
            const metrics = createTestMetrics();
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65); // Mock signature

            expect(() => {
                qualityRating.submitQualityRating(energySource1, metrics, timestamp, signature);
            }).not.toThrow();

            const rating = qualityRating.getCurrentQualityRating(energySource1);
            expect(rating.energySourceId).toBe(energySource1);
            expect(rating.overallScore).toBeGreaterThan(0);
        });

        test('should reject submission from inactive oracle', () => {
            qualityRating.deactivateQualityOracle(oracle1);
            
            const metrics = createTestMetrics();
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65);

            expect(() => {
                qualityRating.submitQualityRating(energySource1, metrics, timestamp, signature);
            }).toThrow('Invalid or inactive oracle');
        });

        test('should reject submission with invalid metrics', () => {
            const invalidMetrics = new QualityMetricsImpl(
                15000n, // Invalid: > 100%
                500n,
                100n,
                10000n,
                10000n,
                100n,
                'ISO-9001',
                5n
            );
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65);

            expect(() => {
                qualityRating.submitQualityRating(energySource1, invalidMetrics, timestamp, signature);
            }).toThrow('Invalid metrics provided');
        });

        test('should reject submission with old timestamp', () => {
            const metrics = createTestMetrics();
            const oldTimestamp = BigInt(Math.floor(Date.now() / 1000)) - 86401n; // > 24 hours ago
            const signature = new Uint8Array(65);

            expect(() => {
                qualityRating.submitQualityRating(energySource1, metrics, oldTimestamp, signature);
            }).toThrow('Timestamp too old');
        });
    });

    describe('Rating Queries', () => {
        beforeEach(() => {
            const metrics = createTestMetrics();
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65);
            
            qualityRating.submitQualityRating(energySource1, metrics, timestamp, signature);
        });

        test('should get current quality rating', () => {
            const rating = qualityRating.getCurrentQualityRating(energySource1);
            
            expect(rating.energySourceId).toBe(energySource1);
            expect(rating.overallScore).toBeGreaterThan(0);
            expect(rating.overallScore).toBeLessThanOrEqual(10000n);
        });

        test('should return default rating for non-existent energy source', () => {
            const rating = qualityRating.getCurrentQualityRating('0xNonExistent');
            
            expect(rating.energySourceId).toBe('0xNonExistent');
            expect(rating.overallScore).toBe(0n);
        });

        test('should get quality metrics', () => {
            const metrics = qualityRating.getQualityMetrics(energySource1);
            
            expect(metrics.renewablePercentage).toBe(8000n);
            expect(metrics.carbonFootprint).toBe(200n);
            expect(metrics.reliabilityScore).toBe(95n);
        });

        test('should get rating history', () => {
            const now = BigInt(Math.floor(Date.now() / 1000));
            const fromTime = now - 3600n; // 1 hour ago
            const toTime = now + 3600n;   // 1 hour from now
            
            const history = qualityRating.getRatingHistory(energySource1, fromTime, toTime);
            
            expect(history).toHaveLength(1);
            expect(history[0].rating.energySourceId).toBe(energySource1);
        });
    });

    describe('Dispute Resolution', () => {
        beforeEach(() => {
            const metrics = createTestMetrics();
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65);
            
            qualityRating.submitQualityRating(energySource1, metrics, timestamp, signature);
        });

        test('should file dispute successfully', () => {
            const rating = qualityRating.getCurrentQualityRating(energySource1);
            const evidence = ['Evidence 1', 'Evidence 2'];

            expect(() => {
                qualityRating.fileRatingDispute(
                    energySource1,
                    rating,
                    'Incorrect rating calculation',
                    evidence
                );
            }).not.toThrow();

            const disputes = qualityRating.getPendingDisputes();
            expect(disputes).toHaveLength(1);
            expect(disputes[0].energySourceId).toBe(energySource1);
        });

        test('should reject dispute with insufficient evidence', () => {
            const rating = qualityRating.getCurrentQualityRating(energySource1);
            const evidence: string[] = []; // No evidence

            expect(() => {
                qualityRating.fileRatingDispute(
                    energySource1,
                    rating,
                    'Incorrect rating calculation',
                    evidence
                );
            }).toThrow('Insufficient evidence provided');
        });

        test('should resolve dispute successfully', () => {
            const rating = qualityRating.getCurrentQualityRating(energySource1);
            const evidence = ['Evidence 1'];
            
            qualityRating.fileRatingDispute(energySource1, rating, 'Test dispute', evidence);
            
            const disputes = qualityRating.getPendingDisputes();
            const disputeId = disputes[0].disputeId;
            
            const resolution = {
                action: DisputeAction.ADJUST_RATING,
                newRating: new QualityRatingImpl(
                    energySource1,
                    9000n, // Higher score
                    9500n,
                    9000n,
                    9500n,
                    9000n,
                    9500n,
                    rating.timestamp,
                    rating.oracleId,
                    rating.confidence,
                    15000n // 1.5x multiplier
                ),
                explanation: 'Rating adjusted after review'
            };
            
            qualityRating.resolveRatingDispute(disputeId, resolution);
            
            const updatedRating = qualityRating.getCurrentQualityRating(energySource1);
            expect(updatedRating.overallScore).toBe(9000n);
        });
    });

    describe('Aggregation Methods', () => {
        test('should aggregate ratings using weighted average', () => {
            // Submit ratings from multiple oracles
            const metrics1 = createTestMetrics();
            const metrics2 = createTestMetrics();
            metrics2.renewablePercentage = 6000n; // Lower renewable percentage
            
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature1 = new Uint8Array(65);
            const signature2 = new Uint8Array(65);
            
            // Mock oracle extraction for different oracles
            qualityRating.submitQualityRating(energySource1, metrics1, timestamp, signature1);
            
            // Create a new contract instance for the second oracle
            const qualityRating2 = new QualityRating(owner);
            qualityRating2.registerQualityOracle(oracle2, new OracleMetadataImpl());
            qualityRating2.submitQualityRating(energySource1, metrics2, timestamp, signature2);
            
            const aggregated = qualityRating.getAggregatedRating(energySource1);
            expect(aggregated.overallScore).toBeGreaterThan(0);
            expect(aggregated.overallScore).toBeLessThanOrEqual(10000n);
        });
    });

    describe('Anomaly Detection', () => {
        test('should detect rating anomalies', () => {
            // Submit normal ratings
            const metrics = createTestMetrics();
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65);
            
            for (let i = 0; i < 5; i++) {
                qualityRating.submitQualityRating(energySource1, metrics, timestamp + BigInt(i * 60), signature);
            }
            
            // Submit anomalous rating
            const anomalousMetrics = new QualityMetricsImpl(
                1000n, // Very low renewable percentage
                1000n, // High carbon footprint
                20n,   // Low reliability
                3000n, // Low efficiency
                5000n, // Low availability
                1000n, // High response time
                'ISO-9001',
                1n
            );
            
            qualityRating.submitQualityRating(energySource1, anomalousMetrics, timestamp + BigInt(300), signature);
            
            const latestRating = qualityRating.getCurrentQualityRating(energySource1);
            const isAnomalous = qualityRating.detectRatingAnomaly(energySource1, latestRating);
            
            expect(isAnomalous).toBe(true);
        });
    });

    describe('Configuration Management', () => {
        test('should update configuration', () => {
            const newWeights = new RatingWeightsImpl(
                4000n, // 40% renewable
                2000n, // 20% carbon
                2000n, // 20% reliability
                1000n, // 10% efficiency
                1000n  // 10% availability
            );
            
            const newConfig = new RatingConfigImpl();
            newConfig.weights = newWeights;
            
            expect(() => {
                qualityRating.updateConfig(newConfig);
            }).not.toThrow();
            
            const updatedConfig = qualityRating.getConfig();
            expect(updatedConfig.weights.renewableWeight).toBe(4000n);
        });

        test('should reject invalid configuration', () => {
            const invalidWeights = new RatingWeightsImpl(
                5000n, // 50%
                5000n, // 50%
                5000n, // 50% - exceeds 100%
                1000n,
                1000n
            );
            
            const invalidConfig = new RatingConfigImpl();
            invalidConfig.weights = invalidWeights;
            
            expect(() => {
                qualityRating.updateConfig(invalidConfig);
            }).toThrow('Invalid configuration');
        });
    });

    describe('Pause and Unpause', () => {
        test('should pause contract', () => {
            qualityRating.pause();
            expect(qualityRating['paused']).toBe(true);
        });

        test('should unpause contract', () => {
            qualityRating.pause();
            qualityRating.unpause();
            expect(qualityRating['paused']).toBe(false);
        });

        test('should reject submissions when paused', () => {
            qualityRating.pause();
            
            const metrics = createTestMetrics();
            const timestamp = BigInt(Math.floor(Date.now() / 1000));
            const signature = new Uint8Array(65);
            
            expect(() => {
                qualityRating.submitQualityRating(energySource1, metrics, timestamp, signature);
            }).toThrow('Contract is paused');
        });
    });
});

describe('ScoringLib', () => {
    describe('Score Calculations', () => {
        test('should calculate renewable score correctly', () => {
            expect(ScoringLib.calculateRenewableScore(0n)).toBe(0);
            expect(ScoringLib.calculateRenewableScore(5000n)).toBe(5000);
            expect(ScoringLib.calculateRenewableScore(10000n)).toBe(10000);
            expect(ScoringLib.calculateRenewableScore(15000n)).toBe(10000); // Capped at 100%
        });

        test('should calculate carbon score correctly', () => {
            expect(ScoringLib.calculateCarbonScore(0n)).toBe(10000n); // Perfect score
            expect(ScoringLib.calculateCarbonScore(500n)).toBeGreaterThan(5000n);
            expect(ScoringLib.calculateCarbonScore(1000n)).toBeLessThan(5000n);
        });

        test('should calculate reliability score correctly', () => {
            expect(ScoringLib.calculateReliabilityScore(0n)).toBe(0n);
            expect(ScoringLib.calculateReliabilityScore(50n)).toBe(5000n);
            expect(ScoringLib.calculateReliabilityScore(100n)).toBe(10000n);
        });

        test('should calculate overall score with weights', () => {
            const metrics = new QualityMetricsImpl(
                8000n, // 80% renewable
                200n,  // 200 gCO2/kWh
                95n,   // 95% reliability
                9000n, // 90% efficiency
                9500n, // 95% availability
                100n,
                'ISO-9001',
                5n
            );
            
            const weights = new RatingWeightsImpl(); // Default weights
            const overallScore = ScoringLib.calculateOverallScore(metrics, weights);
            
            expect(overallScore).toBeGreaterThan(0);
            expect(overallScore).toBeLessThanOrEqual(10000n);
        });
    });

    describe('Pricing Multiplier', () => {
        test('should calculate premium pricing for high quality', () => {
            const highQualityScore = 9500n; // 95%
            const multiplier = ScoringLib.calculatePricingMultiplier(highQualityScore);
            
            expect(multiplier).toBeGreaterThan(10000n); // > 1.0x
            expect(multiplier).toBeLessThanOrEqual(20000n); // <= 2.0x
        });

        test('should calculate discount pricing for low quality', () => {
            const lowQualityScore = 6000n; // 60%
            const multiplier = ScoringLib.calculatePricingMultiplier(lowQualityScore);
            
            expect(multiplier).toBeLessThan(10000n); // < 1.0x
            expect(multiplier).toBeGreaterThanOrEqual(5000n); // >= 0.5x
        });
    });

    describe('Confidence Score', () => {
        test('should calculate confidence score with high reputation', () => {
            const confidence = ScoringLib.calculateConfidenceScore(
                100n,   // High reputation
                3600n,  // 1 hour old data
                8n      // High certification
            );
            
            expect(confidence).toBeGreaterThan(5000n); // > 50%
            expect(confidence).toBeLessThanOrEqual(10000n); // <= 100%
        });

        test('should calculate confidence score with low reputation', () => {
            const confidence = ScoringLib.calculateConfidenceScore(
                -50n,   // Low reputation
                86400n, // 24 hours old data
                1n      // Low certification
            );
            
            expect(confidence).toBeLessThan(7000n); // < 70%
        });
    });

    describe('Anomaly Detection', () => {
        test('should detect anomalies in rating series', () => {
            const normalRatings = [
                createTestRating(7500n),
                createTestRating(7600n),
                createTestRating(7400n),
                createTestRating(7700n),
                createTestRating(7500n)
            ];
            
            const anomalousRating = createTestRating(2000n); // Much lower score
            
            const isAnomalous = ScoringLib.detectAnomaly(
                anomalousRating,
                normalRatings,
                2000n // 20% threshold
            );
            
            expect(isAnomalous).toBe(true);
        });

        test('should not detect anomalies in consistent ratings', () => {
            const consistentRatings = [
                createTestRating(7500n),
                createTestRating(7600n),
                createTestRating(7400n),
                createTestRating(7700n),
                createTestRating(7500n)
            ];
            
            const normalRating = createTestRating(7550n);
            
            const isAnomalous = ScoringLib.detectAnomaly(
                normalRating,
                consistentRatings,
                2000n // 20% threshold
            );
            
            expect(isAnomalous).toBe(false);
        });
    });
});

// Helper functions
function createTestMetrics(): QualityMetrics {
    return new QualityMetricsImpl(
        8000n, // 80% renewable
        200n,  // 200 gCO2/kWh
        95n,   // 95% reliability
        9000n, // 90% efficiency
        9500n, // 95% availability
        100n,  // 100ms response time
        'ISO-9001',
        5n     // Medium certification
    );
}

function createTestRating(score: u64): any {
    return {
        overallScore: score,
        renewableScore: score,
        carbonScore: score,
        reliabilityScore: score,
        efficiencyScore: score,
        availabilityScore: score,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        oracleId: '0xTestOracle',
        confidence: 8000n,
        pricingMultiplier: 10000n
    };
}
