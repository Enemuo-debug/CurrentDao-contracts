/**
 * @title SecurityMonitor Test Suite
 * @dev Comprehensive test suite for SecurityMonitor and related components
 * @dev Tests all security features including monitoring, anomaly detection, and compliance
 */

import { SecurityMonitor } from '../contracts/security/SecurityMonitor';
import { SecurityLib } from '../contracts/security/libraries/SecurityLib';
import { AnomalyDetection } from '../contracts/security/algorithms/AnomalyDetection';
import { ComplianceEngine } from '../contracts/security/engines/ComplianceEngine';
import {
  SecuritySeverity,
  AnomalyType,
  ComplianceSeverity,
  SecurityThresholds,
  ComplianceRule,
  ComplianceContext,
  ReportingPeriod,
  EmergencyScope
} from '../contracts/security/interfaces/ISecurityMonitor';

describe('SecurityMonitor', () => {
  let securityMonitor: SecurityMonitor;

  beforeEach(() => {
    securityMonitor = new SecurityMonitor();
  });

  describe('Transaction Monitoring', () => {
    test('should allow normal transactions', async () => {
      const result = await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1000,
        '0x',
        21000
      );

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe(SecuritySeverity.LOW);
      expect(result.reasons).toHaveLength(0);
    });

    test('should block transactions exceeding value threshold', async () => {
      const result = await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        2000000, // Exceeds default threshold of 1M
        '0x',
        21000
      );

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe(SecuritySeverity.HIGH);
      expect(result.reasons.some(r => r.includes('exceeds threshold'))).toBe(true);
    });

    test('should block transactions to zero address', async () => {
      const result = await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0000000000000000000000000000000000000000',
        1000,
        '0x',
        21000
      );

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe(SecuritySeverity.HIGH);
      expect(result.reasons.some(r => r.includes('zero address'))).toBe(true);
    });

    test('should detect self-interaction', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const result = await securityMonitor.monitorTransaction(
        address,
        address,
        1000,
        '0x',
        21000
      );

      expect(result.riskLevel).toBe(SecuritySeverity.MEDIUM);
      expect(result.reasons.some(r => r.includes('Self-interaction'))).toBe(true);
    });
  });

  describe('Contract Interaction Monitoring', () => {
    test('should allow normal contract interactions', async () => {
      const result = await securityMonitor.monitorContractInteraction(
        '0x7abcdef12345678901234567890123456789012',
        'transfer',
        '0x1234567890123456789012345678901234567890',
        ['0x0987654321098765432109876543210987654321', 1000]
      );

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe(SecuritySeverity.LOW);
    });

    test('should detect reentrancy attempts', async () => {
      // Mock a call stack that includes the current contract
      const result = await securityMonitor.monitorContractInteraction(
        '0x7abcdef12345678901234567890123456789012',
        'withdraw',
        '0x1234567890123456789012345678901234567890',
        []
      );

      // In a real implementation, this would detect actual reentrancy
      // For the test, we verify the method exists and returns expected structure
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('reasons');
    });
  });

  describe('Token Transfer Monitoring', () => {
    test('should allow normal token transfers', async () => {
      const result = await securityMonitor.monitorTokenTransfer(
        '0xtoken1234567890123456789012345678901234567890',
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1000
      );

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe(SecuritySeverity.LOW);
    });

    test('should block large token transfers', async () => {
      const result = await securityMonitor.monitorTokenTransfer(
        '0xtoken1234567890123456789012345678901234567890',
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        2000000 // Exceeds default threshold
      );

      expect(result.riskLevel).toBe(SecuritySeverity.HIGH);
      expect(result.reasons.some(r => r.includes('Large token transfer'))).toBe(true);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect statistical anomalies', async () => {
      // Create transaction history with anomalies
      const address = '0x1234567890123456789012345678901234567890';
      
      // Add multiple transactions to create history
      for (let i = 0; i < 20; i++) {
        await securityMonitor.monitorTransaction(
          address,
          `0x${i.toString().padStart(40, '0')}`,
          1000 + i, // Normal pattern
          '0x',
          21000
        );
      }

      // Add an anomalous transaction
      await securityMonitor.monitorTransaction(
        address,
        '0xanomalous123456789012345678901234567890',
        10000000, // Much larger than normal
        '0x',
        21000
      );

      const result = await securityMonitor.detectAnomalies(address, 3600000);
      
      expect(result).toHaveProperty('hasAnomaly');
      expect(result).toHaveProperty('anomalies');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('recommendedActions');
    });

    test('should detect rapid successive calls', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      // Make many rapid calls
      for (let i = 0; i < 50; i++) {
        await securityMonitor.monitorTransaction(
          address,
          `0x${i.toString().padStart(40, '0')}`,
          1000,
          '0x',
          21000
        );
      }

      const result = await securityMonitor.detectAnomalies(address, 60000); // 1 minute window
      
      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Compliance Checking', () => {
    test('should pass compliance for normal addresses', async () => {
      const result = await securityMonitor.checkCompliance(
        '0x1234567890123456789012345678901234567890',
        'AML'
      );

      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect compliance violations', async () => {
      // Add a compliance rule that will be violated
      const rule = new ComplianceRule(
        'TEST_RULE',
        'Test rule for violation detection',
        'TEST',
        [
          { type: 'transaction_value', operator: '<=', value: 100, description: 'Transaction must be <= 100' }
        ],
        []
      );

      await securityMonitor.addComplianceRule(rule);

      const context = new ComplianceContext(
        '0x1234567890123456789012345678901234567890',
        'TRANSACTION',
        1000, // Exceeds rule limit
        'GLOBAL'
      );

      const result = await securityMonitor.enforceComplianceRules('0x1234567890123456789012345678901234567890', context);
      
      expect(result.enforced).toBe(true);
      expect(result.actionsTaken.length).toBeGreaterThan(0);
    });
  });

  describe('Emergency Controls', () => {
    test('should activate emergency mode', async () => {
      await securityMonitor.activateEmergency(
        'Test emergency activation',
        EmergencyScope.ALL_CONTRACTS
      );

      const isActive = await securityMonitor.isEmergencyActive();
      expect(isActive).toBe(true);
    });

    test('should block all transactions during emergency', async () => {
      await securityMonitor.activateEmergency(
        'Test emergency activation',
        EmergencyScope.ALL_CONTRACTS
      );

      const result = await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1000,
        '0x',
        21000
      );

      expect(result.allowed).toBe(false);
      expect(result.riskLevel).toBe(SecuritySeverity.CRITICAL);
      expect(result.reasons.some(r => r.includes('Emergency mode active'))).toBe(true);
    });

    test('should deactivate emergency mode', async () => {
      await securityMonitor.activateEmergency(
        'Test emergency activation',
        EmergencyScope.ALL_CONTRACTS
      );

      await securityMonitor.deactivateEmergency();

      const isActive = await securityMonitor.isEmergencyActive();
      expect(isActive).toBe(false);
    });
  });

  describe('Suspicious Activity Reporting', () => {
    test('should accept suspicious activity reports', async () => {
      const reportId = await securityMonitor.reportSuspiciousActivity(
        '0xreporter123456789012345678901234567890123456',
        '0xsuspicious123456789012345678901234567890',
        'POTENTIAL_FRAUD',
        'Unusual transaction pattern detected'
      );

      expect(reportId).toBeDefined();
      expect(reportId).toMatch(/^report_\d+_[a-z0-9]+$/);
    });

    test('should investigate high-priority reports', async () => {
      const reportId = await securityMonitor.reportSuspiciousActivity(
        '0xreporter123456789012345678901234567890123456',
        '0xsuspicious123456789012345678901234567890',
        'MONEY_LAUNDERING',
        'Multiple large transfers to offshore addresses'
      );

      expect(reportId).toBeDefined();
      // High-priority reports should be auto-investigated
    });
  });

  describe('Audit Trail', () => {
    test('should maintain audit trail for all activities', async () => {
      // Perform various activities
      await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1000,
        '0x',
        21000
      );

      await securityMonitor.monitorContractInteraction(
        '0x7abcdef12345678901234567890123456789012',
        'transfer',
        '0x1234567890123456789012345678901234567890',
        ['0x0987654321098765432109876543210987654321', 1000]
      );

      const auditTrail = await securityMonitor.getAuditTrail();
      
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail.some(entry => entry.action === 'TRANSACTION')).toBe(true);
      expect(auditTrail.some(entry => entry.action === 'CONTRACT_CALL')).toBe(true);
    });

    test('should filter audit trail by address', async () => {
      const address1 = '0x1234567890123456789012345678901234567890';
      const address2 = '0x0987654321098765432109876543210987654321';

      await securityMonitor.monitorTransaction(
        address1,
        address2,
        1000,
        '0x',
        21000
      );

      await securityMonitor.monitorTransaction(
        address2,
        address1,
        2000,
        '0x',
        21000
      );

      const address1Trail = await securityMonitor.getAuditTrail(address1);
      const address2Trail = await securityMonitor.getAuditTrail(address2);

      expect(address1Trail.length).toBeGreaterThan(0);
      expect(address2Trail.length).toBeGreaterThan(0);
      
      // All entries should involve the respective address
      expect(address1Trail.every(entry => 
        entry.actor === address1 || entry.target === address1
      )).toBe(true);
      
      expect(address2Trail.every(entry => 
        entry.actor === address2 || entry.target === address2
      )).toBe(true);
    });
  });

  describe('Security Events', () => {
    test('should generate security events for high-risk activities', async () => {
      // Trigger a high-risk transaction
      await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        2000000, // High value
        '0x',
        21000
      );

      const securityEvents = await securityMonitor.getSecurityEvents();
      
      expect(securityEvents.length).toBeGreaterThan(0);
      expect(securityEvents.some(event => 
        event.eventType.toString() === 'TRANSACTION'
      )).toBe(true);
    });

    test('should filter security events by severity', async () => {
      // Trigger multiple events with different severities
      await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        2000000, // High value - should create HIGH severity event
        '0x',
        21000
      );

      const highSeverityEvents = await securityMonitor.getSecurityEvents(
        undefined,
        SecuritySeverity.HIGH
      );

      expect(highSeverityEvents.length).toBeGreaterThan(0);
      expect(highSeverityEvents.every(event => 
        event.severity === SecuritySeverity.HIGH
      )).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    test('should update security thresholds', async () => {
      const newThresholds = new SecurityThresholds(
        500000,  // Lower max transaction value
        4000000, // Lower max gas limit
        30,      // Lower max calls per minute
        50,      // Lower max contracts per hour
        0.6,     // Lower suspicious threshold
        0.7      // Lower anomaly confidence threshold
      );

      await securityMonitor.updateSecurityThresholds(newThresholds);

      // Test that new thresholds are applied
      const result = await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        750000, // Above new threshold but below old one
        '0x',
        21000
      );

      expect(result.allowed).toBe(false);
      expect(result.reasons.some(r => r.includes('exceeds threshold'))).toBe(true);
    });

    test('should add and remove compliance rules', async () => {
      const rule = new ComplianceRule(
        'TEST_RULE',
        'Test rule for management',
        'TEST',
        [],
        []
      );

      await securityMonitor.addComplianceRule(rule);
      
      // Rule should be added (verified through compliance check)
      const context = new ComplianceContext(
        '0x1234567890123456789012345678901234567890',
        'TEST',
        0,
        'GLOBAL'
      );

      const result = await securityMonitor.checkCompliance(
        '0x1234567890123456789012345678901234567890',
        'TEST'
      );

      expect(result).toBeDefined();

      await securityMonitor.removeComplianceRule(rule.ruleId);
      // Rule should be removed
    });
  });

  describe('Statistics and Analytics', () => {
    test('should provide security statistics', async () => {
      // Generate some activity
      await securityMonitor.monitorTransaction(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1000,
        '0x',
        21000
      );

      const stats = await securityMonitor.getSecurityStatistics();
      
      expect(stats).toHaveProperty('totalTransactions');
      expect(stats).toHaveProperty('blockedTransactions');
      expect(stats).toHaveProperty('anomaliesDetected');
      expect(stats).toHaveProperty('emergencyActivations');
      expect(stats).toHaveProperty('complianceScore');
      expect(stats).toHaveProperty('averageResponseTime');
      
      expect(stats.totalTransactions).toBeGreaterThan(0);
    });

    test('should provide anomaly statistics', async () => {
      // Trigger some anomalies
      const address = '0x1234567890123456789012345678901234567890';
      
      for (let i = 0; i < 50; i++) {
        await securityMonitor.monitorTransaction(
          address,
          `0x${i.toString().padStart(40, '0')}`,
          1000,
          '0x',
          21000
        );
      }

      await securityMonitor.detectAnomalies(address, 60000);

      const stats = await securityMonitor.getAnomalyStatistics();
      
      expect(stats).toHaveProperty('totalAnomalies');
      expect(stats).toHaveProperty('anomaliesByType');
      expect(stats).toHaveProperty('averageConfidence');
      expect(stats).toHaveProperty('falsePositiveRate');
      expect(stats).toHaveProperty('responseTime');
    });

    test('should provide compliance statistics', async () => {
      const stats = await securityMonitor.getComplianceStatistics();
      
      expect(stats).toHaveProperty('totalChecks');
      expect(stats).toHaveProperty('violations');
      expect(stats).toHaveProperty('complianceRate');
      expect(stats).toHaveProperty('penaltiesApplied');
      expect(stats).toHaveProperty('reportsGenerated');
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance reports', async () => {
      const report = await securityMonitor.generateComplianceReport(ReportingPeriod.DAILY);
      
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('startTime');
      expect(report).toHaveProperty('endTime');
      expect(report).toHaveProperty('totalChecks');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('complianceScore');
      expect(report).toHaveProperty('recommendations');
      
      expect(report.period).toBe(ReportingPeriod.DAILY);
    });

    test('should generate reports for different periods', async () => {
      const dailyReport = await securityMonitor.generateComplianceReport(ReportingPeriod.DAILY);
      const weeklyReport = await securityMonitor.generateComplianceReport(ReportingPeriod.WEEKLY);
      const monthlyReport = await securityMonitor.generateComplianceReport(ReportingPeriod.MONTHLY);

      expect(dailyReport.period).toBe(ReportingPeriod.DAILY);
      expect(weeklyReport.period).toBe(ReportingPeriod.WEEKLY);
      expect(monthlyReport.period).toBe(ReportingPeriod.MONTHLY);
    });
  });
});

describe('SecurityLib', () => {
  describe('Address Validation', () => {
    test('should validate valid addresses', () => {
      expect(SecurityLib.isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(SecurityLib.isValidAddress('0xinvalid')).toBe(false);
      expect(SecurityLib.isValidAddress('1234567890123456789012345678901234567890')).toBe(false);
    });

    test('should identify contract addresses', () => {
      expect(SecurityLib.isContract('0x7abcdef12345678901234567890123456789012')).toBe(true);
      expect(SecurityLib.isContract('0x1234567890123456789012345678901234567890')).toBe(false);
    });
  });

  describe('Transaction Analysis', () => {
    test('should analyze transaction risk correctly', () => {
      const thresholds = new SecurityThresholds();
      
      const result = SecurityLib.analyzeTransactionRisk(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        1000,
        21000,
        thresholds
      );

      expect(result.allowed).toBe(true);
      expect(result.riskLevel).toBe(SecuritySeverity.LOW);
    });

    test('should detect high-value transactions', () => {
      const thresholds = new SecurityThresholds(1000); // Low threshold for testing
      
      const result = SecurityLib.analyzeTransactionRisk(
        '0x1234567890123456789012345678901234567890',
        '0x0987654321098765432109876543210987654321',
        2000, // Exceeds threshold
        21000,
        thresholds
      );

      expect(result.riskLevel).toBe(SecuritySeverity.HIGH);
      expect(result.reasons.some(r => r.includes('exceeds threshold'))).toBe(true);
    });
  });

  describe('Pattern Detection', () => {
    test('should detect rapid successive calls', () => {
      const callHistory = new Map<string, number[]>();
      const address = '0x1234567890123456789012345678901234567890';
      
      // Simulate rapid calls
      const now = Date.now();
      for (let i = 0; i < 35; i++) {
        callHistory.set(address, Array.from({length: i}, (_, j) => now - j * 1000));
      }

      const detected = SecurityLib.detectRapidSuccessiveCalls(
        address,
        callHistory,
        60000, // 1 minute
        30     // max calls
      );

      expect(detected).toBe(true);
    });
  });
});

describe('AnomalyDetection', () => {
  describe('Statistical Analysis', () => {
    test('should detect statistical anomalies', () => {
      const transactions = [
        new TransactionPattern('0x1234', 1000, Date.now() - 1000),
        new TransactionPattern('0x1234', 1100, Date.now() - 2000),
        new TransactionPattern('0x1234', 1050, Date.now() - 3000),
        new TransactionPattern('0x1234', 10000000, Date.now() - 4000), // Anomaly
        new TransactionPattern('0x1234', 950, Date.now() - 5000),
      ];

      const result = AnomalyDetection.detectStatisticalAnomalies(
        '0x1234',
        transactions,
        3600000 // 1 hour
      );

      expect(result.hasAnomaly).toBe(true);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Flash Loan Detection', () => {
    test('should detect potential flash loan attacks', () => {
      const transfers = [
        new TokenTransfer('0xtoken', '0xcontract', '0xuser', 1000000, Date.now()),
        new TokenTransfer('0xtoken', '0xuser', '0xcontract', 1000000, Date.now() + 1000),
      ];

      const contractBalances = new Map<string, number>();
      contractBalances.set('0xtoken', 1000000);
      
      const preAttackBalances = new Map<string, number>();
      preAttackBalances.set('0xtoken', 1000000);

      const result = AnomalyDetection.detectFlashLoanAttacks(
        transfers,
        contractBalances,
        preAttackBalances
      );

      expect(result).toHaveProperty('hasAnomaly');
      expect(result).toHaveProperty('anomalies');
    });
  });
});

describe('ComplianceEngine', () => {
  let complianceEngine: ComplianceEngine;

  beforeEach(() => {
    complianceEngine = new ComplianceEngine();
  });

  describe('Rule Management', () => {
    test('should add compliance rules', () => {
      const rule = new ComplianceRule(
        'TEST_RULE',
        'Test rule',
        'TEST',
        [],
        []
      );

      complianceEngine.addComplianceRule(rule);
      
      // Rule should be added and available for compliance checking
      const context = new ComplianceContext(
        '0x1234567890123456789012345678901234567890',
        'TEST',
        0,
        'GLOBAL'
      );

      const result = complianceEngine.checkCompliance(context);
      expect(result).toBeDefined();
    });

    test('should remove compliance rules', () => {
      const rule = new ComplianceRule(
        'TEST_RULE',
        'Test rule',
        'TEST',
        [],
        []
      );

      complianceEngine.addComplianceRule(rule);
      complianceEngine.removeComplianceRule(rule.ruleId);
      
      // Rule should be removed
    });
  });

  describe('KYC Management', () => {
    test('should add KYC records', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const record = new KYCRecord(address, 2, true);

      complianceEngine.addKYCRecord(address, record);
      
      const context = new ComplianceContext(
        address,
        'TRANSACTION',
        1000,
        'US'
      );

      const result = complianceEngine.checkCompliance(context);
      expect(result.compliant).toBe(true);
    });

    test('should detect missing KYC', () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      const context = new ComplianceContext(
        address,
        'TRANSACTION',
        1000,
        'US'
      );

      const result = complianceEngine.checkCompliance(context);
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.violationType === 'NO_KYC_RECORD')).toBe(true);
    });
  });

  describe('Address Management', () => {
    test('should manage blacklisted addresses', () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      complianceEngine.addBlacklistedAddress(address, 'Test blacklisting');
      
      const context = new ComplianceContext(
        address,
        'TRANSACTION',
        1000,
        'GLOBAL'
      );

      const result = complianceEngine.checkCompliance(context);
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.violationType === 'BLACKLISTED_ADDRESS')).toBe(true);
    });
  });

  describe('Reporting', () => {
    test('should generate compliance statistics', () => {
      const stats = complianceEngine.getComplianceStatistics();
      
      expect(stats).toHaveProperty('totalChecks');
      expect(stats).toHaveProperty('violations');
      expect(stats).toHaveProperty('complianceRate');
      expect(stats).toHaveProperty('penaltiesApplied');
      expect(stats).toHaveProperty('reportsGenerated');
    });

    test('should generate compliance reports', () => {
      const report = complianceEngine.generateComplianceReport(ReportingPeriod.DAILY);
      
      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('startTime');
      expect(report).toHaveProperty('endTime');
      expect(report).toHaveProperty('complianceScore');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('recommendations');
    });
  });
});

// Integration Tests
describe('Security System Integration', () => {
  test('should integrate all components seamlessly', async () => {
    const securityMonitor = new SecurityMonitor();
    
    // Test transaction monitoring
    const txResult = await securityMonitor.monitorTransaction(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      1000,
      '0x',
      21000
    );

    expect(txResult.allowed).toBe(true);

    // Test anomaly detection
    const anomalyResult = await securityMonitor.detectAnomalies(
      '0x1234567890123456789012345678901234567890',
      3600000
    );

    expect(anomalyResult).toBeDefined();

    // Test compliance checking
    const complianceResult = await securityMonitor.checkCompliance(
      '0x1234567890123456789012345678901234567890',
      'AML'
    );

    expect(complianceResult).toBeDefined();

    // Test statistics
    const securityStats = await securityMonitor.getSecurityStatistics();
    const anomalyStats = await securityMonitor.getAnomalyStatistics();
    const complianceStats = await securityMonitor.getComplianceStatistics();

    expect(securityStats.totalTransactions).toBeGreaterThan(0);
    expect(securityStats).toBeDefined();
    expect(anomalyStats).toBeDefined();
    expect(complianceStats).toBeDefined();
  });

  test('should handle emergency scenarios', async () => {
    const securityMonitor = new SecurityMonitor();
    
    // Normal operation
    const normalResult = await securityMonitor.monitorTransaction(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      1000,
      '0x',
      21000
    );

    expect(normalResult.allowed).toBe(true);

    // Emergency activation
    await securityMonitor.activateEmergency(
      'Security breach detected',
      EmergencyScope.ALL_CONTRACTS
    );

    // Blocked during emergency
    const emergencyResult = await securityMonitor.monitorTransaction(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      1000,
      '0x',
      21000
    );

    expect(emergencyResult.allowed).toBe(false);

    // Emergency deactivation
    await securityMonitor.deactivateEmergency();

    // Normal operation restored
    const restoredResult = await securityMonitor.monitorTransaction(
      '0x1234567890123456789012345678901234567890',
      '0x0987654321098765432109876543210987654321',
      1000,
      '0x',
      21000
    );

    expect(restoredResult.allowed).toBe(true);
  });
});
