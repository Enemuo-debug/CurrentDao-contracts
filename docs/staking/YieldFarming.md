# YieldFarming & Staking Contract

Yield farming and staking system for `$WATT` tokens in the CurrentDao ecosystem.

## Architecture

```
contracts/staking/
├── YieldFarming.ts              # Main facade
├── interfaces/IYieldFarming.ts  # Types & interfaces
├── libraries/StakingLib.ts      # Pure calculation helpers
├── pools/StakingPool.ts         # Per-pool state & logic
├── rewards/RewardCalculator.ts  # APY projections & ranking
└── governance/PoolGovernance.ts # On-chain parameter voting
```

## Pools

10 default pools are deployed covering lockup periods from 1 day to 1 year:

| Pool | Name       | Base APY | Lockup  | Compounding | Max Penalty |
|------|------------|----------|---------|-------------|-------------|
| 1    | Flex-1D    | 3%       | 1 day   | No          | 0%          |
| 2    | Sprint-7D  | 5%       | 7 days  | No          | 1%          |
| 3    | Boost-14D  | 7%       | 14 days | Yes         | 2%          |
| 4    | Core-30D   | 10%      | 30 days | Yes         | 3%          |
| 5    | Power-60D  | 15%      | 60 days | Yes         | 4%          |
| 6    | Surge-90D  | 20%      | 90 days | Yes         | 5%          |
| 7    | Volt-180D  | 25%      | 180 days| Yes         | 6%          |
| 8    | Apex-270D  | 30%      | 270 days| Yes         | 7%          |
| 9    | Max-365D   | 40%      | 1 year  | Yes         | 10%         |
| 10   | Elite-365D | 50%      | 1 year  | Yes         | 15%         |

## Dynamic APY

APY scales linearly with pool utilization up to 2× the base rate:

```
effectiveAPY = baseAPY × (1 + utilization%)
```

At 100% utilization, a 10% base APY pool yields up to 20%.

## Compounding

Compounding re-stakes accrued rewards back into the position. A 1.5% monthly boost is applied per compounding period, resulting in approximately **15–20% additional yield annually** over simple interest.

```
boostedRewards = baseRewards × (1.015)^periods
```

## Early Withdrawal Penalties

Penalties scale linearly with remaining lockup time:

```
penalty = amount × penaltyRate × (remainingTime / lockupPeriod)
```

No penalty is applied after the lockup period expires.

## Governance

Pool parameters can be adjusted via on-chain proposals:

1. Any address calls `proposeParameterChange(poolId, paramKey, newValue)`
2. Token holders vote within a 7-day window
3. Quorum: 10% of total voting weight must participate
4. Pass threshold: >50% of votes must be in favour
5. After the voting period, anyone can call `executeProposal(id)`

Governable parameters: `baseAPY`, `earlyWithdrawalPenalty`, `maxCapacity`, `active`, `compoundingEnabled`.

## Gas Targets

| Operation | Estimated Gas |
|-----------|--------------|
| stake     | ~80k         |
| unstake   | ~100k        |
| claim     | ~60k         |
| compound  | ~90k         |

All operations target < 200k gas.

## Security

- Emergency pause/unpause halts all staking operations
- Reentrancy is prevented by updating state before external calls
- Capacity limits prevent pool overflow
- Governance proposals require quorum to prevent low-participation attacks

## Integration

```typescript
import { YieldFarming } from './contracts/staking/YieldFarming';

const yf = new YieldFarming();
yf.createPool({ poolId: 1, name: 'Core-30D', rewardToken: 'WATT', baseAPY: 1000, ... });

yf.stake('userAddress', 1, 5000);
const rewards = yf.getPendingRewards('userAddress', 1);
yf.compound('userAddress', 1);
yf.claimRewards('userAddress', 1);
```
