/**
 * @title ISecurityMonitor
 * @dev Interface for comprehensive security monitoring and compliance system
 * @dev Provides real-time monitoring, anomaly detection, and regulatory compliance
 */

// Events
export interface SecurityEventDetectedEvent {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  actor: string;
  target: string;
  data: string;
  timestamp: number;
  blockNumber: number;
}

export interface AnomalyDetectedEvent {
  anomalyType: AnomalyType;
  confidence: number;
  description: string;
  affectedAddresses: string[];
  mitigationAction: string;
  timestamp: number;
}

export interface ComplianceViolationEvent {
  regulation: string;
  violationType: string;
  severity: ComplianceSeverity;
  violator: string;
  details: string;
  requiredAction: string;
  timestamp: number;
}

export interface EmergencyActivatedEvent {
  reason: string;
  activator: string;
  scope: EmergencyScope;
  timestamp: number;
}

export interface EmergencyDeactivatedEvent {
  deactivator: string;
  timestamp: number;
}

export interface AuditTrailEntryEvent {
  entryId: string;
  action: string;
  actor: string;
  target: string;
  result: boolean;
  gasUsed: number;
  timestamp: number;
}

// Main Interface
export interface ISecurityMonitor {
  // Monitoring Functions
  monitorTransaction(
    actor: string,
    target: string,
    value: number,
    data: string,
    gasLimit: number
  ): Promise<SecurityCheckResult>;

  monitorContractInteraction(
    contract: string,
    function: string,
    actor: string,
    params: any[]
  ): Promise<SecurityCheckResult>;

  monitorTokenTransfer(
    token: string,
    from: string,
    to: string,
    amount: number
  ): Promise<SecurityCheckResult>;

  // Anomaly Detection
  detectAnomalies(
    address: string,
    timeWindow: number
  ): Promise<AnomalyDetectionResult>;

  reportSuspiciousActivity(
    reporter: string,
    suspiciousAddress: string,
    reason: string,
    evidence: string
  ): Promise<string>;

  // Compliance Functions
  checkCompliance(
    address: string,
    regulation: string
  ): Promise<ComplianceCheckResult>;

  enforceComplianceRules(
    address: string,
    context: ComplianceContext
  ): Promise<ComplianceEnforcementResult>;

  generateComplianceReport(
    period: ReportingPeriod
  ): Promise<ComplianceReport>;

  // Emergency Controls
  activateEmergency(
    reason: string,
    scope: EmergencyScope
  ): Promise<void>;

  deactivateEmergency(): Promise<void>;

  isEmergencyActive(): Promise<boolean>;

  // Audit Trail Functions
  getAuditTrail(
    address?: string,
    startTime?: number,
    endTime?: number
  ): Promise<AuditEntry[]>;

  getSecurityEvents(
    eventType?: SecurityEventType,
    severity?: SecuritySeverity,
    startTime?: number,
    endTime?: number
  ): Promise<SecurityEvent[]>;

  // Configuration Functions
  updateSecurityThresholds(thresholds: SecurityThresholds): Promise<void>;

  addComplianceRule(rule: ComplianceRule): Promise<void>;

  removeComplianceRule(ruleId: string): Promise<void>;

  // Statistics and Analytics
  getSecurityStatistics(): Promise<SecurityStatistics>;

  getAnomalyStatistics(): Promise<AnomalyStatistics>;

  getComplianceStatistics(): Promise<ComplianceStatistics>;
}

// Enums
export enum SecurityEventType {
  TRANSACTION = 0,
  CONTRACT_CALL = 1,
  TOKEN_TRANSFER = 2,
  ACCESS_CONTROL = 3,
  EMERGENCY = 4,
  ANOMALY = 5,
  COMPLIANCE = 6
}

export enum SecuritySeverity {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum AnomalyType {
  UNUSUAL_TRANSACTION_PATTERN = 0,
  RAPID_SUCCESSIVE_CALLS = 1,
  LARGE_VALUE_TRANSFER = 2,
  SUSPICIOUS_ADDRESS_INTERACTION = 3,
  REENTRANCY_ATTEMPT = 4,
  FLASH_LOAN_ATTACK = 5,
  ORACLE_MANIPULATION = 6,
  GOVERNANCE_ATTACK = 7
}

export enum ComplianceSeverity {
  INFO = 0,
  WARNING = 1,
  VIOLATION = 2,
  CRITICAL_VIOLATION = 3
}

export enum EmergencyScope {
  SPECIFIC_CONTRACT = 0,
  ALL_CONTRACTS = 1,
  NETWORK_WIDE = 2
}

export enum ReportingPeriod {
  DAILY = 0,
  WEEKLY = 1,
  MONTHLY = 2,
  QUARTERLY = 3,
  YEARLY = 4
}

// Classes and Structs
export class SecurityCheckResult {
  allowed: boolean;
  riskLevel: SecuritySeverity;
  reasons: string[];
  requiredActions: string[];
  gasEstimate: number;

  constructor(
    allowed: boolean,
    riskLevel: SecuritySeverity,
    reasons: string[] = [],
    requiredActions: string[] = [],
    gasEstimate: number = 0
  ) {
    this.allowed = allowed;
    this.riskLevel = riskLevel;
    this.reasons = reasons;
    this.requiredActions = requiredActions;
    this.gasEstimate = gasEstimate;
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

export class ComplianceEnforcementResult {
  enforced: boolean;
  actionsTaken: string[];
  blocked: boolean;
  penaltyApplied: boolean;
  penaltyAmount: number;

  constructor(
    enforced: boolean,
    actionsTaken: string[] = [],
    blocked: boolean = false,
    penaltyApplied: boolean = false,
    penaltyAmount: number = 0
  ) {
    this.enforced = enforced;
    this.actionsTaken = actionsTaken;
    this.blocked = blocked;
    this.penaltyApplied = penaltyApplied;
    this.penaltyAmount = penaltyAmount;
  }
}

export class ComplianceReport {
  period: ReportingPeriod;
  startTime: number;
  endTime: number;
  totalChecks: number;
  violations: ComplianceViolation[];
  complianceScore: number;
  recommendations: string[];

  constructor(
    period: ReportingPeriod,
    startTime: number,
    endTime: number
  ) {
    this.period = period;
    this.startTime = startTime;
    this.endTime = endTime;
    this.totalChecks = 0;
    this.violations = [];
    this.complianceScore = 0;
    this.recommendations = [];
  }
}

export class ComplianceContext {
  address: string;
  transactionType: string;
  value: number;
  jurisdiction: string;
  additionalData: Map<string, any>;

  constructor(
    address: string,
    transactionType: string,
    value: number,
    jurisdiction: string = "GLOBAL"
  ) {
    this.address = address;
    this.transactionType = transactionType;
    this.value = value;
    this.jurisdiction = jurisdiction;
    this.additionalData = new Map();
  }
}

export class AuditEntry {
  entryId: string;
  action: string;
  actor: string;
  target: string;
  result: boolean;
  gasUsed: number;
  timestamp: number;
  blockNumber: number;
  metadata: Map<string, any>;

  constructor(
    action: string,
    actor: string,
    target: string,
    result: boolean,
    gasUsed: number = 0
  ) {
    this.entryId = this.generateEntryId();
    this.action = action;
    this.actor = actor;
    this.target = target;
    this.result = result;
    this.gasUsed = gasUsed;
    this.timestamp = Date.now();
    this.blockNumber = 0; // Would be set by the blockchain
    this.metadata = new Map();
  }

  private generateEntryId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class SecurityEvent {
  eventId: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  actor: string;
  target: string;
  data: string;
  timestamp: number;
  blockNumber: number;
  resolved: boolean;

  constructor(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    actor: string,
    target: string,
    data: string
  ) {
    this.eventId = this.generateEventId();
    this.eventType = eventType;
    this.severity = severity;
    this.actor = actor;
    this.target = target;
    this.data = data;
    this.timestamp = Date.now();
    this.blockNumber = 0; // Would be set by the blockchain
    this.resolved = false;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class SecurityThresholds {
  maxTransactionValue: number;
  maxGasLimit: number;
  maxCallsPerMinute: number;
  maxContractsPerHour: number;
  suspiciousAddressThreshold: number;
  anomalyConfidenceThreshold: number;

  constructor(
    maxTransactionValue: number = 1000000,
    maxGasLimit: number = 8000000,
    maxCallsPerMinute: number = 60,
    maxContractsPerHour: number = 100,
    suspiciousAddressThreshold: number = 0.7,
    anomalyConfidenceThreshold: number = 0.8
  ) {
    this.maxTransactionValue = maxTransactionValue;
    this.maxGasLimit = maxGasLimit;
    this.maxCallsPerMinute = maxCallsPerMinute;
    this.maxContractsPerHour = maxContractsPerHour;
    this.suspiciousAddressThreshold = suspiciousAddressThreshold;
    this.anomalyConfidenceThreshold = anomalyConfidenceThreshold;
  }
}

export class ComplianceRule {
  ruleId: string;
  name: string;
  description: string;
  regulation: string;
  conditions: ComplianceCondition[];
  actions: ComplianceAction[];
  enabled: boolean;

  constructor(
    name: string,
    description: string,
    regulation: string,
    conditions: ComplianceCondition[],
    actions: ComplianceAction[]
  ) {
    this.ruleId = this.generateRuleId();
    this.name = name;
    this.description = description;
    this.regulation = regulation;
    this.conditions = conditions;
    this.actions = actions;
    this.enabled = true;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class ComplianceCondition {
  type: string;
  operator: string;
  value: any;
  description: string;

  constructor(type: string, operator: string, value: any, description: string) {
    this.type = type;
    this.operator = operator;
    this.value = value;
    this.description = description;
  }
}

export class ComplianceAction {
  type: ComplianceActionType;
  parameters: Map<string, any>;
  description: string;

  constructor(type: ComplianceActionType, description: string) {
    this.type = type;
    this.parameters = new Map();
    this.description = description;
  }
}

export enum ComplianceActionType {
  BLOCK_TRANSACTION = 0,
  REQUIRE_ADDITIONAL_VERIFICATION = 1,
  APPLY_PENALTY = 2,
  REPORT_TO_AUTHORITY = 3,
  FREEZE_ACCOUNT = 4,
  NOTIFY_ADMIN = 5
}

export class SecurityStatistics {
  totalTransactions: number;
  blockedTransactions: number;
  anomaliesDetected: number;
  emergencyActivations: number;
  complianceScore: number;
  averageResponseTime: number;

  constructor() {
    this.totalTransactions = 0;
    this.blockedTransactions = 0;
    this.anomaliesDetected = 0;
    this.emergencyActivations = 0;
    this.complianceScore = 0;
    this.averageResponseTime = 0;
  }
}

export class AnomalyStatistics {
  totalAnomalies: number;
  anomaliesByType: Map<AnomalyType, number>;
  averageConfidence: number;
  falsePositiveRate: number;
  responseTime: number;

  constructor() {
    this.totalAnomalies = 0;
    this.anomaliesByType = new Map();
    this.averageConfidence = 0;
    this.falsePositiveRate = 0;
    this.responseTime = 0;
  }
}

export class ComplianceStatistics {
  totalChecks: number;
  violations: number;
  complianceRate: number;
  penaltiesApplied: number;
  reportsGenerated: number;

  constructor() {
    this.totalChecks = 0;
    this.violations = 0;
    this.complianceRate = 0;
    this.penaltiesApplied = 0;
    this.reportsGenerated = 0;
  }
}
