/**
 * @title UpgradeLib
 * @dev Library for upgrade management operations
 * @dev Provides validation, security checks, and utility functions for upgrades
 */

import * as crypto from 'crypto';
import {
  UpgradeProposal,
  MigrationPlan,
  MigrationAction,
  UpgradeStatus,
  ERROR_MESSAGES,
  MIN_UPGRADE_DELAY,
  MAX_UPGRADE_DELAY,
  MIN_EXECUTION_WINDOW,
  MAX_EXECUTION_WINDOW
} from '../interfaces/IUpgradeManager';

/**
 * @dev Validation utilities for upgrade operations
 */
export class UpgradeValidator {
  /**
   * @dev Validate upgrade proposal parameters
   */
  public static validateProposal(
    newImplementation: string,
    description: string,
    scheduledAt: number,
    executionWindow: number,
    migrationPlan: MigrationPlan
  ): void {
    // Validate implementation address
    if (!this.isValidAddress(newImplementation)) {
      throw new Error(ERROR_MESSAGES.INVALID_IMPLEMENTATION);
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      throw new Error("Description cannot be empty");
    }

    if (description.length > 1000) {
      throw new Error("Description too long (max 1000 characters)");
    }

    // Validate scheduling
    const now = Math.floor(Date.now() / 1000);
    const minScheduledAt = now + MIN_UPGRADE_DELAY;
    const maxScheduledAt = now + MAX_UPGRADE_DELAY;

    if (scheduledAt < minScheduledAt) {
      throw new Error(`Upgrade must be scheduled at least ${MIN_UPGRADE_DELAY} seconds in the future`);
    }

    if (scheduledAt > maxScheduledAt) {
      throw new Error(`Upgrade cannot be scheduled more than ${MAX_UPGRADE_DELAY} seconds in the future`);
    }

    // Validate execution window
    if (executionWindow < MIN_EXECUTION_WINDOW) {
      throw new Error(`Execution window must be at least ${MIN_EXECUTION_WINDOW} seconds`);
    }

    if (executionWindow > MAX_EXECUTION_WINDOW) {
      throw new Error(`Execution window cannot exceed ${MAX_EXECUTION_WINDOW} seconds`);
    }

    // Validate migration plan
    this.validateMigrationPlan(migrationPlan);
  }

  /**
   * @dev Validate migration plan
   */
  public static validateMigrationPlan(plan: MigrationPlan): void {
    if (!plan || plan.steps.length === 0) {
      throw new Error(ERROR_MESSAGES.INVALID_MIGRATION_PLAN);
    }

    if (plan.estimatedGas <= 0 || plan.estimatedGas > 10000000) {
      throw new Error("Invalid estimated gas amount");
    }

    if (plan.timeout <= 0 || plan.timeout > 3600) {
      throw new Error("Invalid timeout period");
    }

    // Validate each step
    for (const step of plan.steps) {
      this.validateMigrationStep(step);
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies(plan.steps)) {
      throw new Error("Migration plan has circular dependencies");
    }
  }

  /**
   * @dev Validate individual migration step
   */
  public static validateMigrationStep(step: any): void {
    if (!step.description || step.description.trim().length === 0) {
      throw new Error("Migration step description cannot be empty");
    }

    if (!this.isValidAddress(step.targetContract)) {
      throw new Error("Invalid target contract address");
    }

    if (!Object.values(MigrationAction).includes(step.action)) {
      throw new Error("Invalid migration action");
    }

    // Validate dependencies
    if (step.dependencies && Array.isArray(step.dependencies)) {
      for (const depId of step.dependencies) {
        if (typeof depId !== 'number' || depId < 0) {
          throw new Error("Invalid dependency ID");
        }
      }
    }
  }

  /**
   * @dev Check for circular dependencies in migration steps
   */
  public static hasCircularDependencies(steps: any[]): boolean {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (stepId: number): boolean => {
      if (recursionStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step && step.dependencies) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) return true;
      }
    }

    return false;
  }

  /**
   * @dev Validate Ethereum address format
   */
  public static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * @dev Validate upgrade compatibility
   */
  public static validateCompatibility(
    currentImplementation: string,
    newImplementation: string
  ): boolean {
    // In a real implementation, this would:
    // 1. Check if new implementation has required functions
    // 2. Verify storage layout compatibility
    // 3. Check for breaking changes
    // 4. Validate interface compatibility
    
    // For this example, we'll do basic checks
    if (!this.isValidAddress(currentImplementation) || !this.isValidAddress(newImplementation)) {
      return false;
    }

    if (currentImplementation.toLowerCase() === newImplementation.toLowerCase()) {
      return false;
    }

    return true;
  }

  /**
   * @dev Check if upgrade can be executed
   */
  public static canExecuteUpgrade(proposal: UpgradeProposal): boolean {
    if (proposal.status !== UpgradeStatus.APPROVED) {
      return false;
    }

    if (!proposal.hasEnoughApprovals()) {
      return false;
    }

    if (!proposal.isExecutionWindowActive()) {
      return false;
    }

    return true;
  }
}

/**
 * @dev Security utilities for upgrade operations
 */
export class UpgradeSecurity {
  /**
   * @dev Generate secure hash for data
   */
  public static generateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * @dev Generate checksum for state snapshot
   */
  public static generateChecksum(data: string, timestamp: number): string {
    const combined = data + timestamp.toString();
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * @dev Verify data integrity
   */
  public static verifyIntegrity(data: string, expectedHash: string): boolean {
    const actualHash = this.generateHash(data);
    return actualHash === expectedHash;
  }

  /**
   * @dev Check if implementation is blacklisted
   */
  public static isImplementationBlacklisted(implementation: string, blacklist: string[]): boolean {
    return blacklist.includes(implementation.toLowerCase());
  }

  /**
   * @dev Check if address is authorized for upgrade operations
   */
  public static isAuthorized(
    address: string,
    authorizedAddresses: Set<string>
  ): boolean {
    return authorizedAddresses.has(address.toLowerCase());
  }

  /**
   * @dev Validate upgrade data for security
   */
  public static validateUpgradeData(data: string): boolean {
    // Check for potentially dangerous operations
    const dangerousPatterns = [
      /selfdestruct/i,
      /suicide/i,
      /delegatecall.*0x0/i,
      /call.*0x0/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(data)) {
        return false;
      }
    }

    return true;
  }

  /**
   * @dev Generate secure random ID
   */
  public static generateSecureId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * @dev Encrypt sensitive data
   */
  public static encryptData(data: string, key: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * @dev Decrypt sensitive data
   */
  public static decryptData(encryptedData: string, key: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

/**
 * @dev Gas optimization utilities
 */
export class GasOptimizer {
  /**
   * @dev Estimate gas for upgrade operation
   */
  public static estimateUpgradeGas(
    migrationPlan: MigrationPlan,
    complexityFactor: number = 1.0
  ): number {
    let totalGas = 0;

    // Base gas for upgrade operation
    totalGas += 100000;

    // Gas for migration steps
    for (const step of migrationPlan.steps) {
      switch (step.action) {
        case MigrationAction.MIGRATE_STORAGE:
          totalGas += 200000;
          break;
        case MigrationAction.UPDATE_STATE:
          totalGas += 150000;
          break;
        case MigrationAction.VALIDATE_STATE:
          totalGas += 100000;
          break;
        case MigrationAction.CLEANUP_STORAGE:
          totalGas += 80000;
          break;
      }

      // Add complexity factor
      totalGas = Math.floor(totalGas * complexityFactor);
    }

    // Add buffer for unexpected costs
    totalGas = Math.floor(totalGas * 1.2);

    return totalGas;
  }

  /**
   * @dev Optimize migration plan for gas
   */
  public static optimizeMigrationPlan(plan: MigrationPlan): MigrationPlan {
    // Sort steps by gas efficiency
    const optimizedSteps = [...plan.steps].sort((a, b) => {
      const gasA = this.getStepGasCost(a);
      const gasB = this.getStepGasCost(b);
      return gasA - gasB;
    });

    return {
      ...plan,
      steps: optimizedSteps,
      estimatedGas: this.estimateUpgradeGas(plan)
    };
  }

  /**
   * @dev Get gas cost for migration step
   */
  private static getStepGasCost(step: any): number {
    switch (step.action) {
      case MigrationAction.MIGRATE_STORAGE:
        return 200000;
      case MigrationAction.UPDATE_STATE:
        return 150000;
      case MigrationAction.VALIDATE_STATE:
        return 100000;
      case MigrationAction.CLEANUP_STORAGE:
        return 80000;
      default:
        return 100000;
    }
  }

  /**
   * @dev Batch operations for gas optimization
   */
  public static batchOperations<T>(operations: T[], batchSize: number = 10): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * @dev Time utilities for upgrade scheduling
 */
export class TimeUtils {
  /**
   * @dev Get current timestamp in seconds
   */
  public static now(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * @dev Add delay to timestamp
   */
  public static addDelay(timestamp: number, delay: number): number {
    return timestamp + delay;
  }

  /**
   * @dev Check if timestamp is in the past
   */
  public static isPast(timestamp: number): boolean {
    return timestamp < this.now();
  }

  /**
   * @dev Check if timestamp is in the future
   */
  public static isFuture(timestamp: number): boolean {
    return timestamp > this.now();
  }

  /**
   * @dev Get time remaining until timestamp
   */
  public static getTimeRemaining(timestamp: number): number {
    return Math.max(0, timestamp - this.now());
  }

  /**
   * @dev Format timestamp for display
   */
  public static formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString();
  }

  /**
   * @dev Calculate execution window end
   */
  public static getWindowStart(scheduledAt: number): number {
    return scheduledAt;
  }

  /**
   * @dev Calculate execution window end
   */
  public static getWindowEnd(scheduledAt: number, window: number): number {
    return scheduledAt + window;
  }

  /**
   * @dev Check if time is within execution window
   */
  public static isInExecutionWindow(
    timestamp: number,
    scheduledAt: number,
    window: number
  ): boolean {
    const windowStart = this.getWindowStart(scheduledAt);
    const windowEnd = this.getWindowEnd(scheduledAt, window);
    return timestamp >= windowStart && timestamp <= windowEnd;
  }
}

/**
 * @dev Storage utilities for state management
 */
export class StorageUtils {
  /**
   * @dev Create storage key for contract
   */
  public static createStorageKey(contract: string, key: string): string {
    return `${contract}:${key}`;
  }

  /**
   * @dev Serialize storage data
   */
  public static serializeStorage(data: any): string {
    return JSON.stringify(data);
  }

  /**
   * @dev Deserialize storage data
   */
  public static deserializeStorage(data: string): any {
    try {
      return JSON.parse(data);
    } catch (error) {
      throw new Error("Failed to deserialize storage data");
    }
  }

  /**
   * @dev Calculate storage hash
   */
  public static calculateStorageHash(storage: any): string {
    const serialized = this.serializeStorage(storage);
    return UpgradeSecurity.generateHash(serialized);
  }

  /**
   * @dev Compare storage states
   */
  public static compareStorage(storage1: any, storage2: any): boolean {
    const hash1 = this.calculateStorageHash(storage1);
    const hash2 = this.calculateStorageHash(storage2);
    return hash1 === hash2;
  }

  /**
   * @dev Extract storage slots for migration
   */
  public static extractStorageSlots(storage: any, slots: string[]): any {
    const extracted: any = {};
    for (const slot of slots) {
      if (storage.hasOwnProperty(slot)) {
        extracted[slot] = storage[slot];
      }
    }
    return extracted;
  }
}

/**
 * @dev Event utilities for upgrade tracking
 */
export class EventUtils {
  /**
   * @dev Create upgrade event
   */
  public static createUpgradeEvent(
    type: string,
    proposalId: number,
    data: any
  ): any {
    return {
      type,
      proposalId,
      timestamp: TimeUtils.now(),
      data,
      hash: UpgradeSecurity.generateHash(JSON.stringify(data))
    };
  }

  /**
   * @dev Validate event integrity
   */
  public static validateEvent(event: any): boolean {
    if (!event.type || !event.proposalId || !event.timestamp || !event.data) {
      return false;
    }

    const expectedHash = UpgradeSecurity.generateHash(JSON.stringify(event.data));
    return event.hash === expectedHash;
  }

  /**
   * @dev Filter events by type
   */
  public static filterEventsByType(events: any[], type: string): any[] {
    return events.filter(event => event.type === type);
  }

  /**
   * @dev Filter events by proposal
   */
  public static filterEventsByProposal(events: any[], proposalId: number): any[] {
    return events.filter(event => event.proposalId === proposalId);
  }

  /**
   * @dev Get events in time range
   */
  public static getEventsInTimeRange(
    events: any[],
    startTime: number,
    endTime: number
  ): any[] {
    return events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }
}

/**
 * @dev Cache utilities for performance optimization
 */
export class CacheUtils {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  /**
   * @dev Set cache entry
   */
  public static set(key: string, data: any, ttl: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: TimeUtils.now(),
      ttl
    });
  }

  /**
   * @dev Get cache entry
   */
  public static get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = TimeUtils.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * @dev Delete cache entry
   */
  public static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * @dev Clear cache
   */
  public static clear(): void {
    this.cache.clear();
  }

  /**
   * @dev Get cache statistics
   */
  public static getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits/misses for accurate rate
    };
  }

  /**
   * @dev Clean expired entries
   */
  public static cleanExpired(): number {
    const now = TimeUtils.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}
