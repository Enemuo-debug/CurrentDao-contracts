/**
 * @title EnergyEscrow Test Suite
 * @dev Comprehensive tests for the Energy Trading Escrow system
 * @dev Covers all functionality including edge cases and security scenarios
 */

import { EnergyEscrow } from '../../contracts/escrow/EnergyEscrow';
import { EscrowStatus, DisputeStatus } from '../../contracts/escrow/interfaces/IEscrow';
import { EscrowLib } from '../../contracts/escrow/libraries/EscrowLib';
import { EnergyTrade, DisputeCategory, EmergencyCategory } from '../../contracts/escrow/structures/TradeStructure';

describe('EnergyEscrow', () => {
  let escrow: EnergyEscrow;
  let admin: string;
  let buyer: string;
  let seller: string;
  let mediator: string;
  let otherUser: string;

  beforeEach(() => {
    admin = '0x' + 'a'.repeat(40);
    buyer = '0x' + 'b'.repeat(40);
    seller = '0x' + 'c'.repeat(40);
    mediator = '0x' + 'd'.repeat(40);
    otherUser = '0x' + 'e'.repeat(40);

    escrow = new EnergyEscrow(admin);
  });

  describe('Contract Initialization', () => {
    it('should initialize with correct admin', async () => {
      expect(escrow).toBeDefined();
      await expect(escrow.updateAdmin(buyer, otherUser)).rejects.toThrow();
    });

    it('should reject invalid admin address', () => {
      expect(() => new EnergyEscrow('invalid')).toThrow();
    });

    it('should allow admin to update admin', async () => {
      expect(await escrow.updateAdmin(buyer, admin)).toBe(true);
    });
  });

  describe('Escrow Creation', () => {
    const validParams = {
      amount: 1000,
      wattTokenAmount: 100,
      releaseTime: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
      milestoneCount: 3
    };

    it('should create escrow successfully', async () => {
      const escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        validParams.amount,
        validParams.wattTokenAmount,
        validParams.releaseTime,
        validParams.milestoneCount,
        admin
      );

      expect(escrowId).toBe(1);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.buyer).toBe(buyer);
      expect(details.seller).toBe(seller);
      expect(details.mediator).toBe(mediator);
      expect(details.amount).toBe(validParams.amount);
      expect(details.wattTokenAmount).toBe(validParams.wattTokenAmount);
      expect(details.status).toBe(EscrowStatus.PENDING);
      expect(details.milestoneCount).toBe(validParams.milestoneCount);
    });

    it('should reject duplicate addresses', async () => {
      await expect(escrow.createEscrow(
        buyer,
        buyer,
        mediator,
        validParams.amount,
        validParams.wattTokenAmount,
        validParams.releaseTime,
        validParams.milestoneCount,
        admin
      )).rejects.toThrow('Duplicate addresses');
    });

    it('should reject invalid addresses', async () => {
      await expect(escrow.createEscrow(
        'invalid',
        seller,
        mediator,
        validParams.amount,
        validParams.wattTokenAmount,
        validParams.releaseTime,
        validParams.milestoneCount,
        admin
      )).rejects.toThrow('Invalid address format');
    });

    it('should reject zero amounts', async () => {
      await expect(escrow.createEscrow(
        buyer,
        seller,
        mediator,
        0,
        validParams.wattTokenAmount,
        validParams.releaseTime,
        validParams.milestoneCount,
        admin
      )).rejects.toThrow('must be positive');
    });

    it('should reject past release time', async () => {
      await expect(escrow.createEscrow(
        buyer,
        seller,
        mediator,
        validParams.amount,
        validParams.wattTokenAmount,
        Date.now() - 1000,
        validParams.milestoneCount,
        admin
      )).rejects.toThrow('Release time must be in the future');
    });

    it('should reject invalid milestone count', async () => {
      await expect(escrow.createEscrow(
        buyer,
        seller,
        mediator,
        validParams.amount,
        validParams.wattTokenAmount,
        validParams.releaseTime,
        0,
        admin
      )).rejects.toThrow('Invalid milestone count');
    });
  });

  describe('Token Deposits', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        3,
        admin
      );
    });

    it('should allow buyer to deposit tokens', async () => {
      expect(await escrow.depositTokens(escrowId, 1000, 100, buyer)).toBe(true);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.ACTIVE);
    });

    it('should reject deposits from non-buyer', async () => {
      await expect(escrow.depositTokens(escrowId, 1000, 100, seller)).rejects.toThrow('Only buyer can deposit');
    });

    it('should reject deposits for non-pending escrow', async () => {
      await escrow.depositTokens(escrowId, 1000, 100, buyer);
      await expect(escrow.depositTokens(escrowId, 1000, 100, buyer)).rejects.toThrow('must be in pending status');
    });

    it('should reject invalid deposit amounts', async () => {
      await expect(escrow.depositTokens(escrowId, -100, 100, buyer)).rejects.toThrow('must be positive');
    });
  });

  describe('Delivery Confirmation', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        3,
        admin
      );
      await escrow.depositTokens(escrowId, 1000, 100, buyer);
    });

    it('should allow buyer to confirm delivery', async () => {
      expect(await escrow.confirmDelivery(escrowId, buyer)).toBe(true);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.COMPLETED);
    });

    it('should reject confirmation from non-buyer', async () => {
      await expect(escrow.confirmDelivery(escrowId, seller)).rejects.toThrow('Only buyer can confirm');
    });

    it('should reject confirmation for non-active escrow', async () => {
      await escrow.confirmDelivery(escrowId, buyer);
      await expect(escrow.confirmDelivery(escrowId, buyer)).rejects.toThrow('must be active');
    });
  });

  describe('Milestone Management', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        900,
        90,
        Date.now() + 48 * 60 * 60 * 1000,
        3,
        admin
      );
      await escrow.depositTokens(escrowId, 900, 90, buyer);
    });

    it('should allow buyer to confirm milestone', async () => {
      // Get first milestone (ID should be 1)
      const milestone = await escrow.getMilestone(escrowId, 1);
      expect(milestone.escrowId).toBe(escrowId);
      
      expect(await escrow.confirmMilestone(escrowId, 1, buyer)).toBe(true);
      
      const updatedMilestone = await escrow.getMilestone(escrowId, 1);
      expect(updatedMilestone.completed).toBe(true);
    });

    it('should reject milestone confirmation from non-buyer', async () => {
      await expect(escrow.confirmMilestone(escrowId, 1, seller)).rejects.toThrow('Only buyer can confirm');
    });

    it('should reject confirmation of non-existent milestone', async () => {
      await expect(escrow.confirmMilestone(escrowId, 999, buyer)).rejects.toThrow('Milestone not found');
    });

    it('should complete trade when all milestones confirmed', async () => {
      await escrow.confirmMilestone(escrowId, 1, buyer);
      await escrow.confirmMilestone(escrowId, 2, buyer);
      await escrow.confirmMilestone(escrowId, 3, buyer);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.COMPLETED);
      expect(details.releasedMilestones).toBe(3);
    });
  });

  describe('Dispute Resolution', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        1,
        admin
      );
      await escrow.depositTokens(escrowId, 1000, 100, buyer);
    });

    it('should allow participant to create dispute', async () => {
      const disputeId = await escrow.createDispute(
        escrowId,
        seller,
        'Quality issues',
        ['Evidence 1', 'Evidence 2'],
        buyer
      );

      expect(disputeId).toBe(1);
      
      const dispute = await escrow.getDispute(disputeId);
      expect(dispute.escrowId).toBe(escrowId);
      expect(dispute.initiator).toBe(buyer);
      expect(dispute.respondent).toBe(seller);
      expect(dispute.reason).toBe('Quality issues');
      expect(dispute.evidence).toEqual(['Evidence 1', 'Evidence 2']);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.DISPUTED);
      expect(details.disputeActive).toBe(true);
    });

    it('should reject dispute from non-participant', async () => {
      await expect(escrow.createDispute(
        escrowId,
        seller,
        'Quality issues',
        [],
        otherUser
      )).rejects.toThrow('not a trade participant');
    });

    it('should reject duplicate disputes', async () => {
      await escrow.createDispute(escrowId, seller, 'Issue 1', [], buyer);
      await expect(escrow.createDispute(
        escrowId,
        seller,
        'Issue 2',
        [],
        buyer
      )).rejects.toThrow('already has an open dispute');
    });

    it('should allow mediator to resolve dispute', async () => {
      const disputeId = await escrow.createDispute(escrowId, seller, 'Quality issues', [], buyer);
      
      const resolution = {
        winner: buyer,
        loserPenaltyPercent: 10,
        releaseToWinner: true,
        refundToLoser: false,
        reason: 'Seller failed to deliver quality'
      };
      
      expect(await escrow.resolveDispute(disputeId, resolution, mediator)).toBe(true);
      
      const dispute = await escrow.getDispute(disputeId);
      expect(dispute.resolved).toBe(true);
      expect(dispute.resolvedBy).toBe(mediator);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.COMPLETED);
    });

    it('should reject dispute resolution from non-mediator', async () => {
      const disputeId = await escrow.createDispute(escrowId, seller, 'Quality issues', [], buyer);
      
      await expect(escrow.resolveDispute(disputeId, {
        winner: buyer,
        loserPenaltyPercent: 10,
        releaseToWinner: true,
        refundToLoser: false,
        reason: 'Test'
      }, buyer)).rejects.toThrow('Only mediator can resolve disputes');
    });

    it('should apply penalty correctly', async () => {
      const disputeId = await escrow.createDispute(escrowId, seller, 'Quality issues', [], buyer);
      
      let penaltyEventFired = false;
      escrow.onPenaltyApplied = (event) => {
        penaltyEventFired = true;
        expect(event.penalizedParty).toBe(seller);
        expect(event.penaltyAmount).toBe(100); // 10% of 1000
      };
      
      await escrow.resolveDispute(disputeId, {
        winner: buyer,
        loserPenaltyPercent: 10,
        releaseToWinner: true,
        refundToLoser: false,
        reason: 'Penalty test'
      }, mediator);
      
      expect(penaltyEventFired).toBe(true);
    });
  });

  describe('Emergency Release', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        1,
        admin
      );
      await escrow.depositTokens(escrowId, 1000, 100, buyer);
    });

    it('should allow participant to request emergency release', async () => {
      const requestId = await escrow.requestEmergencyRelease(
        escrowId,
        'Smart contract bug detected',
        buyer
      );

      expect(requestId).toBe(1);
      
      const request = await escrow.getEmergencyRequest(requestId);
      expect(request.escrowId).toBe(escrowId);
      expect(request.initiator).toBe(buyer);
      expect(request.reason).toBe('Smart contract bug detected');
      expect(request.requiredApprovals).toBe(3); // Default
    });

    it('should reject emergency request from non-participant', async () => {
      await expect(escrow.requestEmergencyRelease(
        escrowId,
        'Emergency',
        otherUser
      )).rejects.toThrow('not a trade participant');
    });

    it('should allow approvals from participants', async () => {
      const requestId = await escrow.requestEmergencyRelease(escrowId, 'Emergency', buyer);
      
      expect(await escrow.approveEmergencyRelease(requestId, seller)).toBe(true);
      expect(await escrow.approveEmergencyRelease(requestId, mediator)).toBe(true);
      
      let approvalEventFired = false;
      escrow.onEmergencyApproved = (event) => {
        approvalEventFired = true;
        expect(event.currentApprovals).toBe(2);
      };
      
      expect(await escrow.approveEmergencyRelease(requestId, buyer)).toBe(true);
      expect(approvalEventFired).toBe(true);
    });

    it('should reject duplicate approvals', async () => {
      const requestId = await escrow.requestEmergencyRelease(escrowId, 'Emergency', buyer);
      
      expect(await escrow.approveEmergencyRelease(requestId, seller)).toBe(true);
      await expect(escrow.approveEmergencyRelease(requestId, seller)).rejects.toThrow('Already approved');
    });

    it('should execute emergency release when sufficient approvals', async () => {
      const requestId = await escrow.requestEmergencyRelease(escrowId, 'Emergency', buyer);
      
      await escrow.approveEmergencyRelease(requestId, seller);
      await escrow.approveEmergencyRelease(requestId, mediator);
      await escrow.approveEmergencyRelease(requestId, buyer);
      
      let executeEventFired = false;
      escrow.onEmergencyExecuted = (event) => {
        executeEventFired = true;
        expect(event.releasedTo).toBe(seller);
        expect(event.amount).toBe(1000);
      };
      
      expect(await escrow.executeEmergencyRelease(requestId, seller, admin)).toBe(true);
      expect(executeEventFired).toBe(true);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.EMERGENCY_RELEASE);
    });

    it('should reject execution with insufficient approvals', async () => {
      const requestId = await escrow.requestEmergencyRelease(escrowId, 'Emergency', buyer);
      
      await escrow.approveEmergencyRelease(requestId, seller);
      
      await expect(escrow.executeEmergencyRelease(requestId, seller, admin))
        .rejects.toThrow('Insufficient approvals');
    });
  });

  describe('Escrow Cancellation', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        1,
        admin
      );
    });

    it('should allow buyer to cancel pending escrow', async () => {
      expect(await escrow.cancelEscrow(escrowId, 'Changed mind', buyer)).toBe(true);
      
      const details = await escrow.getEscrowDetails(escrowId);
      expect(details.status).toBe(EscrowStatus.CANCELLED);
    });

    it('should allow seller to cancel pending escrow', async () => {
      expect(await escrow.cancelEscrow(escrowId, 'Buyer unresponsive', seller)).toBe(true);
    });

    it('should refund buyer when cancelling active escrow', async () => {
      await escrow.depositTokens(escrowId, 1000, 100, buyer);
      
      let cancelEventFired = false;
      escrow.onEscrowCancelled = (event) => {
        cancelEventFired = true;
        expect(event.refundedAmount).toBe(1000);
      };
      
      expect(await escrow.cancelEscrow(escrowId, 'Mutual agreement', buyer)).toBe(true);
      expect(cancelEventFired).toBe(true);
    });

    it('should reject cancellation from unauthorized user', async () => {
      await expect(escrow.cancelEscrow(escrowId, 'Trying to cancel', otherUser))
        .rejects.toThrow('Unauthorized to cancel');
    });
  });

  describe('Auto-release Functionality', () => {
    let escrowId: number;

    beforeEach(async () => {
      escrowId = await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 1000, // Very short time
        1,
        admin
      );
      await escrow.depositTokens(escrowId, 1000, 100, buyer);
    });

    it('should auto-release when time expires', (done) => {
      setTimeout(async () => {
        let autoReleaseEventFired = false;
        escrow.onAutoRelease = (event) => {
          autoReleaseEventFired = true;
          expect(event.reason).toBe('Time-based auto-release');
        };
        
        const processedCount = await escrow.processAutoReleases();
        expect(processedCount).toBe(1);
        expect(autoReleaseEventFired).toBe(true);
        
        const details = await escrow.getEscrowDetails(escrowId);
        expect(details.status).toBe(EscrowStatus.COMPLETED);
        
        done();
      }, 1100);
    });

    it('should not auto-release disputed escrows', (done) => {
      escrow.createDispute(escrowId, seller, 'Dispute', [], buyer).then(() => {
        setTimeout(async () => {
          const processedCount = await escrow.processAutoReleases();
          expect(processedCount).toBe(0);
          
          const details = await escrow.getEscrowDetails(escrowId);
          expect(details.status).toBe(EscrowStatus.DISPUTED);
          
          done();
        }, 1100);
      });
    });
  });

  describe('Admin Functions', () => {
    it('should allow admin to pause contract', async () => {
      expect(await escrow.pause(admin)).toBe(true);
      
      await expect(escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        1,
        admin
      )).rejects.toThrow('Contract is paused');
    });

    it('should allow admin to unpause contract', async () => {
      await escrow.pause(admin);
      expect(await escrow.unpause(admin)).toBe(true);
      
      expect(await escrow.createEscrow(
        buyer,
        seller,
        mediator,
        1000,
        100,
        Date.now() + 48 * 60 * 60 * 1000,
        1,
        admin
      )).toBe(4); // Next ID
    });

    it('should reject pause from non-admin', async () => {
      await expect(escrow.pause(buyer)).rejects.toThrow('Caller is not admin');
    });

    it('should allow admin to update penalty percent', async () => {
      expect(await escrow.updatePenaltyPercent(15, admin)).toBe(true);
    });

    it('should reject excessive penalty percent', async () => {
      await expect(escrow.updatePenaltyPercent(60, admin))
        .rejects.toThrow('cannot exceed 50%');
    });

    it('should allow admin to update emergency approvals', async () => {
      expect(await escrow.updateRequiredEmergencyApprovals(5, admin)).toBe(true);
    });

    it('should reject invalid emergency approval count', async () => {
      await expect(escrow.updateRequiredEmergencyApprovals(1, admin))
        .rejects.toThrow('Invalid emergency approval count');
    });
  });

  describe('Utility Functions', () => {
    it('should calculate penalty correctly', () => {
      const penalty = escrow.calculatePenalty(1000, 10);
      expect(penalty).toBe(100);
    });

    it('should check time expired', () => {
      expect(escrow.isTimeExpired(999)).toBe(true); // Past timestamp
      expect(escrow.isTimeExpired(Date.now() + 1000000)).toBe(false); // Future timestamp
    });

    it('should provide contract statistics', async () => {
      await escrow.createEscrow(buyer, seller, mediator, 1000, 100, Date.now() + 48 * 60 * 60 * 1000, 1, admin);
      await escrow.createEscrow(buyer + '2', seller + '2', mediator + '2', 1000, 100, Date.now() + 48 * 60 * 60 * 1000, 1, admin);
      
      const stats = await escrow.getContractStats();
      expect(stats.totalTrades).toBe(2);
      expect(stats.activeTrades).toBe(2);
      expect(stats.completedTrades).toBe(0);
    });

    it('should maintain audit trail', async () => {
      await escrow.createEscrow(buyer, seller, mediator, 1000, 100, Date.now() + 48 * 60 * 60 * 1000, 1, admin);
      
      const auditTrail = await escrow.getAuditTrail();
      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail[auditTrail.length - 1].action).toBe('ESCROW_CREATED');
    });
  });
});

describe('EscrowLib', () => {
  describe('Address Validation', () => {
    it('should validate correct addresses', () => {
      expect(EscrowLib.isValidAddress('0x' + 'a'.repeat(40))).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(EscrowLib.isValidAddress('invalid')).toBe(false);
      expect(EscrowLib.isValidAddress('0x' + 'a'.repeat(39))).toBe(false);
      expect(EscrowLib.isValidAddress('')).toBe(false);
    });
  });

  describe('Amount Validation', () => {
    it('should validate positive amounts', () => {
      expect(() => EscrowLib.validateAmount(100)).not.toThrow();
    });

    it('should reject zero or negative amounts', () => {
      expect(() => EscrowLib.validateAmount(0)).toThrow('must be positive');
      expect(() => EscrowLib.validateAmount(-100)).toThrow('must be positive');
    });

    it('should reject invalid numbers', () => {
      expect(() => EscrowLib.validateAmount(NaN)).toThrow('must be a valid number');
      expect(() => EscrowLib.validateAmount(Infinity)).toThrow('must be finite');
    });
  });

  describe('Penalty Calculations', () => {
    it('should calculate penalty correctly', () => {
      expect(EscrowLib.calculatePenaltyAmount(1000, 10)).toBe(100);
      expect(EscrowLib.calculatePenaltyAmount(500, 25)).toBe(125);
    });

    it('should reject excessive penalty percent', () => {
      expect(() => EscrowLib.calculatePenaltyAmount(1000, 60))
        .toThrow('cannot exceed 50%');
    });

    it('should calculate release after penalty', () => {
      expect(EscrowLib.calculateReleaseAfterPenalty(1000, 10)).toBe(900);
      expect(EscrowLib.calculateReleaseAfterPenalty(500, 25)).toBe(375);
    });
  });

  describe('Time Utilities', () => {
    it('should detect expired timestamps', () => {
      expect(EscrowLib.isTimeExpired(Date.now() - 1000)).toBe(true);
      expect(EscrowLib.isTimeExpired(Date.now() + 1000000)).toBe(false);
    });

    it('should validate timestamps', () => {
      expect(() => EscrowLib.validateTimestamp(Date.now())).not.toThrow();
      expect(() => EscrowLib.validateTimestamp(-1)).toThrow('must be positive');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow operations within limit', () => {
      const rateLimiter = EscrowLib.createRateLimiter(5, 1000);
      
      expect(rateLimiter.checkOperation('user1')).toBe(true);
      expect(rateLimiter.checkOperation('user1')).toBe(true);
      expect(rateLimiter.checkOperation('user1')).toBe(true);
    });

    it('should block operations exceeding limit', () => {
      const rateLimiter = EscrowLib.createRateLimiter(2, 1000);
      
      expect(rateLimiter.checkOperation('user1')).toBe(true);
      expect(rateLimiter.checkOperation('user1')).toBe(true);
      expect(rateLimiter.checkOperation('user1')).toBe(false);
    });

    it('should reset rate limit', () => {
      const rateLimiter = EscrowLib.createRateLimiter(2, 1000);
      
      rateLimiter.checkOperation('user1');
      rateLimiter.checkOperation('user1');
      expect(rateLimiter.checkOperation('user1')).toBe(false);
      
      rateLimiter.reset('user1');
      expect(rateLimiter.checkOperation('user1')).toBe(true);
    });
  });
});
