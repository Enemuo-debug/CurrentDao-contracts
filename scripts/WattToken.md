# $WATT Energy Token

## Overview

The `$WATT` Energy Token is the core utility token of the CurrentDao marketplace, representing energy credits. It is a fully compliant ERC-20 token built with specific features tailored for energy production and consumption.

## Token Metadata

- **Name**: Energy Watt
- **Symbol**: WATT
- **Decimals**: 18

## Core Features

1. **ERC-20 Compatibility**: Implements all standard features (`transfer`, `approve`, `balanceOf`, `totalSupply`) allowing it to be easily integrated into DEXs, wallets, and other smart contracts.
2. **Energy Minting**: Authorized smart meters or grid oracles assigned the `MINTER` role can mint new $WATT tokens when energy is successfully produced and injected into the grid.
3. **Energy Burning**: Users or contracts with the `BURNER` role can burn tokens when energy is consumed, appropriately reducing the circulating supply.
4. **Emergency Controls**: An `ADMIN` can temporarily `pause()` and `unpause()` all token transfers and minting in the event of an emergency or critical bug.
5. **SafeMath**: All token movements are strictly protected against integer overflow and underflow vulnerabilities.

## Role-Based Access Control

- **Admin**: The creator/deployer of the contract. Can grant/revoke roles and toggle the paused state.
- **Minter**: Can create new $WATT tokens.
- **Burner**: Can destroy $WATT tokens from a user's balance to signify energy consumption.

## Contract Integration

### Minting Tokens
```typescript
// Only an account with the MINTER role can call this
wattToken.mint(minterAddress, producerAddress, 1500); // Mints 1500 WATT
```

### Burning Tokens
```typescript
// Only an account with the BURNER role can call this
wattToken.burn(burnerAddress, consumerAddress, 500); // Burns 500 WATT
```

### Standard Transfers
```typescript
wattToken.executeTransfer(senderAddress, recipientAddress, 100);
```

## Gas Optimization

The contract is designed with minimal state variables and lightweight logical checks, ensuring that high-frequency transactions (such as continuous energy production tracking) remain under the targeted 200k gas unit limits.