/**
 * @title IUpgradeManager
 * @dev Interface for the upgrade management system with proxy patterns
 * @dev Provides secure contract upgrades with state preservation and governance
 */

// Core Types
export interface UpgradeProposal {
  id: number;
  proposedBy: string;
  newImplementation: string;
  currentImplementation: string;
  description: string;
  upgradeData: string;
  proposedAt: number;
  scheduledAt: number;
  executionWindow: number;
  status: UpgradeStatus;
  votes: Vote[];
  requiredApprovals: number;
  migrationPlan: MigrationPlan;
  rollbackData?: string;
  executionTime?: number;
  gasUsed?: number;
}

export interface Vote {
  voter: string;
  support: boolean;
  votedAt: number;
  reason?: string;
}

export interface MigrationPlan {
  steps: MigrationStep[];
  estimatedGas: number;
  timeout: number;
  requiresPause: boolean;
}

export interface MigrationStep {
  id: number;
  description: string;
  targetContract: string;
  action: MigrationAction;
  data: string;
  dependencies: number[];
}

export enum MigrationAction {
  MIGRATE_STORAGE = "MIGRATE_STORAGE",
  UPDATE_STATE = "UPDATE_STATE",
  VALIDATE_STATE = "VALIDATE_STATE",
  CLEANUP_STORAGE = "CLEANUP_STORAGE"
}

export enum UpgradeStatus {
  PROPOSED = "PROPOSED",
  SCHEDULED = "SCHEDULED",
  APPROVED = "APPROVED",
  EXECUTED = "EXECUTED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  ROLLED_BACK = "ROLLED_BACK"
}

export interface UpgradeAnalytics {
  totalUpgrades: number;
  successfulUpgrades: number;
  failedUpgrades: number;
  rolledBackUpgrades: number;
  averageExecutionTime: number;
  averageGasUsed: number;
  lastUpgradeTime: number;
  upgradeHistory: UpgradeRecord[];
}

export interface UpgradeRecord {
  proposalId: number;
  executedAt: number;
  executionTime: number;
  gasUsed: number;
  status: UpgradeStatus;
  rollbackTriggered: boolean;
}

export interface ProxyInfo {
  implementation: string;
  admin: string;
  isInitialized: boolean;
  upgradeCount: number;
  lastUpgradeAt: number;
  version: string;
}

export interface StateSnapshot {
  id: string;
  contract: string;
  timestamp: number;
  storageHash: string;
  data: string;
  checksum: string;
}

// Events
export interface UpgradeProposedEvent {
  proposalId: number;
  proposedBy: string;
  newImplementation: string;
  description: string;
  scheduledAt: number;
}

export interface UpgradeScheduledEvent {
  proposalId: number;
  executionWindow: number;
  requiredApprovals: number;
}

export interface UpgradeApprovedEvent {
  proposalId: number;
  approvedBy: string;
  approvals: number;
}

export interface UpgradeExecutedEvent {
  proposalId: number;
  newImplementation: string;
  executedBy: string;
  gasUsed: number;
  executionTime: number;
}

export interface UpgradeFailedEvent {
  proposalId: number;
  reason: string;
  errorData: string;
}

export interface UpgradeRolledBackEvent {
  proposalId: number;
  rolledBackBy: string;
  previousImplementation: string;
  reason: string;
}

export interface VoteCastEvent {
  proposalId: number;
  voter: string;
  support: boolean;
  reason?: string;
}

export interface StateSnapshotCreatedEvent {
  snapshotId: string;
  contract: string;
  timestamp: number;
  storageHash: string;
}

// Main Interface
export interface IUpgradeManager {
  // Proposal Management
  proposeUpgrade(
    newImplementation: string,
    description: string,
    upgradeData: string,
    scheduledAt: number,
    executionWindow: number,
    migrationPlan: MigrationPlan
  ): Promise<number>;

  scheduleUpgrade(proposalId: number, requiredApprovals: number): Promise<void>;
  cancelUpgrade(proposalId: number, reason: string): Promise<void>;

  // Voting and Governance
  voteUpgrade(proposalId: number, support: boolean, reason?: string): Promise<void>;
  executeUpgrade(proposalId: number): Promise<void>;
  rollbackUpgrade(proposalId: number, reason: string): Promise<void>;

  // State Management
  createStateSnapshot(contract: string): Promise<string>;
  verifyStateSnapshot(snapshotId: string): Promise<boolean>;
  restoreFromSnapshot(snapshotId: string): Promise<void>;

  // Proxy Management
  upgradeProxy(proxy: string, newImplementation: string, data?: string): Promise<void>;
  getProxyInfo(proxy: string): Promise<ProxyInfo>;
  getImplementation(proxy: string): Promise<string>;
  getAdmin(proxy: string): Promise<void>;

  // Analytics and Monitoring
  getUpgradeAnalytics(): Promise<UpgradeAnalytics>;
  getUpgradeHistory(limit?: number): Promise<UpgradeRecord[]>;
  getActiveProposals(): Promise<UpgradeProposal[]>;

  // Validation and Security
  validateUpgrade(proposalId: number): Promise<boolean>;
  validateImplementation(implementation: string): Promise<boolean>;
  checkCompatibility(
    currentImplementation: string,
    newImplementation: string
  ): Promise<boolean>;

  // Emergency Functions
  emergencyPause(): Promise<void>;
  emergencyUnpause(): Promise<void>;
  emergencyUpgrade(
    newImplementation: string,
    reason: string,
    requiresMultisig: boolean
  ): Promise<void>;

  // View Functions
  getProposal(proposalId: number): Promise<UpgradeProposal>;
  getVotes(proposalId: number): Promise<Vote[]>;
  getStateSnapshot(snapshotId: string): Promise<StateSnapshot>;
  isPaused(): Promise<boolean>;
  getUpgradeDelay(): Promise<number>;
  getTimelock(): Promise<number>;

  // Configuration
  setUpgradeDelay(delay: number): Promise<void>;
  setTimelock(timelock: number): Promise<void>;
  setGovernanceContract(governance: string): Promise<void>;
  setSecurityModule(security: string): Promise<void>;
}

// Constants
export const UPGRADE_MANAGER_ROLE = "UPGRADE_MANAGER_ROLE";
export const UPGRADE_PROPOSER_ROLE = "UPGRADE_PROPOSER_ROLE";
export const UPGRADE_EXECUTOR_ROLE = "UPGRADE_EXECUTOR_ROLE";
export const UPGRADE_VOTER_ROLE = "UPGRADE_VOTER_ROLE";
export const EMERGENCY_UPGRADE_ROLE = "EMERGENCY_UPGRADE_ROLE";

export const MIN_UPGRADE_DELAY = 86400; // 1 day in seconds
export const MAX_UPGRADE_DELAY = 2592000; // 30 days in seconds
export const DEFAULT_UPGRADE_DELAY = 604800; // 7 days in seconds

export const MIN_EXECUTION_WINDOW = 3600; // 1 hour
export const MAX_EXECUTION_WINDOW = 86400; // 24 hours
export const DEFAULT_EXECUTION_WINDOW = 14400; // 4 hours

// Error Messages
export const ERROR_MESSAGES = {
  PROPOSAL_NOT_FOUND: "Upgrade proposal not found",
  PROPOSAL_ALREADY_EXECUTED: "Upgrade proposal already executed",
  PROPOSAL_NOT_APPROVED: "Upgrade proposal not approved",
  EXECUTION_WINDOW_CLOSED: "Upgrade execution window closed",
  INSUFFICIENT_APPROVALS: "Insufficient approvals for upgrade",
  INVALID_IMPLEMENTATION: "Invalid implementation contract",
  INCOMPATIBLE_UPGRADE: "Upgrade is not compatible",
  UPGRADE_PAUSED: "Upgrade system is paused",
  UNAUTHORIZED_VOTER: "Not authorized to vote",
  ALREADY_VOTED: "Already voted on this proposal",
  INVALID_MIGRATION_PLAN: "Invalid migration plan",
  SNAPSHOT_NOT_FOUND: "State snapshot not found",
  SNAPSHOT_VERIFICATION_FAILED: "State snapshot verification failed",
  ROLLBACK_NOT_ALLOWED: "Rollback not allowed for this upgrade",
  EMERGENCY_UPGRADE_REQUIRED: "Emergency upgrade requires special permissions",
  GOVERNANCE_CHECK_FAILED: "Governance check failed",
  SECURITY_VALIDATION_FAILED: "Security validation failed"
} as const;

// Gas Limits
export const GAS_LIMITS = {
  PROPOSE_UPGRADE: 200000,
  SCHEDULE_UPGRADE: 150000,
  VOTE_UPGRADE: 100000,
  EXECUTE_UPGRADE: 500000,
  ROLLBACK_UPGRADE: 400000,
  CREATE_SNAPSHOT: 300000,
  VERIFY_SNAPSHOT: 200000,
  RESTORE_SNAPSHOT: 400000,
  VALIDATE_UPGRADE: 250000
} as const;
