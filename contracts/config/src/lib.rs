#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Symbol, Vec};

// ── Storage keys ──────────────────────────────────────────────────────────────
// 0u32          → admin: Address
// 1u32          → environment: String (e.g. "testnet", "mainnet")
// 2u32          → config_version: u32
// 3u32          → paused: bool (global circuit breaker)
// 100 + hash   → ConfigParam (platform parameters by key)
// 200u32        → Vec<Symbol> (parameter key registry)
// 300u32        → Vec<Address> (authorized managers)
// 400u32        → Vec<ConfigChange> (change history)

#[contracttype]
#[derive(Clone)]
pub struct ConfigParam {
    pub key: Symbol,
    pub value: i128,
    pub min_value: i128,
    pub max_value: i128,
    pub description: String,
    pub last_updated_ledger: u32,
    pub updated_by: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct ConfigChange {
    pub key: Symbol,
    pub old_value: i128,
    pub new_value: i128,
    pub changed_by: Address,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct PlatformSettings {
    pub environment: String,
    pub version: u32,
    pub paused: bool,
    pub param_count: u32,
}

#[contract]
pub struct ConfigContract;

#[contractimpl]
impl ConfigContract {
    // ── Initialization ────────────────────────────────────────────────────────

    pub fn initialize(e: Env, admin: Address, environment: String) {
        if e.storage().instance().has(&0u32) {
            panic!("already initialized");
        }
        e.storage().instance().set(&0u32, &admin);
        e.storage().instance().set(&1u32, &environment);
        e.storage().instance().set(&2u32, &1u32); // version starts at 1
        e.storage().instance().set(&3u32, &false); // not paused

        let keys: Vec<Symbol> = Vec::new(&e);
        e.storage().instance().set(&200u32, &keys);

        let managers: Vec<Address> = Vec::new(&e);
        e.storage().instance().set(&300u32, &managers);

        let history: Vec<ConfigChange> = Vec::new(&e);
        e.storage().instance().set(&400u32, &history);
    }

    // ── Admin management ──────────────────────────────────────────────────────

    pub fn set_admin(e: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();
        Self::require_admin(&e, &current_admin);
        e.storage().instance().set(&0u32, &new_admin);
    }

    pub fn add_manager(e: Env, admin: Address, manager: Address) {
        admin.require_auth();
        Self::require_admin(&e, &admin);
        let mut managers: Vec<Address> = e.storage().instance().get(&300u32).unwrap();
        managers.push_back(manager);
        e.storage().instance().set(&300u32, &managers);
    }

    pub fn remove_manager(e: Env, admin: Address, manager: Address) {
        admin.require_auth();
        Self::require_admin(&e, &admin);
        let managers: Vec<Address> = e.storage().instance().get(&300u32).unwrap();
        let mut new_managers: Vec<Address> = Vec::new(&e);
        for m in managers.iter() {
            if m != manager {
                new_managers.push_back(m);
            }
        }
        e.storage().instance().set(&300u32, &new_managers);
    }

    // ── Parameter management ──────────────────────────────────────────────────

    /// Register a new configuration parameter with bounds.
    pub fn set_param(
        e: Env,
        caller: Address,
        key: Symbol,
        value: i128,
        min_value: i128,
        max_value: i128,
        description: String,
    ) {
        caller.require_auth();
        Self::require_manager(&e, &caller);
        Self::require_not_paused(&e);

        if value < min_value || value > max_value {
            panic!("value out of bounds");
        }

        // Check if key already exists and record change
        let param_key = Self::param_storage_key(&e, &key);
        if e.storage().instance().has(&param_key) {
            let old: ConfigParam = e.storage().instance().get(&param_key).unwrap();
            Self::record_change(&e, key.clone(), old.value, value, caller.clone());
        }

        let param = ConfigParam {
            key: key.clone(),
            value,
            min_value,
            max_value,
            description,
            last_updated_ledger: e.ledger().sequence(),
            updated_by: caller,
        };
        e.storage().instance().set(&param_key, &param);

        // Register key if new
        let mut keys: Vec<Symbol> = e.storage().instance().get(&200u32).unwrap();
        let mut found = false;
        for k in keys.iter() {
            if k == key {
                found = true;
                break;
            }
        }
        if !found {
            keys.push_back(key);
            e.storage().instance().set(&200u32, &keys);
        }

        Self::bump_version(&e);
    }

    /// Update only the value of an existing parameter (must stay within bounds).
    pub fn update_param(e: Env, caller: Address, key: Symbol, new_value: i128) {
        caller.require_auth();
        Self::require_manager(&e, &caller);
        Self::require_not_paused(&e);

        let param_key = Self::param_storage_key(&e, &key);
        let mut param: ConfigParam = e.storage().instance().get(&param_key).unwrap();

        if new_value < param.min_value || new_value > param.max_value {
            panic!("value out of bounds");
        }

        let old_value = param.value;
        param.value = new_value;
        param.last_updated_ledger = e.ledger().sequence();
        param.updated_by = caller.clone();
        e.storage().instance().set(&param_key, &param);

        Self::record_change(&e, key, old_value, new_value, caller);
        Self::bump_version(&e);
    }

    /// Remove a configuration parameter.
    pub fn remove_param(e: Env, caller: Address, key: Symbol) {
        caller.require_auth();
        Self::require_admin(&e, &caller);
        Self::require_not_paused(&e);

        let param_key = Self::param_storage_key(&e, &key);
        if !e.storage().instance().has(&param_key) {
            panic!("parameter not found");
        }

        let old: ConfigParam = e.storage().instance().get(&param_key).unwrap();
        Self::record_change(&e, key.clone(), old.value, 0, caller);

        e.storage().instance().remove(&param_key);

        // Remove from key registry
        let keys: Vec<Symbol> = e.storage().instance().get(&200u32).unwrap();
        let mut new_keys: Vec<Symbol> = Vec::new(&e);
        for k in keys.iter() {
            if k != key {
                new_keys.push_back(k);
            }
        }
        e.storage().instance().set(&200u32, &new_keys);
        Self::bump_version(&e);
    }

    // ── Query ─────────────────────────────────────────────────────────────────

    pub fn get_param(e: Env, key: Symbol) -> ConfigParam {
        let param_key = Self::param_storage_key(&e, &key);
        e.storage().instance().get(&param_key).unwrap()
    }

    pub fn get_value(e: Env, key: Symbol) -> i128 {
        let param_key = Self::param_storage_key(&e, &key);
        let param: ConfigParam = e.storage().instance().get(&param_key).unwrap();
        param.value
    }

    pub fn list_params(e: Env) -> Vec<Symbol> {
        e.storage().instance().get(&200u32).unwrap()
    }

    pub fn get_all_params(e: Env) -> Vec<ConfigParam> {
        let keys: Vec<Symbol> = e.storage().instance().get(&200u32).unwrap();
        let mut params: Vec<ConfigParam> = Vec::new(&e);
        for key in keys.iter() {
            let param_key = Self::param_storage_key(&e, &key);
            let param: ConfigParam = e.storage().instance().get(&param_key).unwrap();
            params.push_back(param);
        }
        params
    }

    /// Export all parameters as a Map<Symbol, i128> for easy consumption.
    pub fn export_config(e: Env) -> Map<Symbol, i128> {
        let keys: Vec<Symbol> = e.storage().instance().get(&200u32).unwrap();
        let mut config: Map<Symbol, i128> = Map::new(&e);
        for key in keys.iter() {
            let param_key = Self::param_storage_key(&e, &key);
            let param: ConfigParam = e.storage().instance().get(&param_key).unwrap();
            config.set(key, param.value);
        }
        config
    }

    // ── Platform settings ─────────────────────────────────────────────────────

    pub fn get_settings(e: Env) -> PlatformSettings {
        let environment: String = e.storage().instance().get(&1u32).unwrap();
        let version: u32 = e.storage().instance().get(&2u32).unwrap();
        let paused: bool = e.storage().instance().get(&3u32).unwrap_or(false);
        let keys: Vec<Symbol> = e.storage().instance().get(&200u32).unwrap();
        PlatformSettings {
            environment,
            version,
            paused,
            param_count: keys.len(),
        }
    }

    pub fn set_environment(e: Env, admin: Address, environment: String) {
        admin.require_auth();
        Self::require_admin(&e, &admin);
        e.storage().instance().set(&1u32, &environment);
        Self::bump_version(&e);
    }

    // ── Circuit breaker ───────────────────────────────────────────────────────

    pub fn pause(e: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&e, &admin);
        e.storage().instance().set(&3u32, &true);
    }

    pub fn unpause(e: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&e, &admin);
        e.storage().instance().set(&3u32, &false);
    }

    pub fn is_paused(e: Env) -> bool {
        e.storage().instance().get(&3u32).unwrap_or(false)
    }

    // ── Change history ────────────────────────────────────────────────────────

    pub fn get_history(e: Env) -> Vec<ConfigChange> {
        e.storage().instance().get(&400u32).unwrap()
    }

    pub fn get_version(e: Env) -> u32 {
        e.storage().instance().get(&2u32).unwrap()
    }

    // ── Batch operations ──────────────────────────────────────────────────────

    /// Update multiple parameters at once. Keys and values must have the same length.
    pub fn batch_update(e: Env, caller: Address, keys: Vec<Symbol>, values: Vec<i128>) {
        caller.require_auth();
        Self::require_manager(&e, &caller);
        Self::require_not_paused(&e);

        if keys.len() != values.len() {
            panic!("keys and values must have equal length");
        }

        for i in 0..keys.len() {
            let key = keys.get(i).unwrap();
            let new_value = values.get(i).unwrap();

            let param_key = Self::param_storage_key(&e, &key);
            let mut param: ConfigParam = e.storage().instance().get(&param_key).unwrap();

            if new_value < param.min_value || new_value > param.max_value {
                panic!("value out of bounds");
            }

            let old_value = param.value;
            param.value = new_value;
            param.last_updated_ledger = e.ledger().sequence();
            param.updated_by = caller.clone();
            e.storage().instance().set(&param_key, &param);

            Self::record_change(&e, key, old_value, new_value, caller.clone());
        }

        Self::bump_version(&e);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn require_admin(e: &Env, caller: &Address) {
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        if *caller != admin {
            panic!("unauthorized: admin only");
        }
    }

    fn require_manager(e: &Env, caller: &Address) {
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        if *caller == admin {
            return;
        }
        let managers: Vec<Address> = e.storage().instance().get(&300u32).unwrap();
        for m in managers.iter() {
            if m == *caller {
                return;
            }
        }
        panic!("unauthorized: not admin or manager");
    }

    fn require_not_paused(e: &Env) {
        let paused: bool = e.storage().instance().get(&3u32).unwrap_or(false);
        if paused {
            panic!("contract is paused");
        }
    }

    fn param_storage_key(e: &Env, key: &Symbol) -> u32 {
        // Use a deterministic mapping: hash the symbol to a u32 offset in the 100+ range
        // For simplicity, use the symbol's position in the registry + 100
        let keys: Vec<Symbol> = e.storage().instance().get(&200u32).unwrap();
        for i in 0..keys.len() {
            if keys.get(i).unwrap() == *key {
                return 100u32 + i;
            }
        }
        // New key — assign next slot
        100u32 + keys.len()
    }

    fn bump_version(e: &Env) {
        let version: u32 = e.storage().instance().get(&2u32).unwrap();
        e.storage().instance().set(&2u32, &(version + 1));
    }

    fn record_change(e: &Env, key: Symbol, old_value: i128, new_value: i128, changed_by: Address) {
        let mut history: Vec<ConfigChange> = e.storage().instance().get(&400u32).unwrap();
        history.push_back(ConfigChange {
            key,
            old_value,
            new_value,
            changed_by,
            ledger: e.ledger().sequence(),
        });
        e.storage().instance().set(&400u32, &history);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Env, Symbol, String};

    fn setup() -> (Env, Address, ConfigContractClient<'static>) {
        let e = Env::default();
        e.mock_all_auths();
        let contract_id = e.register(ConfigContract, ());
        let client = ConfigContractClient::new(&e, &contract_id);
        let admin = Address::generate(&e);
        let env_name = String::from_str(&e, "testnet");
        client.initialize(&admin, &env_name);
        (e, admin, client)
    }

    #[test]
    fn test_initialize() {
        let (e, _, client) = setup();
        let settings = client.get_settings();
        assert_eq!(settings.version, 1);
        assert_eq!(settings.paused, false);
        assert_eq!(settings.param_count, 0);
        assert_eq!(settings.environment, String::from_str(&e, "testnet"));
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_initialize() {
        let (e, admin, client) = setup();
        let env_name = String::from_str(&e, "mainnet");
        client.initialize(&admin, &env_name);
    }

    #[test]
    fn test_set_and_get_param() {
        let (e, admin, client) = setup();
        let key = Symbol::new(&e, "fee_rate");
        let desc = String::from_str(&e, "Platform fee rate in basis points");
        client.set_param(&admin, &key, &100, &0, &10000, &desc);

        let param = client.get_param(&key);
        assert_eq!(param.value, 100);
        assert_eq!(param.min_value, 0);
        assert_eq!(param.max_value, 10000);

        assert_eq!(client.get_value(&key), 100);
    }

    #[test]
    fn test_update_param() {
        let (e, admin, client) = setup();
        let key = Symbol::new(&e, "fee_rate");
        let desc = String::from_str(&e, "Fee rate");
        client.set_param(&admin, &key, &100, &0, &10000, &desc);

        client.update_param(&admin, &key, &250);
        assert_eq!(client.get_value(&key), 250);

        // Check version was bumped (init=1, set_param=2, update=3)
        assert_eq!(client.get_version(), 3);
    }

    #[test]
    #[should_panic(expected = "value out of bounds")]
    fn test_update_param_out_of_bounds() {
        let (e, admin, client) = setup();
        let key = Symbol::new(&e, "fee_rate");
        let desc = String::from_str(&e, "Fee rate");
        client.set_param(&admin, &key, &100, &0, &500, &desc);
        client.update_param(&admin, &key, &501);
    }

    #[test]
    fn test_remove_param() {
        let (e, admin, client) = setup();
        let key = Symbol::new(&e, "fee_rate");
        let desc = String::from_str(&e, "Fee rate");
        client.set_param(&admin, &key, &100, &0, &10000, &desc);

        assert_eq!(client.list_params().len(), 1);
        client.remove_param(&admin, &key);
        assert_eq!(client.list_params().len(), 0);
    }

    #[test]
    fn test_manager_workflow() {
        let (e, admin, client) = setup();
        let manager = Address::generate(&e);

        client.add_manager(&admin, &manager);

        // Manager can set params
        let key = Symbol::new(&e, "max_stake");
        let desc = String::from_str(&e, "Maximum stake amount");
        client.set_param(&manager, &key, &1000, &0, &100000, &desc);
        assert_eq!(client.get_value(&key), 1000);
    }

    #[test]
    fn test_pause_unpause() {
        let (_e, admin, client) = setup();
        assert_eq!(client.is_paused(), false);

        client.pause(&admin);
        assert_eq!(client.is_paused(), true);

        client.unpause(&admin);
        assert_eq!(client.is_paused(), false);
    }

    #[test]
    #[should_panic(expected = "contract is paused")]
    fn test_paused_blocks_updates() {
        let (e, admin, client) = setup();
        let key = Symbol::new(&e, "fee_rate");
        let desc = String::from_str(&e, "Fee rate");
        client.set_param(&admin, &key, &100, &0, &10000, &desc);

        client.pause(&admin);
        client.update_param(&admin, &key, &200);
    }

    #[test]
    fn test_batch_update() {
        let (e, admin, client) = setup();

        // Set up two params
        let key1 = Symbol::new(&e, "fee_rate");
        let key2 = Symbol::new(&e, "min_stake");
        let desc1 = String::from_str(&e, "Fee rate");
        let desc2 = String::from_str(&e, "Min stake");
        client.set_param(&admin, &key1, &100, &0, &10000, &desc1);
        client.set_param(&admin, &key2, &50, &0, &1000, &desc2);

        // Batch update both
        let keys = Vec::from_array(&e, [key1.clone(), key2.clone()]);
        let values = Vec::from_array(&e, [200i128, 75i128]);
        client.batch_update(&admin, &keys, &values);

        assert_eq!(client.get_value(&key1), 200);
        assert_eq!(client.get_value(&key2), 75);
    }

    #[test]
    fn test_change_history() {
        let (e, admin, client) = setup();
        let key = Symbol::new(&e, "fee_rate");
        let desc = String::from_str(&e, "Fee rate");
        client.set_param(&admin, &key, &100, &0, &10000, &desc);
        client.update_param(&admin, &key, &200);

        let history = client.get_history();
        // One change record from update_param (set_param on new key doesn't record)
        assert_eq!(history.len(), 1);
        let change = history.get(0).unwrap();
        assert_eq!(change.old_value, 100);
        assert_eq!(change.new_value, 200);
    }

    #[test]
    fn test_export_config() {
        let (e, admin, client) = setup();
        let key1 = Symbol::new(&e, "fee_rate");
        let key2 = Symbol::new(&e, "min_stake");
        let desc1 = String::from_str(&e, "Fee rate");
        let desc2 = String::from_str(&e, "Min stake");
        client.set_param(&admin, &key1, &100, &0, &10000, &desc1);
        client.set_param(&admin, &key2, &50, &0, &1000, &desc2);

        let config = client.export_config();
        assert_eq!(config.get(key1).unwrap(), 100);
        assert_eq!(config.get(key2).unwrap(), 50);
    }

    #[test]
    fn test_set_environment() {
        let (e, admin, client) = setup();
        let new_env = String::from_str(&e, "mainnet");
        client.set_environment(&admin, &new_env);
        let settings = client.get_settings();
        assert_eq!(settings.environment, String::from_str(&e, "mainnet"));
    }

    #[test]
    fn test_set_admin() {
        let (e, admin, client) = setup();
        let new_admin = Address::generate(&e);
        client.set_admin(&admin, &new_admin);

        // New admin can now set environment
        let new_env = String::from_str(&e, "mainnet");
        client.set_environment(&new_admin, &new_env);
    }

    #[test]
    fn test_get_all_params() {
        let (e, admin, client) = setup();
        let key1 = Symbol::new(&e, "fee_rate");
        let key2 = Symbol::new(&e, "min_stake");
        let desc1 = String::from_str(&e, "Fee rate");
        let desc2 = String::from_str(&e, "Min stake");
        client.set_param(&admin, &key1, &100, &0, &10000, &desc1);
        client.set_param(&admin, &key2, &50, &0, &1000, &desc2);

        let all = client.get_all_params();
        assert_eq!(all.len(), 2);
    }
}
