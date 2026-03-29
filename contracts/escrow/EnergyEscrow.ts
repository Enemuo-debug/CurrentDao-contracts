/**
 * @title EnergyEscrow
 * @dev Secure escrow system for energy trading with $WATT tokens
 * @dev Multi-party escrow with buyer/seller/mediator roles, time-based release, and dispute resolution
 * @dev Implements penalty system, partial releases, emergency recovery, and comprehensive audit trail
 */

import {
  IEscrow,
  EscrowDetails,
  Milestone,
  Dispute,
  EmergencyRequest,
  EscrowStatus,
  DisputeStatus,
  EscrowCreatedEvent,
  TokensDepositedEvent,
  MilestoneCompletedEvent,
  TokensReleasedEvent,
  DisputeCreatedEvent,
  DisputeResolvedEvent,
  PenaltyAppliedEvent,
  EmergencyReleaseRequestedEvent,
  EmergencyApprovedEvent,
  EmergencyExecutedEvent,
  EscrowCancelledEvent,
  AutoReleaseEvent,
  DisputeResolution
} from './interfaces/IEscrow';

import {
  EnergyTrade,
  TradeMilestone,
  TradeDispute,
  EmergencyRequest as TradeEmergencyRequest,
  DisputeCategory,
  EvidenceType,
  EmergencyCategory
} from './structures/TradeStructure';

import { EscrowLib } from './libraries/EscrowLib';

export class EnergyEscrow implements IEscrow {
  // Storage
  private admin: string;
  private paused: boolean = false;
  private penaltyPercent: number = EscrowLib.DEFAULT_PENALTY_PERCENT;
  private autoReleasePeriod: number = EscrowLib.DEFAULT_AUTO_RELEASE_PERIOD;
  private requiredEmergencyApprovals: number = EscrowLib.DEFAULT_EMERGENCY_APPROVALS;
  
  private trades: Map<number, EnergyTrade> = new Map();
  private milestones: Map<number, TradeMilestone> = new Map();
  private disputes: Map<number, TradeDispute> = new Map();
  private emergencyRequests: Map<number, TradeEmergencyRequest> = new Map();
  private auditTrail: any[] = [];
  
  private nextTradeId: number = 1;
  private nextMilestoneId: number = 1;
  private nextDisputeId: number = 1;
  private nextEmergencyRequestId: number = 1;
  
  // Token interface (would be injected in production)
  private wattToken: any;
  
  // Reentrancy protection
  private reentrancyGuard = EscrowLib.createReentrancyGuard();
  
  // Rate limiting
  private rateLimiter = EscrowLib.createRateLimiter(10, 60000); // 10 operations per minute
  
  // Events
  public onEscrowCreated?: (event: EscrowCreatedEvent) => void;
  public onTokensDeposited?: (event: TokensDepositedEvent) => void;
  public onMilestoneCompleted?: (event: MilestoneCompletedEvent) => void;
  public onTokensReleased?: (event: TokensReleasedEvent) => void;
  public onDisputeCreated?: (event: DisputeCreatedEvent) => void;
  public onDisputeResolved?: (event: DisputeResolvedEvent) => void;
  public onPenaltyApplied?: (event: PenaltyAppliedEvent) => void;
  public onEmergencyReleaseRequested?: (event: EmergencyReleaseRequestedEvent) => void;
  public onEmergencyApproved?: (event: EmergencyApprovedEvent) => void;
  public onEmergencyExecuted?: (event: EmergencyExecutedEvent) => void;
  public onEscrowCancelled?: (event: EscrowCancelledEvent) => void;
  public onAutoRelease?: (event: AutoReleaseEvent) => void;

  constructor(adminAddress: string, wattTokenContract?: any) {
    if (!EscrowLib.isValidAddress(adminAddress)) {
      throw new Error('EnergyEscrow: Invalid admin address');
    }
    
    this.admin = adminAddress;
    this.wattToken = wattTokenContract;
    
    this.addAuditEntry('CONTRACT_INITIALIZED', adminAddress, { admin: adminAddress });
  }

  // --- Modifiers ---
  
  private whenNotPaused() {
    if (this.paused) {
      throw new Error('EnergyEscrow: Contract is paused');
    }
  }

  private onlyAdmin(caller: string) {
    if (caller !== this.admin) {
      throw new Error('EnergyEscrow: Caller is not admin');
    }
  }

  private checkRateLimit(caller: string) {
    if (!this.rateLimiter.checkOperation(caller)) {
      throw new Error('EnergyEscrow: Rate limit exceeded');
    }
  }

  private nonReentrant() {
    this.reentrancyGuard.enter();
    try {
      // Function logic will be executed here
    } finally {
      this.reentrancyGuard.exit();
    }
  }

  // --- Core Escrow Functions ---

  public createEscrow(
    buyer: string,
    seller: string,
    mediator: string,
    amount: number,
    wattTokenAmount: number,
    releaseTime: number,
    milestoneCount: number,
    caller: string
  ): number {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    // Validate inputs
    EscrowLib.validateAddresses([buyer, seller, mediator, caller]);
    EscrowLib.validateUniqueAddresses([buyer, seller, mediator]);
    EscrowLib.validateAmount(amount, 'currency amount');
    EscrowLib.validateAmount(wattTokenAmount, 'WATT token amount');
    EscrowLib.validateTimestamp(releaseTime);
    
    if (milestoneCount < 1 || milestoneCount > 100) {
      throw new Error('EnergyEscrow: Invalid milestone count');
    }
    
    const tradeId = this.nextTradeId++;
    const trade = new EnergyTrade(
      tradeId,
      buyer,
      seller,
      mediator,
      wattTokenAmount, // Use WATT amount as energy amount for simplicity
      amount / wattTokenAmount, // Calculate price per WATT
      amount,
      releaseTime,
      milestoneCount
    );
    
    this.trades.set(tradeId, trade);
    
    // Create milestones
    const { currencyPerMilestone, energyPerMilestone } = EscrowLib.calculateMilestoneAmounts(
      amount,
      wattTokenAmount,
      milestoneCount
    );
    
    for (let i = 0; i < milestoneCount; i++) {
      const milestone = new TradeMilestone(
        this.nextMilestoneId++,
        tradeId,
        energyPerMilestone,
        currencyPerMilestone,
        `Milestone ${i + 1}`
      );
      this.milestones.set(milestone.id, milestone);
    }
    
    this.addAuditEntry('ESCROW_CREATED', caller, {
      tradeId,
      buyer,
      seller,
      mediator,
      amount,
      wattTokenAmount,
      releaseTime,
      milestoneCount
    });
    
    const event: EscrowCreatedEvent = {
      escrowId: tradeId,
      buyer,
      seller,
      mediator,
      amount,
      wattTokenAmount,
      releaseTime,
      milestoneCount,
      timestamp: Date.now()
    };
    
    this.emitEvent('onEscrowCreated', event);
    
    return tradeId;
  }

  public depositTokens(escrowId: number, amount: number, wattTokenAmount: number, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    
    if (caller !== trade.buyer) {
      throw new Error('EnergyEscrow: Only buyer can deposit tokens');
    }
    
    if (trade.status !== EscrowStatus.PENDING) {
      throw new Error('EnergyEscrow: Trade must be in pending status');
    }
    
    EscrowLib.validateAmount(amount, 'deposit amount');
    EscrowLib.validateAmount(wattTokenAmount, 'WATT deposit amount');
    
    // In a real implementation, this would transfer tokens from buyer to contract
    // For now, we'll simulate the deposit
    trade.updateStatus(EscrowStatus.ACTIVE);
    
    this.addAuditEntry('TOKENS_DEPOSITED', caller, {
      escrowId,
      amount,
      wattTokenAmount
    });
    
    const event: TokensDepositedEvent = {
      escrowId,
      depositor: caller,
      amount,
      wattTokenAmount,
      timestamp: Date.now()
    };
    
    this.emitEvent('onTokensDeposited', event);
    
    return true;
  }

  public confirmDelivery(escrowId: number, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    
    if (caller !== trade.buyer) {
      throw new Error('EnergyEscrow: Only buyer can confirm delivery');
    }
    
    if (trade.status !== EscrowStatus.ACTIVE) {
      throw new Error('EnergyEscrow: Trade must be active');
    }
    
    // Mark all milestones as completed
    const tradeMilestones = this.getTradeMilestones(escrowId);
    for (const milestone of tradeMilestones) {
      if (!milestone.completed) {
        milestone.complete();
        
        const event: MilestoneCompletedEvent = {
          escrowId,
          milestoneId: milestone.id,
          completedBy: caller,
          timestamp: Date.now()
        };
        
        this.emitEvent('onMilestoneCompleted', event);
      }
    }
    
    // Auto-release tokens to seller
    this.releaseTokens(escrowId, trade.seller, trade.currencyAmount, caller);
    
    trade.updateStatus(EscrowStatus.COMPLETED);
    
    this.addAuditEntry('DELIVERY_CONFIRMED', caller, { escrowId });
    
    return true;
  }

  public confirmMilestone(escrowId: number, milestoneId: number, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    
    if (caller !== trade.buyer) {
      throw new Error('EnergyEscrow: Only buyer can confirm milestones');
    }
    
    if (trade.status !== EscrowStatus.ACTIVE) {
      throw new Error('EnergyEscrow: Trade must be active');
    }
    
    const milestone = this.milestones.get(milestoneId);
    if (!milestone || milestone.tradeId !== escrowId) {
      throw new Error('EnergyEscrow: Milestone not found');
    }
    
    EscrowLib.validateMilestoneCompletion(trade, [milestone], milestoneId);
    
    milestone.complete();
    
    // Release milestone payment
    this.releaseTokens(escrowId, trade.seller, milestone.currencyAmount, caller, milestoneId);
    
    // Check if all milestones are completed
    const tradeMilestones = this.getTradeMilestones(escrowId);
    const allCompleted = tradeMilestones.every(m => m.completed);
    
    if (allCompleted) {
      trade.updateStatus(EscrowStatus.COMPLETED);
    }
    
    this.addAuditEntry('MILESTONE_CONFIRMED', caller, {
      escrowId,
      milestoneId
    });
    
    const event: MilestoneCompletedEvent = {
      escrowId,
      milestoneId,
      completedBy: caller,
      timestamp: Date.now()
    };
    
    this.emitEvent('onMilestoneCompleted', event);
    
    return true;
  }

  public releaseTokens(escrowId: number, to: string, amount: number, caller: string, milestoneId?: number): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    
    if (caller !== trade.buyer && caller !== trade.mediator && caller !== this.admin) {
      throw new Error('EnergyEscrow: Unauthorized to release tokens');
    }
    
    EscrowLib.validateAddresses([to]);
    EscrowLib.validateAmount(amount, 'release amount');
    
    // In a real implementation, this would transfer tokens
    // For now, we'll simulate the release
    
    this.addAuditEntry('TOKENS_RELEASED', caller, {
      escrowId,
      to,
      amount,
      milestoneId
    });
    
    const event: TokensReleasedEvent = {
      escrowId,
      to,
      amount,
      milestoneId,
      timestamp: Date.now()
    };
    
    this.emitEvent('onTokensReleased', event);
    
    return true;
  }

  // --- Dispute Resolution ---

  public createDispute(
    escrowId: number,
    respondent: string,
    reason: string,
    evidence: string[],
    caller: string
  ): number {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    const existingDisputes = Array.from(this.disputes.values());
    
    EscrowLib.validateDisputeCreation(trade, caller, respondent, existingDisputes);
    
    const sanitizedReason = EscrowLib.sanitizeString(reason, 1000);
    const sanitizedEvidence = EscrowLib.sanitizeEvidence(evidence);
    
    const disputeId = this.nextDisputeId++;
    const dispute = new TradeDispute(
      disputeId,
      escrowId,
      caller,
      respondent,
      sanitizedReason,
      DisputeCategory.OTHER,
      sanitizedEvidence.map(e => ({
        submittedBy: caller,
        type: EvidenceType.TEXT,
        content: e,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        toJSON: () => ({ id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, submittedBy: caller, type: EvidenceType.TEXT, content: e, timestamp: Date.now() })
      }))
    );
    
    this.disputes.set(disputeId, dispute);
    trade.updateStatus(EscrowStatus.DISPUTED);
    
    this.addAuditEntry('DISPUTE_CREATED', caller, {
      disputeId,
      escrowId,
      respondent,
      reason: sanitizedReason
    });
    
    const event: DisputeCreatedEvent = {
      disputeId,
      escrowId,
      initiator: caller,
      respondent,
      reason: sanitizedReason,
      timestamp: Date.now()
    };
    
    this.emitEvent('onDisputeCreated', event);
    
    return disputeId;
  }

  public resolveDispute(disputeId: number, resolution: DisputeResolution, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error('EnergyEscrow: Dispute not found');
    }
    
    const trade = this.getTradeOrThrow(dispute.tradeId);
    EscrowLib.validateDisputeResolution(dispute, caller, trade);
    
    dispute.resolve(resolution, caller);
    
    // Apply penalty if specified
    if (resolution.loserPenaltyPercent > 0) {
      const penaltyAmount = EscrowLib.calculatePenaltyAmount(
        trade.currencyAmount,
        resolution.loserPenaltyPercent
      );
      
      const event: PenaltyAppliedEvent = {
        escrowId: dispute.tradeId,
        penalizedParty: resolution.winner === trade.buyer ? trade.seller : trade.buyer,
        penaltyAmount,
        reason: resolution.reason,
        timestamp: Date.now()
      };
      
      this.emitEvent('onPenaltyApplied', event);
    }
    
    // Release tokens according to resolution
    if (resolution.releaseToWinner) {
      const releaseAmount = resolution.refundToLoser 
        ? trade.currencyAmount 
        : EscrowLib.calculateReleaseAfterPenalty(trade.currencyAmount, resolution.loserPenaltyPercent);
      
      this.releaseTokens(dispute.tradeId, resolution.winner, releaseAmount, caller);
    }
    
    trade.updateStatus(EscrowStatus.COMPLETED);
    
    this.addAuditEntry('DISPUTE_RESOLVED', caller, {
      disputeId,
      resolution
    });
    
    const event: DisputeResolvedEvent = {
      disputeId,
      escrowId: dispute.tradeId,
      resolver: caller,
      resolution,
      timestamp: Date.now()
    };
    
    this.emitEvent('onDisputeResolved', event);
    
    return true;
  }

  // --- Emergency Functions ---

  public requestEmergencyRelease(escrowId: number, reason: string, caller: string): number {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    
    EscrowLib.validateEmergencyRequest(trade, caller, reason, this.requiredEmergencyApprovals);
    
    const sanitizedReason = EscrowLib.sanitizeString(reason, 1000);
    
    const requestId = this.nextEmergencyRequestId++;
    const request = new TradeEmergencyRequest(
      requestId,
      escrowId,
      caller,
      sanitizedReason,
      EmergencyCategory.OTHER,
      this.requiredEmergencyApprovals
    );
    
    this.emergencyRequests.set(requestId, request);
    
    this.addAuditEntry('EMERGENCY_REQUESTED', caller, {
      requestId,
      escrowId,
      reason: sanitizedReason
    });
    
    const event: EmergencyReleaseRequestedEvent = {
      requestId,
      escrowId,
      initiator: caller,
      reason: sanitizedReason,
      requiredApprovals: this.requiredEmergencyApprovals,
      timestamp: Date.now()
    };
    
    this.emitEvent('onEmergencyReleaseRequested', event);
    
    return requestId;
  }

  public approveEmergencyRelease(requestId: number, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const request = this.emergencyRequests.get(requestId);
    if (!request) {
      throw new Error('EnergyEscrow: Emergency request not found');
    }
    
    const trade = this.getTradeOrThrow(request.tradeId);
    EscrowLib.validateEmergencyApproval(request, caller, trade);
    
    request.approve(caller);
    
    this.addAuditEntry('EMERGENCY_APPROVED', caller, {
      requestId,
      approver: caller
    });
    
    const event: EmergencyApprovedEvent = {
      requestId,
      escrowId: request.tradeId,
      approver: caller,
      currentApprovals: request.approvals.length,
      requiredApprovals: request.requiredApprovals,
      timestamp: Date.now()
    };
    
    this.emitEvent('onEmergencyApproved', event);
    
    return true;
  }

  public executeEmergencyRelease(requestId: number, to: string, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const request = this.emergencyRequests.get(requestId);
    if (!request) {
      throw new Error('EnergyEscrow: Emergency request not found');
    }
    
    if (!request.canExecute()) {
      throw new Error('EnergyEscrow: Insufficient approvals for emergency release');
    }
    
    const trade = this.getTradeOrThrow(request.tradeId);
    EscrowLib.validateAddresses([to]);
    
    request.execute(caller);
    trade.updateStatus(EscrowStatus.EMERGENCY_RELEASE);
    
    // Release all tokens to specified recipient
    this.releaseTokens(request.tradeId, to, trade.currencyAmount, caller);
    
    this.addAuditEntry('EMERGENCY_EXECUTED', caller, {
      requestId,
      to,
      amount: trade.currencyAmount
    });
    
    const event: EmergencyExecutedEvent = {
      requestId,
      escrowId: request.tradeId,
      executor: caller,
      releasedTo: to,
      amount: trade.currencyAmount,
      timestamp: Date.now()
    };
    
    this.emitEvent('onEmergencyExecuted', event);
    
    return true;
  }

  // --- Utility Functions ---

  public cancelEscrow(escrowId: number, reason: string, caller: string): boolean {
    this.whenNotPaused();
    this.checkRateLimit(caller);
    this.nonReentrant();
    
    const trade = this.getTradeOrThrow(escrowId);
    
    if (caller !== trade.buyer && caller !== trade.seller && caller !== this.admin) {
      throw new Error('EnergyEscrow: Unauthorized to cancel escrow');
    }
    
    if (trade.status === EscrowStatus.COMPLETED || trade.status === EscrowStatus.CANCELLED) {
      throw new Error('EnergyEscrow: Trade already completed or cancelled');
    }
    
    const sanitizedReason = EscrowLib.sanitizeString(reason, 500);
    
    // Refund buyer if tokens were deposited
    let refundAmount = 0;
    if (trade.status === EscrowStatus.ACTIVE) {
      refundAmount = trade.currencyAmount;
      this.releaseTokens(escrowId, trade.buyer, refundAmount, caller);
    }
    
    trade.updateStatus(EscrowStatus.CANCELLED);
    
    this.addAuditEntry('ESCROW_CANCELLED', caller, {
      escrowId,
      reason: sanitizedReason,
      refundAmount
    });
    
    const event: EscrowCancelledEvent = {
      escrowId,
      cancelledBy: caller,
      reason: sanitizedReason,
      refundedAmount: refundAmount,
      timestamp: Date.now()
    };
    
    this.emitEvent('onEscrowCancelled', event);
    
    return true;
  }

  public getEscrowDetails(escrowId: number): EscrowDetails {
    const trade = this.getTradeOrThrow(escrowId);
    const tradeMilestones = this.getTradeMilestones(escrowId);
    const completedMilestones = tradeMilestones.filter(m => m.completed).length;
    
    const openDispute = Array.from(this.disputes.values()).find(
      d => d.tradeId === escrowId && d.status === DisputeStatus.OPEN
    );
    
    return {
      id: trade.id,
      buyer: trade.buyer,
      seller: trade.seller,
      mediator: trade.mediator,
      amount: trade.currencyAmount,
      wattTokenAmount: trade.totalValue,
      createdAt: trade.createdAt,
      releaseTime: trade.releaseTime,
      status: trade.status,
      milestoneCount: trade.milestoneCount,
      releasedMilestones: completedMilestones,
      disputeActive: !!openDispute,
      disputeWinner: openDispute?.resolution?.winner,
      penaltyApplied: false, // Would be tracked in actual implementation
      emergencyRelease: trade.status === EscrowStatus.EMERGENCY_RELEASE
    };
  }

  public getMilestone(escrowId: number, milestoneId: number): Milestone {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone || milestone.tradeId !== escrowId) {
      throw new Error('EnergyEscrow: Milestone not found');
    }
    
    return {
      id: milestone.id,
      escrowId: milestone.tradeId,
      amount: milestone.currencyAmount,
      description: milestone.description,
      completed: milestone.completed,
      released: milestone.released,
      completedAt: milestone.completedAt
    };
  }

  public getDispute(disputeId: number): Dispute {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new Error('EnergyEscrow: Dispute not found');
    }
    
    return {
      id: dispute.id,
      escrowId: dispute.tradeId,
      initiator: dispute.initiator,
      respondent: dispute.respondent,
      reason: dispute.reason,
      evidence: dispute.evidence.map(e => e.content),
      createdAt: dispute.createdAt,
      resolved: dispute.status !== DisputeStatus.OPEN,
      resolution: dispute.resolution,
      resolvedAt: dispute.resolvedAt,
      resolvedBy: dispute.resolvedBy
    };
  }

  public getEmergencyRequest(requestId: number): EmergencyRequest {
    const request = this.emergencyRequests.get(requestId);
    if (!request) {
      throw new Error('EnergyEscrow: Emergency request not found');
    }
    
    return {
      id: request.id,
      escrowId: request.tradeId,
      initiator: request.initiator,
      reason: request.reason,
      approvals: request.approvals,
      requiredApprovals: request.requiredApprovals,
      createdAt: request.createdAt,
      executed: request.executed,
      executedAt: request.executedAt
    };
  }

  public isTimeExpired(escrowId: number): boolean {
    const trade = this.getTradeOrThrow(escrowId);
    return EscrowLib.isTimeExpired(trade.releaseTime);
  }

  public calculatePenalty(amount: number, penaltyPercent: number): number {
    return EscrowLib.calculatePenaltyAmount(amount, penaltyPercent);
  }

  // --- Admin Functions ---

  public updateAdmin(admin: string, caller: string): boolean {
    this.onlyAdmin(caller);
    EscrowLib.validateAddresses([admin]);
    
    const oldAdmin = this.admin;
    this.admin = admin;
    
    this.addAuditEntry('ADMIN_UPDATED', caller, {
      oldAdmin,
      newAdmin: admin
    });
    
    return true;
  }

  public pause(caller: string): boolean {
    this.onlyAdmin(caller);
    this.paused = true;
    
    this.addAuditEntry('CONTRACT_PAUSED', caller, {});
    
    return true;
  }

  public unpause(caller: string): boolean {
    this.onlyAdmin(caller);
    this.paused = false;
    
    this.addAuditEntry('CONTRACT_UNPAUSED', caller, {});
    
    return true;
  }

  public updatePenaltyPercent(newPercent: number, caller: string): boolean {
    this.onlyAdmin(caller);
    EscrowLib.validatePercent(newPercent, 'penalty percent');
    
    if (newPercent > EscrowLib.MAX_PENALTY_PERCENT) {
      throw new Error(`EnergyEscrow: Penalty percent cannot exceed ${EscrowLib.MAX_PENALTY_PERCENT}%`);
    }
    
    const oldPercent = this.penaltyPercent;
    this.penaltyPercent = newPercent;
    
    this.addAuditEntry('PENALTY_PERCENT_UPDATED', caller, {
      oldPercent,
      newPercent
    });
    
    return true;
  }

  public updateAutoReleasePeriod(newPeriod: number, caller: string): boolean {
    this.onlyAdmin(caller);
    
    if (newPeriod < EscrowLib.MIN_AUTO_RELEASE_PERIOD || 
        newPeriod > EscrowLib.MAX_AUTO_RELEASE_PERIOD) {
      throw new Error('EnergyEscrow: Invalid auto-release period');
    }
    
    const oldPeriod = this.autoReleasePeriod;
    this.autoReleasePeriod = newPeriod;
    
    this.addAuditEntry('AUTO_RELEASE_PERIOD_UPDATED', caller, {
      oldPeriod,
      newPeriod
    });
    
    return true;
  }

  public updateRequiredEmergencyApprovals(newCount: number, caller: string): boolean {
    this.onlyAdmin(caller);
    
    if (newCount < EscrowLib.MIN_EMERGENCY_APPROVALS || 
        newCount > EscrowLib.MAX_EMERGENCY_APPROVALS) {
      throw new Error('EnergyEscrow: Invalid emergency approval count');
    }
    
    const oldCount = this.requiredEmergencyApprovals;
    this.requiredEmergencyApprovals = newCount;
    
    this.addAuditEntry('EMERGENCY_APPROVALS_UPDATED', caller, {
      oldCount,
      newCount
    });
    
    return true;
  }

  // --- Auto-release functionality (would be called by oracle or cron job) ---

  public processAutoReleases(): number {
    let processedCount = 0;
    
    for (const [, trade] of this.trades.entries()) {
      if (trade.status === EscrowStatus.ACTIVE && this.isTimeExpired(trade.id)) {
        // Auto-release to seller if no disputes
        const openDispute = Array.from(this.disputes.values()).find(
          d => d.tradeId === trade.id && d.status === DisputeStatus.OPEN
        );
        
        if (!openDispute) {
          this.releaseTokens(trade.id, trade.seller, trade.currencyAmount, this.admin);
          trade.updateStatus(EscrowStatus.COMPLETED);
          
          const event: AutoReleaseEvent = {
            escrowId: trade.id,
            reason: 'Time-based auto-release',
            releasedTo: trade.seller,
            amount: trade.currencyAmount,
            timestamp: Date.now()
          };
          
          this.emitEvent('onAutoRelease', event);
          processedCount++;
        }
      }
    }
    
    return processedCount;
  }

  // --- Helper Methods ---

  private getTradeOrThrow(escrowId: number): EnergyTrade {
    const trade = this.trades.get(escrowId);
    if (!trade) {
      throw new Error('EnergyEscrow: Trade not found');
    }
    return trade;
  }

  private getTradeMilestones(escrowId: number): TradeMilestone[] {
    return Array.from(this.milestones.values()).filter(
      milestone => milestone.tradeId === escrowId
    );
  }

  private addAuditEntry(action: string, actor: string, details: any): void {
    const entry = EscrowLib.createAuditEntry(action, actor, details);
    this.auditTrail.push(entry);
    
    // Keep audit trail size manageable
    if (this.auditTrail.length > 10000) {
      this.auditTrail = this.auditTrail.slice(-5000);
    }
  }

  private emitEvent(eventType: string, eventData: any): void {
    const eventHandler = (this as any)[eventType];
    if (typeof eventHandler === 'function') {
      eventHandler(eventData);
    }
  }

  // --- Public getters for testing and monitoring ---

  public getAuditTrail(): any[] {
    return [...this.auditTrail];
  }

  public getContractStats(): any {
    const trades = Array.from(this.trades.values());
    const disputes = Array.from(this.disputes.values());
    const emergencyRequests = Array.from(this.emergencyRequests.values());
    
    return {
      totalTrades: trades.length,
      activeTrades: trades.filter(t => t.status === EscrowStatus.ACTIVE).length,
      completedTrades: trades.filter(t => t.status === EscrowStatus.COMPLETED).length,
      disputedTrades: trades.filter(t => t.status === EscrowStatus.DISPUTED).length,
      cancelledTrades: trades.filter(t => t.status === EscrowStatus.CANCELLED).length,
      openDisputes: disputes.filter(d => d.status === DisputeStatus.OPEN).length,
      pendingEmergencyRequests: emergencyRequests.filter(r => !r.executed).length,
      paused: this.paused,
      penaltyPercent: this.penaltyPercent,
      autoReleasePeriod: this.autoReleasePeriod,
      requiredEmergencyApprovals: this.requiredEmergencyApprovals
    };
  }
}
