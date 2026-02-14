#![no_std]

use soroban_sdk::{Address, Env};

#[soroban_sdk::contract]
pub struct EscrowContract;

impl EscrowContract {
    pub fn initialize(e: Env, admin: Address) {
        // 0 = admin
        e.storage().instance().set(&0u32, &admin);
    }

    pub fn create_escrow(e: Env, sender: Address, recipient: Address, amount: i128) -> u32 {
        sender.require_auth();
        
        // Get escrow count - key 1
        let count: u32 = e.storage().instance().get(&1u32).unwrap_or(0);
        let new_id = count + 1;
        e.storage().instance().set(&1u32, &new_id);
        
        // Store escrow data at key 100 + escrow_id
        // Format: (sender, recipient, amount, released, cancelled)
        let escrow_key = 100u32 + new_id;
        e.storage().instance().set(&escrow_key, &(sender, recipient, amount, false, false));
        
        new_id
    }

    pub fn confirm_delivery(e: Env, escrow_id: u32) {
        // Get escrow
        let escrow_key = 100u32 + escrow_id;
        let (sender, recipient, amount, released, cancelled): (Address, Address, i128, bool, bool) = 
            e.storage().instance().get(&escrow_key).unwrap();
        
        // Only pending escrows can be confirmed
        if released {
            panic!("escrow already released");
        }
        if cancelled {
            panic!("escrow was cancelled");
        }
        
        // Mark as released
        e.storage().instance().set(&escrow_key, &(sender, recipient, amount, true, cancelled));
    }

    pub fn cancel_escrow(e: Env, escrow_id: u32) {
        // Get escrow
        let escrow_key = 100u32 + escrow_id;
        let (sender, recipient, amount, released, cancelled): (Address, Address, i128, bool, bool) = 
            e.storage().instance().get(&escrow_key).unwrap();
        
        // Only pending escrows can be cancelled
        if released {
            panic!("escrow already released");
        }
        if cancelled {
            panic!("escrow already cancelled");
        }
        
        // Mark as cancelled
        e.storage().instance().set(&escrow_key, &(sender, recipient, amount, released, true));
    }

    pub fn get_escrow(e: Env, escrow_id: u32) -> (Address, Address, i128, bool, bool) {
        let escrow_key = 100u32 + escrow_id;
        e.storage().instance().get(&escrow_key).unwrap()
    }
}
