/**
 * @title EscrowLib
 * @dev Library for energy trading escrow utility functions and security checks
 * @dev Provides validation, calculation, and security utilities for escrow operations
 */

import { EscrowStatus, DisputeStatus } from '../interfaces/IEscrow';
import { EnergyTrade, TradeMilestone, TradeDispute, EmergencyRequest } from '../structures/TradeStructure';

export class EscrowLib {
  // Constants
  public static readonly DEFAULT_PENALTY_PERCENT = 10; // 10%
  public static readonly DEFAULT_AUTO_RELEASE_PERIOD = 48 * 60 * 60 * 1000; // 48 hours in ms
  public static readonly MAX_PENALTY_PERCENT = 50; // 50% max penalty
  public static readonly MIN_AUTO_RELEASE_PERIOD = 1 * 60 * 60 * 1000; // 1 hour minimum
  public static readonly MAX_AUTO_RELEASE_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days maximum
  public static readonly DEFAULT_EMERGENCY_APPROVALS = 3;
  public static readonly MIN_EMERGENCY_APPROVALS = 2;
  public static readonly MAX_EMERGENCY_APPROVALS = 10;

  // Address validation
  public static isValidAddress(address: string): boolean {
    if (!address || typeof address !== 'string') {
      return false;
    }
    // Ethereum address format validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  public static validateAddresses(addresses: string[]): void {
    for (const address of addresses) {
      if (!this.isValidAddress(address)) {
        throw new Error(`EscrowLib: Invalid address format: ${address}`);
      }
    }
  }

  public static validateUniqueAddresses(addresses: string[]): void {
    const unique = new Set(addresses);
    if (unique.size !== addresses.length) {
      throw new Error('EscrowLib: Duplicate addresses detected');
    }
  }

  // Amount validation
  public static validateAmount(amount: number, fieldName: string = 'amount'): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      throw new Error(`EscrowLib: ${fieldName} must be a valid number`);
    }
    if (amount <= 0) {
      throw new Error(`EscrowLib: ${fieldName} must be positive`);
    }
    if (!Number.isFinite(amount)) {
      throw new Error(`EscrowLib: ${fieldName} must be finite`);
    }
    // Check for reasonable precision (18 decimal places max)
    if (amount * 1e18 % 1 !== 0 && amount.toString().split('.')[1]?.length > 18) {
      throw new Error(`EscrowLib: ${fieldName} exceeds maximum precision`);
    }
  }

  public static validatePercent(percent: number, fieldName: string = 'percent'): void {
    if (typeof percent !== 'number' || isNaN(percent)) {
      throw new Error(`EscrowLib: ${fieldName} must be a valid number`);
    }
    if (percent < 0 || percent > 100) {
      throw new Error(`EscrowLib: ${fieldName} must be between 0 and 100`);
    }
  }

  // Time validation
  public static validateTimestamp(timestamp: number): void {
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      throw new Error('EscrowLib: Invalid timestamp');
    }
    if (timestamp <= 0) {
      throw new Error('EscrowLib: Timestamp must be positive');
    }
    // Check if timestamp is reasonable (not too far in the past or future)
    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const tenYearsFromNow = now + (10 * 365 * 24 * 60 * 60 * 1000);
    
    if (timestamp < oneYearAgo || timestamp > tenYearsFromNow) {
      throw new Error('EscrowLib: Timestamp is out of reasonable range');
    }
  }

  public static isTimeExpired(timestamp: number): boolean {
    this.validateTimestamp(timestamp);
    return Date.now() >= timestamp;
  }

  // Penalty calculations
  public static calculatePenaltyAmount(amount: number, penaltyPercent: number): number {
    this.validateAmount(amount, 'penalty amount base');
    this.validatePercent(penaltyPercent, 'penalty percent');
    
    if (penaltyPercent > this.MAX_PENALTY_PERCENT) {
      throw new Error(`EscrowLib: Penalty percent cannot exceed ${this.MAX_PENALTY_PERCENT}%`);
    }
    
    return (amount * penaltyPercent) / 100;
  }

  public static calculateReleaseAfterPenalty(totalAmount: number, penaltyPercent: number): number {
    const penalty = this.calculatePenaltyAmount(totalAmount, penaltyPercent);
    return totalAmount - penalty;
  }

  // Milestone calculations
  public static calculateMilestoneAmounts(totalAmount: number, totalEnergy: number, milestoneCount: number): {
    currencyPerMilestone: number;
    energyPerMilestone: number;
  } {
    this.validateAmount(totalAmount, 'total amount');
    this.validateAmount(totalEnergy, 'total energy');
    
    if (milestoneCount < 1 || milestoneCount > 100) {
      throw new Error('EscrowLib: Invalid milestone count');
    }
    
    return {
      currencyPerMilestone: totalAmount / milestoneCount,
      energyPerMilestone: totalEnergy / milestoneCount
    };
  }

  public static validateMilestoneCompletion(
    trade: EnergyTrade,
    milestones: TradeMilestone[],
    milestoneId: number
  ): void {
    if (!milestones || milestones.length === 0) {
      throw new Error('EscrowLib: No milestones found');
    }
    
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error('EscrowLib: Milestone not found');
    }
    
    if (milestone.tradeId !== trade.id) {
      throw new Error('EscrowLib: Milestone does not belong to this trade');
    }
    
    if (milestone.completed) {
      throw new Error('EscrowLib: Milestone already completed');
    }
  }

  // Dispute validation
  public static validateDisputeCreation(
    trade: EnergyTrade,
    initiator: string,
    respondent: string,
    existingDisputes: TradeDispute[]
  ): void {
    if (trade.status !== EscrowStatus.ACTIVE) {
      throw new Error('EscrowLib: Trade must be active to create dispute');
    }
    
    if (!trade.buyer || !trade.seller || !trade.mediator) {
      throw new Error('EscrowLib: Trade has incomplete participant data');
    }
    
    const validInitiators = [trade.buyer, trade.seller, trade.mediator];
    if (!validInitiators.includes(initiator)) {
      throw new Error('EscrowLib: Initiator is not a trade participant');
    }
    
    const validRespondents = [trade.buyer, trade.seller, trade.mediator].filter(p => p !== initiator);
    if (!validRespondents.includes(respondent)) {
      throw new Error('EscrowLib: Respondent is not a valid trade participant');
    }
    
    // Check for existing open disputes
    const openDisputes = existingDisputes.filter(d => 
      d.tradeId === trade.id && d.status === DisputeStatus.OPEN
    );
    if (openDisputes.length > 0) {
      throw new Error('EscrowLib: Trade already has an open dispute');
    }
  }

  public static validateDisputeResolution(
    dispute: TradeDispute,
    resolver: string,
    trade: EnergyTrade
  ): void {
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new Error('EscrowLib: Dispute is not open');
    }
    
    if (resolver !== trade.mediator) {
      throw new Error('EscrowLib: Only mediator can resolve disputes');
    }
  }

  // Emergency request validation
  public static validateEmergencyRequest(
    trade: EnergyTrade,
    initiator: string,
    reason: string,
    requiredApprovals: number
  ): void {
    if (!reason || reason.trim().length === 0) {
      throw new Error('EscrowLib: Emergency reason cannot be empty');
    }
    
    if (reason.length > 1000) {
      throw new Error('EscrowLib: Emergency reason too long');
    }
    
    if (requiredApprovals < this.MIN_EMERGENCY_APPROVALS || 
        requiredApprovals > this.MAX_EMERGENCY_APPROVALS) {
      throw new Error(`EscrowLib: Required approvals must be between ${this.MIN_EMERGENCY_APPROVALS} and ${this.MAX_EMERGENCY_APPROVALS}`);
    }
    
    const validInitiators = [trade.buyer, trade.seller, trade.mediator];
    if (!validInitiators.includes(initiator)) {
      throw new Error('EscrowLib: Initiator is not a trade participant');
    }
  }

  public static validateEmergencyApproval(
    request: EmergencyRequest,
    approver: string,
    trade: EnergyTrade
  ): void {
    if (request.executed) {
      throw new Error('EscrowLib: Emergency request already executed');
    }
    
    if (request.approvals.includes(approver)) {
      throw new Error('EscrowLib: Already approved by this address');
    }
    
    // Only trade participants can approve
    const validApprovers = [trade.buyer, trade.seller, trade.mediator];
    if (!validApprovers.includes(approver)) {
      throw new Error('EscrowLib: Approver is not a trade participant');
    }
  }

  // Gas optimization utilities
  public static optimizeBatchOperations<T>(operations: T[], batchSize: number = 50): T[][] {
    if (batchSize < 1 || batchSize > 100) {
      throw new Error('EscrowLib: Batch size must be between 1 and 100');
    }
    
    const batches: T[][] = [];
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    return batches;
  }

  public static estimateGasCost(operationType: string, complexity: number = 1): number {
    const baseCosts: Record<string, number> = {
      'create_escrow': 50000,
      'deposit_tokens': 30000,
      'confirm_delivery': 25000,
      'confirm_milestone': 20000,
      'release_tokens': 35000,
      'create_dispute': 40000,
      'resolve_dispute': 45000,
      'emergency_request': 35000,
      'emergency_approve': 15000,
      'emergency_execute': 40000,
      'cancel_escrow': 30000
    };
    
    const baseCost = baseCosts[operationType] || 25000;
    return Math.ceil(baseCost * complexity);
  }

  // Security utilities
  public static checkReentrancy(operation: string, context: any): void {
    if (context._reentrancyGuard && context._reentrancyGuard.entered) {
      throw new Error(`EscrowLib: Reentrancy detected in ${operation}`);
    }
  }

  public static createReentrancyGuard(): { entered: boolean; enter(): void; exit(): void } {
    const guard: any = { entered: false };
    
    guard.enter = function() {
      if (this.entered) {
        throw new Error('EscrowLib: Reentrancy guard - contract reentered');
      }
      this.entered = true;
    };
    
    guard.exit = function() {
      this.entered = false;
    };
    
    return guard;
  }

  // Audit trail utilities
  public static createAuditEntry(
    action: string,
    actor: string,
    details: any,
    timestamp?: number
  ): any {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      actor,
      details,
      timestamp: timestamp || Date.now(),
      blockNumber: undefined, // Would be set by blockchain
      transactionHash: undefined // Would be set by blockchain
    };
  }

  public static validateAuditTrail(auditTrail: any[]): void {
    if (!Array.isArray(auditTrail)) {
      throw new Error('EscrowLib: Audit trail must be an array');
    }
    
    for (const entry of auditTrail) {
      if (!entry.id || !entry.action || !entry.actor || !entry.timestamp) {
        throw new Error('EscrowLib: Invalid audit entry format');
      }
      
      this.validateTimestamp(entry.timestamp);
    }
  }

  // Input sanitization
  public static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') {
      throw new Error('EscrowLib: Input must be a string');
    }
    
    if (input.length > maxLength) {
      throw new Error(`EscrowLib: Input exceeds maximum length of ${maxLength}`);
    }
    
    // Remove potentially dangerous characters
    return input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .trim();
  }

  public static sanitizeEvidence(evidence: string[]): string[] {
    if (!Array.isArray(evidence)) {
      throw new Error('EscrowLib: Evidence must be an array');
    }
    
    if (evidence.length > 50) {
      throw new Error('EscrowLib: Too many evidence items');
    }
    
    return evidence.map(item => this.sanitizeString(item, 2000));
  }

  // Rate limiting
  public static createRateLimiter(maxOperations: number, windowMs: number): {
    checkOperation(actor: string): boolean;
    reset(actor: string): void;
  } {
    const operations = new Map<string, number[]>();
    
    const cleanup = () => {
      const now = Date.now();
      for (const [actor, timestamps] of operations.entries()) {
        const validTimestamps = timestamps.filter(t => now - t < windowMs);
        if (validTimestamps.length === 0) {
          operations.delete(actor);
        } else {
          operations.set(actor, validTimestamps);
        }
      }
    };
    
    return {
      checkOperation(actor: string): boolean {
        cleanup();
        
        const timestamps = operations.get(actor) || [];
        const now = Date.now();
        const recentOperations = timestamps.filter(t => now - t < windowMs);
        
        if (recentOperations.length >= maxOperations) {
          return false;
        }
        
        recentOperations.push(now);
        operations.set(actor, recentOperations);
        return true;
      },
      
      reset(actor: string): void {
        operations.delete(actor);
      }
    };
  }

  // Utility functions for testing and debugging
  public static generateTestTrade(
    id: number = 1,
    buyer?: string,
    seller?: string,
    mediator?: string
  ): EnergyTrade {
    return new EnergyTrade(
      id,
      buyer || '0x' + '1'.repeat(40),
      seller || '0x' + '2'.repeat(40),
      mediator || '0x' + '3'.repeat(40),
      1000, // 1000 kWh
      0.1,  // 0.1 WATT per kWh
      100,  // 100 currency units
      Date.now() + (48 * 60 * 60 * 1000), // 48 hours from now
      3 // 3 milestones
    );
  }

  public static generateTestMilestone(
    id: number,
    tradeId: number,
    amount: number = 33.33,
    energy: number = 333.33
  ): TradeMilestone {
    return new TradeMilestone(
      id,
      tradeId,
      energy,
      amount,
      `Test milestone ${id}`
    );
  }
}
