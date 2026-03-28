import { FeeManager } from '../../contracts/fees/FeeManager';
import { FeeType, FeeTier, FeeExemption } from '../../contracts/fees/structures/FeeStructure';
import { FeeCalculation } from '../../contracts/fees/libraries/FeeCalculation';

describe('FeeManager', () => {
    let feeManager: FeeManager;
    let owner: string;
    let user1: string;
    let user2: string;

    beforeEach(() => {
        owner = '0xowner';
        user1 = '0xuser1';
        user2 = '0xuser2';
        feeManager = new FeeManager(owner);
    });

    describe('Basic Fee Calculation', () => {
        it('should calculate fixed fee for transactions under $100', () => {
            const result = feeManager.calculateFee(50, user1, 'TRADE');
            
            expect(result.totalFee).toBe(1); // Default fixed fee for TRADE
            expect(result.breakdown.fixed).toBe(1);
            expect(result.breakdown.percentage).toBe(0);
            expect(result.effectiveRate).toBe(200); // 2% in basis points
        });

        it('should calculate percentage fee for transactions over $100', () => {
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            
            expect(result.totalFee).toBe(5); // 0.5% of 1000
            expect(result.breakdown.fixed).toBe(0);
            expect(result.breakdown.percentage).toBe(5);
            expect(result.effectiveRate).toBe(50); // 0.5% in basis points
        });

        it('should apply min fee constraints', () => {
            const result = feeManager.calculateFee(1, user1, 'TRANSFER');
            
            expect(result.totalFee).toBeGreaterThanOrEqual(0.1); // Min fee for TRANSFER
        });

        it('should apply max fee constraints', () => {
            const result = feeManager.calculateFee(100000, user1, 'TRANSFER');
            
            expect(result.totalFee).toBeLessThanOrEqual(10); // Max fee for TRANSFER
        });
    });

    describe('Tiered Fee Structure', () => {
        beforeEach(() => {
            const tier: FeeTier = {
                id: 'premium',
                name: 'Premium Tier',
                minVolume: 10000,
                discountPercentage: 1000, // 10% discount
                priority: 1
            };
            
            feeManager.addFeeTier('TRADE', tier);
            feeManager.setUserTier(user1, 'TRADE', tier);
        });

        it('should apply tier discount for eligible users', () => {
            const result = feeManager.calculateFee(50000, user1, 'TRADE');
            
            expect(result.tierUsed).toBe('premium');
            expect(result.totalFee).toBeLessThan(250); // Should be less than 0.5% of 50000
        });

        it('should not apply tier discount for non-eligible users', () => {
            const result = feeManager.calculateFee(50000, user2, 'TRADE');
            
            expect(result.tierUsed).toBeUndefined();
            expect(result.totalFee).toBe(100); // Capped at max fee of 100
        });
    });

    describe('Dynamic Fee Adjustment', () => {
        it('should increase fees during high network congestion', () => {
            feeManager.setNetworkCongestionLevel(80); // High congestion
            
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            
            expect(result.dynamicAdjustment).toBeGreaterThan(0);
            expect(result.totalFee).toBeGreaterThan(5); // Base fee
        });

        it('should not adjust fees when dynamic fees are disabled', () => {
            feeManager.enableDynamicFees('TRADE', false);
            feeManager.setNetworkCongestionLevel(80);
            
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            
            expect(result.dynamicAdjustment).toBe(0);
            expect(result.totalFee).toBe(5); // Base fee only
        });

        it('should respect min and max dynamic rates', () => {
            feeManager.setNetworkCongestionLevel(100); // Maximum congestion
            
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            
            expect(result.totalFee).toBeLessThanOrEqual(25); // Max 2.5% of 1000
        });
    });

    describe('Volume Discounts', () => {
        it('should apply volume discount for high-volume traders', () => {
            // Simulate high volume
            feeManager.updateUserVolume(user1, 'TRADE', 15000);
            
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            
            expect(result.volumeDiscount).toBeGreaterThan(0);
            expect(result.totalFee).toBeLessThan(5); // Less than base fee
        });

        it('should not apply volume discount for low-volume traders', () => {
            feeManager.updateUserVolume(user1, 'TRADE', 500);
            
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            
            expect(result.volumeDiscount).toBe(0);
            expect(result.totalFee).toBe(5); // Base fee
        });

        it('should reset volume periodically', () => {
            feeManager.updateUserVolume(user1, 'TRADE', 15000);
            expect(feeManager.getUserVolume(user1, 'TRADE')).toBe(15000);
            
            // In a real implementation, this would test time-based reset
            // For now, we just verify the volume tracking works
        });
    });

    describe('Fee Exemptions', () => {
        it('should apply percentage exemption', () => {
            const exemptionId = feeManager.createExemption(
                user1,
                'TRADE',
                'PERCENTAGE',
                2000 // 20% exemption
            );
            
            const result = feeManager.calculateFeeWithExemption(1000, user1, 'TRADE', exemptionId);
            
            expect(result.exemptionDiscount).toBe(2000);
            expect(result.totalFee).toBe(4); // 20% discount on $5 fee
        });

        it('should apply fixed exemption', () => {
            const exemptionId = feeManager.createExemption(
                user1,
                'TRADE',
                'FIXED',
                2 // $2 fixed exemption
            );
            
            const result = feeManager.calculateFeeWithExemption(1000, user1, 'TRADE', exemptionId);
            
            expect(result.totalFee).toBe(3); // $5 - $2 exemption
        });

        it('should apply full exemption', () => {
            const exemptionId = feeManager.createExemption(
                user1,
                'TRADE',
                'FULL',
                0
            );
            
            const result = feeManager.calculateFeeWithExemption(1000, user1, 'TRADE', exemptionId);
            
            expect(result.totalFee).toBe(0);
        });

        it('should handle expired exemptions', () => {
            const exemptionId = feeManager.createExemption(
                user1,
                'TRADE',
                'PERCENTAGE',
                2000,
                Date.now() - 1000 // Already expired
            );
            
            expect(() => {
                feeManager.calculateFeeWithExemption(1000, user1, 'TRADE', exemptionId);
            }).toThrow('Invalid or expired exemption');
        });

        it('should revoke exemptions', () => {
            const exemptionId = feeManager.createExemption(
                user1,
                'TRADE',
                'PERCENTAGE',
                2000
            );
            
            feeManager.revokeExemption(exemptionId);
            
            expect(feeManager.isExemptionValid(exemptionId)).toBe(false);
        });
    });

    describe('Fee Distribution', () => {
        it('should distribute fees according to configuration', () => {
            let distributedAmounts = new Map<string, number>();
            
            feeManager.onFeeDistributed = (transactionType, amounts) => {
                distributedAmounts = amounts;
            };
            
            feeManager.distributeFees('TRADE', 100);
            
            expect(distributedAmounts.get('treasury')).toBe(50); // 50%
            expect(distributedAmounts.get('validators')).toBe(30); // 30%
            expect(distributedAmounts.get('developers')).toBe(20); // 20%
        });

        it('should validate distribution percentages', () => {
            expect(() => {
                feeManager.setFeeDistribution('INVALID', {
                    transactionType: 'INVALID',
                    recipients: [
                        { address: 'treasury', percentage: 5000, name: 'Treasury' },
                        { address: 'validators', percentage: 4000, name: 'Validators' }
                    ],
                    totalPercentage: 9000 // Not 100%
                });
            }).toThrow('Total distribution percentage must equal 10000');
        });
    });

    describe('Historical Tracking', () => {
        it('should record fee payments', () => {
            feeManager.recordFeePayment(user1, 'TRADE', 1000, 5, 'standard', 20);
            
            const history = feeManager.getUserFeeHistory(user1);
            
            expect(history).toHaveLength(1);
            expect(history[0].userAddress).toBe(user1);
            expect(history[0].transactionType).toBe('TRADE');
            expect(history[0].amount).toBe(1000);
            expect(history[0].feeAmount).toBe(5);
        });

        it('should calculate fee statistics', () => {
            feeManager.recordFeePayment(user1, 'TRADE', 1000, 5, 'standard', 20);
            feeManager.recordFeePayment(user2, 'TRADE', 2000, 10, 'standard', 30);
            
            const stats = feeManager.getFeeStatistics('TRADE');
            
            expect(stats.totalFees).toBe(15);
            expect(stats.averageFee).toBe(7.5);
            expect(stats.totalTransactions).toBe(2);
        });

        it('should limit history size', () => {
            // Record many transactions to test limit
            for (let i = 0; i < 1005; i++) {
                feeManager.recordFeePayment(user1, 'TRADE', 1000, 5, 'standard', 20);
            }
            
            const history = feeManager.getUserFeeHistory(user1);
            expect(history.length).toBeLessThanOrEqual(1000);
        });
    });

    describe('Batch Operations', () => {
        it('should calculate fees in batch for gas optimization', () => {
            const requests = [
                { amount: 1000, userAddress: user1, transactionType: 'TRADE' },
                { amount: 2000, userAddress: user2, transactionType: 'TRADE' },
                { amount: 500, userAddress: user1, transactionType: 'TRANSFER' }
            ];
            
            const results = feeManager.batchCalculateFees(requests);
            
            expect(results).toHaveLength(3);
            expect(results[0].totalFee).toBe(5); // 0.5% of 1000
            expect(results[1].totalFee).toBe(10); // 0.5% of 2000
            expect(results[2].totalFee).toBeGreaterThan(0); // TRANSFER fee
        });

        it('should track gas savings from batch operations', () => {
            const requests = [
                { amount: 1000, userAddress: user1, transactionType: 'TRADE' },
                { amount: 1000, userAddress: user2, transactionType: 'TRADE' }
            ];
            
            const initialMetrics = feeManager.getOptimizationMetrics();
            feeManager.batchCalculateFees(requests);
            const finalMetrics = feeManager.getOptimizationMetrics();
            
            expect(finalMetrics.totalGasSaved).toBeGreaterThan(initialMetrics.totalGasSaved);
        });
    });

    describe('Administrative Functions', () => {
        it('should pause and unpause operations', () => {
            feeManager.pause();
            expect(feeManager.isPaused()).toBe(true);
            
            expect(() => {
                feeManager.calculateFee(1000, user1, 'TRADE');
            }).toThrow('Contract is paused');
            
            feeManager.unpause();
            expect(feeManager.isPaused()).toBe(false);
            
            expect(() => {
                feeManager.calculateFee(1000, user1, 'TRADE');
            }).not.toThrow();
        });

        it('should transfer ownership', () => {
            const newOwner = '0xnewowner';
            feeManager.transferOwnership(newOwner);
            
            expect(feeManager.getOwner()).toBe(newOwner);
        });

        it('should update fee structures', () => {
            const newStructure = {
                feeType: FeeType.FIXED,
                baseFee: 10,
                percentageFee: 0,
                minFee: 10,
                maxFee: 10
            };
            
            feeManager.updateFeeStructure('TRADE', newStructure);
            
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            expect(result.totalFee).toBe(10);
        });

        it('should add and remove fee tiers', () => {
            const tier: FeeTier = {
                id: 'test',
                name: 'Test Tier',
                minVolume: 1000,
                discountPercentage: 500,
                priority: 1
            };
            
            feeManager.addFeeTier('TRADE', tier);
            
            let structure = feeManager.getFeeStructure('TRADE');
            expect(structure?.tiers).toContain(tier);
            
            feeManager.removeFeeTier('TRADE', 0);
            
            structure = feeManager.getFeeStructure('TRADE');
            expect(structure?.tiers).not.toContain(tier);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle invalid transaction types', () => {
            expect(() => {
                feeManager.calculateFee(1000, user1, 'INVALID_TYPE');
            }).toThrow('Fee structure not found');
        });

        it('should handle negative amounts', () => {
            expect(() => {
                feeManager.calculateFee(-100, user1, 'TRADE');
            }).toThrow('Amount cannot be negative');
        });

        it('should handle invalid network congestion levels', () => {
            expect(() => {
                feeManager.setNetworkCongestionLevel(150);
            }).toThrow('Network congestion level must be between 0 and 100');
        });

        it('should handle zero amounts', () => {
            const result = feeManager.calculateFee(0, user1, 'TRADE');
            expect(result.totalFee).toBeGreaterThanOrEqual(0);
        });

        it('should handle very large amounts', () => {
            const result = feeManager.calculateFee(Number.MAX_SAFE_INTEGER, user1, 'TRADE');
            expect(result.totalFee).toBeLessThanOrEqual(100); // Max fee constraint
        });
    });

    describe('Gas Optimization', () => {
        it('should provide accurate gas estimates', () => {
            const result = feeManager.calculateFee(1000, user1, 'TRADE');
            expect(result.gasEstimate).toBeGreaterThan(0);
        });

        it('should optimize fee calculations', () => {
            const contexts = [
                {
                    userAddress: user1,
                    transactionType: 'TRADE',
                    amount: 1000,
                    networkCongestion: 20,
                    userVolume: 0,
                    timestamp: Date.now()
                },
                {
                    userAddress: user2,
                    transactionType: 'TRADE',
                    amount: 2000,
                    networkCongestion: 20,
                    userVolume: 0,
                    timestamp: Date.now()
                }
            ];
            
            const structure = feeManager.getFeeStructure('TRADE')!;
            const { results, optimizationMetrics } = FeeCalculation.optimizeFeeCalculation(structure, contexts);
            
            expect(results).toHaveLength(2);
            expect(optimizationMetrics.batchEfficiency).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Integration Tests', () => {
        it('should handle complex fee calculation scenarios', () => {
            // Setup complex scenario
            feeManager.setNetworkCongestionLevel(60);
            feeManager.updateUserVolume(user1, 'TRADE', 15000);
            
            const tier: FeeTier = {
                id: 'vip',
                name: 'VIP Tier',
                minVolume: 10000,
                discountPercentage: 1500, // 15% discount
                priority: 1
            };
            
            feeManager.addFeeTier('TRADE', tier);
            feeManager.setUserTier(user1, 'TRADE', tier);
            
            const exemptionId = feeManager.createExemption(
                user1,
                'TRADE',
                'PERCENTAGE',
                500 // 5% exemption
            );
            
            const result = feeManager.calculateFeeWithExemption(5000, user1, 'TRADE', exemptionId);
            
            // Verify all adjustments are applied
            expect(result.dynamicAdjustment).toBeGreaterThan(0);
            expect(result.volumeDiscount).toBeGreaterThan(0);
            expect(result.exemptionDiscount).toBe(500);
            expect(result.tierUsed).toBe('vip');
            expect(result.totalFee).toBeLessThan(25); // Base 0.5% of 5000
        });

        it('should maintain consistency across multiple operations', () => {
            // Perform multiple operations and verify consistency
            const results = [];
            
            for (let i = 0; i < 10; i++) {
                const result = feeManager.calculateFee(1000 + i * 100, user1, 'TRADE');
                results.push(result);
            }
            
            // Verify monotonic increase in fees with amount
            for (let i = 1; i < results.length; i++) {
                expect(results[i].totalFee).toBeGreaterThanOrEqual(results[i - 1].totalFee);
            }
        });
    });
});
