/**
 * @title TradeStructure
 * @dev Data structures for energy trading escrow system
 * @dev Defines comprehensive trade models with validation and serialization
 */

import { EscrowStatus, DisputeStatus } from '../interfaces/IEscrow';

// Core Trade Structure
export class EnergyTrade {
  public readonly id: number;
  public buyer: string;
  public seller: string;
  public mediator: string;
  public energyAmount: number; // in kWh
  public pricePerKwh: number; // in WATT tokens
  public totalValue: number; // in WATT tokens
  public currencyAmount: number; // in stable currency
  public createdAt: number;
  public releaseTime: number;
  public status: EscrowStatus;
  public milestoneCount: number;
  public metadata: TradeMetadata;

  constructor(
    id: number,
    buyer: string,
    seller: string,
    mediator: string,
    energyAmount: number,
    pricePerKwh: number,
    currencyAmount: number,
    releaseTime: number,
    milestoneCount: number = 1,
    metadata?: Partial<TradeMetadata>
  ) {
    this.validateTradeData(buyer, seller, mediator, energyAmount, pricePerKwh, currencyAmount, releaseTime, milestoneCount);
    
    this.id = id;
    this.buyer = buyer;
    this.seller = seller;
    this.mediator = mediator;
    this.energyAmount = energyAmount;
    this.pricePerKwh = pricePerKwh;
    this.totalValue = energyAmount * pricePerKwh;
    this.currencyAmount = currencyAmount;
    this.createdAt = Date.now();
    this.releaseTime = releaseTime;
    this.status = EscrowStatus.PENDING;
    this.milestoneCount = milestoneCount;
    this.metadata = new TradeMetadata(metadata);
  }

  private validateTradeData(
    buyer: string,
    seller: string,
    mediator: string,
    energyAmount: number,
    pricePerKwh: number,
    currencyAmount: number,
    releaseTime: number,
    milestoneCount: number
  ): void {
    if (!buyer || !seller || !mediator) {
      throw new Error('TradeStructure: Invalid participant addresses');
    }
    if (buyer === seller || buyer === mediator || seller === mediator) {
      throw new Error('TradeStructure: Duplicate participant addresses');
    }
    if (energyAmount <= 0) {
      throw new Error('TradeStructure: Energy amount must be positive');
    }
    if (pricePerKwh <= 0) {
      throw new Error('TradeStructure: Price per kWh must be positive');
    }
    if (currencyAmount <= 0) {
      throw new Error('TradeStructure: Currency amount must be positive');
    }
    if (releaseTime <= Date.now()) {
      throw new Error('TradeStructure: Release time must be in the future');
    }
    if (milestoneCount < 1 || milestoneCount > 100) {
      throw new Error('TradeStructure: Invalid milestone count');
    }
  }

  public updateStatus(newStatus: EscrowStatus): void {
    this.validateStatusTransition(this.status, newStatus);
    this.status = newStatus;
  }

  private validateStatusTransition(current: EscrowStatus, next: EscrowStatus): void {
    const validTransitions: Map<EscrowStatus, EscrowStatus[]> = new Map([
      [EscrowStatus.PENDING, [EscrowStatus.ACTIVE, EscrowStatus.CANCELLED]],
      [EscrowStatus.ACTIVE, [EscrowStatus.COMPLETED, EscrowStatus.DISPUTED, EscrowStatus.EMERGENCY_RELEASE]],
      [EscrowStatus.DISPUTED, [EscrowStatus.COMPLETED, EscrowStatus.CANCELLED]],
      [EscrowStatus.EMERGENCY_RELEASE, [EscrowStatus.COMPLETED, EscrowStatus.CANCELLED]],
      [EscrowStatus.COMPLETED, []], // Terminal state
      [EscrowStatus.CANCELLED, []]  // Terminal state
    ]);

    const allowedNext = validTransitions.get(current);
    if (!allowedNext?.includes(next)) {
      throw new Error(`TradeStructure: Invalid status transition from ${current} to ${next}`);
    }
  }

  public toJSON(): any {
    return {
      id: this.id,
      buyer: this.buyer,
      seller: this.seller,
      mediator: this.mediator,
      energyAmount: this.energyAmount,
      pricePerKwh: this.pricePerKwh,
      totalValue: this.totalValue,
      currencyAmount: this.currencyAmount,
      createdAt: this.createdAt,
      releaseTime: this.releaseTime,
      status: this.status,
      milestoneCount: this.milestoneCount,
      metadata: this.metadata.toJSON()
    };
  }

  public static fromJSON(data: any): EnergyTrade {
    const trade = new EnergyTrade(
      data.id,
      data.buyer,
      data.seller,
      data.mediator,
      data.energyAmount,
      data.pricePerKwh,
      data.currencyAmount,
      data.releaseTime,
      data.milestoneCount,
      data.metadata
    );
    trade.createdAt = data.createdAt;
    trade.status = data.status;
    return trade;
  }
}

// Trade Metadata
export class TradeMetadata {
  public location: string;
  public energyType: EnergyType;
  public certification: string;
  public deliveryTerms: string;
  public qualityStandards: string[];
  public customFields: Map<string, any>;

  constructor(data?: Partial<TradeMetadata>) {
    this.location = data?.location || '';
    this.energyType = data?.energyType || EnergyType.GENERAL;
    this.certification = data?.certification || '';
    this.deliveryTerms = data?.deliveryTerms || '';
    this.qualityStandards = data?.qualityStandards || [];
    this.customFields = new Map(data?.customFields || []);
  }

  public addCustomField(key: string, value: any): void {
    this.customFields.set(key, value);
  }

  public getCustomField(key: string): any {
    return this.customFields.get(key);
  }

  public toJSON(): any {
    return {
      location: this.location,
      energyType: this.energyType,
      certification: this.certification,
      deliveryTerms: this.deliveryTerms,
      qualityStandards: this.qualityStandards,
      customFields: Object.fromEntries(this.customFields)
    };
  }
}

export enum EnergyType {
  SOLAR = 'SOLAR',
  WIND = 'WIND',
  HYDRO = 'HYDRO',
  NUCLEAR = 'NUCLEAR',
  GEOTHERMAL = 'GEOTHERMAL',
  BIOMASS = 'BIOMASS',
  GENERAL = 'GENERAL'
}

// Milestone Structure
export class TradeMilestone {
  public readonly id: number;
  public readonly tradeId: number;
  public energyAmount: number;
  public currencyAmount: number;
  public description: string;
  public completed: boolean;
  public released: boolean;
  public completedAt?: number;
  public releasedAt?: number;
  public evidence: string[];

  constructor(
    id: number,
    tradeId: number,
    energyAmount: number,
    currencyAmount: number,
    description: string
  ) {
    if (energyAmount <= 0 || currencyAmount <= 0) {
      throw new Error('TradeMilestone: Amounts must be positive');
    }
    if (!description || description.trim().length === 0) {
      throw new Error('TradeMilestone: Description cannot be empty');
    }

    this.id = id;
    this.tradeId = tradeId;
    this.energyAmount = energyAmount;
    this.currencyAmount = currencyAmount;
    this.description = description;
    this.completed = false;
    this.released = false;
    this.evidence = [];
  }

  public complete(evidence?: string[]): void {
    if (this.completed) {
      throw new Error('TradeMilestone: Already completed');
    }
    this.completed = true;
    this.completedAt = Date.now();
    if (evidence) {
      this.evidence.push(...evidence);
    }
  }

  public release(): void {
    if (!this.completed) {
      throw new Error('TradeMilestone: Must be completed before release');
    }
    if (this.released) {
      throw new Error('TradeMilestone: Already released');
    }
    this.released = true;
    this.releasedAt = Date.now();
  }

  public getCompletionPercentage(): number {
    return this.completed ? 100 : 0;
  }

  public toJSON(): any {
    return {
      id: this.id,
      tradeId: this.tradeId,
      energyAmount: this.energyAmount,
      currencyAmount: this.currencyAmount,
      description: this.description,
      completed: this.completed,
      released: this.released,
      completedAt: this.completedAt,
      releasedAt: this.releasedAt,
      evidence: this.evidence
    };
  }
}

// Dispute Structure
export class TradeDispute {
  public readonly id: number;
  public readonly tradeId: number;
  public initiator: string;
  public respondent: string;
  public reason: string;
  public category: DisputeCategory;
  public evidence: DisputeEvidence[];
  public status: DisputeStatus;
  public createdAt: number;
  public resolvedAt?: number;
  public resolvedBy?: string;
  public resolution?: DisputeResolution;

  constructor(
    id: number,
    tradeId: number,
    initiator: string,
    respondent: string,
    reason: string,
    category: DisputeCategory,
    evidence?: DisputeEvidence[]
  ) {
    if (!initiator || !respondent || initiator === respondent) {
      throw new Error('TradeDispute: Invalid participant addresses');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('TradeDispute: Reason cannot be empty');
    }

    this.id = id;
    this.tradeId = tradeId;
    this.initiator = initiator;
    this.respondent = respondent;
    this.reason = reason;
    this.category = category;
    this.evidence = evidence || [];
    this.status = DisputeStatus.OPEN;
    this.createdAt = Date.now();
  }

  public addEvidence(evidence: DisputeEvidence): void {
    if (this.status !== DisputeStatus.OPEN) {
      throw new Error('TradeDispute: Cannot add evidence to resolved dispute');
    }
    this.evidence.push(evidence);
  }

  public resolve(resolution: DisputeResolution, resolvedBy: string): void {
    if (this.status !== DisputeStatus.OPEN) {
      throw new Error('TradeDispute: Already resolved');
    }
    this.resolution = resolution;
    this.resolvedBy = resolvedBy;
    this.resolvedAt = Date.now();
    this.status = DisputeStatus.RESOLVED;
  }

  public reject(reason: string, rejectedBy: string): void {
    if (this.status !== DisputeStatus.OPEN) {
      throw new Error('TradeDispute: Already resolved');
    }
    this.status = DisputeStatus.REJECTED;
    this.resolvedBy = rejectedBy;
    this.resolvedAt = Date.now();
    // Store rejection reason in resolution
    this.resolution = {
      winner: '',
      loserPenaltyPercent: 0,
      releaseToWinner: false,
      refundToLoser: false,
      reason: `Rejected: ${reason}`
    };
  }

  public toJSON(): any {
    return {
      id: this.id,
      tradeId: this.tradeId,
      initiator: this.initiator,
      respondent: this.respondent,
      reason: this.reason,
      category: this.category,
      evidence: this.evidence.map(e => e.toJSON()),
      status: this.status,
      createdAt: this.createdAt,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy,
      resolution: this.resolution
    };
  }
}

export enum DisputeCategory {
  DELIVERY_FAILURE = 'DELIVERY_FAILURE',
  QUALITY_ISSUE = 'QUALITY_ISSUE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  TIMING_ISSUE = 'TIMING_ISSUE',
  FRAUD = 'FRAUD',
  TECHNICAL = 'TECHNICAL',
  OTHER = 'OTHER'
}

export class DisputeEvidence {
  public readonly id: string;
  public submittedBy: string;
  public type: EvidenceType;
  public content: string;
  public hash?: string;
  public timestamp: number;

  constructor(
    submittedBy: string,
    type: EvidenceType,
    content: string,
    hash?: string
  ) {
    this.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.submittedBy = submittedBy;
    this.type = type;
    this.content = content;
    this.hash = hash;
    this.timestamp = Date.now();
  }

  public toJSON(): any {
    return {
      id: this.id,
      submittedBy: this.submittedBy,
      type: this.type,
      content: this.content,
      hash: this.hash,
      timestamp: this.timestamp
    };
  }
}

export enum EvidenceType {
  DOCUMENT = 'DOCUMENT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  SENSOR_DATA = 'SENSOR_DATA',
  BLOCKCHAIN_PROOF = 'BLOCKCHAIN_PROOF',
  THIRD_PARTY_VERIFICATION = 'THIRD_PARTY_VERIFICATION',
  TEXT = 'TEXT',
  OTHER = 'OTHER'
}

export interface DisputeResolution {
  winner: string;
  loserPenaltyPercent: number;
  releaseToWinner: boolean;
  refundToLoser: boolean;
  reason: string;
}

// Emergency Request Structure
export class EmergencyRequest {
  public readonly id: number;
  public readonly tradeId: number;
  public initiator: string;
  public reason: string;
  public category: EmergencyCategory;
  public approvals: string[];
  public requiredApprovals: number;
  public createdAt: number;
  public executed: boolean;
  public executedAt?: number;
  public executedBy?: string;

  constructor(
    id: number,
    tradeId: number,
    initiator: string,
    reason: string,
    category: EmergencyCategory,
    requiredApprovals: number
  ) {
    if (!initiator || !reason) {
      throw new Error('EmergencyRequest: Invalid initiator or reason');
    }
    if (requiredApprovals < 1) {
      throw new Error('EmergencyRequest: Required approvals must be at least 1');
    }

    this.id = id;
    this.tradeId = tradeId;
    this.initiator = initiator;
    this.reason = reason;
    this.category = category;
    this.approvals = [];
    this.requiredApprovals = requiredApprovals;
    this.createdAt = Date.now();
    this.executed = false;
  }

  public approve(approver: string): void {
    if (this.executed) {
      throw new Error('EmergencyRequest: Already executed');
    }
    if (this.approvals.includes(approver)) {
      throw new Error('EmergencyRequest: Already approved by this address');
    }
    this.approvals.push(approver);
  }

  public canExecute(): boolean {
    return !this.executed && this.approvals.length >= this.requiredApprovals;
  }

  public execute(executedBy: string): void {
    if (!this.canExecute()) {
      throw new Error('EmergencyRequest: Cannot execute - insufficient approvals');
    }
    this.executed = true;
    this.executedAt = Date.now();
    this.executedBy = executedBy;
  }

  public toJSON(): any {
    return {
      id: this.id,
      tradeId: this.tradeId,
      initiator: this.initiator,
      reason: this.reason,
      category: this.category,
      approvals: this.approvals,
      requiredApprovals: this.requiredApprovals,
      createdAt: this.createdAt,
      executed: this.executed,
      executedAt: this.executedAt,
      executedBy: this.executedBy
    };
  }
}

export enum EmergencyCategory {
  SMART_CONTRACT_BUG = 'SMART_CONTRACT_BUG',
  SECURITY_BREACH = 'SECURITY_BREACH',
  REGULATORY_COMPLIANCE = 'REGULATORY_COMPLIANCE',
  MARKET_MANIPULATION = 'MARKET_MANIPULATION',
  FORCE_MAJEURE = 'FORCE_MAJEURE',
  TECHNICAL_FAILURE = 'TECHNICAL_FAILURE',
  OTHER = 'OTHER'
}
