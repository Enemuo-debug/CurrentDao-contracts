import { YieldFarming } from '../../contracts/staking/YieldFarming';
import { StakingLib } from '../../contracts/staking/libraries/StakingLib';
import { RewardCalculator } from '../../contracts/staking/rewards/RewardCalculator';
import type { IPoolConfig } from '../../contracts/staking/interfaces/IYieldFarming';

const ONE_DAY = 86_400;
const ONE_YEAR = 31_536_000;

function makePool(id: number, overrides: Partial<IPoolConfig> = {}): IPoolConfig {
    return {
        poolId: id,
        name: `Pool ${id}`,
        rewardToken: 'WATT',
        baseAPY: 1000,              // 10%
        lockupPeriod: 30 * ONE_DAY, // 30 days
        earlyWithdrawalPenalty: 500, // 5%
        maxCapacity: 1_000_000,
        compoundingEnabled: true,
        active: true,
        ...overrides,
    };
}

function makeYF(startTime = 1_000_000) {
    let t = startTime;
    const clock = () => t;
    const yf = new YieldFarming(1_000_000, clock);
    return { yf, clock, advance: (secs: number) => { t += secs; } };
}

// ─── Pool Management ────────────────────────────────────────────────────────

describe('Pool Management', () => {
    test('creates up to 10+ pools', () => {
        const { yf } = makeYF();
        for (let i = 1; i <= 12; i++) {
            yf.createPool(makePool(i));
        }
        expect(yf.getAllPools()).toHaveLength(12);
    });

    test('throws on duplicate pool id', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        expect(() => yf.createPool(makePool(1))).toThrow('already exists');
    });

    test('throws on invalid lockup period (< 1 day)', () => {
        const { yf } = makeYF();
        expect(() => yf.createPool(makePool(1, { lockupPeriod: 3600 }))).toThrow();
    });

    test('throws on invalid lockup period (> 1 year)', () => {
        const { yf } = makeYF();
        expect(() => yf.createPool(makePool(1, { lockupPeriod: ONE_YEAR + 1 }))).toThrow();
    });

    test('lockup boundary: 1 day is valid', () => {
        const { yf } = makeYF();
        expect(() => yf.createPool(makePool(1, { lockupPeriod: ONE_DAY }))).not.toThrow();
    });

    test('lockup boundary: 1 year is valid', () => {
        const { yf } = makeYF();
        expect(() => yf.createPool(makePool(1, { lockupPeriod: ONE_YEAR }))).not.toThrow();
    });

    test('updates pool config', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        yf.updatePool(1, { baseAPY: 2000 });
        expect(yf.getPool(1).baseAPY).toBe(2000);
    });

    test('getPool throws for unknown pool', () => {
        const { yf } = makeYF();
        expect(() => yf.getPool(99)).toThrow('not found');
    });
});

// ─── Staking ────────────────────────────────────────────────────────────────

describe('Staking', () => {
    test('stakes tokens and creates position', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        const pos = yf.stake('alice', 1, 1000);
        expect(pos.amount).toBe(1000);
        expect(pos.poolId).toBe(1);
        expect(pos.staker).toBe('alice');
    });

    test('adds to existing position on re-stake', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1));
        yf.stake('alice', 1, 1000);
        advance(ONE_DAY);
        const pos = yf.stake('alice', 1, 500);
        expect(pos.amount).toBe(1500);
    });

    test('rejects stake exceeding pool capacity', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1, { maxCapacity: 500 }));
        expect(() => yf.stake('alice', 1, 1000)).toThrow('capacity exceeded');
    });

    test('rejects zero stake amount', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        expect(() => yf.stake('alice', 1, 0)).toThrow();
    });

    test('rejects stake on inactive pool', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1, { active: false }));
        expect(() => yf.stake('alice', 1, 100)).toThrow('not active');
    });

    test('pool stats reflect staked amount and utilization', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1, { maxCapacity: 10_000 }));
        yf.stake('alice', 1, 5_000);
        const stats = yf.getPoolStats(1);
        expect(stats.totalStaked).toBe(5_000);
        expect(stats.utilization).toBe(50);
    });
});

// ─── Unstaking & Penalties ──────────────────────────────────────────────────

describe('Unstaking & Early Withdrawal Penalties', () => {
    test('no penalty after lockup period', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1, { lockupPeriod: ONE_DAY }));
        yf.stake('alice', 1, 1000);
        advance(ONE_DAY + 1);
        const { received, penalty } = yf.unstake('alice', 1, 1000);
        expect(penalty).toBe(0);
        expect(received).toBe(1000);
    });

    test('applies penalty for early withdrawal', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1, { lockupPeriod: 30 * ONE_DAY, earlyWithdrawalPenalty: 500 }));
        yf.stake('alice', 1, 1000);
        // Withdraw immediately — full penalty applies
        const { penalty } = yf.unstake('alice', 1, 1000);
        expect(penalty).toBeGreaterThan(0);
        expect(penalty).toBeLessThanOrEqual(50); // max 5% of 1000
    });

    test('penalty scales linearly with remaining lockup', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1, { lockupPeriod: 30 * ONE_DAY, earlyWithdrawalPenalty: 1000 }));
        yf.stake('alice', 1, 1000);
        advance(15 * ONE_DAY); // halfway through lockup
        const { penalty } = yf.unstake('alice', 1, 1000);
        // ~50% of max penalty
        expect(penalty).toBeGreaterThan(0);
        expect(penalty).toBeLessThan(100);
    });

    test('throws when unstaking more than staked', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        yf.stake('alice', 1, 500);
        expect(() => yf.unstake('alice', 1, 1000)).toThrow('Insufficient');
    });

    test('throws when no position exists', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        expect(() => yf.unstake('bob', 1, 100)).toThrow('No stake position');
    });
});

// ─── Rewards ────────────────────────────────────────────────────────────────

describe('Reward Calculation', () => {
    test('accrues rewards over time', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1, { baseAPY: 1000 })); // 10% APY
        yf.stake('alice', 1, 10_000);
        advance(ONE_YEAR);
        const pending = yf.getPendingRewards('alice', 1);
        // ~10% of 10000 = ~1000 (dynamic APY may be slightly higher)
        expect(pending).toBeGreaterThan(900);
        expect(pending).toBeLessThan(2500);
    });

    test('claimRewards returns accrued amount and resets', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1));
        yf.stake('alice', 1, 10_000);
        advance(ONE_YEAR);
        const claimed = yf.claimRewards('alice', 1);
        expect(claimed).toBeGreaterThan(0);
        const afterClaim = yf.getPendingRewards('alice', 1);
        expect(afterClaim).toBeCloseTo(0, 0);
    });

    test('dynamic APY increases with pool utilization', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1, { baseAPY: 1000, maxCapacity: 10_000 }));
        yf.stake('alice', 1, 9_000); // 90% utilization
        const stats = yf.getPoolStats(1);
        expect(stats.currentAPY).toBeGreaterThan(1000); // boosted above base
    });

    test('pending rewards are zero for non-existent position', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        expect(yf.getPendingRewards('nobody', 1)).toBe(0);
    });
});

describe('Compounding', () => {
    test('compound re-stakes rewards and increases position', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1, { compoundingEnabled: true }));
        yf.stake('alice', 1, 10_000);
        advance(ONE_YEAR);
        const compounded = yf.compound('alice', 1);
        expect(compounded).toBeGreaterThan(0);
        const pos = yf.getPosition('alice', 1);
        expect(pos!.amount).toBeGreaterThan(10_000);
    });

    test('compounding boost is ~15% annually over simple interest', () => {
        const base = 1000;
        const periods = 12; // 12 monthly periods = 1 year
        const boosted = StakingLib.applyCompoundBoost(base, periods);
        // 1.5% monthly boost compounded 12x ≈ 19.6% gain on rewards
        expect(boosted).toBeGreaterThan(base * 1.15);
    });

    test('throws when compounding disabled', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1, { compoundingEnabled: false }));
        yf.stake('alice', 1, 1000);
        advance(ONE_DAY);
        expect(() => yf.compound('alice', 1)).toThrow('not enabled');
    });
});

// ─── Governance ─────────────────────────────────────────────────────────────

describe('Pool Governance', () => {
    test('proposal is created and retrievable', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        const id = yf.proposeParameterChange({
            poolId: 1, paramKey: 'baseAPY', newValue: 2000,
            proposer: 'alice', deadline: 0,
        });
        expect(id).toBe(1);
        const proposal = yf.getProposal(id);
        expect(proposal).not.toBeNull();
        expect(proposal!.paramKey).toBe('baseAPY');
    });

    test('proposal passes and updates pool param', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1));
        const id = yf.proposeParameterChange({
            poolId: 1, paramKey: 'baseAPY', newValue: 2000,
            proposer: 'alice', deadline: 0,
        });
        // Vote with enough weight to pass (>50% of 1_000_000 total)
        yf.vote(id, 'alice', true, 600_000);
        yf.vote(id, 'bob', false, 100_000);
        advance(7 * ONE_DAY + 1); // past voting period
        yf.executeProposal(id);
        expect(yf.getPool(1).baseAPY).toBe(2000);
    });

    test('proposal fails without quorum', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1));
        const id = yf.proposeParameterChange({
            poolId: 1, paramKey: 'baseAPY', newValue: 2000,
            proposer: 'alice', deadline: 0,
        });
        yf.vote(id, 'alice', true, 500); // below 10% quorum
        advance(7 * ONE_DAY + 1);
        expect(() => yf.executeProposal(id)).toThrow('Quorum');
    });

    test('cannot vote after deadline', () => {
        const { yf, advance } = makeYF();
        yf.createPool(makePool(1));
        const id = yf.proposeParameterChange({
            poolId: 1, paramKey: 'baseAPY', newValue: 2000,
            proposer: 'alice', deadline: 0,
        });
        advance(7 * ONE_DAY + 1);
        expect(() => yf.vote(id, 'alice', true, 600_000)).toThrow('Voting period ended');
    });

    test('cannot execute before voting period ends', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        const id = yf.proposeParameterChange({
            poolId: 1, paramKey: 'baseAPY', newValue: 2000,
            proposer: 'alice', deadline: 0,
        });
        yf.vote(id, 'alice', true, 600_000);
        expect(() => yf.executeProposal(id)).toThrow('not ended');
    });
});

// ─── Emergency & Edge Cases ──────────────────────────────────────────────────

describe('Emergency Controls', () => {
    test('paused contract rejects stake', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        yf.emergencyPause();
        expect(() => yf.stake('alice', 1, 100)).toThrow('paused');
    });

    test('paused contract rejects unstake', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        yf.stake('alice', 1, 100);
        yf.emergencyPause();
        expect(() => yf.unstake('alice', 1, 100)).toThrow('paused');
    });

    test('unpausing restores operations', () => {
        const { yf } = makeYF();
        yf.createPool(makePool(1));
        yf.emergencyPause();
        yf.emergencyUnpause();
        expect(() => yf.stake('alice', 1, 100)).not.toThrow();
    });
});

// ─── RewardCalculator ────────────────────────────────────────────────────────

describe('RewardCalculator', () => {
    const calc = new RewardCalculator();
    const config = makePool(1, { baseAPY: 1000, maxCapacity: 10_000 });
    const stats = { poolId: 1, totalStaked: 5000, utilization: 50, currentAPY: 1500, totalRewardsDistributed: 0, stakerCount: 1 };

    test('projects rewards for a given principal and lockup', () => {
        const proj = calc.projectRewards(config, stats, 10_000, 365);
        expect(proj.estimatedReward).toBeGreaterThan(0);
        expect(proj.withCompounding).toBeGreaterThanOrEqual(proj.estimatedReward);
    });

    test('ranks pools by best yield', () => {
        const configs = [
            makePool(1, { baseAPY: 500 }),
            makePool(2, { baseAPY: 2000 }),
            makePool(3, { baseAPY: 1000 }),
        ];
        const statsMap = new Map(configs.map(c => [c.poolId, { ...stats, poolId: c.poolId }]));
        const ranked = calc.rankPools(configs, statsMap, 30);
        expect(ranked[0]!.poolId).toBe(2); // highest APY first
    });

    test('calculates break-even days', () => {
        const days = calc.breakEvenDays(config, stats);
        expect(days).toBeGreaterThan(0);
        expect(days).toBeLessThan(365);
    });

    test('batch pending rewards aggregates correctly', () => {
        const now = 1_000_000 + ONE_YEAR;
        const entries = [
            { amount: 1000, lastCompoundAt: 1_000_000, pendingRewards: 0 },
            { amount: 2000, lastCompoundAt: 1_000_000, pendingRewards: 50 },
        ];
        const total = calc.batchPendingRewards(entries, 1000, now);
        expect(total).toBeGreaterThan(50);
    });
});

// ─── StakingLib ──────────────────────────────────────────────────────────────

describe('StakingLib', () => {
    test('validateLockup accepts valid range', () => {
        expect(StakingLib.validateLockup(ONE_DAY)).toBe(true);
        expect(StakingLib.validateLockup(ONE_YEAR)).toBe(true);
        expect(StakingLib.validateLockup(ONE_DAY - 1)).toBe(false);
        expect(StakingLib.validateLockup(ONE_YEAR + 1)).toBe(false);
    });

    test('calcUtilization clamps at 100%', () => {
        expect(StakingLib.calcUtilization(2000, 1000)).toBe(100);
        expect(StakingLib.calcUtilization(500, 1000)).toBe(50);
    });

    test('estimateGasCategory returns low for claim', () => {
        expect(StakingLib.estimateGasCategory('claim')).toBe('low');
    });

    test('applyCompoundBoost increases rewards', () => {
        const boosted = StakingLib.applyCompoundBoost(1000, 12);
        expect(boosted).toBeGreaterThan(1000);
    });
});
