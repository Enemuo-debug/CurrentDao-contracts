import { 
  PauseLevel, 
  PauseStatus, 
  PauseEvent, 
  EmergencyConfig,
  GovernanceAction,
  ContractPauseState,
  PauseAnalytics,
  NotificationData,
  EmergencyMetrics,
  DEFAULT_EMERGENCY_CONFIG
} from './structures/PauseStructure';
import { IEmergencyPause, EmergencyPauseError, EmergencyPauseEvents } from './interfaces/IEmergencyPause';
import { EmergencyLib } from './libraries/EmergencyLib';
import { EmergencyGovernance } from './governance/EmergencyGovernance';

/**
 * @title EmergencyPause
 * @dev Main emergency pause contract providing rapid security response
 */
export class EmergencyPause implements IEmergencyPause {
  private config: EmergencyConfig;
  private governance: EmergencyGovernance;
  private pauseStatus: PauseStatus;
  private pauseEvents: PauseEvent[] = [];
  private contractStates: Map<string, ContractPauseState> = new Map();
  private notifications: NotificationData[] = [];
  private eventHandlers: EmergencyPauseEvents;

  constructor(
    initialGovernanceMembers: string[],
    initialConfig?: Partial<EmergencyConfig>,
    eventHandlers?: EmergencyPauseEvents
  ) {
    // Initialize configuration
    this.config = {
      ...DEFAULT_EMERGENCY_CONFIG,
      ...initialConfig,
      governanceMembers: initialGovernanceMembers,
      pauseLevels: {
        ...DEFAULT_EMERGENCY_CONFIG.pauseLevels,
        ...(initialConfig?.pauseLevels || {})
      }
    };

    // Initialize governance
    this.governance = new EmergencyGovernance(
      initialGovernanceMembers,
      this.config.requiredSignatures
    );

    // Initialize pause status
    this.pauseStatus = {
      level: PauseLevel.NONE,
      isActive: false,
      startTime: 0,
      duration: 0,
      reason: '',
      initiator: '',
      affectedContracts: [],
      autoResumeTime: 0,
      lastUpdateTime: 0
    };

    // Initialize event handlers
    this.eventHandlers = eventHandlers || this.getDefaultEventHandlers();
  }

  /**
   * @dev Initiates emergency pause at specified level
   */
  public async emergencyPause(
    level: PauseLevel,
    reason: string,
    duration: number,
    affectedContracts: string[]
  ): Promise<void> {
    // Validate pause request
    const validation = EmergencyLib.validatePauseRequest(
      level,
      reason,
      duration,
      affectedContracts,
      this.config
    );

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if pause is already active
    if (this.pauseStatus.isActive) {
      throw new Error(EmergencyPauseError.EMERGENCY_ALREADY_ACTIVE);
    }

    // Create pause status
    this.pauseStatus = EmergencyLib.createPauseStatus(
      level,
      reason,
      duration,
      'system', // Would be actual caller in production
      affectedContracts,
      this.config
    );

    // Update contract states
    this.updateContractStates(level, affectedContracts, reason);

    // Create pause event
    const pauseEvent = EmergencyLib.createPauseEvent(
      this.pauseStatus,
      EmergencyLib.generatePauseEventId(level, 'system'),
      validation.gasEstimate
    );
    this.pauseEvents.push(pauseEvent);

    // Send notifications
    await this.emitPauseNotification(level, reason, affectedContracts);

    // Emit event
    if (this.eventHandlers.EmergencyPauseInitiated) {
      this.eventHandlers.EmergencyPauseInitiated({
        level,
        reason,
        timestamp: this.pauseStatus.startTime,
        initiator: this.pauseStatus.initiator,
        affectedContracts
      });
    }

    console.log(`Emergency pause initiated at level ${level} for ${duration} seconds`);
  }

  /**
   * @dev Resumes operations after emergency pause
   */
  public async resumeOperations(
    level: PauseLevel,
    signatures: string[],
    proof: string
  ): Promise<void> {
    // Validate resume request
    const validation = EmergencyLib.validateResumeRequest(
      level,
      signatures,
      this.pauseStatus,
      this.config
    );

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate governance approval
    const governanceValidation = this.governance.validateMultiSignature(
      {
        signatures,
        signers: signatures.map((_, i) => `signer_${i}`), // Would be actual signers
        threshold: this.config.pauseLevels[level].requiredSignatures,
        data: proof,
        hash: EmergencyLib.generatePauseEventId(level, 'resume')
      },
      GovernanceAction.EMERGENCY_RESUME,
      this.config
    );

    if (!governanceValidation.isValid) {
      throw new Error(`Governance validation failed: ${governanceValidation.errors.join(', ')}`);
    }

    // Update pause status
    this.pauseStatus.isActive = false;
    this.pauseStatus.lastUpdateTime = Math.floor(Date.now() / 1000);

    // Update contract states
    this.resumeContractStates(level);

    // Update pause event
    const lastEvent = this.pauseEvents[this.pauseEvents.length - 1];
    if (lastEvent && !lastEvent.endTime) {
      const updatedEvent = EmergencyLib.updatePauseEventWithResume(
        lastEvent,
        signatures,
        false,
        validation.gasEstimate
      );
      this.pauseEvents[this.pauseEvents.length - 1] = updatedEvent;
    }

    // Send notifications
    const notification = EmergencyLib.createNotificationData(
      'EMERGENCY_RESUME',
      level,
      `Operations resumed at level ${level}`,
      this.pauseStatus.affectedContracts,
      'system'
    );
    this.notifications.push(notification);

    // Emit event
    if (this.eventHandlers.EmergencyPauseResumed) {
      this.eventHandlers.EmergencyPauseResumed({
        level,
        timestamp: this.pauseStatus.lastUpdateTime,
        resumedBy: 'system',
        signatures
      });
    }

    console.log(`Emergency operations resumed at level ${level}`);
  }

  /**
   * @dev Gets current pause status
   */
  public async getPauseStatus(): Promise<PauseStatus> {
    return { ...this.pauseStatus };
  }

  /**
   * @dev Gets pause configuration
   */
  public async getEmergencyConfig(): Promise<EmergencyConfig> {
    return { ...this.config };
  }

  /**
   * @dev Updates emergency configuration
   */
  public async updateEmergencyConfig(
    config: EmergencyConfig,
    signatures: string[]
  ): Promise<void> {
    // Validate governance approval
    const validation = this.governance.validateMultiSignature(
      {
        signatures,
        signers: signatures.map((_, i) => `signer_${i}`),
        threshold: this.config.requiredSignatures + 1,
        data: JSON.stringify(config),
        hash: EmergencyLib.generatePauseEventId(PauseLevel.NONE, 'config_update')
      },
      GovernanceAction.UPDATE_CONFIG,
      this.config
    );

    if (!validation.isValid) {
      throw new Error(`Governance validation failed: ${validation.errors.join(', ')}`);
    }

    // Update configuration
    const oldConfig = { ...this.config };
    this.config = { ...config };

    // Update governance if members changed
    if (config.governanceMembers !== oldConfig.governanceMembers) {
      this.governance = new EmergencyGovernance(
        config.governanceMembers,
        config.requiredSignatures
      );
    }

    // Emit event
    if (this.eventHandlers.EmergencyConfigUpdated) {
      this.eventHandlers.EmergencyConfigUpdated({
        oldConfig,
        newConfig: config,
        timestamp: Math.floor(Date.now() / 1000),
        updatedBy: 'system'
      });
    }

    console.log('Emergency configuration updated');
  }

  /**
   * @dev Gets pause analytics
   */
  public async getPauseAnalytics(): Promise<{
    totalPauses: number;
    averageDuration: number;
    pauseFrequency: number;
    lastPauseTime: number;
    pauseHistory: PauseEvent[];
  }> {
    const analytics = EmergencyLib.calculateAnalytics(this.pauseEvents);
    
    return {
      totalPauses: analytics.totalPauses,
      averageDuration: analytics.averageDuration,
      pauseFrequency: analytics.pauseFrequency,
      lastPauseTime: analytics.lastPauseTime,
      pauseHistory: this.pauseEvents
    };
  }

  /**
   * @dev Checks if specific contract is paused
   */
  public async isContractPaused(contractAddress: string): Promise<boolean> {
    const state = this.contractStates.get(contractAddress.toLowerCase());
    return state ? state.isPaused : false;
  }

  /**
   * @dev Gets affected contracts for specific pause level
   */
  public async getAffectedContracts(level: PauseLevel): Promise<string[]> {
    if (level === PauseLevel.NONE) {
      return [];
    }

    switch (level) {
      case PauseLevel.SELECTIVE:
        return this.pauseStatus.affectedContracts;
      case PauseLevel.PARTIAL:
        return this.config.criticalContracts;
      case PauseLevel.FULL:
        return Array.from(this.contractStates.keys());
      default:
        return [];
    }
  }

  /**
   * @dev Triggers auto-resume if conditions met
   */
  public async triggerAutoResume(): Promise<void> {
    if (!EmergencyLib.shouldAutoResume(this.pauseStatus, this.config)) {
      throw new Error(EmergencyPauseError.AUTO_RESUME_CONDITIONS_NOT_MET);
    }

    const level = this.pauseStatus.level;
    
    // Update pause status
    this.pauseStatus.isActive = false;
    this.pauseStatus.lastUpdateTime = Math.floor(Date.now() / 1000);

    // Update contract states
    this.resumeContractStates(level);

    // Update pause event
    const lastEvent = this.pauseEvents[this.pauseEvents.length - 1];
    if (lastEvent && !lastEvent.endTime) {
      const updatedEvent = EmergencyLib.updatePauseEventWithResume(
        lastEvent,
        [], // No signatures for auto-resume
        true,
        0 // Minimal gas for auto-resume
      );
      this.pauseEvents[this.pauseEvents.length - 1] = updatedEvent;
    }

    // Send notifications
    const notification = EmergencyLib.createNotificationData(
      'AUTO_RESUME',
      level,
      `Auto-resume triggered at level ${level}`,
      this.pauseStatus.affectedContracts,
      'system'
    );
    this.notifications.push(notification);

    // Emit event
    if (this.eventHandlers.AutoResumeTriggered) {
      this.eventHandlers.AutoResumeTriggered({
        level,
        timestamp: this.pauseStatus.lastUpdateTime,
        reason: 'Auto-resume conditions met'
      });
    }

    console.log(`Auto-resume triggered at level ${level}`);
  }

  /**
   * @dev Adds governance member
   */
  public async addGovernanceMember(
    memberAddress: string,
    signatures: string[]
  ): Promise<void> {
    const proposal = this.governance.createProposal(
      GovernanceAction.ADD_MEMBER,
      'system',
      undefined,
      undefined,
      memberAddress
    );

    // Add signatures
    for (let i = 0; i < signatures.length; i++) {
      this.governance.signProposal(proposal.id, `signer_${i}`, signatures[i]);
    }

    console.log(`Governance member added: ${memberAddress}`);
  }

  /**
   * @dev Removes governance member
   */
  public async removeGovernanceMember(
    memberAddress: string,
    signatures: string[]
  ): Promise<void> {
    const proposal = this.governance.createProposal(
      GovernanceAction.REMOVE_MEMBER,
      'system',
      undefined,
      undefined,
      memberAddress
    );

    // Add signatures
    for (let i = 0; i < signatures.length; i++) {
      this.governance.signProposal(proposal.id, `signer_${i}`, signatures[i]);
    }

    console.log(`Governance member removed: ${memberAddress}`);
  }

  /**
   * @dev Validates governance action
   */
  public async validateGovernanceAction(
    action: GovernanceAction,
    signatures: string[]
  ): Promise<boolean> {
    const validation = this.governance.validateMultiSignature(
      {
        signatures,
        signers: signatures.map((_, i) => `signer_${i}`),
        threshold: this.config.requiredSignatures,
        data: action.toString(),
        hash: EmergencyLib.generatePauseEventId(PauseLevel.NONE, 'validation')
      },
      action,
      this.config
    );

    return validation.isValid;
  }

  /**
   * @dev Emits pause notification
   */
  public async emitPauseNotification(
    level: PauseLevel,
    reason: string,
    affectedContracts: string[]
  ): Promise<void> {
    const notification = EmergencyLib.createNotificationData(
      'EMERGENCY_PAUSE',
      level,
      `Emergency pause initiated: ${reason}`,
      affectedContracts,
      'system'
    );
    this.notifications.push(notification);

    console.log(`Pause notification sent for level ${level}`);
  }

  /**
   * @dev Gets gas optimization data
   */
  public async getGasOptimizationData(): Promise<{
    pauseGasCost: number;
    resumeGasCost: number;
    notificationGasCost: number;
  }> {
    return {
      pauseGasCost: EmergencyLib.estimatePauseGas(
        PauseLevel.FULL,
        this.config.criticalContracts.length,
        this.config
      ),
      resumeGasCost: EmergencyLib.estimateResumeGas(
        PauseLevel.FULL,
        this.config.requiredSignatures,
        this.config
      ),
      notificationGasCost: 15000 // Base notification cost
    };
  }

  /**
   * @dev Updates contract states based on pause level
   */
  private updateContractStates(
    level: PauseLevel,
    affectedContracts: string[],
    reason: string
  ): void {
    const now = Math.floor(Date.now() / 1000);

    switch (level) {
      case PauseLevel.SELECTIVE:
        for (const contract of affectedContracts) {
          this.contractStates.set(contract.toLowerCase(), {
            contractAddress: contract,
            isPaused: true,
            pauseLevel: level,
            pauseTime: now,
            expectedResumeTime: this.pauseStatus.autoResumeTime,
            pauseReason: reason,
            functionsPaused: ['all']
          });
        }
        break;

      case PauseLevel.PARTIAL:
        for (const contract of this.config.criticalContracts) {
          this.contractStates.set(contract.toLowerCase(), {
            contractAddress: contract,
            isPaused: true,
            pauseLevel: level,
            pauseTime: now,
            expectedResumeTime: this.pauseStatus.autoResumeTime,
            pauseReason: reason,
            functionsPaused: ['critical']
          });
        }
        break;

      case PauseLevel.FULL:
        // Pause all known contracts
        for (const contract of this.contractStates.keys()) {
          this.contractStates.set(contract, {
            contractAddress: contract,
            isPaused: true,
            pauseLevel: level,
            pauseTime: now,
            expectedResumeTime: this.pauseStatus.autoResumeTime,
            pauseReason: reason,
            functionsPaused: ['all']
          });
        }
        break;
    }
  }

  /**
   * @dev Resumes contract states
   */
  private resumeContractStates(level: PauseLevel): void {
    for (const [address, state] of this.contractStates.entries()) {
      if (state.pauseLevel === level || level === PauseLevel.FULL) {
        this.contractStates.set(address, {
          ...state,
          isPaused: false,
          functionsPaused: []
        });
      }
    }
  }

  /**
   * @dev Gets default event handlers
   */
  private getDefaultEventHandlers(): EmergencyPauseEvents {
    return {
      EmergencyPauseInitiated: (event) => {
        console.log(`Emergency pause initiated: ${JSON.stringify(event)}`);
      },
      EmergencyPauseResumed: (event) => {
        console.log(`Emergency pause resumed: ${JSON.stringify(event)}`);
      },
      GovernanceActionExecuted: (event) => {
        console.log(`Governance action executed: ${JSON.stringify(event)}`);
      },
      AutoResumeTriggered: (event) => {
        console.log(`Auto-resume triggered: ${JSON.stringify(event)}`);
      },
      EmergencyConfigUpdated: (event) => {
        console.log(`Emergency config updated: ${JSON.stringify(event)}`);
      }
    };
  }

  /**
   * @dev Gets emergency metrics
   */
  public getEmergencyMetrics(): EmergencyMetrics {
    return EmergencyLib.calculateEmergencyMetrics(this.pauseEvents, this.notifications);
  }

  /**
   * @dev Gets contract pause state
   */
  public getContractPauseState(contractAddress: string): ContractPauseState | undefined {
    return this.contractStates.get(contractAddress.toLowerCase());
  }

  /**
   * @dev Gets all notifications
   */
  public getNotifications(): NotificationData[] {
    return [...this.notifications];
  }

  /**
   * @dev Gets governance statistics
   */
  public getGovernanceStats() {
    return this.governance.getGovernanceStats();
  }

  /**
   * @dev Checks if auto-resume should be triggered
   */
  public shouldAutoResume(): boolean {
    return EmergencyLib.shouldAutoResume(this.pauseStatus, this.config);
  }
}
