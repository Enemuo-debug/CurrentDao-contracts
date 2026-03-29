/**
 * @title IEscrow
 * @dev Interface for the Energy Trading Escrow system
 * @dev Handles multi-party escrow with dispute resolution and penalty systems
 */

export interface EscrowDetails {
  id: number;
  buyer: string;
  seller: string;
  mediator: string;
  amount: number;
  wattTokenAmount: number;
  createdAt: number;
  releaseTime: number;
  status: EscrowStatus;
  milestoneCount: number;
  releasedMilestones: number;
  disputeActive: boolean;
  disputeWinner?: string;
  penaltyApplied: boolean;
  emergencyRelease: boolean;
}

export interface Milestone {
  id: number;
  escrowId: number;
  amount: number;
  description: string;
  completed: boolean;
  released: boolean;
  completedAt?: number;
}

export interface Dispute {
  id: number;
  escrowId: number;
  initiator: string;
  respondent: string;
  reason: string;
  evidence: string[];
  createdAt: number;
  resolved: boolean;
  resolution?: DisputeResolution;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface DisputeResolution {
  winner: string;
  loserPenaltyPercent: number;
  releaseToWinner: boolean;
  refundToLoser: boolean;
  reason: string;
}

export interface EmergencyRequest {
  id: number;
  escrowId: number;
  initiator: string;
  reason: string;
  approvals: string[];
  requiredApprovals: number;
  createdAt: number;
  executed: boolean;
  executedAt?: number;
}

export enum EscrowStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DISPUTED = 'DISPUTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EMERGENCY_RELEASE = 'EMERGENCY_RELEASE'
}

export enum DisputeStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED'
}

// Events
export interface EscrowCreatedEvent {
  escrowId: number;
  buyer: string;
  seller: string;
  mediator: string;
  amount: number;
  wattTokenAmount: number;
  releaseTime: number;
  milestoneCount: number;
  timestamp: number;
}

export interface TokensDepositedEvent {
  escrowId: number;
  depositor: string;
  amount: number;
  wattTokenAmount: number;
  timestamp: number;
}

export interface MilestoneCompletedEvent {
  escrowId: number;
  milestoneId: number;
  completedBy: string;
  timestamp: number;
}

export interface TokensReleasedEvent {
  escrowId: number;
  to: string;
  amount: number;
  milestoneId?: number;
  timestamp: number;
}

export interface DisputeCreatedEvent {
  disputeId: number;
  escrowId: number;
  initiator: string;
  respondent: string;
  reason: string;
  timestamp: number;
}

export interface DisputeResolvedEvent {
  disputeId: number;
  escrowId: number;
  resolver: string;
  resolution: DisputeResolution;
  timestamp: number;
}

export interface PenaltyAppliedEvent {
  escrowId: number;
  penalizedParty: string;
  penaltyAmount: number;
  reason: string;
  timestamp: number;
}

export interface EmergencyReleaseRequestedEvent {
  requestId: number;
  escrowId: number;
  initiator: string;
  reason: string;
  requiredApprovals: number;
  timestamp: number;
}

export interface EmergencyApprovedEvent {
  requestId: number;
  escrowId: number;
  approver: string;
  currentApprovals: number;
  requiredApprovals: number;
  timestamp: number;
}

export interface EmergencyExecutedEvent {
  requestId: number;
  escrowId: number;
  executor: string;
  releasedTo: string;
  amount: number;
  timestamp: number;
}

export interface EscrowCancelledEvent {
  escrowId: number;
  cancelledBy: string;
  reason: string;
  refundedAmount: number;
  timestamp: number;
}

export interface AutoReleaseEvent {
  escrowId: number;
  reason: string;
  releasedTo: string;
  amount: number;
  timestamp: number;
}

// Main interface
export interface IEscrow {
  // Core escrow functions
  createEscrow(
    buyer: string,
    seller: string,
    mediator: string,
    amount: number,
    wattTokenAmount: number,
    releaseTime: number,
    milestoneCount: number,
    caller: string
  ): number;

  depositTokens(escrowId: number, amount: number, wattTokenAmount: number, caller: string): boolean;

  confirmDelivery(escrowId: number, caller: string): boolean;

  confirmMilestone(escrowId: number, milestoneId: number, caller: string): boolean;

  releaseTokens(escrowId: number, to: string, amount: number, caller: string): boolean;

  // Dispute resolution
  createDispute(
    escrowId: number,
    respondent: string,
    reason: string,
    evidence: string[],
    caller: string
  ): number;

  resolveDispute(
    disputeId: number,
    resolution: DisputeResolution,
    caller: string
  ): boolean;

  // Emergency functions
  requestEmergencyRelease(
    escrowId: number,
    reason: string,
    caller: string
  ): number;

  approveEmergencyRelease(requestId: number, caller: string): boolean;

  executeEmergencyRelease(requestId: number, to: string, caller: string): boolean;

  // Utility functions
  cancelEscrow(escrowId: number, reason: string, caller: string): boolean;

  getEscrowDetails(escrowId: number): EscrowDetails;

  getMilestone(escrowId: number, milestoneId: number): Milestone;

  getDispute(disputeId: number): Dispute;

  getEmergencyRequest(requestId: number): EmergencyRequest;

  isTimeExpired(escrowId: number): boolean;

  calculatePenalty(amount: number, penaltyPercent: number): number;

  // Admin functions
  updateAdmin(admin: string, caller: string): boolean;

  pause(caller: string): boolean;

  unpause(caller: string): boolean;

  updatePenaltyPercent(newPercent: number, caller: string): boolean;

  updateAutoReleasePeriod(newPeriod: number, caller: string): boolean;

  updateRequiredEmergencyApprovals(newCount: number, caller: string): boolean;

  // Events
  onEscrowCreated?: (event: EscrowCreatedEvent) => void;
  onTokensDeposited?: (event: TokensDepositedEvent) => void;
  onMilestoneCompleted?: (event: MilestoneCompletedEvent) => void;
  onTokensReleased?: (event: TokensReleasedEvent) => void;
  onDisputeCreated?: (event: DisputeCreatedEvent) => void;
  onDisputeResolved?: (event: DisputeResolvedEvent) => void;
  onPenaltyApplied?: (event: PenaltyAppliedEvent) => void;
  onEmergencyReleaseRequested?: (event: EmergencyReleaseRequestedEvent) => void;
  onEmergencyApproved?: (event: EmergencyApprovedEvent) => void;
  onEmergencyExecuted?: (event: EmergencyExecutedEvent) => void;
  onEscrowCancelled?: (event: EscrowCancelledEvent) => void;
  onAutoRelease?: (event: AutoReleaseEvent) => void;
}
