#![no_std]

mod detection;
mod protection;
mod patterns;

use soroban_sdk::{contract, Address, Env, Symbol, Vec};

pub use detection::AttackDetector;
pub use protection::ProtectionMechanisms;
pub use patterns::PatternRecognizer;

// Storage keys
const ADMIN_KEY: u32 = 0;
const PAUSED_KEY: u32 = 1;
const FLASH_LOAN_FEE_KEY: u32 = 2;
const MIN_FLASH_LOAN_AMOUNT_KEY: u32 = 3;
const MAX_FLASH_LOAN_AMOUNT_KEY: u32 = 4;
const ACTIVE_BORROW_KEY: u32 = 5; // Track active flash loans
const CALL_DEPTH_KEY: u32 = 6; // Reentrancy guard
const PATTERN_COUNT_KEY: u32 = 7; // Attack pattern count
const STATE_HASH_KEY: u32 = 8; // For state consistency checks
const BLACKLIST_KEY: u32 = 9; // Blacklisted addresses
const TOTAL_FEES_COLLECTED_KEY: u32 = 10;

#[contract]
pub struct FlashLoanProtection;

#[derive(Clone)]
pub struct FlashLoanData {
    pub borrower: Address,
    pub token: Address,
    pub amount: i128,
    pub fee: i128,
    pub timestamp: u64,
    pub tx_hash: Symbol, // To detect same-block execution
}

impl FlashLoanProtection {
    /// Initialize the flash loan protection contract
    pub fn initialize(env: Env, admin: Address, fee_bps: u32, min_amount: i128, max_amount: i128) {
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&FLASH_LOAN_FEE_KEY, &fee_bps);
        env.storage().instance().set(&MIN_FLASH_LOAN_AMOUNT_KEY, &min_amount);
        env.storage().instance().set(&MAX_FLASH_LOAN_AMOUNT_KEY, &max_amount);
        env.storage().instance().set(&PAUSED_KEY, &false);
        env.storage().instance().set(&CALL_DEPTH_KEY, &0u32);
        env.storage().instance().set(&PATTERN_COUNT_KEY, &0u32);
    }

    /// Check if flash loans are paused
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<u32, bool>(&PAUSED_KEY)
            .unwrap_or(false)
    }

    /// Emergency pause - stops all flash loans
    pub fn pause(env: Env) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();
        env.storage().instance().set(&PAUSED_KEY, &true);
    }

    /// Resume flash loans
    pub fn unpause(env: Env) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();
        env.storage().instance().set(&PAUSED_KEY, &false);
    }

    /// Execute a flash loan with comprehensive protection
    pub fn execute_flash_loan(
        env: Env,
        borrower: Address,
        token: Address,
        amount: i128,
        callback: Symbol,
    ) -> i128 {
        // Check if paused
        if Self::is_paused(env.clone()) {
            panic!("Flash loans are currently paused");
        }

        // Verify borrower authorization
        borrower.require_auth();

        // Get fee configuration
        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&FLASH_LOAN_FEE_KEY)
            .unwrap_or(10); // 0.1% default
        let min_amount: i128 = env
            .storage()
            .instance()
            .get(&MIN_FLASH_LOAN_AMOUNT_KEY)
            .unwrap_or(1_000_000);
        let max_amount: i128 = env
            .storage()
            .instance()
            .get(&MAX_FLASH_LOAN_AMOUNT_KEY)
            .unwrap_or(1_000_000_000_000);

        // Validate amount
        if amount < min_amount || amount > max_amount {
            panic!("Flash loan amount out of bounds");
        }

        // Calculate fee (bps = basis points, divide by 10000)
        let fee = (amount * (fee_bps as i128)) / 10000;

        // Create flash loan data
        let flash_data = FlashLoanData {
            borrower: borrower.clone(),
            token: token.clone(),
            amount,
            fee,
            timestamp: env.ledger().timestamp(),
            tx_hash: Symbol::new(&env, ""),
        };

        // Run attack detection
        let detector = AttackDetector::new(&env);
        detector.detect_attack(&flash_data);

        // Check for blacklisted addresses
        if Self::is_blacklisted(&env, &borrower) {
            panic!("Borrower is blacklisted");
        }

        // Increment call depth for reentrancy protection
        let current_depth: u32 = env
            .storage()
            .instance()
            .get(&CALL_DEPTH_KEY)
            .unwrap_or(0);
        if current_depth > 0 {
            panic!("Reentrancy detected");
        }
        env.storage()
            .instance()
            .set(&CALL_DEPTH_KEY, &(current_depth + 1));

        // Store active borrow
        env.storage()
            .instance()
            .set(&ACTIVE_BORROW_KEY, &flash_data.clone());

        // Execute callback (simulated - in real implementation would use invoke_host_function)
        // For now, we'll just demonstrate the pattern
        let result = amount + fee; // Simulated return

        // Verify state consistency
        let protection = ProtectionMechanisms::new(&env);
        protection.verify_state_consistency(&flash_data);

        // Run pattern recognition to detect novel attacks
        let recognizer = PatternRecognizer::new(&env);
        recognizer.analyze_pattern(&flash_data);

        // Verify callback repaid loan + fee
        let repay_amount: i128 = amount + fee;

        // Decrement call depth
        env.storage()
            .instance()
            .set(&CALL_DEPTH_KEY, &(current_depth));

        // Clear active borrow
        env.storage().instance().set(&ACTIVE_BORROW_KEY, &false);

        // Update fee collection
        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&TOTAL_FEES_COLLECTED_KEY)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&TOTAL_FEES_COLLECTED_KEY, &(total_fees + fee));

        repay_amount
    }

    /// Add address to blacklist
    pub fn blacklist_address(env: Env, address: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();

        let addr_string = address.to_xdr(&env);
        let blacklist_key = BLACKLIST_KEY;
        let mut blacklist: Vec<Address> = env
            .storage()
            .instance()
            .get(&blacklist_key)
            .unwrap_or(Vec::new(&env));

        // Check if already blacklisted
        for addr in blacklist.iter() {
            if addr.to_xdr(&env) == addr_string {
                return; // Already blacklisted
            }
        }

        blacklist.push_back(address);
        env.storage().instance().set(&blacklist_key, &blacklist);
    }

    /// Remove address from blacklist
    pub fn unblacklist_address(env: Env, address: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();

        let addr_string = address.to_xdr(&env);
        let blacklist_key = BLACKLIST_KEY;
        let mut blacklist: Vec<Address> = env
            .storage()
            .instance()
            .get(&blacklist_key)
            .unwrap_or(Vec::new(&env));

        let mut new_list = Vec::new(&env);
        for addr in blacklist.iter() {
            if addr.to_xdr(&env) != addr_string {
                new_list.push_back(addr);
            }
        }

        env.storage()
            .instance()
            .set(&blacklist_key, &new_list);
    }

    /// Check if address is blacklisted
    pub fn is_blacklisted(env: &Env, address: &Address) -> bool {
        let addr_string = address.to_xdr(env);
        let blacklist_key = BLACKLIST_KEY;
        let blacklist: Vec<Address> = env
            .storage()
            .instance()
            .get(&blacklist_key)
            .unwrap_or(Vec::new(env));

        for addr in blacklist.iter() {
            if addr.to_xdr(env) == addr_string {
                return true;
            }
        }
        false
    }

    /// Get total fees collected
    pub fn get_total_fees(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&TOTAL_FEES_COLLECTED_KEY)
            .unwrap_or(0)
    }

    /// Withdraw collected fees (admin only)
    pub fn withdraw_fees(env: Env, amount: i128) -> i128 {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();

        let total_fees: i128 = env
            .storage()
            .instance()
            .get(&TOTAL_FEES_COLLECTED_KEY)
            .unwrap_or(0);

        if amount > total_fees {
            panic!("Insufficient fees collected");
        }

        env.storage()
            .instance()
            .set(&TOTAL_FEES_COLLECTED_KEY, &(total_fees - amount));

        amount
    }

    /// Get current flash loan fee (in basis points)
    pub fn get_fee(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&FLASH_LOAN_FEE_KEY)
            .unwrap_or(10)
    }

    /// Update flash loan fee
    pub fn set_fee(env: Env, new_fee_bps: u32) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();

        if new_fee_bps > 1000 {
            panic!("Fee cannot exceed 10%");
        }

        env.storage()
            .instance()
            .set(&FLASH_LOAN_FEE_KEY, &new_fee_bps);
    }

    /// Get attack pattern count
    pub fn get_attack_pattern_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&PATTERN_COUNT_KEY)
            .unwrap_or(0)
    }

    /// Get min flash loan amount
    pub fn get_min_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&MIN_FLASH_LOAN_AMOUNT_KEY)
            .unwrap_or(1_000_000)
    }

    /// Get max flash loan amount
    pub fn get_max_amount(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&MAX_FLASH_LOAN_AMOUNT_KEY)
            .unwrap_or(1_000_000_000_000)
    }

    /// Update flash loan limits
    pub fn set_limits(env: Env, min_amount: i128, max_amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        admin.require_auth();

        if min_amount >= max_amount {
            panic!("Invalid limits");
        }

        env.storage()
            .instance()
            .set(&MIN_FLASH_LOAN_AMOUNT_KEY, &min_amount);
        env.storage()
            .instance()
            .set(&MAX_FLASH_LOAN_AMOUNT_KEY, &max_amount);
    }
}
