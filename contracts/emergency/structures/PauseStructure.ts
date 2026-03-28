/**
 * @title PauseStructure
 * @dev Data structures for emergency pause system
 */

/**
 * @dev Pause levels with different scopes and impacts
 */
export enum PauseLevel {
  NONE = 0,           // No pause active
  SELECTIVE = 1,      // Pause specific contracts
  PARTIAL = 2,        // Pause critical functions only
  FULL = 3           // Pause all platform operations
}

/**
 * @dev Pause status information
 */
export interface PauseStatus {
  level: PauseLevel;
  isActive: boolean;
  startTime: number;
  duration: number;
  reason: string;
  initiator: string;
  affectedContracts: string[];
  autoResumeTime: number;
  lastUpdateTime: number;
}

/**
 * @dev Emergency configuration
 */
export interface EmergencyConfig {
  requiredSignatures: number;
  maxPauseDuration: number;
  autoResumeEnabled: boolean;
  notificationThreshold: number;
  gasOptimizationLevel: number;
  governanceMembers: string[];
  criticalContracts: string[];
  pauseLevels: {
    [key in PauseLevel]: {
      requiredSignatures: number;
      maxDuration: number;
      autoResumeEnabled: boolean;
    };
  };
}

/**
 * @dev Pause event for analytics
 */
export interface PauseEvent {
  id: string;
  level: PauseLevel;
  startTime: number;
  endTime?: number;
  duration?: number;
  reason: string;
  initiator: string;
  affectedContracts: string[];
  resumeSignatures: string[];
  autoResumed: boolean;
  gasUsed: number;
}

/**
 * @dev Governance actions
 */
export enum GovernanceAction {
  ADD_MEMBER = 0,
  REMOVE_MEMBER = 1,
  UPDATE_CONFIG = 2,
  EMERGENCY_PAUSE = 3,
  EMERGENCY_RESUME = 4,
  TRIGGER_AUTO_RESUME = 5
}

/**
 * @dev Governance proposal
 */
export interface GovernanceProposal {
  id: string;
  action: GovernanceAction;
  proposer: string;
  targetLevel?: PauseLevel;
  targetConfig?: Partial<EmergencyConfig>;
  targetMember?: string;
  signatures: string[];
  timestamp: number;
  executed: boolean;
  executionTime?: number;
}

/**
 * @dev Notification data
 */
export interface NotificationData {
  type: 'EMERGENCY_PAUSE' | 'EMERGENCY_RESUME' | 'AUTO_RESUME' | 'GOVERNANCE_ACTION';
  level: PauseLevel;
  timestamp: number;
  message: string;
  affectedContracts: string[];
  initiator: string;
  additionalData?: Record<string, any>;
}

/**
 * @dev Gas optimization data
 */
export interface GasOptimizationData {
  pauseBaseCost: number;
  resumeBaseCost: number;
  notificationBaseCost: number;
  signatureVerificationCost: number;
  contractUpdateCost: number;
  totalOptimizedCost: number;
}

/**
 * @dev Analytics data
 */
export interface PauseAnalytics {
  totalPauses: number;
  totalDuration: number;
  averageDuration: number;
  pauseFrequency: number;
  lastPauseTime: number;
  pauseByLevel: {
    [key in PauseLevel]: number;
  };
  pauseByReason: Record<string, number>;
  gasUsage: {
    total: number;
    average: number;
    byAction: Record<string, number>;
  };
  governanceActivity: {
    totalProposals: number;
    executedProposals: number;
    averageExecutionTime: number;
  };
}

/**
 * @dev Contract pause state
 */
export interface ContractPauseState {
  contractAddress: string;
  isPaused: boolean;
  pauseLevel: PauseLevel;
  pauseTime: number;
  expectedResumeTime: number;
  pauseReason: string;
  functionsPaused: string[];
}

/**
 * @dev Multi-signature data
 */
export interface MultiSignatureData {
  signatures: string[];
  signers: string[];
  threshold: number;
  data: string;
  hash: string;
}

/**
 * @dev Emergency response metrics
 */
export interface EmergencyMetrics {
  responseTime: number;        // Time to initiate pause after threat detection
  haltTime: number;           // Time to halt all operations
  resumeTime: number;         // Time to resume operations
  notificationTime: number;   // Time to send notifications
  gasEfficiency: number;      // Gas used per operation
  successRate: number;        // Percentage of successful emergency responses
}

/**
 * @dev Validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gasEstimate: number;
}

/**
 * @dev Default emergency configuration
 */
export const DEFAULT_EMERGENCY_CONFIG: EmergencyConfig = {
  requiredSignatures: 3,
  maxPauseDuration: 86400, // 24 hours
  autoResumeEnabled: true,
  notificationThreshold: 5,
  gasOptimizationLevel: 2,
  governanceMembers: [],
  criticalContracts: [],
  pauseLevels: {
    [PauseLevel.NONE]: {
      requiredSignatures: 0,
      maxDuration: 0,
      autoResumeEnabled: false
    },
    [PauseLevel.SELECTIVE]: {
      requiredSignatures: 2,
      maxDuration: 3600, // 1 hour
      autoResumeEnabled: true
    },
    [PauseLevel.PARTIAL]: {
      requiredSignatures: 3,
      maxDuration: 7200, // 2 hours
      autoResumeEnabled: true
    },
    [PauseLevel.FULL]: {
      requiredSignatures: 5,
      maxDuration: 86400, // 24 hours
      autoResumeEnabled: true
    }
  }
};

/**
 * @dev Gas optimization constants
 */
export const GAS_CONSTANTS = {
  BASE_PAUSE_COST: 50000,
  BASE_RESUME_COST: 45000,
  SIGNATURE_VERIFICATION_COST: 3000,
  CONTRACT_UPDATE_COST: 10000,
  NOTIFICATION_COST: 15000,
  STORAGE_WRITE_COST: 5000,
  EVENT_EMIT_COST: 3000
};

/**
 * @dev Time constants
 */
export const TIME_CONSTANTS = {
  SECOND: 1,
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800
};

/**
 * @dev Validation constants
 */
export const VALIDATION_CONSTANTS = {
  MAX_REASON_LENGTH: 500,
  MAX_SIGNATURES: 10,
  MIN_SIGNATURES: 1,
  MAX_GOVERNANCE_MEMBERS: 20,
  MIN_GOVERNANCE_MEMBERS: 3
};
