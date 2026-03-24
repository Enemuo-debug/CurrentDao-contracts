#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

// ── Storage keys ──────────────────────────────────────────────────────────────
// 0u32          → admin: Address
// 1u32          → contract_count: u32
// 100 + id      → ContractEntry
// 200 + id      → Vec<UpgradeRecord>  (upgrade history per contract)
// 300u32        → Vec<Address>        (deployer allowlist — O(1) add/check)

#[contracttype]
#[derive(Clone)]
pub struct ContractEntry {
    pub id: u32,
    pub contract_type: String,   // e.g. "token", "escrow", "dao"
    pub address: Address,
    pub version: u32,            // monotonically increasing
    pub deployer: Address,
    pub network: String,         // e.g. "testnet", "mainnet"
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct UpgradeRecord {
    pub from_version: u32,
    pub to_version: u32,
    pub upgraded_by: Address,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Analytics {
    pub total: u32,
    pub active: u32,
    pub inactive: u32,
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    // ── Admin ─────────────────────────────────────────────────────────────────

    pub fn initialize(e: Env, admin: Address) {
        if e.storage().instance().has(&0u32) {
            panic!("already initialized");
        }
        e.storage().instance().set(&0u32, &admin);
        e.storage().instance().set(&1u32, &0u32);
        let allowlist: Vec<Address> = Vec::new(&e);
        e.storage().instance().set(&300u32, &allowlist);
    }

    pub fn set_admin(e: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();
        Self::require_admin(&e, &current_admin);
        e.storage().instance().set(&0u32, &new_admin);
    }

    /// Admin grants deploy rights to an address.
    pub fn add_deployer(e: Env, admin: Address, deployer: Address) {
        admin.require_auth();
        Self::require_admin(&e, &admin);
        let mut list: Vec<Address> = e.storage().instance().get(&300u32).unwrap();
        list.push_back(deployer);
        e.storage().instance().set(&300u32, &list);
    }

    // ── Factory / Deployment ──────────────────────────────────────────────────

    pub fn register(
        e: Env,
        deployer: Address,
        contract_type: String,
        address: Address,
        version: u32,
        network: String,
    ) -> u32 {
        deployer.require_auth();
        Self::require_deployer(&e, &deployer);

        let count: u32 = e.storage().instance().get(&1u32).unwrap_or(0);
        let new_id = count + 1;
        e.storage().instance().set(&1u32, &new_id);

        let entry = ContractEntry { id: new_id, contract_type, address, version, deployer, network, active: true };
        e.storage().instance().set(&(100u32 + new_id), &entry);

        let history: Vec<UpgradeRecord> = Vec::new(&e);
        e.storage().instance().set(&(200u32 + new_id), &history);

        new_id
    }

    // ── Upgrade tracking ──────────────────────────────────────────────────────

    pub fn record_upgrade(
        e: Env,
        caller: Address,
        contract_id: u32,
        new_version: u32,
        new_address: Address,
    ) {
        caller.require_auth();
        Self::require_deployer(&e, &caller);

        let key = 100u32 + contract_id;
        let mut entry: ContractEntry = e.storage().instance().get(&key).unwrap();

        if new_version <= entry.version {
            panic!("new version must be greater than current version");
        }

        let record = UpgradeRecord {
            from_version: entry.version,
            to_version: new_version,
            upgraded_by: caller,
            ledger: e.ledger().sequence(),
        };

        let hist_key = 200u32 + contract_id;
        let mut history: Vec<UpgradeRecord> = e.storage().instance().get(&hist_key).unwrap();
        history.push_back(record);
        e.storage().instance().set(&hist_key, &history);

        entry.version = new_version;
        entry.address = new_address;
        e.storage().instance().set(&key, &entry);
    }

    pub fn deactivate(e: Env, caller: Address, contract_id: u32) {
        caller.require_auth();
        Self::require_admin(&e, &caller);

        let key = 100u32 + contract_id;
        let mut entry: ContractEntry = e.storage().instance().get(&key).unwrap();
        entry.active = false;
        e.storage().instance().set(&key, &entry);
    }

    // ── Discovery ─────────────────────────────────────────────────────────────

    pub fn get_contract(e: Env, contract_id: u32) -> ContractEntry {
        e.storage().instance().get(&(100u32 + contract_id)).unwrap()
    }

    /// Find all active contracts matching a given type (e.g. "token", "dao").
    pub fn find_by_type(e: Env, contract_type: String) -> Vec<ContractEntry> {
        let count: u32 = e.storage().instance().get(&1u32).unwrap_or(0);
        let mut results: Vec<ContractEntry> = Vec::new(&e);
        for i in 1..=count {
            let entry: ContractEntry = e.storage().instance().get(&(100u32 + i)).unwrap();
            if entry.active && entry.contract_type == contract_type {
                results.push_back(entry);
            }
        }
        results
    }

    /// Find the active contract matching a given type and exact version.
    pub fn find_by_version(e: Env, contract_type: String, version: u32) -> Option<ContractEntry> {
        let count: u32 = e.storage().instance().get(&1u32).unwrap_or(0);
        for i in 1..=count {
            let entry: ContractEntry = e.storage().instance().get(&(100u32 + i)).unwrap();
            if entry.active && entry.contract_type == contract_type && entry.version == version {
                return Some(entry);
            }
        }
        None
    }

    pub fn get_history(e: Env, contract_id: u32) -> Vec<UpgradeRecord> {
        e.storage().instance().get(&(200u32 + contract_id)).unwrap()
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    pub fn analytics(e: Env) -> Analytics {
        let total: u32 = e.storage().instance().get(&1u32).unwrap_or(0);
        let mut active = 0u32;
        for i in 1..=total {
            let entry: ContractEntry = e.storage().instance().get(&(100u32 + i)).unwrap();
            if entry.active { active += 1; }
        }
        Analytics { total, active, inactive: total - active }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn require_admin(e: &Env, caller: &Address) {
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        if *caller != admin {
            panic!("unauthorized: admin only");
        }
    }

    /// O(n) over the allowlist only — not over all contracts.
    fn require_deployer(e: &Env, caller: &Address) {
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        if *caller == admin {
            return;
        }
        let list: Vec<Address> = e.storage().instance().get(&300u32).unwrap();
        for addr in list.iter() {
            if addr == *caller {
                return;
            }
        }
        panic!("unauthorized: not admin or approved deployer");
    }
}
