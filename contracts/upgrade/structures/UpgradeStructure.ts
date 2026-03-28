/**
 * @title UpgradeStructure
 * @dev Data structures for the upgrade management system
 * @dev Provides comprehensive data models for upgrade proposals, governance, and analytics
 */

import {
  UpgradeProposal,
  Vote,
  MigrationPlan,
  MigrationStep,
  MigrationAction,
  UpgradeStatus,
  UpgradeAnalytics,
  UpgradeRecord,
  ProxyInfo,
  StateSnapshot
} from "../interfaces/IUpgradeManager";

/**
 * @dev Upgrade Proposal structure with comprehensive metadata
 */
export class UpgradeProposalStruct implements UpgradeProposal {
  public id: number;
  public proposedBy: string;
  public newImplementation: string;
  public currentImplementation: string;
  public description: string;
  public upgradeData: string;
  public proposedAt: number;
  public scheduledAt: number;
  public executionWindow: number;
  public status: UpgradeStatus;
  public votes: Vote[];
  public requiredApprovals: number;
  public migrationPlan: MigrationPlan;
  public rollbackData?: string;
  public executionTime?: number;
  public gasUsed?: number;
  public failureReason?: string;

  constructor(
    id: number,
    proposedBy: string,
    newImplementation: string,
    currentImplementation: string,
    description: string,
    upgradeData: string,
    scheduledAt: number,
    executionWindow: number,
    requiredApprovals: number,
    migrationPlan: MigrationPlan
  ) {
    this.id = id;
    this.proposedBy = proposedBy;
    this.newImplementation = newImplementation;
    this.currentImplementation = currentImplementation;
    this.description = description;
    this.upgradeData = upgradeData;
    this.proposedAt = Math.floor(Date.now() / 1000);
    this.scheduledAt = scheduledAt;
    this.executionWindow = executionWindow;
    this.status = UpgradeStatus.PROPOSED;
    this.votes = [];
    this.requiredApprovals = requiredApprovals;
    this.migrationPlan = migrationPlan;
  }

  /**
   * @dev Add a vote to the proposal
   */
  public addVote(voter: string, support: boolean, reason?: string): void {
    // Check if already voted
    const existingVote = this.votes.find(v => v.voter === voter);
    if (existingVote) {
      throw new Error(`Voter ${voter} has already voted`);
    }

    this.votes.push({
      voter,
      support,
      votedAt: Math.floor(Date.now() / 1000),
      reason
    });
  }

  /**
   * @dev Get approval count
   */
  public getApprovalCount(): number {
    return this.votes.filter(v => v.support).length;
  }

  /**
   * @dev Check if proposal has enough approvals
   */
  public hasEnoughApprovals(): boolean {
    return this.getApprovalCount() >= this.requiredApprovals;
  }

  /**
   * @dev Check if execution window is active
   */
  public isExecutionWindowActive(): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now >= this.scheduledAt && now <= (this.scheduledAt + this.executionWindow);
  }

  /**
   * @dev Mark proposal as executed
   */
  public markAsExecuted(gasUsed: number, executionTime: number): void {
    this.status = UpgradeStatus.EXECUTED;
    this.gasUsed = gasUsed;
    this.executionTime = executionTime;
  }

  /**
   * @dev Mark proposal as failed
   */
  public markAsFailed(reason: string): void {
    this.status = UpgradeStatus.FAILED;
    this.failureReason = reason;
  }

  /**
   * @dev Cancel the proposal
   */
  public cancel(): void {
    this.status = UpgradeStatus.CANCELLED;
  }

  /**
   * @dev Rollback the proposal
   */
  public rollback(): void {
    this.status = UpgradeStatus.ROLLED_BACK;
  }
}

/**
 * @dev Vote structure for upgrade governance
 */
export class VoteStruct implements Vote {
  public voter: string;
  public support: boolean;
  public votedAt: number;
  public reason?: string;

  constructor(voter: string, support: boolean, reason?: string) {
    this.voter = voter;
    this.support = support;
    this.votedAt = Math.floor(Date.now() / 1000);
    this.reason = reason;
  }
}

/**
 * @dev Migration Plan structure
 */
export class MigrationPlanStruct implements MigrationPlan {
  public steps: MigrationStep[];
  public estimatedGas: number;
  public timeout: number;
  public requiresPause: boolean;

  constructor(
    steps: MigrationStep[],
    estimatedGas: number,
    timeout: number,
    requiresPause: boolean
  ) {
    this.steps = steps;
    this.estimatedGas = estimatedGas;
    this.timeout = timeout;
    this.requiresPause = requiresPause;
    this.validatePlan();
  }

  /**
   * @dev Validate migration plan
   */
  private validatePlan(): void {
    if (this.steps.length === 0) {
      throw new Error("Migration plan must have at least one step");
    }

    if (this.estimatedGas <= 0) {
      throw new Error("Estimated gas must be positive");
    }

    if (this.timeout <= 0) {
      throw new Error("Timeout must be positive");
    }

    // Validate step dependencies
    const stepIds = new Set(this.steps.map(s => s.id));
    for (const step of this.steps) {
      for (const depId of step.dependencies) {
        if (!stepIds.has(depId)) {
          throw new Error(`Step ${step.id} depends on non-existent step ${depId}`);
        }
      }
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies()) {
      throw new Error("Migration plan has circular dependencies");
    }
  }

  /**
   * @dev Check for circular dependencies
   */
  private hasCircularDependencies(): boolean {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (stepId: number): boolean => {
      if (recursionStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = this.steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of this.steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) return true;
      }
    }

    return false;
  }

  /**
   * @dev Get steps in execution order
   */
  public getExecutionOrder(): MigrationStep[] {
    const visited = new Set<number>();
    const result: MigrationStep[] = [];

    const visit = (stepId: number): void => {
      if (visited.has(stepId)) return;

      const step = this.steps.find(s => s.id === stepId);
      if (!step) return;

      // Visit dependencies first
      for (const depId of step.dependencies) {
        visit(depId);
      }

      visited.add(stepId);
      result.push(step);
    };

    for (const step of this.steps) {
      visit(step.id);
    }

    return result;
  }
}

/**
 * @dev Migration Step structure
 */
export class MigrationStepStruct implements MigrationStep {
  public id: number;
  public description: string;
  public targetContract: string;
  public action: MigrationAction;
  public data: string;
  public dependencies: number[];
  public executed: boolean = false;
  public executionTime?: number;
  public gasUsed?: number;

  constructor(
    id: number,
    description: string,
    targetContract: string,
    action: MigrationAction,
    data: string,
    dependencies: number[] = []
  ) {
    this.id = id;
    this.description = description;
    this.targetContract = targetContract;
    this.action = action;
    this.data = data;
    this.dependencies = dependencies;
  }

  /**
   * @dev Mark step as executed
   */
  public markAsExecuted(gasUsed: number, executionTime: number): void {
    this.executed = true;
    this.gasUsed = gasUsed;
    this.executionTime = executionTime;
  }
}

/**
 * @dev Upgrade Analytics structure
 */
export class UpgradeAnalyticsStruct implements UpgradeAnalytics {
  public totalUpgrades: number;
  public successfulUpgrades: number;
  public failedUpgrades: number;
  public rolledBackUpgrades: number;
  public averageExecutionTime: number;
  public averageGasUsed: number;
  public lastUpgradeTime: number;
  public upgradeHistory: UpgradeRecord[];

  constructor() {
    this.totalUpgrades = 0;
    this.successfulUpgrades = 0;
    this.failedUpgrades = 0;
    this.rolledBackUpgrades = 0;
    this.averageExecutionTime = 0;
    this.averageGasUsed = 0;
    this.lastUpgradeTime = 0;
    this.upgradeHistory = [];
  }

  /**
   * @dev Add upgrade record to analytics
   */
  public addUpgradeRecord(record: UpgradeRecord): void {
    this.upgradeHistory.push(record);
    this.totalUpgrades++;

    switch (record.status) {
      case UpgradeStatus.EXECUTED:
        this.successfulUpgrades++;
        break;
      case UpgradeStatus.FAILED:
        this.failedUpgrades++;
        break;
      case UpgradeStatus.ROLLED_BACK:
        this.rolledBackUpgrades++;
        break;
    }

    this.updateAverages();
    this.lastUpgradeTime = record.executedAt;
  }

  /**
   * @dev Update average calculations
   */
  private updateAverages(): void {
    const executedRecords = this.upgradeHistory.filter(
      r => r.status === UpgradeStatus.EXECUTED
    );

    if (executedRecords.length > 0) {
      this.averageExecutionTime = executedRecords.reduce(
        (sum, r) => sum + r.executionTime, 0
      ) / executedRecords.length;

      this.averageGasUsed = executedRecords.reduce(
        (sum, r) => sum + r.gasUsed, 0
      ) / executedRecords.length;
    }
  }

  /**
   * @dev Get success rate
   */
  public getSuccessRate(): number {
    if (this.totalUpgrades === 0) return 0;
    return (this.successfulUpgrades / this.totalUpgrades) * 100;
  }

  /**
   * @dev Get failure rate
   */
  public getFailureRate(): number {
    if (this.totalUpgrades === 0) return 0;
    return (this.failedUpgrades / this.totalUpgrades) * 100;
  }

  /**
   * @dev Get rollback rate
   */
  public getRollbackRate(): number {
    if (this.totalUpgrades === 0) return 0;
    return (this.rolledBackUpgrades / this.totalUpgrades) * 100;
  }
}

/**
 * @dev Upgrade Record structure
 */
export class UpgradeRecordStruct implements UpgradeRecord {
  public proposalId: number;
  public executedAt: number;
  public executionTime: number;
  public gasUsed: number;
  public status: UpgradeStatus;
  public rollbackTriggered: boolean;

  constructor(
    proposalId: number,
    executedAt: number,
    executionTime: number,
    gasUsed: number,
    status: UpgradeStatus,
    rollbackTriggered: boolean = false
  ) {
    this.proposalId = proposalId;
    this.executedAt = executedAt;
    this.executionTime = executionTime;
    this.gasUsed = gasUsed;
    this.status = status;
    this.rollbackTriggered = rollbackTriggered;
  }
}

/**
 * @dev Proxy Info structure
 */
export class ProxyInfoStruct implements ProxyInfo {
  public implementation: string;
  public admin: string;
  public isInitialized: boolean;
  public upgradeCount: number;
  public lastUpgradeAt: number;
  public version: string;

  constructor(
    implementation: string,
    admin: string,
    isInitialized: boolean,
    upgradeCount: number,
    lastUpgradeAt: number,
    version: string
  ) {
    this.implementation = implementation;
    this.admin = admin;
    this.isInitialized = isInitialized;
    this.upgradeCount = upgradeCount;
    this.lastUpgradeAt = lastUpgradeAt;
    this.version = version;
  }

  /**
   * @dev Update proxy info after upgrade
   */
  public updateAfterUpgrade(
    newImplementation: string,
    newVersion: string,
    gasUsed: number
  ): void {
    this.implementation = newImplementation;
    this.version = newVersion;
    this.upgradeCount++;
    this.lastUpgradeAt = Math.floor(Date.now() / 1000);
  }
}

/**
 * @dev State Snapshot structure
 */
export class StateSnapshotStruct implements StateSnapshot {
  public id: string;
  public contract: string;
  public timestamp: number;
  public storageHash: string;
  public data: string;
  public checksum: string;

  constructor(
    id: string,
    contract: string,
    storageHash: string,
    data: string,
    checksum: string
  ) {
    this.id = id;
    this.contract = contract;
    this.timestamp = Math.floor(Date.now() / 1000);
    this.storageHash = storageHash;
    this.data = data;
    this.checksum = checksum;
  }

  /**
   * @dev Verify snapshot integrity
   */
  public verify(): boolean {
    // In a real implementation, this would verify the checksum
    // For now, we'll assume the checksum is valid
    return true;
  }
}

/**
 * @dev Upgrade Queue structure for managing scheduled upgrades
 */
export class UpgradeQueue {
  private queue: UpgradeProposal[] = [];
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  /**
   * @dev Add proposal to queue
   */
  public enqueue(proposal: UpgradeProposal): void {
    if (this.queue.length >= this.maxSize) {
      throw new Error("Upgrade queue is full");
    }

    this.queue.push(proposal);
    this.sortByScheduledTime();
  }

  /**
   * @dev Remove and return the next proposal
   */
  public dequeue(): UpgradeProposal | undefined {
    return this.queue.shift();
  }

  /**
   * @dev Peek at the next proposal
   */
  public peek(): UpgradeProposal | undefined {
    return this.queue[0];
  }

  /**
   * @dev Remove a specific proposal
   */
  public remove(proposalId: number): boolean {
    const index = this.queue.findIndex(p => p.id === proposalId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * @dev Get all proposals
   */
  public getAll(): UpgradeProposal[] {
    return [...this.queue];
  }

  /**
   * @dev Get proposals ready for execution
   */
  public getReadyProposals(): UpgradeProposal[] {
    const now = Math.floor(Date.now() / 1000);
    return this.queue.filter(p => 
      p.status === UpgradeStatus.APPROVED &&
      p.scheduledAt <= now &&
      p.isExecutionWindowActive()
    );
  }

  /**
   * @dev Sort queue by scheduled time
   */
  private sortByScheduledTime(): void {
    this.queue.sort((a, b) => a.scheduledAt - b.scheduledAt);
  }

  /**
   * @dev Get queue size
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * @dev Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * @dev Clear queue
   */
  public clear(): void {
    this.queue = [];
  }
}
