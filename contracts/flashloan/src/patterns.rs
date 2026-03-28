use soroban_sdk::{Address, Env};

use crate::FlashLoanData;

/// Attack pattern recognition and learning system
pub struct PatternRecognizer<'a> {
    env: &'a Env,
}

/// Represents a detected attack pattern
#[derive(Clone)]
pub struct AttackPattern {
    pub pattern_id: u32,
    pub confidence: u32, // 0-100
    pub severity: u32,   // 0-100
    pub description: u32, // Index to description storage
}

impl<'a> PatternRecognizer<'a> {
    pub fn new(env: &'a Env) -> Self {
        PatternRecognizer { env }
    }

    /// Analyze the flash loan execution for novel attack patterns
    pub fn analyze_pattern(&self, flash_data: &FlashLoanData) {
        // Pattern 1: Price manipulation detection
        self.detect_price_manipulation(&flash_data.borrower, flash_data.amount);

        // Pattern 2: Liquidation attack detection
        self.detect_liquidation_attack(&flash_data);

        // Pattern 3: Oracle manipulation detection
        self.detect_oracle_manipulation();

        // Pattern 4: Governance attack detection
        self.detect_governance_attack(&flash_data.borrower);

        // Pattern 5: Collateral withdrawal attack
        self.detect_collateral_attack(&flash_data);

        // Pattern 6: Geometric arbitrage patterns
        self.detect_arbitrage_pattern(&flash_data.amount);
    }

    /// Detect price manipulation attacks (e.g., pumping price to liquidate positions)
    fn detect_price_manipulation(&self, borrower: &Address, amount: i128) {
        let pattern_history_key = 4000u32;
        let history: Vec<(i128, u64)> = self
            .env
            .storage()
            .instance()
            .get(&pattern_history_key)
            .unwrap_or(Vec::new(self.env));

        let current_time = self.env.ledger().timestamp();
        let time_window = 300u64; // 5 minute window

        let mut suspicious_count = 0;
        for (amt, time) in history.iter() {
            if current_time - time < time_window {
                // Check for amount clustering (similar amounts in short time)
                if (amt - amount).abs() < amount / 10 {
                    suspicious_count += 1;
                }
            }
        }

        if suspicious_count > 5 {
            self.record_pattern(
                1u32,                     // Pattern ID 1: Price Manipulation
                75u32,                    // High confidence
                85u32,                    // High severity
                borrower,
            );
        }

        // Keep last 20 attempts
        let mut new_history = Vec::new(self.env);
        let mut count = 0;
        for (amt, time) in history.iter() {
            if count < 19 {
                new_history.push_back((amt, time));
                count += 1;
            }
        }
        new_history.push_back((amount, current_time));
        self.env
            .storage()
            .instance()
            .set(&pattern_history_key, &new_history);
    }

    /// Detect liquidation attacks (borrowing to trigger liquidations)
    fn detect_liquidation_attack(&self, flash_data: &FlashLoanData) {
        let liquidation_events_key = 4100u32;
        let events: Vec<(u64, i128)> = self
            .env
            .storage()
            .instance()
            .get(&liquidation_events_key)
            .unwrap_or(Vec::new(self.env));

        let current_time = self.env.ledger().timestamp();
        let time_window = 60u64; // 1 minute window

        let mut liquidations_in_window = 0;
        for (_time, _amount) in events.iter() {
            if current_time - _time < time_window {
                liquidations_in_window += 1;
            }
        }

        // If multiple liquidations happen during flash loan, it's suspicious
        if liquidations_in_window > 3 {
            self.record_pattern(
                2u32,                     // Pattern ID 2: Liquidation Attack
                80u32,                    // Very high confidence
                95u32,                    // Critical severity
                &flash_data.borrower,
            );
        }
    }

    /// Detect oracle price feed manipulation
    fn detect_oracle_manipulation(&self) {
        let oracle_update_key = 4200u32;
        let updates: Vec<(u64, i128)> = self
            .env
            .storage()
            .instance()
            .get(&oracle_update_key)
            .unwrap_or(Vec::new(self.env));

        let current_time = self.env.ledger().timestamp();

        // Check for extreme price movements in short time
        if updates.len() >= 2 {
            let last = updates.len() - 1;
            let prev = updates.len() - 2;

            let current_price = updates.get(last).unwrap().1;
            let prev_price = updates.get(prev).unwrap().0;

            let price_change = ((current_price - prev_price).abs() as f64 / prev_price as f64) * 100.0;

            // Flag if >20% change
            if price_change > 20.0 {
                self.record_pattern(
                    3u32,                  // Pattern ID 3: Oracle Manipulation
                    70u32,                 // High confidence
                    90u32,                 // Critical severity
                    &soroban_sdk::Address::from_contract_id(
                        &self.env,
                        &soroban_sdk::ContractId([0; 32]),
                    ),
                );
            }
        }
    }

    /// Detect governance attacks (using borrowed funds for voting)
    fn detect_governance_attack(&self, borrower: &Address) {
        let governance_participants_key = 4300u32;
        let participants: Vec<Address> = self
            .env
            .storage()
            .instance()
            .get(&governance_participants_key)
            .unwrap_or(Vec::new(self.env));

        // Check if borrower has recent governance activity
        let borrower_xdr = borrower.to_xdr(self.env);
        for participant in participants.iter() {
            if participant.to_xdr(self.env) == borrower_xdr {
                // Borrower participated in governance recently with flash loan
                self.record_pattern(
                    4u32,                  // Pattern ID 4: Governance Attack
                    65u32,                 // Medium-high confidence
                    70u32,                 // High severity
                    borrower,
                );
                break;
            }
        }
    }

    /// Detect collateral withdrawal attacks
    fn detect_collateral_attack(&self, flash_data: &FlashLoanData) {
        let collateral_movements_key = 4400u32;
        let movements: Vec<i128> = self
            .env
            .storage()
            .instance()
            .get(&collateral_movements_key)
            .unwrap_or(Vec::new(self.env));

        let current_time = self.env.ledger().timestamp();
        let time_window = 60u64; // 1 minute

        let mut significant_withdrawals = 0;
        for withdrawal_amount in movements.iter() {
            if withdrawal_amount > &(flash_data.amount / 2) {
                significant_withdrawals += 1;
            }
        }

        if significant_withdrawals > 2 {
            self.record_pattern(
                5u32,                     // Pattern ID 5: Collateral Attack
                72u32,                    // High confidence
                75u32,                    // High severity
                &flash_data.borrower,
            );
        }
    }

    /// Detect geometric arbitrage patterns
    fn detect_arbitrage_pattern(&self, amount: i128) {
        let arbitrage_history_key = 4500u32;
        let history: Vec<i128> = self
            .env
            .storage()
            .instance()
            .get(&arbitrage_history_key)
            .unwrap_or(Vec::new(self.env));

        // Check for fibonacci or geometric sequence (common in algorithmic attacks)
        if history.len() >= 3 {
            let len = history.len();
            let a = history.get(len - 3).unwrap();
            let b = history.get(len - 2).unwrap();
            let c = history.get(len - 1).unwrap();

            // Check for geometric progression: b/a ≈ c/b
            if a != &0 && b != &0 {
                let ratio1 = (*b as f64) / (*a as f64);
                let ratio2 = (amount as f64) / (*c as f64);

                // If ratios are very similar, it's a geometric pattern
                let ratio_diff = (ratio1 - ratio2).abs();
                if ratio_diff < 0.05 {
                    // 5% tolerance
                    self.record_pattern(
                        6u32,              // Pattern ID 6: Geometric Arbitrage
                        60u32,             // Medium confidence
                        50u32,             // Medium severity
                        &soroban_sdk::Address::from_contract_id(
                            &self.env,
                            &soroban_sdk::ContractId([0; 32]),
                        ),
                    );
                }
            }
        }

        // Keep last 10 amounts
        let mut new_history = Vec::new(self.env);
        let mut count = 0;
        for amt in history.iter() {
            if count < 9 {
                new_history.push_back(amt);
                count += 1;
            }
        }
        new_history.push_back(amount);
        self.env
            .storage()
            .instance()
            .set(&arbitrage_history_key, &new_history);
    }

    /// Record a detected pattern
    fn record_pattern(&self, pattern_id: u32, confidence: u32, severity: u32, borrower: &Address) {
        let pattern_count_key = 7u32;
        let current_count: u32 = self
            .env
            .storage()
            .instance()
            .get(&pattern_count_key)
            .unwrap_or(0);

        let patterns_key = 4900u32 + pattern_id;
        let pattern = AttackPattern {
            pattern_id,
            confidence,
            severity,
            description: current_count,
        };

        self.env
            .storage()
            .instance()
            .set(&patterns_key, &pattern);
        self.env
            .storage()
            .instance()
            .set(&pattern_count_key, &(current_count + 1));

        // If severity > 80, consider blocking the borrower
        if severity > 80 && confidence > 75 {
            // Mark for potential blacklisting
            let suspicious_key = 5000u32 + pattern_id;
            self.env
                .storage()
                .instance()
                .set(&suspicious_key, &borrower.clone());
        }
    }

    /// Get detected patterns count
    pub fn get_patterns_count(&self) -> u32 {
        let pattern_count_key = 7u32;
        self.env
            .storage()
            .instance()
            .get(&pattern_count_key)
            .unwrap_or(0)
    }
}
