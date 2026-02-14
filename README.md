# CurrentDao-contracts

Smart contracts for the CurrentDao solar energy ecosystem on Stellar/Soroban.

## Overview

This project contains three main smart contracts:

1. **Energy Token ($WATT)** - A custom token representing 1kWh of energy
2. **Escrow Contract** - Holds payment until smart meter confirms energy delivery
3. **DAO Contract** - Allows members to vote on where to build new solar arrays

## Project Structure

```
CurrentDao-contracts/
├── Cargo.toml                    # Workspace configuration
├── contracts/
│   ├── token/                    # Energy Token ($WATT) contract
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── lib.rs
│   ├── escrow/                   # Escrow contract
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── lib.rs
│   └── dao/                      # DAO contract
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs
└── README.md
```

## Prerequisites

- Rust (1.70 or later)
- Soroban CLI (`cargo install stellar-soroban-cli`)

## Building

To build all contracts:

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM files are in:
- `target/wasm32-unknown-unknown/release/energy_token.wasm`
- `target/wasm32-unknown-unknown/release/escrow_contract.wasm`
- `target/wasm32-unknown-unknown/release/dao_contract.wasm`

## Contract Details

### Energy Token ($WATT)

The Energy Token represents 1kWh of energy and is used to track energy contributions from solar panel installations.

**Functions:**
- `initialize(admin, decimals, name, symbol)` - Initialize the token
- `mint(to, amount)` - Mint new tokens
- `transfer(from, to, amount)` - Transfer tokens
- `balance(addr)` - Get token balance
- `set_admin(new_admin)` - Set admin
- `burn(from, amount)` - Burn tokens

### Escrow Contract

The Escrow contract holds payments from contributors until the smart meter confirms energy delivery.

**Functions:**
- `initialize(admin)` - Initialize escrow
- `create_escrow(sender, recipient, amount)` - Create new escrow
- `confirm_delivery(escrow_id)` - Confirm delivery, release funds
- `cancel_escrow(escrow_id)` - Cancel escrow
- `get_escrow(escrow_id)` - Get escrow details

### DAO Contract

The DAO allows members to propose and vote on where to build new solar arrays.

**Functions:**
- `initialize(admin, token_address)` - Initialize DAO
- `create_proposal(proposer, location, description, amount)` - Create proposal
- `vote(voter, proposal_id, support)` - Vote on proposal
- `finalize(proposal_id)` - Finalize proposal
- `get_proposal(id)` - Get proposal details

## Usage

### Deploying Contracts

1. Deploy the Energy Token contract first
2. Deploy the Escrow contract
3. Deploy the DAO contract with the token address

### Contributor Flow

1. Contributors receive $WATT tokens (representing their energy contribution)
2. DAO members vote on proposals for new solar installations
3. Escrow ensures payments are held until energy delivery is confirmed
