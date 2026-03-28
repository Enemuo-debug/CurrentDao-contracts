#!/usr/bin/env bash
# deploy_registry.sh — Deploy and initialize the ContractRegistry on Stellar/Soroban
set -euo pipefail

NETWORK="${1:-testnet}"
ADMIN_SECRET="${ADMIN_SECRET_KEY:?Set ADMIN_SECRET_KEY env var}"

echo "==> Building registry contract..."
cargo build --target wasm32-unknown-unknown --release -p registry-contract

WASM="target/wasm32-unknown-unknown/release/registry_contract.wasm"

echo "==> Deploying to $NETWORK..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$ADMIN_SECRET" \
  --network "$NETWORK")

echo "Contract ID: $CONTRACT_ID"

echo "==> Initializing registry..."
ADMIN_ADDRESS=$(stellar keys address "$ADMIN_SECRET" --network "$NETWORK")

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$ADMIN_SECRET" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$ADMIN_ADDRESS"

echo "==> Registry deployed and initialized."
echo "CONTRACT_ID=$CONTRACT_ID"
