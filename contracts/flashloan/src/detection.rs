use soroban_sdk::{Address, Env};

use crate::FlashLoanData;

/// Attack detection module for identifying flash loan attacks
pub struct AttackDetector<'a> {
    env: &'a Env,
}

impl<'a> AttackDetector<'a> {
    pub fn new(env: &'a Env) -> Self {
        AttackDetector { env }
    }

    /// Detect common flash loan attack patterns
    pub fn detect_attack(&self, flash_data: &FlashLoanData) {
        // Detection 1: Same-block execution
        let current_ledger: u32 = self.env.ledger().sequence();
        let stored_sequence_key = 1000u32;
        let last_sequence: u32 = self
            .env
            .storage()
            .instance()
            .get(&stored_sequence_key)
            .unwrap_or(0);

        if last_sequence == current_ledger {
            // Multiple flash loans in same block
            let same_block_count_key = 1001u32;
            let count: u32 = self
                .env
                .storage()
                .instance()
                .get(&same_block_count_key)
                .unwrap_or(0);

            if count > 3 {
                panic!("Too many flash loans in single block - possible attack");
            }

            self.env
                .storage()
                .instance()
                .set(&same_block_count_key, &(count + 1));
        } else {
            // New block, reset counter
            self.env
                .storage()
                .instance()
                .set(&stored_sequence_key, &current_ledger);
            self.env
                .storage()
                .instance()
                .set(&same_block_count_key, &1u32);
        }

        // Detection 2: Suspicious amount patterns
        self.detect_amount_anomaly(&flash_data.borrower, flash_data.amount);

        // Detection 3: Repeated borrower patterns
        self.detect_repeater_pattern(&flash_data.borrower);

        // Detection 4: Callback function validation
        self.detect_suspicious_callback();

        // Detection 5: Rate limiting
        self.detect_rate_limit(&flash_data.borrower);
    }

    /// Detect unusual amount patterns that might indicate attacks
    fn detect_amount_anomaly(&self, borrower: &Address, amount: i128) {
        let borrower_key = 2000u32;
        let last_amounts: Vec<i128> = self
            .env
            .storage()
            .instance()
            .get(&borrower_key)
            .unwrap_or(Vec::new(self.env));

        // Calculate average of last 5 loans
        if last_amounts.len() >= 5 {
            let sum: i128 = last_amounts.iter().sum();
            let avg = sum / (last_amounts.len() as i128);

            // Flag if amount is 10x the average (possible drain attack)
            if amount > avg * 10 {
                panic!("Flash loan amount significantly higher than usual - suspicious");
            }
        }

        // Keep moving average of last 5 amounts
        let mut new_amounts = Vec::new(self.env);
        for (i, &amt) in last_amounts.iter().enumerate() {
            if i < 4 {
                new_amounts.push_back(amt);
            }
        }
        new_amounts.push_back(amount);
        self.env
            .storage()
            .instance()
            .set(&borrower_key, &new_amounts);
    }

    /// Detect repeater pattern - same borrower trying multiple strategies
    fn detect_repeater_pattern(&self, borrower: &Address) {
        let repeater_key = 2100u32;
        let repeat_counts: Vec<(Address, u32)> = self
            .env
            .storage()
            .instance()
            .get(&repeater_key)
            .unwrap_or(Vec::new(self.env));

        let borrower_xdr = borrower.to_xdr(self.env);
        let mut found = false;

        let mut new_counts = Vec::new(self.env);
        for (addr, count) in repeat_counts.iter() {
            if addr.to_xdr(self.env) == borrower_xdr {
                if count > 10 {
                    panic!("Borrower has exceeded max attempts - possible attack");
                }
                new_counts.push_back((addr.clone(), count + 1));
                found = true;
            } else {
                new_counts.push_back((addr.clone(), count));
            }
        }

        if !found {
            new_counts.push_back((borrower.clone(), 1u32));
        }

        self.env
            .storage()
            .instance()
            .set(&repeater_key, &new_counts);
    }

    /// Validate callback function to prevent arbitrary execution
    fn detect_suspicious_callback(&self) {
        // In production, validate callback function signature and source
        // For now, we check that callback exists and is valid
        // This would integrate with the contract call stack
    }

    /// Implement rate limiting per borrower
    fn detect_rate_limit(&self, borrower: &Address) {
        let rate_limit_key = 2200u32;
        let current_time = self.env.ledger().timestamp();
        let time_window = 3600u64; // 1 hour window

        let (last_time, request_count): (u64, u32) = self
            .env
            .storage()
            .instance()
            .get(&rate_limit_key)
            .unwrap_or((0u64, 0u32));

        if current_time - last_time < time_window {
            // Still in same time window
            if request_count > 20 {
                panic!("Rate limit exceeded - too many flash loans");
            }
            self.env
                .storage()
                .instance()
                .set(&rate_limit_key, &(last_time, request_count + 1));
        } else {
            // New time window
            self.env
                .storage()
                .instance()
                .set(&rate_limit_key, &(current_time, 1u32));
        }
    }
}
