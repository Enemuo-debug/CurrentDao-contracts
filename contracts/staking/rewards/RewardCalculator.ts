import { StakingLib, BASIS_POINTS, SECONDS_PER_YEAR } from '../libraries/StakingLib';
import type { IPoolConfig, IPoolStats } from '../interfaces/IYieldFarming';

export interface IRewardProjection {
    poolId: number;
    principal: number;
    lockupDays: number;
    estimatedReward: number;
    effectiveAPY: number;
    withCompounding: number;
}

export class RewardCalculator {
    /**
     * Projects rewards for a given stake over the lockup period.
     */
    projectRewards(
        config: IPoolConfig,
        stats: IPoolStats,
        principal: number,
        lockupDays: number
    ): IRewardProjection {
        const dynamicAPY = StakingLib.getDynamicAPY(config, stats);
        const lockupSeconds = lockupDays * 86_400;
        const rewardRate = dynamicAPY / BASIS_POINTS;
        const estimatedReward = principal * rewardRate * (lockupSeconds / SECONDS_PER_YEAR);

        // Compounding boost: 15% annual boost applied monthly
        const periods = Math.floor(lockupDays / 30);
        const withCompounding = config.compoundingEnabled
            ? StakingLib.applyCompoundBoost(estimatedReward, periods)
            : estimatedReward;

        return {
            poolId: config.poolId,
            principal,
            lockupDays,
            estimatedReward,
            effectiveAPY: dynamicAPY,
            withCompounding,
        };
    }

    /**
     * Compares APY across all pools to find the best option for a given lockup.
     */
    rankPools(
        configs: IPoolConfig[],
        statsMap: Map<number, IPoolStats>,
        lockupDays: number
    ): IRewardProjection[] {
        return configs
            .filter(c => c.active)
            .map(c => {
                const stats = statsMap.get(c.poolId) ?? {
                    poolId: c.poolId,
                    totalStaked: 0,
                    utilization: 0,
                    currentAPY: c.baseAPY,
                    totalRewardsDistributed: 0,
                    stakerCount: 0,
                };
                return this.projectRewards(c, stats, 1000, lockupDays);
            })
            .sort((a, b) => b.withCompounding - a.withCompounding);
    }

    /**
     * Calculates the break-even point for early withdrawal given penalty.
     * Returns the minimum days to stake before penalty is offset by rewards.
     */
    breakEvenDays(config: IPoolConfig, stats: IPoolStats): number {
        const dynamicAPY = StakingLib.getDynamicAPY(config, stats);
        const rewardRate = dynamicAPY / BASIS_POINTS;
        const penaltyRate = config.earlyWithdrawalPenalty / BASIS_POINTS;
        if (rewardRate <= 0) return Infinity;
        // days until rewards >= penalty on full amount
        return Math.ceil((penaltyRate / rewardRate) * 365);
    }

    /**
     * Calculates gas-efficient batch reward totals for multiple stakers.
     * Aggregates in a single pass to minimize computation.
     */
    batchPendingRewards(
        entries: Array<{ amount: number; lastCompoundAt: number; pendingRewards: number }>,
        currentAPY: number,
        now: number
    ): number {
        return entries.reduce((total, e) => {
            const elapsed = now - e.lastCompoundAt;
            const accrued = elapsed > 0
                ? e.amount * (currentAPY / BASIS_POINTS) * (elapsed / SECONDS_PER_YEAR)
                : 0;
            return total + e.pendingRewards + accrued;
        }, 0);
    }
}
