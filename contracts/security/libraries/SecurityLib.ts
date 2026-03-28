/**
 * @title SecurityLib
 * @dev Core security library providing common security functions and utilities
 * @dev Used by SecurityMonitor and other security contracts
 */

import { 
  SecuritySeverity, 
  AnomalyType, 
  ComplianceSeverity,
  SecurityThresholds,
  SecurityCheckResult
} from '../interfaces/ISecurityMonitor';

export class SecurityLib {
  // Address validation and analysis
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static isContract(address: string): boolean {
    // In a real implementation, this would check the code size at the address
    // For simulation, we assume addresses starting with "0x7" are contracts
    return address.startsWith('0x7');
  }

  static isSuspiciousAddress(address: string, blacklistedAddresses: Set<string>): boolean {
    return blacklistedAddresses.has(address.toLowerCase());
  }

  // Transaction analysis
  static analyzeTransactionRisk(
    from: string,
    to: string,
    value: number,
    gasLimit: number,
    thresholds: SecurityThresholds
  ): SecurityCheckResult {
    const reasons: string[] = [];
    const actions: string[] = [];
    let riskLevel = SecuritySeverity.LOW;
    let allowed = true;

    // Check value threshold
    if (value > thresholds.maxTransactionValue) {
      riskLevel = SecuritySeverity.HIGH;
      reasons.push(`Transaction value ${value} exceeds threshold ${thresholds.maxTransactionValue}`);
      actions.push('REQUIRE_ADDITIONAL_VERIFICATION');
    }

    // Check gas limit
    if (gasLimit > thresholds.maxGasLimit) {
      riskLevel = SecuritySeverity.MEDIUM;
      reasons.push(`Gas limit ${gasLimit} exceeds threshold ${thresholds.maxGasLimit}`);
    }

    // Check for self-interaction
    if (from.toLowerCase() === to.toLowerCase()) {
      riskLevel = SecuritySeverity.MEDIUM;
      reasons.push('Self-interaction detected');
    }

    // Check for zero address
    if (to === '0x0000000000000000000000000000000000000000') {
      riskLevel = SecuritySeverity.HIGH;
      reasons.push('Transfer to zero address');
      allowed = false;
    }

    return new SecurityCheckResult(allowed, riskLevel, reasons, actions);
  }

  // Pattern detection
  static detectRapidSuccessiveCalls(
    address: string,
    callHistory: Map<string, number[]>,
    timeWindow: number = 60000, // 1 minute
    maxCalls: number = 30
  ): boolean {
    const now = Date.now();
    const calls = callHistory.get(address) || [];
    
    // Filter calls within time window
    const recentCalls = calls.filter(timestamp => now - timestamp < timeWindow);
    
    // Update call history
    callHistory.set(address, [...recentCalls, now]);
    
    return recentCalls.length >= maxCalls;
  }

  static detectUnusualTransactionPattern(
    address: string,
    transactionHistory: TransactionPattern[],
    timeWindow: number = 3600000 // 1 hour
  ): AnomalyDetectionResult {
    const now = Date.now();
    const recentTransactions = transactionHistory.filter(
      tx => now - tx.timestamp < timeWindow
    );

    const anomalies: DetectedAnomaly[] = [];
    let hasAnomaly = false;

    // Check for unusually high frequency
    if (recentTransactions.length > 100) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.RAPID_SUCCESSIVE_CALLS,
        `Unusual transaction frequency: ${recentTransactions.length} transactions in 1 hour`,
        0.9,
        [address],
        `Transaction count: ${recentTransactions.length}`
      ));
      hasAnomaly = true;
    }

    // Check for round number transactions (potential automation)
    const roundNumberTransactions = recentTransactions.filter(tx => 
      tx.value % 1000000000000000000 === 0 // Round numbers in wei
    );
    
    if (roundNumberTransactions.length > recentTransactions.length * 0.8) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
        'High proportion of round number transactions detected',
        0.7,
        [address],
        `Round number transactions: ${roundNumberTransactions.length}/${recentTransactions.length}`
      ));
      hasAnomaly = true;
    }

    // Check for increasing transaction values (potential panic selling)
    const sortedTransactions = recentTransactions.sort((a, b) => a.timestamp - b.timestamp);
    let increasingCount = 0;
    
    for (let i = 1; i < sortedTransactions.length; i++) {
      if (sortedTransactions[i].value > sortedTransactions[i - 1].value) {
        increasingCount++;
      }
    }
    
    if (increasingCount > sortedTransactions.length * 0.7 && sortedTransactions.length > 5) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
        'Pattern of increasing transaction values detected',
        0.6,
        [address],
        `Increasing transactions: ${increasingCount}/${sortedTransactions.length}`
      ));
      hasAnomaly = true;
    }

    const confidence = hasAnomaly ? 
      Math.max(...anomalies.map(a => a.confidence)) : 0;

    return new AnomalyDetectionResult(
      hasAnomaly,
      anomalies,
      confidence,
      anomalies.map(a => `Investigate: ${a.description}`)
    );
  }

  // Reentrancy detection
  static detectReentrancyAttempt(
    callStack: string[],
    currentContract: string
  ): boolean {
    return callStack.includes(currentContract);
  }

  // Flash loan attack detection
  static detectFlashLoanAttack(
    tokenTransfers: TokenTransfer[],
    contractBalance: number,
    preAttackBalance: number
  ): boolean {
    // Look for large balance changes followed by immediate reversals
    const largeTransfer = tokenTransfers.find(transfer => 
      transfer.amount > contractBalance * 0.1 // 10% of contract balance
    );

    if (!largeTransfer) return false;

    // Check if balance was restored within a short time
    const balanceRecovered = contractBalance >= preAttackBalance * 0.95;
    
    return largeTransfer && balanceRecovered;
  }

  // Oracle manipulation detection
  static detectOracleManipulation(
    oracleValues: number[],
    expectedRange: { min: number; max: number }
  ): boolean {
    if (oracleValues.length < 3) return false;

    // Check for sudden price spikes or drops
    const recentValues = oracleValues.slice(-3);
    const avgChange = recentValues.reduce((sum, val, i) => {
      if (i === 0) return sum;
      return sum + Math.abs(val - recentValues[i - 1]);
    }, 0) / (recentValues.length - 1);

    const threshold = (expectedRange.max - expectedRange.min) * 0.1; // 10% of range
    
    return avgChange > threshold;
  }

  // Governance attack detection
  static detectGovernanceAttack(
    votingPatterns: VotingPattern[],
    proposalId: string,
    totalVotes: number
  ): boolean {
    const proposalVotes = votingPatterns.filter(vp => vp.proposalId === proposalId);
    
    if (proposalVotes.length === 0) return false;

    // Check for sudden influx of new voters
    const newVoters = proposalVotes.filter(vp => vp.isNewVoter);
    const newVoterRatio = newVoters.length / proposalVotes.length;

    // Check for voting power concentration
    const votingPower = proposalVotes.reduce((sum, vp) => sum + vp.votingPower, 0);
    const maxSingleVoter = Math.max(...proposalVotes.map(vp => vp.votingPower));
    const concentrationRatio = maxSingleVoter / votingPower;

    return newVoterRatio > 0.5 || concentrationRatio > 0.6;
  }

  // Compliance utilities
  static checkAMLCompliance(
    address: string,
    transactionValue: number,
    riskScore: number,
    jurisdiction: string
  ): ComplianceCheckResult {
    const violations: ComplianceViolation[] = [];
    const actions: string[] = [];

    // Check transaction value limits
    const dailyLimit = this.getDailyLimit(jurisdiction);
    if (transactionValue > dailyLimit) {
      violations.push(new ComplianceViolation(
        'AML',
        'DAILY_LIMIT_EXCEEDED',
        ComplianceSeverity.VIOLATION,
        `Transaction value ${transactionValue} exceeds daily limit ${dailyLimit}`,
        `Value: ${transactionValue}, Limit: ${dailyLimit}`
      ));
      actions.push('REPORT_TO_AUTHORITY');
    }

    // Check risk score
    if (riskScore > 0.8) {
      violations.push(new ComplianceViolation(
        'AML',
        'HIGH_RISK_TRANSACTION',
        ComplianceSeverity.WARNING,
        `High risk score detected: ${riskScore}`,
        `Risk Score: ${riskScore}`
      ));
      actions.push('REQUIRE_ADDITIONAL_VERIFICATION');
    }

    return new ComplianceCheckResult(
      violations.length === 0,
      violations,
      actions,
      violations.length > 0 ? 86400 : 0 // 24 hour grace period for violations
    );
  }

  static checkKYCCompliance(
    address: string,
    kycStatus: KYCStatus,
    requiredLevel: KYCLevel
  ): ComplianceCheckResult {
    const violations: ComplianceViolation[] = [];

    if (kycStatus.level < requiredLevel) {
      violations.push(new ComplianceViolation(
        'KYC',
        'INSUFFICIENT_KYC_LEVEL',
        ComplianceSeverity.VIOLATION,
        `KYC level ${kycStatus.level} is below required level ${requiredLevel}`,
        `Current: ${kycStatus.level}, Required: ${requiredLevel}`
      ));
    }

    if (kycStatus.expired) {
      violations.push(new ComplianceViolation(
        'KYC',
        'KYC_EXPIRED',
        ComplianceSeverity.VIOLATION,
        'KYC verification has expired',
        `Expired: ${kycStatus.expiryDate}`
      ));
    }

    return new ComplianceCheckResult(
      violations.length === 0,
      violations,
      violations.length > 0 ? ['FREEZE_ACCOUNT'] : []
    );
  }

  static checkSanctionsCompliance(
    address: string,
    sanctionsList: Set<string>
  ): ComplianceCheckResult {
    const violations: ComplianceViolation[] = [];

    if (sanctionsList.has(address.toLowerCase())) {
      violations.push(new ComplianceViolation(
        'SANCTIONS',
        'SANCTIONED_ADDRESS',
        ComplianceSeverity.CRITICAL_VIOLATION,
        'Address is on sanctions list',
        `Address: ${address}`
      ));
    }

    return new ComplianceCheckResult(
      violations.length === 0,
      violations,
      violations.length > 0 ? ['BLOCK_TRANSACTION', 'REPORT_TO_AUTHORITY'] : []
    );
  }

  // Utility functions
  private static getDailyLimit(jurisdiction: string): number {
    const limits: Map<string, number> = new Map([
      ['US', 10000],  // $10,000 USD
      ['EU', 15000],  // €15,000 EUR
      ['UK', 12000],  // £12,000 GBP
      ['GLOBAL', 50000] // Default global limit
    ]);

    return limits.get(jurisdiction) || limits.get('GLOBAL')!;
  }

  static generateSecurityHash(data: any): string {
    // Simple hash generation for demonstration
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  static calculateRiskScore(
    factors: RiskFactor[]
  ): number {
    if (factors.length === 0) return 0;

    const weightedSum = factors.reduce((sum, factor) => 
      sum + (factor.score * factor.weight), 0
    );
    
    const totalWeight = factors.reduce((sum, factor) => 
      sum + factor.weight, 0
    );

    return Math.min(weightedSum / totalWeight, 1.0);
  }

  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  static sanitizeInput(input: string): string {
    // Basic input sanitization
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
}

// Supporting classes
export class TransactionPattern {
  address: string;
  value: number;
  timestamp: number;
  gasUsed: number;

  constructor(address: string, value: number, timestamp: number, gasUsed: number = 0) {
    this.address = address;
    this.value = value;
    this.timestamp = timestamp;
    this.gasUsed = gasUsed;
  }
}

export class TokenTransfer {
  token: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;

  constructor(token: string, from: string, to: string, amount: number, timestamp: number) {
    this.token = token;
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.timestamp = timestamp;
  }
}

export class VotingPattern {
  proposalId: string;
  voter: string;
  votingPower: number;
  support: boolean;
  isNewVoter: boolean;
  timestamp: number;

  constructor(
    proposalId: string,
    voter: string,
    votingPower: number,
    support: boolean,
    isNewVoter: boolean
  ) {
    this.proposalId = proposalId;
    this.voter = voter;
    this.votingPower = votingPower;
    this.support = support;
    this.isNewVoter = isNewVoter;
    this.timestamp = Date.now();
  }
}

export class KYCStatus {
  level: KYCLevel;
  verified: boolean;
  expired: boolean;
  expiryDate: number;
  documentType: string;

  constructor(
    level: KYCLevel,
    verified: boolean,
    expired: boolean,
    expiryDate: number,
    documentType: string
  ) {
    this.level = level;
    this.verified = verified;
    this.expired = expired;
    this.expiryDate = expiryDate;
    this.documentType = documentType;
  }
}

export enum KYCLevel {
  NONE = 0,
  BASIC = 1,
  STANDARD = 2,
  ENHANCED = 3,
  INSTITUTIONAL = 4
}

export class RiskFactor {
  type: string;
  score: number;
  weight: number;
  description: string;

  constructor(type: string, score: number, weight: number, description: string) {
    this.type = type;
    this.score = Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
    this.weight = Math.max(0, Math.min(1, weight)); // Clamp between 0 and 1
    this.description = description;
  }
}

export class DetectedAnomaly {
  type: AnomalyType;
  description: string;
  confidence: number;
  affectedAddresses: string[];
  timestamp: number;
  evidence: string;

  constructor(
    type: AnomalyType,
    description: string,
    confidence: number,
    affectedAddresses: string[],
    evidence: string = ""
  ) {
    this.type = type;
    this.description = description;
    this.confidence = confidence;
    this.affectedAddresses = affectedAddresses;
    this.timestamp = Date.now();
    this.evidence = evidence;
  }
}

export class ComplianceCheckResult {
  compliant: boolean;
  violations: ComplianceViolation[];
  requiredActions: string[];
  gracePeriod: number;

  constructor(
    compliant: boolean,
    violations: ComplianceViolation[] = [],
    requiredActions: string[] = [],
    gracePeriod: number = 0
  ) {
    this.compliant = compliant;
    this.violations = violations;
    this.requiredActions = requiredActions;
    this.gracePeriod = gracePeriod;
  }
}

export class ComplianceViolation {
  regulation: string;
  violationType: string;
  severity: ComplianceSeverity;
  description: string;
  evidence: string;

  constructor(
    regulation: string,
    violationType: string,
    severity: ComplianceSeverity,
    description: string,
    evidence: string = ""
  ) {
    this.regulation = regulation;
    this.violationType = violationType;
    this.severity = severity;
    this.description = description;
    this.evidence = evidence;
  }
}

export class AnomalyDetectionResult {
  hasAnomaly: boolean;
  anomalies: DetectedAnomaly[];
  confidence: number;
  recommendedActions: string[];

  constructor(
    hasAnomaly: boolean,
    anomalies: DetectedAnomaly[] = [],
    confidence: number = 0,
    recommendedActions: string[] = []
  ) {
    this.hasAnomaly = hasAnomaly;
    this.anomalies = anomalies;
    this.confidence = confidence;
    this.recommendedActions = recommendedActions;
  }
}
