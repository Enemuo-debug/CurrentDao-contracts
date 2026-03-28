import { 
  PauseLevel, 
  PauseStatus, 
  PauseEvent, 
  EmergencyConfig,
  GovernanceAction 
} from '../structures/PauseStructure';

/**
 * @title IEmergencyPause Interface
 * @dev Interface for emergency pause contract providing rapid security response
 */
export interface IEmergencyPause {
  /**
   * @dev Initiates emergency pause at specified level
   * @param level Pause level (FULL, PARTIAL, SELECTIVE)
   * @param reason Human-readable reason for pause
   * @param duration Duration in seconds (0 for indefinite)
   * @param affectedContracts Array of contract addresses to pause
   */
  emergencyPause(
    level: PauseLevel,
    reason: string,
    duration: number,
    affectedContracts: string[]
  ): Promise<void>;

  /**
   * @dev Resumes operations after emergency pause
   * @param level Pause level to resume
   * @param signatures Array of governance signatures
   * @param proof Multi-signature approval proof
   */
  resumeOperations(
    level: PauseLevel,
    signatures: string[],
    proof: string
  ): Promise<void>;

  /**
   * @dev Gets current pause status
   */
  getPauseStatus(): Promise<PauseStatus>;

  /**
   * @dev Gets pause configuration
   */
  getEmergencyConfig(): Promise<EmergencyConfig>;

  /**
   * @dev Updates emergency configuration
   * @param config New configuration
   * @param signatures Governance signatures
   */
  updateEmergencyConfig(
    config: EmergencyConfig,
    signatures: string[]
  ): Promise<void>;

  /**
   * @dev Gets pause analytics
   */
  getPauseAnalytics(): Promise<{
    totalPauses: number;
    averageDuration: number;
    pauseFrequency: number;
    lastPauseTime: number;
    pauseHistory: PauseEvent[];
  }>;

  /**
   * @dev Checks if specific contract is paused
   * @param contractAddress Contract address to check
   */
  isContractPaused(contractAddress: string): Promise<boolean>;

  /**
   * @dev Gets affected contracts for specific pause level
   * @param level Pause level
   */
  getAffectedContracts(level: PauseLevel): Promise<string[]>;

  /**
   * @dev Triggers auto-resume if conditions met
   */
  triggerAutoResume(): Promise<void>;

  /**
   * @dev Adds governance member
   * @param memberAddress New member address
   * @param signatures Current governance signatures
   */
  addGovernanceMember(
    memberAddress: string,
    signatures: string[]
  ): Promise<void>;

  /**
   * @dev Removes governance member
   * @param memberAddress Member address to remove
   * @param signatures Current governance signatures
   */
  removeGovernanceMember(
    memberAddress: string,
    signatures: string[]
  ): Promise<void>;

  /**
   * @dev Validates governance action
   * @param action Governance action to validate
   * @param signatures Action signatures
   */
  validateGovernanceAction(
    action: GovernanceAction,
    signatures: string[]
  ): Promise<boolean>;

  /**
   * @dev Emits pause notification
   * @param level Pause level
   * @param reason Pause reason
   * @param affectedContracts Affected contract addresses
   */
  emitPauseNotification(
    level: PauseLevel,
    reason: string,
    affectedContracts: string[]
  ): Promise<void>;

  /**
   * @dev Gets gas optimization data
   */
  getGasOptimizationData(): Promise<{
    pauseGasCost: number;
    resumeGasCost: number;
    notificationGasCost: number;
  }>;
}

/**
 * @dev Emergency pause events
 */
export interface EmergencyPauseEvents {
  EmergencyPauseInitiated: (event: {
    level: PauseLevel;
    reason: string;
    timestamp: number;
    initiator: string;
    affectedContracts: string[];
  }) => void;

  EmergencyPauseResumed: (event: {
    level: PauseLevel;
    timestamp: number;
    resumedBy: string;
    signatures: string[];
  }) => void;

  GovernanceActionExecuted: (event: {
    action: GovernanceAction;
    timestamp: number;
    executor: string;
    signatures: string[];
  }) => void;

  AutoResumeTriggered: (event: {
    level: PauseLevel;
    timestamp: number;
    reason: string;
  }) => void;

  EmergencyConfigUpdated: (event: {
    oldConfig: EmergencyConfig;
    newConfig: EmergencyConfig;
    timestamp: number;
    updatedBy: string;
  }) => void;
}

/**
 * @dev Emergency pause errors
 */
export enum EmergencyPauseError {
  INSUFFICIENT_SIGNATURES = "INSUFFICIENT_SIGNATURES",
  INVALID_PAUSE_LEVEL = "INVALID_PAUSE_LEVEL",
  CONTRACT_ALREADY_PAUSED = "CONTRACT_ALREADY_PAUSED",
  CONTRACT_NOT_PAUSED = "CONTRACT_NOT_PAUSED",
  UNAUTHORIZED_GOVERNANCE_ACTION = "UNAUTHORIZED_GOVERNANCE_ACTION",
  AUTO_RESUME_CONDITIONS_NOT_MET = "AUTO_RESUME_CONDITIONS_NOT_MET",
  PAUSE_DURATION_EXCEEDED = "PAUSE_DURATION_EXCEEDED",
  INVALID_GOVERNANCE_MEMBER = "INVALID_GOVERNANCE_MEMBER",
  EMERGENCY_ALREADY_ACTIVE = "EMERGENCY_ALREADY_ACTIVE",
  NO_EMERGENCY_ACTIVE = "NO_EMERGENCY_ACTIVE"
}
