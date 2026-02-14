#![no_std]

use soroban_sdk::{Address, Env, String};

#[soroban_sdk::contract]
pub struct EnergyToken;

impl EnergyToken {
    pub fn initialize(e: Env, admin: Address, _decimals: u32, _name: String, _symbol: String) {
        // Store the admin in storage
        e.storage().instance().set(&0u32, &admin);
    }

    pub fn mint(e: Env, to: Address, amount: i128) {
        // Check authorization from invoker
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        admin.require_auth();
        
        // Get current supply and add mint amount
        let supply_key = 1u32;
        let current_supply: i128 = e.storage().instance().get(&supply_key).unwrap_or(0);
        e.storage().instance().set(&supply_key, &(current_supply + amount));
        
        // Add to recipient balance - use a hash of the address
        let balance_key = 2u32;
        let current_balance: i128 = e.storage().instance().get(&balance_key).unwrap_or(0);
        e.storage().instance().set(&balance_key, &(current_balance + amount));
    }

    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        
        // Deduct from sender - use different keys
        let from_key = 3u32;
        let from_balance: i128 = e.storage().instance().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        e.storage().instance().set(&from_key, &(from_balance - amount));
        
        // Add to recipient
        let to_key = 4u32;
        let to_balance: i128 = e.storage().instance().get(&to_key).unwrap_or(0);
        e.storage().instance().set(&to_key, &(to_balance + amount));
    }

    pub fn balance(e: Env, addr: Address) -> i128 {
        let key = 5u32;
        e.storage().instance().get(&key).unwrap_or(0)
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        let admin: Address = e.storage().instance().get(&0u32).unwrap();
        admin.require_auth();
        e.storage().instance().set(&0u32, &new_admin);
    }

    pub fn burn(e: Env, from: Address, amount: i128) {
        from.require_auth();
        
        // Deduct from sender
        let from_key = 3u32;
        let from_balance: i128 = e.storage().instance().get(&from_key).unwrap_or(0);
        if from_balance < amount {
            panic!("insufficient balance");
        }
        e.storage().instance().set(&from_key, &(from_balance - amount));
        
        // Reduce total supply
        let supply_key = 1u32;
        let current_supply: i128 = e.storage().instance().get(&supply_key).unwrap_or(0);
        e.storage().instance().set(&supply_key, &(current_supply - amount));
    }
    
    pub fn supply(e: Env) -> i128 {
        let key = 1u32;
        e.storage().instance().get(&key).unwrap_or(0)
    }
}
