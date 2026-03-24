# ContractRegistry

On-chain registry for all CurrentDao contracts deployed on Stellar/Soroban.

## Architecture

```
contracts/registry/src/lib.rs
├── ContractEntry       — stored data per registered contract
├── UpgradeRecord       — one record per upgrade event
└── RegistryContract    — the contract itself
```

Storage layout (instance storage):

| Key         | Value              |
|-------------|--------------------|
| `0u32`      | `admin: Address`   |
| `1u32`      | `contract_count: u32` |
| `100 + id`  | `ContractEntry`    |
| `200 + id`  | `Vec<UpgradeRecord>` |

## Functions

### Governance
| Function | Auth | Description |
|---|---|---|
| `initialize(admin)` | — | One-time setup, seeds deployer allowlist |
| `set_admin(current, new)` | admin | Transfer admin |
| `add_deployer(admin, deployer)` | admin | Grant deploy rights to an address |

### Factory / Deployment
| Function | Auth | Description |
|---|---|---|
| `register(deployer, type, address, version, network)` | admin or allowlisted deployer | Register a new contract deployment |

### Upgrade Tracking
| Function | Auth | Description |
|---|---|---|
| `record_upgrade(caller, id, new_version, new_address)` | admin or allowlisted deployer | Record a contract upgrade; enforces version monotonicity |
| `deactivate(caller, id)` | admin | Soft-delete a contract |

### Discovery
| Function | Auth | Description |
|---|---|---|
| `get_contract(id)` | — | Fetch a `ContractEntry` by registry ID |
| `find_by_type(contract_type)` | — | All active contracts of a given type |
| `find_by_version(contract_type, version)` | — | Active contract matching type + exact version |
| `get_history(id)` | — | Full `Vec<UpgradeRecord>` for a contract |

### Analytics
| Function | Auth | Description |
|---|---|---|
| `analytics()` | — | Returns `Analytics { total, active, inactive }` |

## ContractEntry fields

```rust
pub struct ContractEntry {
    pub id: u32,
    pub contract_type: String,  // "token" | "escrow" | "dao" | ...
    pub address: Address,
    pub version: u32,           // monotonically increasing
    pub deployer: Address,
    pub network: String,        // "testnet" | "mainnet" | "futurenet"
    pub active: bool,
}
```

## Deployment

```bash
export ADMIN_SECRET_KEY=<your-secret>
./scripts/deploy_registry.sh testnet
```

## Registering a contract post-deploy

```bash
stellar contract invoke \
  --id <REGISTRY_CONTRACT_ID> \
  --source <DEPLOYER_SECRET> \
  --network testnet \
  -- register \
  --deployer <DEPLOYER_ADDRESS> \
  --contract_type "token" \
  --address <TOKEN_CONTRACT_ID> \
  --version 1 \
  --network "testnet"
```

## Cross-chain support

The `network` field on `ContractEntry` tracks which Stellar network (testnet / mainnet / futurenet) a contract lives on. Deploy one registry per network and use the `network` field for cross-network discovery in off-chain tooling.

## Version management

`record_upgrade` enforces `new_version > current_version`, preventing accidental downgrades. All previous versions remain queryable via `get_history`.

## Gas / storage notes

All data lives in instance storage (cheapest on Soroban). The deployer authorization check (`require_deployer`) is O(n) over the allowlist only — not over all registered contracts. The allowlist is expected to stay small (< 20 addresses), making this negligible. Discovery functions (`find_by_type`, `find_by_version`, `analytics`) are O(n) over registered contracts by necessity — no cheaper alternative exists on Soroban without an off-chain index.
