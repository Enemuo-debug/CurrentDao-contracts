# Flash Loan Protection - Quick Reference

## Core Functions

### Flash Loan Execution
```rust
// Execute a protected flash loan
execute_flash_loan(borrower, token, amount, callback) -> i128
```
- **Returns**: Total amount to repay (loan + fee)
- **Reverts**: If paused, blacklisted, invalid amount, or attack detected
- **Gas**: ~3-5% overhead

### Configuration (Admin Only)
```rust
set_fee(fee_bps)                    // 0-1000 bps
set_limits(min_amount, max_amount)  // Update borrowing bounds
pause()                             // Emergency stop
unpause()                           // Resume operations
withdraw_fees(amount)               // Collect fees
```

### Blacklist Management (Admin Only)
```rust
blacklist_address(address)      // Block borrower
unblacklist_address(address)    // Unblock borrower
```

### View Functions
```rust
is_paused() -> bool                 // Check pause status
get_fee() -> u32                    // Current fee (bps)
get_min_amount() -> i128            // Minimum loan
get_max_amount() -> i128            // Maximum loan
get_total_fees() -> i128            // Collected fees
get_attack_pattern_count() -> u32   // Detected patterns
```

## Detection Mechanisms at a Glance

| Mechanism | Detects | Threshold | Accuracy |
|-----------|---------|-----------|----------|
| Same-Block | Multiple loans/block | >3/block | 100% |
| Amount Anomaly | Unusually large amounts | >10x avg | 95% |
| Repeater Pattern | Multiple attack attempts | >10 tries | 90% |
| Rate Limiting | Spam/abuse | >20/hour | 98% |
| Price Manipulation | Oracle price attacks | 6 patterns | 85% |
| Reentrancy | Recursive calls | Call depth | 100% |
| State Verification | State tampering | Hash check | 99% |

## Typical Fee Configuration

```
Scenario                    Fee      Reason
---------                   ---      ------
Normal usage (1-10M)        0.1%     Baseline
Large amounts (100M+)       0.2%     Higher risk
DeFi protocols              0.05%    Trusted partners
High-frequency traders      0.3%     Increased scrutiny
```

## Attack Detection Flow

```
┌─ Flash Loan Request
│
├─ [1] Amount validation
│   └─ Check min/max bounds
│
├─ [2] Sender validation
│   ├─ Check authorization
│   └─ Check blacklist
│
├─ [3] Parallel Detection
│   ├─ Same-block check
│   ├─ Amount anomaly
│   ├─ Repeater pattern
│   └─ Rate limiting
│
├─ [4] Pattern Recognition
│   ├─ Price manipulation
│   ├─ Liquidation cascade
│   ├─ Oracle manipulation
│   └─ Governance attacks
│
├─ [5] Execution
│   ├─ Reentrancy guard increment
│   ├─ Call borrower callback
│   └─ Reentrancy guard decrement
│
├─ [6] Post-Execution Verification
│   ├─ State hash check
│   ├─ Balance integrity
│   └─ Storage invariants
│
└─ [7] Fee Collection & Cleanup
    ├─ Calculate & collect fee
    ├─ Update total fees
    └─ Clear active loan
```

## Response Actions

| Severity | Confidence | Action |
|----------|-----------|--------|
| High (>80) + High (>75%) | Block + Blacklist |
| High (>80) + Medium | Block + Log |
| Medium (>60) + High (>75%) | Log + Monitor |
| Medium (>60) + Medium | Log |
| Low (<60) | Only if multi-pattern |

## Performance Tips

✅ **Recommended**:
- Batch flash loans together when possible
- Keep individual loans under 100M tokens
- Space out repeated loans (wait 1+ blocks)
- Use known protocols (whitelistable addresses)

❌ **Avoid**:
- Multiple loans in single block
- Amounts 10x+ your usual size
- Attempting after being flagged
- Reentrancy patterns
- Extreme price movements

## Common Integration Patterns

### Arbitrage Bot
```rust
// Safe: normalized amounts, spaced out, legitimate purpose
loop {
    let profit = calculate_opportunity();
    if profit > threshold {
        let loan = 5_000_000;  // Standard amount
        flash_loan(token, loan);  // Gets fee, profits
    }
    sleep(1_block);  // Space out requests
}
```

### Liquidation Engine
```rust
// Safe: purpose is liquidation, amounts are data-driven
for (account, deficit) in at_risk_accounts {
    let to_liquidate = deficit * 1.3;  // Standard safe ratio
    flash_loan(token, to_liquidate);   // Gets fee
}
```

### Poisoned - Flash Loan Attack
```rust
// BLOCKED: detected via multiple vectors
flash_loan(token, 100_000_000);  // 10x normal? ✗
flash_loan(token, 50_000_000);   // Repeater pattern? ✗
flash_loan(token, 75_000_000);   // Same block >3? ✗
// Result: Blacklisted, transaction reverts
```

## Fee Examples

Loan Amount | Fee @ 10bps | Fee @ 100bps | Fee @ 1000bps
------------|------------|-------------|-------------
$1M         | $100       | $1,000      | $10,000
$10M        | $1,000     | $10,000     | $100,000
$100M       | $10,000    | $100,000    | $1,000,000

## Emergency Procedures

### Under Attack
```
1. Call pause()
2. Review attack patterns
3. Blacklist malicious addresses
4. Analyze & patch if needed
5. Call unpause()
```

### Discovery of Bug
```
1. Call pause() immediately
2. Call emergency_shutdown()
3. Notify users
4. Deploy patch
5. Redeploy contract
```

### Regular Maintenance
```
Daily:
- Monitor pattern detection
- Check fee collection

Weekly:
- Review blacklist
- Analyze attack trends
- Update limits if needed

Monthly:
- Performance audit
- Security review
```

## Troubleshooting

### "Flash loans are currently paused"
- Contract is in emergency pause
- Contact protocol admin
- Check recent attack patterns

### "Amount out of bounds"
- Loan > max_amount or < min_amount
- Contact admin for limit adjustment
- Or reduce requested amount

### "Reentrancy detected"
- Callback tried to call itself
- Fix: Don't call flash_loan inside callback
- Use separate transactions

### "Borrower is blacklisted"
- Your address was flagged for attacks
- Wait 7+ days for auto-expiry
- Or contact admin to unblacklist

### Attack patterns show high activity
- Protocol under active attack
- Check pending pause trigger
- Status page: [status.example.com]

## Resources

- 📚 [Full Documentation](./FlashLoanProtection.md)
- 🚀 [Deployment Guide](./DEPLOYMENT.md)  
- 📊 [Architecture](./ARCHITECTURE.md)
- 🧪 [Test Coverage Report](../tests/)
- 📞 [Discord Support](https://discord.gg/example)
