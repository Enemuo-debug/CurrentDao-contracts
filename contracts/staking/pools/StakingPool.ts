import type { IPoolConfig, IStakePosition, IPoolStats } from '../interfaces/IYieldFarming';
import { StakingLib } from '../libraries/StakingLib';

export class StakingPool {
    private config: IPoolConfig;
    private positions: Map<string, IStakePosition> = new Map();
    private totalStaked: number = 0;
    private totalRewardsDistributed: number = 0;
    private stakerCount: number = 0;

    constructor(config: IPoolConfig) {
        if (!StakingLib.validateLockup(config.lockupPeriod)) {
            throw new Error(`Pool ${config.poolId}: lockup must be between 1 day and 1 year`);
        }
        this.config = { ...config };
    }

    getConfig(): IPoolConfig {
        return { ...this.config };
    }

    updateConfig(updates: Partial<IPoolConfig>): void {
        if (updates.lockupPeriod !== undefined && !StakingLib.validateLockup(updates.lockupPeriod)) {
            throw new Error('Invalid lockup period');
        }
        this.config = { ...this.config, ...updates };
    }

    getStats(): IPoolStats {
        const utilization = StakingLib.calcUtilization(this.totalStaked, this.config.maxCapacity);
        const currentAPY = StakingLib.getDynamicAPY(this.config, {
            poolId: this.config.poolId,
            totalStaked: this.totalStaked,
            utilization,
            currentAPY: this.config.baseAPY,
            totalRewardsDistributed: this.totalRewardsDistributed,
            stakerCount: this.stakerCount,
        });
        return {
            poolId: this.config.poolId,
            totalStaked: this.totalStaked,
            utilization,
            currentAPY,
            totalRewardsDistributed: this.totalRewardsDistributed,
            stakerCount: this.stakerCount,
        };
    }

    stake(staker: string, amount: number, now: number): IStakePosition {
        if (!this.config.active) throw new Error(`Pool ${this.config.poolId} is not active`);
        if (amount <= 0) throw new Error('Stake amount must be positive');
        if (this.totalStaked + amount > this.config.maxCapacity) {
            throw new Error(`Pool ${this.config.poolId} capacity exceeded`);
        }

        const existing = this.positions.get(staker);
        if (existing) {
            // Accumulate pending rewards before adding more stake
            const stats = this.getStats();
            const accrued = StakingLib.calculateRewards(existing, stats.currentAPY, now);
            existing.pendingRewards += accrued;
            existing.amount += amount;
            existing.lastCompoundAt = now;
            existing.lockupEnd = now + this.config.lockupPeriod;
            this.totalStaked += amount;
            return { ...existing };
        }

        const position: IStakePosition = {
            staker,
            poolId: this.config.poolId,
            amount,
            stakedAt: now,
            lastCompoundAt: now,
            lockupEnd: now + this.config.lockupPeriod,
            pendingRewards: 0,
            compoundedRewards: 0,
        };
        this.positions.set(staker, position);
        this.totalStaked += amount;
        this.stakerCount++;
        return { ...position };
    }

    unstake(staker: string, amount: number, now: number): { received: number; penalty: number } {
        const position = this.positions.get(staker);
        if (!position) throw new Error('No stake position found');
        if (amount > position.amount) throw new Error('Insufficient staked amount');

        const penalty = StakingLib.calculatePenalty(amount, this.config, position.stakedAt, now);
        const received = amount - penalty;

        position.amount -= amount;
        this.totalStaked -= amount;

        if (position.amount === 0) {
            this.positions.delete(staker);
            this.stakerCount = Math.max(0, this.stakerCount - 1);
        }

        return { received, penalty };
    }

    claimRewards(staker: string, now: number): number {
        const position = this.positions.get(staker);
        if (!position) throw new Error('No stake position found');

        const stats = this.getStats();
        const accrued = StakingLib.calculateRewards(position, stats.currentAPY, now);
        const total = position.pendingRewards + accrued;

        position.pendingRewards = 0;
        position.lastCompoundAt = now;
        this.totalRewardsDistributed += total;

        return total;
    }

    compound(staker: string, now: number): number {
        if (!this.config.compoundingEnabled) throw new Error('Compounding not enabled for this pool');

        const position = this.positions.get(staker);
        if (!position) throw new Error('No stake position found');

        const stats = this.getStats();
        const accrued = StakingLib.calculateRewards(position, stats.currentAPY, now);
        const total = position.pendingRewards + accrued;

        // Apply 15% annual compounding boost
        const periodsCompounded = Math.floor((now - position.stakedAt) / (86_400 * 30)); // monthly periods
        const boosted = StakingLib.applyCompoundBoost(total, periodsCompounded);

        // Re-stake the boosted rewards
        if (this.totalStaked + boosted <= this.config.maxCapacity) {
            position.amount += boosted;
            this.totalStaked += boosted;
        }

        position.pendingRewards = 0;
        position.compoundedRewards += boosted;
        position.lastCompoundAt = now;
        this.totalRewardsDistributed += boosted;

        return boosted;
    }

    getPendingRewards(staker: string, now: number): number {
        const position = this.positions.get(staker);
        if (!position) return 0;
        const stats = this.getStats();
        const accrued = StakingLib.calculateRewards(position, stats.currentAPY, now);
        return position.pendingRewards + accrued;
    }

    getPosition(staker: string): IStakePosition | null {
        const p = this.positions.get(staker);
        return p ? { ...p } : null;
    }
}
