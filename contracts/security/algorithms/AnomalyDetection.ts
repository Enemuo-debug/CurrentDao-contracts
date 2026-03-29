/**
 * @title AnomalyDetection
 * @dev Advanced anomaly detection algorithms for security monitoring
 * @dev Implements machine learning-inspired pattern recognition and statistical analysis
 */

import { 
  AnomalyType, 
  DetectedAnomaly, 
  AnomalyDetectionResult
} from '../interfaces/ISecurityMonitor';
import { TransactionPattern, TokenTransfer, VotingPattern } from '../libraries/SecurityLib';

export class AnomalyDetection {
  private static readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
  private static readonly MIN_SAMPLES_FOR_ANALYSIS = 10;
  private static readonly TIME_WINDOWS = {
    VERY_SHORT: 60000,      // 1 minute
    SHORT: 300000,          // 5 minutes
    MEDIUM: 900000,         // 15 minutes
    LONG: 3600000,          // 1 hour
    VERY_LONG: 86400000     // 24 hours
  };

  // Statistical anomaly detection
  static detectStatisticalAnomalies(
    address: string,
    transactionHistory: TransactionPattern[],
    timeWindow: number = AnomalyDetection.TIME_WINDOWS.LONG
  ): AnomalyDetectionResult {
    const now = Date.now();
    const recentTransactions = transactionHistory.filter(
      tx => now - tx.timestamp < timeWindow
    );

    if (recentTransactions.length < AnomalyDetection.MIN_SAMPLES_FOR_ANALYSIS) {
      return new AnomalyDetectionResult(false, [], 0, []);
    }

    const anomalies: DetectedAnomaly[] = [];
    const values = recentTransactions.map(tx => tx.value);
    
    // Z-score analysis for transaction values
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    for (let i = 0; i < recentTransactions.length; i++) {
      const tx = recentTransactions[i];
      const zScore = Math.abs((tx.value - mean) / stdDev);
      
      if (zScore > 3) { // 3 standard deviations
        anomalies.push(new DetectedAnomaly(
          AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
          `Transaction value ${tx.value} is ${zScore.toFixed(2)} standard deviations from mean`,
          Math.min(zScore / 3, 1.0),
          [address],
          `Value: ${tx.value}, Mean: ${mean.toFixed(2)}, Z-Score: ${zScore.toFixed(2)}`
        ));
      }
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `Investigate statistical anomaly: ${a.description}`)
    );
  }

  // Behavioral pattern analysis
  static detectBehavioralAnomalies(
    address: string,
    transactionHistory: TransactionPattern[],
    callHistory: Map<string, number[]>,
    timeWindow: number = TIME_WINDOWS.LONG
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];
    const now = Date.now();

    // Analyze transaction frequency patterns
    const recentTransactions = transactionHistory.filter(
      tx => now - tx.timestamp < timeWindow
    );

    if (recentTransactions.length > 0) {
      const timeIntervals: number[] = [];
      for (let i = 1; i < recentTransactions.length; i++) {
        timeIntervals.push(recentTransactions[i].timestamp - recentTransactions[i - 1].timestamp);
      }

      if (timeIntervals.length > 0) {
        const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;
        const intervalVariance = timeIntervals.reduce((sum, interval) => 
          sum + Math.pow(interval - avgInterval, 2), 0) / timeIntervals.length;
        const intervalStdDev = Math.sqrt(intervalVariance);

        // Check for unusually regular intervals (potential bot activity)
        const regularityScore = 1 - (intervalStdDev / avgInterval);
        if (regularityScore > 0.9 && recentTransactions.length > 20) {
          anomalies.push(new DetectedAnomaly(
            AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
            `Highly regular transaction intervals detected (score: ${regularityScore.toFixed(3)})`,
            regularityScore,
            [address],
            `Transactions: ${recentTransactions.length}, Regularity: ${regularityScore.toFixed(3)}`
          ));
        }
      }
    }

    // Analyze call patterns
    const addressCalls = callHistory.get(address) || [];
    const recentCalls = addressCalls.filter(timestamp => now - timestamp < AnomalyDetection.TIME_WINDOWS.SHORT);
    
    if (recentCalls.length > 100) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.RAPID_SUCCESSIVE_CALLS,
        `Excessive call frequency: ${recentCalls.length} calls in 5 minutes`,
        Math.min(recentCalls.length / 100, 1.0),
        [address],
        `Call count: ${recentCalls.length} in 5 minutes`
      ));
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `Investigate behavioral anomaly: ${a.description}`)
    );
  }

  // Flash loan attack detection
  static detectFlashLoanAttacks(
    tokenTransfers: TokenTransfer[],
    contractBalances: Map<string, number>,
    preAttackBalances: Map<string, number>
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];

    // Group transfers by transaction (assuming close timestamps)
    const transactionGroups = this.groupTransfersByTransaction(tokenTransfers);

    for (const group of transactionGroups) {
      // Look for large borrow followed by immediate repayment
      const largeBorrows = group.filter(transfer => 
        transfer.amount > 1000000 && // Large amount threshold
        transfer.to.startsWith('0x7') // Contract address
      );

      if (largeBorrows.length > 0) {
        const totalBorrowed = largeBorrows.reduce((sum, transfer) => sum + transfer.amount, 0);
        
        // Check if there's a repayment in the same transaction
        const repayments = group.filter(transfer => 
          transfer.from.startsWith('0x7') && 
          transfer.amount > 0
        );
        
        const totalRepaid = repayments.reduce((sum, transfer) => sum + transfer.amount, 0);

        // If borrowed amount is close to repaid amount, potential flash loan
        if (Math.abs(totalBorrowed - totalRepaid) / totalBorrowed < 0.05) {
          // Check for price manipulation
          const affectedTokens = new Set(group.map(t => t.token));
          let priceManipulationDetected = false;

          for (const token of affectedTokens) {
            const preBalance = preAttackBalances.get(token) || 0;
            const postBalance = contractBalances.get(token) || 0;
            
            if (preBalance > 0 && Math.abs(postBalance - preBalance) / preBalance > 0.1) {
              priceManipulationDetected = true;
              break;
            }
          }

          if (priceManipulationDetected) {
            anomalies.push(new DetectedAnomaly(
              AnomalyType.FLASH_LOAN_ATTACK,
              `Potential flash loan attack with price manipulation detected`,
              0.9,
              Array.from(new Set(group.map(t => [t.from, t.to]).flat())),
              `Borrowed: ${totalBorrowed}, Repaid: ${totalRepaid}, Tokens: ${Array.from(affectedTokens).join(', ')}`
            ));
          }
        }
      }
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `BLOCK_TRANSACTION, FREEZE_ACCOUNT: ${a.description}`)
    );
  }

  // Reentrancy attack detection
  static detectReentrancyAttacks(
    callStack: string[],
    currentContract: string,
    transactionHistory: TransactionPattern[]
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];

    // Check for recursive calls
    const contractOccurrences = callStack.filter(addr => addr === currentContract);
    if (contractOccurrences.length > 1) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.REENTRANCY_ATTEMPT,
        `Reentrancy attempt detected: ${contractOccurrences.length} recursive calls`,
        0.95,
        [currentContract],
        `Call stack depth: ${contractOccurrences.length}`
      ));
    }

    // Check for external call patterns that suggest reentrancy
    const recentTransactions = transactionHistory.filter(
      tx => Date.now() - tx.timestamp < AnomalyDetection.TIME_WINDOWS.SHORT
    );

    // Look for multiple calls to the same contract in quick succession
    const contractCalls = new Map<string, number>();
    for (const tx of recentTransactions) {
      const count = contractCalls.get(tx.address) || 0;
      contractCalls.set(tx.address, count + 1);
    }

    for (const [contract, count] of contractCalls.entries()) {
      if (count > 5) {
        anomalies.push(new DetectedAnomaly(
          AnomalyType.REENTRANCY_ATTEMPT,
          `Suspicious calling pattern: ${count} calls to ${contract} in 5 minutes`,
          0.7,
          [contract],
          `Call count: ${count}`
        ));
      }
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `BLOCK_TRANSACTION: ${a.description}`)
    );
  }

  // Oracle manipulation detection
  static detectOracleManipulation(
    oracleUpdates: OracleUpdate[],
    tokenPrices: Map<string, number[]>,
    expectedVolatility: Map<string, number>
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];

    for (const update of oracleUpdates) {
      const priceHistory = tokenPrices.get(update.token) || [];
      
      if (priceHistory.length < 3) continue;

      const recentPrices = priceHistory.slice(-5);
      const oldPrice = recentPrices[0];
      const newPrice = update.price;
      const priceChange = Math.abs(newPrice - oldPrice) / oldPrice;

      const expectedVol = expectedVolatility.get(update.token) || 0.05; // 5% default

      if (priceChange > expectedVol * 3) { // 3x expected volatility
        anomalies.push(new DetectedAnomaly(
          AnomalyType.ORACLE_MANIPULATION,
          `Extreme price movement detected for ${update.token}: ${(priceChange * 100).toFixed(2)}%`,
          Math.min(priceChange / (expectedVol * 3), 1.0),
          [update.source],
          `Token: ${update.token}, Change: ${(priceChange * 100).toFixed(2)}%, Expected: ${(expectedVol * 100).toFixed(2)}%`
        ));
      }

      // Check for rapid successive updates
      const recentUpdates = oracleUpdates.filter(u => 
        u.token === update.token && 
        update.timestamp - u.timestamp < AnomalyDetection.TIME_WINDOWS.VERY_SHORT &&
        u.timestamp !== update.timestamp
      );

      if (recentUpdates.length > 5) {
        anomalies.push(new DetectedAnomaly(
          AnomalyType.ORACLE_MANIPULATION,
          `Rapid oracle updates detected for ${update.token}: ${recentUpdates.length + 1} updates in 1 minute`,
          0.8,
          [update.source],
          `Update count: ${recentUpdates.length + 1} in 1 minute`
        ));
      }
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `PAUSE_ORACLE, INVESTIGATE: ${a.description}`)
    );
  }

  // Governance attack detection
  static detectGovernanceAttacks(
    votingPatterns: VotingPattern[],
    proposals: Map<string, ProposalData>
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];

    // Group votes by proposal
    const proposalVotes = new Map<string, VotingPattern[]>();
    for (const vote of votingPatterns) {
      const votes = proposalVotes.get(vote.proposalId) || [];
      votes.push(vote);
      proposalVotes.set(vote.proposalId, votes);
    }

    for (const [proposalId, votes] of proposalVotes.entries()) {
      const proposal = proposals.get(proposalId);
      if (!proposal) continue;

      // Check for sudden voter influx
      const newVoters = votes.filter(v => v.isNewVoter);
      const newVoterRatio = newVoters.length / votes.length;

      if (newVoterRatio > 0.7 && votes.length > 10) {
        anomalies.push(new DetectedAnomaly(
          AnomalyType.GOVERNANCE_ATTACK,
          `Suspicious voter influx for proposal ${proposalId}: ${(newVoterRatio * 100).toFixed(1)}% new voters`,
          newVoterRatio,
          Array.from(new Set(votes.map(v => v.voter))),
          `New voters: ${newVoters.length}/${votes.length}`
        ));
      }

      // Check for voting power concentration
      const totalVotingPower = votes.reduce((sum, vote) => sum + vote.votingPower, 0);
      const maxVoterPower = Math.max(...votes.map(v => v.votingPower));
      const concentrationRatio = maxVoterPower / totalVotingPower;

      if (concentrationRatio > 0.5) {
        const dominantVoter = votes.find(v => v.votingPower === maxVoterPower);
        anomalies.push(new DetectedAnomaly(
          AnomalyType.GOVERNANCE_ATTACK,
          `Voting power concentration detected in proposal ${proposalId}: ${(concentrationRatio * 100).toFixed(1)}% controlled by one address`,
          concentrationRatio,
          dominantVoter ? [dominantVoter.voter] : [],
          `Concentration: ${(concentrationRatio * 100).toFixed(1)}%, Voter: ${dominantVoter?.voter || 'Unknown'}`
        ));
      }

      // Check for last-minute voting
      const votingDeadline = proposal.deadline;
      const lastMinuteVotes = votes.filter(v => 
        votingDeadline - v.timestamp < AnomalyDetection.TIME_WINDOWS.VERY_SHORT
      );

      if (lastMinuteVotes.length > votes.length * 0.3) {
        anomalies.push(new DetectedAnomaly(
          AnomalyType.GOVERNANCE_ATTACK,
          `Last-minute voting surge detected for proposal ${proposalId}: ${lastMinuteVotes.length} votes in final minute`,
          lastMinuteVotes.length / votes.length,
          Array.from(lastMinuteVotes.map(v => v.voter)),
          `Last-minute votes: ${lastMinuteVotes.length}/${votes.length}`
        ));
      }
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `PAUSE_GOVERNANCE, INVESTIGATE: ${a.description}`)
    );
  }

  // Machine learning-inspired pattern recognition
  static detectMLAnomalies(
    address: string,
    features: Map<string, number>,
    historicalFeatures: Map<string, number[]>[]
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];

    if (historicalFeatures.length < AnomalyDetection.MIN_SAMPLES_FOR_ANALYSIS) {
      return new AnomalyDetectionResult(false, [], 0, []);
    }

    // Calculate feature statistics
    const featureStats = new Map<string, { mean: number; stdDev: number }>();
    
    for (const [featureName, _] of features.entries()) {
      const historicalValues = historicalFeatures
        .map(hf => hf.get(featureName) || 0)
        .filter(val => val !== 0);

      if (historicalValues.length > 0) {
        const mean = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
        const variance = historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalValues.length;
        const stdDev = Math.sqrt(variance);
        
        featureStats.set(featureName, { mean, stdDev });
      }
    }

    // Calculate anomaly score
    let totalAnomalyScore = 0;
    let featureCount = 0;

    for (const [featureName, currentValue] of features.entries()) {
      const stats = featureStats.get(featureName);
      if (!stats || stats.stdDev === 0) continue;

      const zScore = Math.abs((currentValue - stats.mean) / stats.stdDev);
      const featureAnomalyScore = Math.min(zScore / 3, 1.0); // Normalize to 0-1
      
      totalAnomalyScore += featureAnomalyScore;
      featureCount++;

      if (zScore > 2.5) {
        anomalies.push(new DetectedAnomaly(
          AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
          `ML anomaly detected in ${featureName}: z-score ${zScore.toFixed(2)}`,
          featureAnomalyScore,
          [address],
          `Feature: ${featureName}, Value: ${currentValue}, Expected: ${stats.mean.toFixed(2)}`
        ));
      }
    }

    const overallAnomalyScore = featureCount > 0 ? totalAnomalyScore / featureCount : 0;

    if (overallAnomalyScore > 0.7) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
        `Overall behavioral anomaly detected: score ${overallAnomalyScore.toFixed(3)}`,
        overallAnomalyScore,
        [address],
        `Overall score: ${overallAnomalyScore.toFixed(3)}, Features analyzed: ${featureCount}`
      ));
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      overallAnomalyScore,
      anomalies.map(a => `INVESTIGATE: ${a.description}`)
    );
  }

  // Utility methods
  private static groupTransfersByTransaction(transfers: TokenTransfer[]): TokenTransfer[][] {
    const groups: TokenTransfer[][] = [];
    const timeThreshold = 5000; // 5 seconds

    if (transfers.length === 0) return groups;

    let currentGroup: TokenTransfer[] = [transfers[0]];
    let currentTimestamp = transfers[0].timestamp;

    for (let i = 1; i < transfers.length; i++) {
      const transfer = transfers[i];
      
      if (transfer.timestamp - currentTimestamp < timeThreshold) {
        currentGroup.push(transfer);
      } else {
        groups.push(currentGroup);
        currentGroup = [transfer];
        currentTimestamp = transfer.timestamp;
      }
    }

    groups.push(currentGroup);
    return groups;
  }

  // Real-time anomaly detection
  static detectRealTimeAnomalies(
    address: string,
    currentTransaction: TransactionPattern,
    recentTransactions: TransactionPattern[],
    thresholds: AnomalyThresholds
  ): AnomalyDetectionResult {
    const anomalies: DetectedAnomaly[] = [];

    // Check against thresholds
    if (currentTransaction.value > thresholds.maxTransactionValue) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.LARGE_VALUE_TRANSFER,
        `Transaction value ${currentTransaction.value} exceeds threshold ${thresholds.maxTransactionValue}`,
        Math.min(currentTransaction.value / thresholds.maxTransactionValue, 1.0),
        [address],
        `Value: ${currentTransaction.value}, Threshold: ${thresholds.maxTransactionValue}`
      ));
    }

    if (currentTransaction.gasUsed > thresholds.maxGasUsage) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.UNUSUAL_TRANSACTION_PATTERN,
        `Gas usage ${currentTransaction.gasUsed} exceeds threshold ${thresholds.maxGasUsage}`,
        Math.min(currentTransaction.gasUsed / thresholds.maxGasUsage, 1.0),
        [address],
        `Gas used: ${currentTransaction.gasUsed}, Threshold: ${thresholds.maxGasUsage}`
      ));
    }

    // Check frequency
    const veryRecentTransactions = recentTransactions.filter(
      tx => currentTransaction.timestamp - tx.timestamp < thresholds.frequencyWindow
    );

    if (veryRecentTransactions.length > thresholds.maxFrequency) {
      anomalies.push(new DetectedAnomaly(
        AnomalyType.RAPID_SUCCESSIVE_CALLS,
        `Transaction frequency ${veryRecentTransactions.length} exceeds threshold ${thresholds.maxFrequency}`,
        Math.min(veryRecentTransactions.length / thresholds.maxFrequency, 1.0),
        [address],
        `Frequency: ${veryRecentTransactions.length}, Threshold: ${thresholds.maxFrequency}`
      ));
    }

    return new AnomalyDetectionResult(
      anomalies.length > 0,
      anomalies,
      anomalies.length > 0 ? Math.max(...anomalies.map(a => a.confidence)) : 0,
      anomalies.map(a => `MONITOR_CLOSELY: ${a.description}`)
    );
  }
}

// Supporting classes
export class OracleUpdate {
  token: string;
  price: number;
  source: string;
  timestamp: number;

  constructor(token: string, price: number, source: string) {
    this.token = token;
    this.price = price;
    this.source = source;
    this.timestamp = Date.now();
  }
}

export class ProposalData {
  proposalId: string;
  deadline: number;
  totalVotingPower: number;
  quorum: number;
  description: string;

  constructor(
    proposalId: string,
    deadline: number,
    totalVotingPower: number,
    quorum: number,
    description: string
  ) {
    this.proposalId = proposalId;
    this.deadline = deadline;
    this.totalVotingPower = totalVotingPower;
    this.quorum = quorum;
    this.description = description;
  }
}

export class AnomalyThresholds {
  maxTransactionValue: number;
  maxGasUsage: number;
  maxFrequency: number;
  frequencyWindow: number;
  confidenceThreshold: number;

  constructor(
    maxTransactionValue: number = 1000000,
    maxGasUsage: number = 8000000,
    maxFrequency: number = 10,
    frequencyWindow: number = 60000,
    confidenceThreshold: number = 0.7
  ) {
    this.maxTransactionValue = maxTransactionValue;
    this.maxGasUsage = maxGasUsage;
    this.maxFrequency = maxFrequency;
    this.frequencyWindow = frequencyWindow;
    this.confidenceThreshold = confidenceThreshold;
  }
}
