import { 
  PauseLevel, 
  PauseStatus, 
  PauseEvent, 
  EmergencyConfig,
  GovernanceAction,
  ContractPauseState,
  MultiSignatureData,
  PauseAnalytics,
  NotificationData,
  EmergencyMetrics,
  ValidationResult,
  DEFAULT_EMERGENCY_CONFIG,
  GAS_CONSTANTS,
  TIME_CONSTANTS,
  VALIDATION_CONSTANTS
} from '../structures/PauseStructure';
import { EmergencyPauseError } from '../interfaces/IEmergencyPause';

/**
 * @title EmergencyLib
 * @dev Core library for emergency pause operations and utilities
 */
export class EmergencyLib {
  /**
   * @dev Validates pause request parameters
   */
  static validatePauseRequest(
    level: PauseLevel,
    reason: string,
    duration: number,
    affectedContracts: string[],
    config: EmergencyConfig
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let gasEstimate = 0;

    // Validate pause level
    if (level === PauseLevel.NONE) {
      errors.push('Invalid pause level: NONE');
    }

    // Validate reason
    if (!reason || reason.trim().length === 0) {
      errors.push('Pause reason cannot be empty');
    } else if (reason.length > VALIDATION_CONSTANTS.MAX_REASON_LENGTH) {
      errors.push(`Reason exceeds maximum length of ${VALIDATION_CONSTANTS.MAX_REASON_LENGTH}`);
    }

    // Validate duration
    const levelConfig = config.pauseLevels[level];
    if (duration > levelConfig.maxDuration) {
      errors.push(`Duration exceeds maximum for level ${level}: ${levelConfig.maxDuration} seconds`);
    }
    if (duration < 0) {
      errors.push('Duration cannot be negative');
    }

    // Validate affected contracts
    if (level === PauseLevel.SELECTIVE && affectedContracts.length === 0) {
      errors.push('Selective pause requires at least one affected contract');
    }

    // Validate contract addresses format
    for (const contract of affectedContracts) {
      if (!this.isValidAddress(contract)) {
        errors.push(`Invalid contract address: ${contract}`);
      }
    }

    // Calculate gas estimate
    gasEstimate = this.estimatePauseGas(level, affectedContracts.length, config);

    // Add warnings
    if (duration === 0) {
      warnings.push('Indefinite pause - ensure manual resume process is clear');
    }

    if (level === PauseLevel.FULL) {
      warnings.push('Full pause will halt all platform operations');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      gasEstimate
    };
  }

  /**
   * @dev Validates resume request parameters
   */
  static validateResumeRequest(
    level: PauseLevel,
    signatures: string[],
    currentStatus: PauseStatus,
    config: EmergencyConfig
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let gasEstimate = 0;

    // Validate pause is active
    if (!currentStatus.isActive) {
      errors.push('No active pause to resume');
    }

    // Validate pause level
    if (currentStatus.level !== level) {
      errors.push(`Resume level mismatch. Current: ${currentStatus.level}, Requested: ${level}`);
    }

    // Validate signatures
    const levelConfig = config.pauseLevels[level];
    if (signatures.length < levelConfig.requiredSignatures) {
      errors.push(`Insufficient signatures. Required: ${levelConfig.requiredSignatures}, Provided: ${signatures.length}`);
    }

    // Validate signature format
    for (const signature of signatures) {
      if (!this.isValidSignature(signature)) {
        errors.push(`Invalid signature format: ${signature}`);
      }
    }

    // Calculate gas estimate
    gasEstimate = this.estimateResumeGas(level, signatures.length, config);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      gasEstimate
    };
  }

  /**
   * @dev Validates governance action
   */
  static validateGovernanceAction(
    action: GovernanceAction,
    signatures: string[],
    config: EmergencyConfig
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let gasEstimate = 0;

    // Validate signatures
    if (signatures.length < config.requiredSignatures) {
      errors.push(`Insufficient signatures. Required: ${config.requiredSignatures}, Provided: ${signatures.length}`);
    }

    // Validate signature format
    for (const signature of signatures) {
      if (!this.isValidSignature(signature)) {
        errors.push(`Invalid signature format: ${signature}`);
      }
    }

    // Calculate gas estimate
    gasEstimate = this.estimateGovernanceGas(action, signatures.length, config);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      gasEstimate
    };
  }

  /**
   * @dev Creates pause status object
   */
  static createPauseStatus(
    level: PauseLevel,
    reason: string,
    duration: number,
    initiator: string,
    affectedContracts: string[],
    config: EmergencyConfig
  ): PauseStatus {
    const now = Math.floor(Date.now() / 1000);
    const levelConfig = config.pauseLevels[level];
    
    return {
      level,
      isActive: true,
      startTime: now,
      duration,
      reason,
      initiator,
      affectedContracts,
      autoResumeTime: levelConfig.autoResumeEnabled && duration > 0 ? now + duration : 0,
      lastUpdateTime: now
    };
  }

  /**
   * @dev Creates pause event for analytics
   */
  static createPauseEvent(
    status: PauseStatus,
    id: string,
    gasUsed: number
  ): PauseEvent {
    return {
      id,
      level: status.level,
      startTime: status.startTime,
      reason: status.reason,
      initiator: status.initiator,
      affectedContracts: status.affectedContracts,
      resumeSignatures: [],
      autoResumed: false,
      gasUsed
    };
  }

  /**
   * @dev Updates pause event with resume data
   */
  static updatePauseEventWithResume(
    event: PauseEvent,
    signatures: string[],
    autoResumed: boolean,
    gasUsed: number
  ): PauseEvent {
    const now = Math.floor(Date.now() / 1000);
    
    return {
      ...event,
      endTime: now,
      duration: now - event.startTime,
      resumeSignatures: signatures,
      autoResumed,
      gasUsed: event.gasUsed + gasUsed
    };
  }

  /**
   * @dev Creates notification data
   */
  static createNotificationData(
    type: NotificationData['type'],
    level: PauseLevel,
    message: string,
    affectedContracts: string[],
    initiator: string,
    additionalData?: Record<string, any>
  ): NotificationData {
    return {
      type,
      level,
      timestamp: Math.floor(Date.now() / 1000),
      message,
      affectedContracts,
      initiator,
      additionalData
    };
  }

  /**
   * @dev Calculates pause analytics
   */
  static calculateAnalytics(events: PauseEvent[]): PauseAnalytics {
    if (events.length === 0) {
      return {
        totalPauses: 0,
        totalDuration: 0,
        averageDuration: 0,
        pauseFrequency: 0,
        lastPauseTime: 0,
        pauseByLevel: {
          [PauseLevel.NONE]: 0,
          [PauseLevel.SELECTIVE]: 0,
          [PauseLevel.PARTIAL]: 0,
          [PauseLevel.FULL]: 0
        },
        pauseByReason: {},
        gasUsage: {
          total: 0,
          average: 0,
          byAction: {}
        },
        governanceActivity: {
          totalProposals: 0,
          executedProposals: 0,
          averageExecutionTime: 0
        }
      };
    }

    const completedEvents = events.filter(e => e.endTime !== undefined);
    const totalDuration = completedEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalGas = events.reduce((sum, e) => sum + e.gasUsed, 0);
    const lastPauseTime = Math.max(...events.map(e => e.startTime));

    // Calculate pause by level
    const pauseByLevel = {
      [PauseLevel.NONE]: 0,
      [PauseLevel.SELECTIVE]: 0,
      [PauseLevel.PARTIAL]: 0,
      [PauseLevel.FULL]: 0
    };

    // Calculate pause by reason
    const pauseByReason: Record<string, number> = {};

    // Calculate gas usage by action
    const gasUsageByAction: Record<string, number> = {};

    for (const event of events) {
      pauseByLevel[event.level]++;
      pauseByReason[event.reason] = (pauseByReason[event.reason] || 0) + 1;
      gasUsageByAction[event.autoResumed ? 'AUTO_RESUME' : 'MANUAL_RESUME'] = 
        (gasUsageByAction[event.autoResumed ? 'AUTO_RESUME' : 'MANUAL_RESUME'] || 0) + event.gasUsed;
    }

    // Calculate frequency (pauses per day)
    const timeSpan = events.length > 1 ? 
      (Math.max(...events.map(e => e.startTime)) - Math.min(...events.map(e => e.startTime))) / TIME_CONSTANTS.DAY :
      1;
    const pauseFrequency = events.length / Math.max(timeSpan, 1);

    return {
      totalPauses: events.length,
      totalDuration,
      averageDuration: completedEvents.length > 0 ? totalDuration / completedEvents.length : 0,
      pauseFrequency,
      lastPauseTime,
      pauseByLevel,
      pauseByReason,
      gasUsage: {
        total: totalGas,
        average: totalGas / events.length,
        byAction: gasUsageByAction
      },
      governanceActivity: {
        totalProposals: 0, // Would be populated from governance data
        executedProposals: 0,
        averageExecutionTime: 0
      }
    };
  }

  /**
   * @dev Checks if auto-resume conditions are met
   */
  static shouldAutoResume(status: PauseStatus, config: EmergencyConfig): boolean {
    if (!status.isActive) return false;
    
    const levelConfig = config.pauseLevels[status.level];
    if (!levelConfig.autoResumeEnabled) return false;
    
    if (status.autoResumeTime === 0) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return now >= status.autoResumeTime;
  }

  /**
   * @dev Estimates gas cost for pause operation
   */
  static estimatePauseGas(
    level: PauseLevel,
    contractCount: number,
    config: EmergencyConfig
  ): number {
    let gasCost = GAS_CONSTANTS.BASE_PAUSE_COST;
    
    // Add cost for contract updates
    gasCost += contractCount * GAS_CONSTANTS.CONTRACT_UPDATE_COST;
    
    // Add cost for signature verification
    gasCost += config.pauseLevels[level].requiredSignatures * GAS_CONSTANTS.SIGNATURE_VERIFICATION_COST;
    
    // Add cost for notifications
    gasCost += GAS_CONSTANTS.NOTIFICATION_COST;
    
    // Add storage costs
    gasCost += GAS_CONSTANTS.STORAGE_WRITE_COST * 3; // Status, event, analytics
    
    // Add event emission cost
    gasCost += GAS_CONSTANTS.EVENT_EMIT_COST * 2; // Pause event, notification event
    
    return gasCost;
  }

  /**
   * @dev Estimates gas cost for resume operation
   */
  static estimateResumeGas(
    level: PauseLevel,
    signatureCount: number,
    config: EmergencyConfig
  ): number {
    let gasCost = GAS_CONSTANTS.BASE_RESUME_COST;
    
    // Add cost for signature verification
    gasCost += signatureCount * GAS_CONSTANTS.SIGNATURE_VERIFICATION_COST;
    
    // Add cost for contract updates
    gasCost += config.pauseLevels[level].requiredSignatures * GAS_CONSTANTS.CONTRACT_UPDATE_COST;
    
    // Add cost for notifications
    gasCost += GAS_CONSTANTS.NOTIFICATION_COST;
    
    // Add storage costs
    gasCost += GAS_CONSTANTS.STORAGE_WRITE_COST * 2; // Status update, event update
    
    // Add event emission cost
    gasCost += GAS_CONSTANTS.EVENT_EMIT_COST * 2; // Resume event, notification event
    
    return gasCost;
  }

  /**
   * @dev Estimates gas cost for governance operation
   */
  static estimateGovernanceGas(
    action: GovernanceAction,
    signatureCount: number,
    config: EmergencyConfig
  ): number {
    let gasCost = GAS_CONSTANTS.BASE_RESUME_COST; // Base governance cost
    
    // Add cost for signature verification
    gasCost += signatureCount * GAS_CONSTANTS.SIGNATURE_VERIFICATION_COST;
    
    // Add action-specific costs
    switch (action) {
      case GovernanceAction.ADD_MEMBER:
      case GovernanceAction.REMOVE_MEMBER:
        gasCost += GAS_CONSTANTS.STORAGE_WRITE_COST * 2;
        break;
      case GovernanceAction.UPDATE_CONFIG:
        gasCost += GAS_CONSTANTS.STORAGE_WRITE_COST * 3;
        break;
      case GovernanceAction.EMERGENCY_PAUSE:
      case GovernanceAction.EMERGENCY_RESUME:
        gasCost += GAS_CONSTANTS.BASE_PAUSE_COST;
        break;
      case GovernanceAction.TRIGGER_AUTO_RESUME:
        gasCost += GAS_CONSTANTS.BASE_RESUME_COST;
        break;
    }
    
    // Add event emission cost
    gasCost += GAS_CONSTANTS.EVENT_EMIT_COST;
    
    return gasCost;
  }

  /**
   * @dev Validates address format
   */
  static isValidAddress(address: string): boolean {
    // Basic address validation - adjust based on your blockchain requirements
    return typeof address === 'string' && 
           address.length > 0 && 
           address.length <= 42 &&
           /^0x[a-fA-F0-9]+$/.test(address);
  }

  /**
   * @dev Validates signature format
   */
  static isValidSignature(signature: string): boolean {
    // Basic signature validation - adjust based on your signature scheme
    return typeof signature === 'string' && 
           signature.length > 0 && 
           signature.length <= 132;
  }

  /**
   * @dev Generates pause event ID
   */
  static generatePauseEventId(level: PauseLevel, initiator: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).substring(2, 8);
    return `pause_${level}_${initiator}_${timestamp}_${random}`;
  }

  /**
   * @dev Formats duration for display
   */
  static formatDuration(seconds: number): string {
    if (seconds < TIME_CONSTANTS.MINUTE) {
      return `${seconds} seconds`;
    } else if (seconds < TIME_CONSTANTS.HOUR) {
      return `${Math.floor(seconds / TIME_CONSTANTS.MINUTE)} minutes`;
    } else if (seconds < TIME_CONSTANTS.DAY) {
      return `${Math.floor(seconds / TIME_CONSTANTS.HOUR)} hours`;
    } else {
      return `${Math.floor(seconds / TIME_CONSTANTS.DAY)} days`;
    }
  }

  /**
   * @dev Calculates emergency response metrics
   */
  static calculateEmergencyMetrics(
    pauseEvents: PauseEvent[],
    notifications: NotificationData[]
  ): EmergencyMetrics {
    if (pauseEvents.length === 0) {
      return {
        responseTime: 0,
        haltTime: 0,
        resumeTime: 0,
        notificationTime: 0,
        gasEfficiency: 0,
        successRate: 0
      };
    }

    // Calculate average response time (time from threat detection to pause initiation)
    // This would typically come from external monitoring data
    const responseTime = 5000; // 5 seconds target

    // Calculate average halt time (time to halt operations)
    const haltTime = 10000; // 10 seconds target

    // Calculate average resume time
    const completedEvents = pauseEvents.filter(e => e.endTime !== undefined);
    const resumeTime = completedEvents.length > 0 ?
      completedEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / completedEvents.length :
      0;

    // Calculate notification time
    const notificationTime = notifications.length > 0 ?
      notifications.reduce((sum, n) => sum + (n.timestamp - pauseEvents[0].startTime), 0) / notifications.length :
      0;

    // Calculate gas efficiency
    const totalGas = pauseEvents.reduce((sum, e) => sum + e.gasUsed, 0);
    const gasEfficiency = totalGas / pauseEvents.length;

    // Calculate success rate (successful resumes / total pauses)
    const successRate = completedEvents.length / pauseEvents.length;

    return {
      responseTime,
      haltTime,
      resumeTime,
      notificationTime,
      gasEfficiency,
      successRate
    };
  }
}
