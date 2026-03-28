import type {
    IYieldFarming,
    IPoolConfig,
    IStakePosition,
    IPoolStats,
    IGovernanceProposal,
} from './interfaces/IYieldFarming';
import { StakingPool } from './pools/StakingPool';
import { RewardCalculator } from './rewards/RewardCalculator';
import { PoolGovernance } from './governance/PoolGovernance';

/**
 * YieldFarming — main facade for the $WATT staking and yield farming system.
 *
 * Supports 10+ pools, dynamic APY based on utilization, lock-up periods
 * from 1 day to 1 year, 15% annual compounding boost, early withdrawal
 * penalties, and on-chain pool governance.
 *
 * All staking operations are designed to stay under 200k gas equivalent.
 */
export class YieldFarming implements IYieldFarming {
    private pools: Map<number, StakingPool> = new Map();
    private rewardCalculator: RewardCalculator;
    private governance: PoolGovernance;
    private paused: boolean = false;
    private now: () => number;

    constructor(initialVotingWeight: number = 1_000_000, clock?: () => number) {
        this.rewardCalculator = new RewardCalculator();
        this.now = clock ?? (() => Math.floor(Date.now() / 1000));
        this.governance = new PoolGovernance(
            initialVotingWeight,
            (poolId, paramKey, newValue) => this.applyGovernanceChange(poolId, paramKey, newValue)
        );
    }

    // ─── Pool Management ────────────────────────────────────────────────────

    createPool(config: IPoolConfig): void {
        if (this.pools.has(config.poolId)) {
            throw new Error(`Pool ${config.poolId} already exists`);
        }
        this.pools.set(config.poolId, new StakingPool(config));
    }

    updatePool(poolId: number, updates: Partial<IPoolConfig>): void {
        this.getPoolOrThrow(poolId).updateConfig(updates);
    }

    getPool(poolId: number): IPoolConfig {
        return this.getPoolOrThrow(poolId).getConfig();
    }

    getPoolStats(poolId: number): IPoolStats {
        return this.getPoolOrThrow(poolId).getStats();
    }

    getAllPools(): IPoolConfig[] {
        return Array.from(this.pools.values()).map(p => p.getConfig());
    }

    // ─── Staking ────────────────────────────────────────────────────────────

    stake(staker: string, poolId: number, amount: number): IStakePosition {
        this.assertNotPaused();
        return this.getPoolOrThrow(poolId).stake(staker, amount, this.now());
    }

    unstake(staker: string, poolId: number, amount: number): { received: number; penalty: number } {
        this.assertNotPaused();
        return this.getPoolOrThrow(poolId).unstake(staker, amount, this.now());
    }

    getPosition(staker: string, poolId: number): IStakePosition | null {
        return this.getPoolOrThrow(poolId).getPosition(staker);
    }

    // ─── Rewards ────────────────────────────────────────────────────────────

    claimRewards(staker: string, poolId: number): number {
        this.assertNotPaused();
        return this.getPoolOrThrow(poolId).claimRewards(staker, this.now());
    }

    compound(staker: string, poolId: number): number {
        this.assertNotPaused();
        return this.getPoolOrThrow(poolId).compound(staker, this.now());
    }

    getPendingRewards(staker: string, poolId: number): number {
        return this.getPoolOrThrow(poolId).getPendingRewards(staker, this.now());
    }

    /**
     * Projects rewards across all pools for a given principal and lockup.
     * Useful for UI to show competitive APY comparisons.
     */
    projectRewards(principal: number, lockupDays: number) {
        const configs = this.getAllPools();
        const statsMap = new Map<number, IPoolStats>(
            configs.map(c => [c.poolId, this.getPoolStats(c.poolId)])
        );
        return this.rewardCalculator.rankPools(configs, statsMap, lockupDays);
    }

    // ─── Governance ─────────────────────────────────────────────────────────

    proposeParameterChange(
        proposal: Omit<IGovernanceProposal, 'proposalId' | 'votesFor' | 'votesAgainst' | 'executed'>
    ): number {
        return this.governance.propose(
            proposal.poolId,
            proposal.paramKey,
            proposal.newValue,
            proposal.proposer,
            this.now()
        );
    }

    vote(proposalId: number, voter: string, support: boolean, weight: number): void {
        this.governance.vote(proposalId, voter, support, weight, this.now());
    }

    executeProposal(proposalId: number): void {
        this.governance.execute(proposalId, this.now());
    }

    getProposal(proposalId: number): IGovernanceProposal | null {
        return this.governance.getProposal(proposalId);
    }

    // ─── Emergency ──────────────────────────────────────────────────────────

    emergencyPause(): void {
        this.paused = true;
    }

    emergencyUnpause(): void {
        this.paused = false;
    }

    // ─── Internals ──────────────────────────────────────────────────────────

    private getPoolOrThrow(poolId: number): StakingPool {
        const pool = this.pools.get(poolId);
        if (!pool) throw new Error(`Pool ${poolId} not found`);
        return pool;
    }

    private assertNotPaused(): void {
        if (this.paused) throw new Error('YieldFarming: contract is paused');
    }

    private applyGovernanceChange(poolId: number, paramKey: string, newValue: number): void {
        const pool = this.pools.get(poolId);
        if (!pool) return;
        pool.updateConfig({ [paramKey]: newValue } as Partial<IPoolConfig>);
    }
}
