/**
 * deploy_staking.ts
 * Deploys the YieldFarming contract with a default set of 10 staking pools
 * covering lockup periods from 1 day to 1 year with varying APY tiers.
 */
import { YieldFarming } from '../contracts/staking/YieldFarming';
import type { IPoolConfig } from '../contracts/staking/interfaces/IYieldFarming';

const ONE_DAY = 86_400;
const ONE_YEAR = 31_536_000;

const DEFAULT_POOLS: IPoolConfig[] = [
    { poolId: 1,  name: 'Flex-1D',    rewardToken: 'WATT', baseAPY: 300,  lockupPeriod: ONE_DAY,          earlyWithdrawalPenalty: 0,    maxCapacity: 5_000_000,  compoundingEnabled: false, active: true },
    { poolId: 2,  name: 'Sprint-7D',  rewardToken: 'WATT', baseAPY: 500,  lockupPeriod: 7 * ONE_DAY,      earlyWithdrawalPenalty: 100,  maxCapacity: 5_000_000,  compoundingEnabled: false, active: true },
    { poolId: 3,  name: 'Boost-14D',  rewardToken: 'WATT', baseAPY: 700,  lockupPeriod: 14 * ONE_DAY,     earlyWithdrawalPenalty: 200,  maxCapacity: 10_000_000, compoundingEnabled: true,  active: true },
    { poolId: 4,  name: 'Core-30D',   rewardToken: 'WATT', baseAPY: 1000, lockupPeriod: 30 * ONE_DAY,     earlyWithdrawalPenalty: 300,  maxCapacity: 10_000_000, compoundingEnabled: true,  active: true },
    { poolId: 5,  name: 'Power-60D',  rewardToken: 'WATT', baseAPY: 1500, lockupPeriod: 60 * ONE_DAY,     earlyWithdrawalPenalty: 400,  maxCapacity: 20_000_000, compoundingEnabled: true,  active: true },
    { poolId: 6,  name: 'Surge-90D',  rewardToken: 'WATT', baseAPY: 2000, lockupPeriod: 90 * ONE_DAY,     earlyWithdrawalPenalty: 500,  maxCapacity: 20_000_000, compoundingEnabled: true,  active: true },
    { poolId: 7,  name: 'Volt-180D',  rewardToken: 'WATT', baseAPY: 2500, lockupPeriod: 180 * ONE_DAY,    earlyWithdrawalPenalty: 600,  maxCapacity: 50_000_000, compoundingEnabled: true,  active: true },
    { poolId: 8,  name: 'Apex-270D',  rewardToken: 'WATT', baseAPY: 3000, lockupPeriod: 270 * ONE_DAY,    earlyWithdrawalPenalty: 700,  maxCapacity: 50_000_000, compoundingEnabled: true,  active: true },
    { poolId: 9,  name: 'Max-365D',   rewardToken: 'WATT', baseAPY: 4000, lockupPeriod: ONE_YEAR,         earlyWithdrawalPenalty: 1000, maxCapacity: 100_000_000, compoundingEnabled: true, active: true },
    { poolId: 10, name: 'Elite-365D', rewardToken: 'WATT', baseAPY: 5000, lockupPeriod: ONE_YEAR,         earlyWithdrawalPenalty: 1500, maxCapacity: 50_000_000, compoundingEnabled: true,  active: true },
];

async function deploy() {
    console.log('Deploying YieldFarming contract...');

    const yf = new YieldFarming(10_000_000);

    for (const pool of DEFAULT_POOLS) {
        yf.createPool(pool);
        console.log(`  Created pool ${pool.poolId}: ${pool.name} — APY ${pool.baseAPY / 100}% base`);
    }

    console.log(`\nDeployed with ${yf.getAllPools().length} pools.`);
    console.log('YieldFarming deployment complete.');
    return yf;
}

deploy().catch(console.error);

