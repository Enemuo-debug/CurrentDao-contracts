/**
 * @title UpgradeManager Test Suite
 * @dev Comprehensive tests for the upgrade management system
 * @dev Tests proxy patterns, governance, state preservation, and security
 */

import { UpgradeManager } from '../../contracts/upgrade/UpgradeManager';
import { UpgradeProxy, ProxyFactory } from '../../contracts/upgrade/proxies/UpgradeProxy';
import {
  UpgradeProposalStruct,
  MigrationPlanStruct,
  MigrationStepStruct,
  UpgradeAnalyticsStruct
} from '../../contracts/upgrade/structures/UpgradeStructure';
import {
  UpgradeValidator,
  UpgradeSecurity,
  GasOptimizer,
  TimeUtils
} from '../../contracts/upgrade/libraries/UpgradeLib';
import {
  MigrationAction,
  UpgradeStatus,
  DEFAULT_UPGRADE_DELAY,
  DEFAULT_EXECUTION_WINDOW,
  ERROR_MESSAGES
} from '../../contracts/upgrade/interfaces/IUpgradeManager';

describe('UpgradeManager', () => {
  let upgradeManager: UpgradeManager;
  let admin: string;
  let proposer: string;
  let executor: string;
  let voter: string;
  let mockImplementation: string;
  let newImplementation: string;

  beforeEach(() => {
    admin = '0x1234567890123456789012345678901234567890';
    proposer = '0x2345678901234567890123456789012345678901';
    executor = '0x3456789012345678901234567890123456789012';
    voter = '0x4567890123456789012345678901234567890123';
    mockImplementation = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    newImplementation = '0xfedcbafedcbafedcbafedcbafedcbafedcbafed';

    upgradeManager = new UpgradeManager(admin);
  });

  describe('Initialization', () => {
    test('should initialize with correct defaults', () => {
      expect(upgradeManager.getProposalCount()).toBe(0);
      expect(upgradeManager.getSnapshotCount()).toBe(0);
      expect(upgradeManager.getProxyCount()).toBe(0);
    });

    test('should have correct initial configuration', async () => {
      const delay = await upgradeManager.getUpgradeDelay();
      const timelock = await upgradeManager.getTimelock();
      const paused = await upgradeManager.isPaused();

      expect(delay).toBe(DEFAULT_UPGRADE_DELAY);
      expect(timelock).toBe(0);
      expect(paused).toBe(false);
    });
  });

  describe('Upgrade Proposal', () => {
    let migrationPlan: any;

    beforeEach(() => {
      const steps = [
        new MigrationStepStruct(
          1,
          'Migrate storage slot 1',
          mockImplementation,
          MigrationAction.MIGRATE_STORAGE,
          '0x',
          []
        ),
        new MigrationStepStruct(
          2,
          'Update state variables',
          mockImplementation,
          MigrationAction.UPDATE_STATE,
          '0x',
          [1]
        )
      ];

      migrationPlan = new MigrationPlanStruct(
        steps,
        500000,
        300,
        false
      );
    });

    test('should create upgrade proposal successfully', async () => {
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      const proposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );

      expect(proposalId).toBe(1);
      expect(upgradeManager.getProposalCount()).toBe(1);

      const proposal = await upgradeManager.getProposal(proposalId);
      expect(proposal.id).toBe(proposalId);
      expect(proposal.newImplementation).toBe(newImplementation);
      expect(proposal.status).toBe(UpgradeStatus.PROPOSED);
    });

    test('should reject proposal with invalid implementation', async () => {
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      
      await expect(
        upgradeManager.proposeUpgrade(
          'invalid_address',
          'Test upgrade proposal',
          '0x',
          scheduledAt,
          DEFAULT_EXECUTION_WINDOW,
          migrationPlan
        )
      ).rejects.toThrow(ERROR_MESSAGES.INVALID_IMPLEMENTATION);
    });

    test('should reject proposal with insufficient delay', async () => {
      const scheduledAt = TimeUtils.now() + 3600; // 1 hour instead of minimum
      
      await expect(
        upgradeManager.proposeUpgrade(
          newImplementation,
          'Test upgrade proposal',
          '0x',
          scheduledAt,
          DEFAULT_EXECUTION_WINDOW,
          migrationPlan
        )
      ).rejects.toThrow('Upgrade must be scheduled at least');
    });

    test('should reject proposal with empty description', async () => {
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      
      await expect(
        upgradeManager.proposeUpgrade(
          newImplementation,
          '',
          '0x',
          scheduledAt,
          DEFAULT_EXECUTION_WINDOW,
          migrationPlan
        )
      ).rejects.toThrow('Description cannot be empty');
    });
  });

  describe('Upgrade Scheduling', () => {
    let proposalId: number;
    let migrationPlan: any;

    beforeEach(async () => {
      const steps = [
        new MigrationStepStruct(
          1,
          'Test migration',
          mockImplementation,
          MigrationAction.MIGRATE_STORAGE,
          '0x',
          []
        )
      ];

      migrationPlan = new MigrationPlanStruct(steps, 200000, 300, false);
      
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      proposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );
    });

    test('should schedule upgrade successfully', async () => {
      await upgradeManager.scheduleUpgrade(proposalId, 3);
      
      const proposal = await upgradeManager.getProposal(proposalId);
      expect(proposal.status).toBe(UpgradeStatus.SCHEDULED);
      expect(proposal.requiredApprovals).toBe(3);
    });

    test('should reject scheduling non-existent proposal', async () => {
      await expect(
        upgradeManager.scheduleUpgrade(999, 3)
      ).rejects.toThrow(ERROR_MESSAGES.PROPOSAL_NOT_FOUND);
    });

    test('should cancel upgrade successfully', async () => {
      await upgradeManager.scheduleUpgrade(proposalId, 3);
      await upgradeManager.cancelUpgrade(proposalId, 'Test cancellation');
      
      const proposal = await upgradeManager.getProposal(proposalId);
      expect(proposal.status).toBe(UpgradeStatus.CANCELLED);
    });
  });

  describe('Voting and Governance', () => {
    let proposalId: number;
    let migrationPlan: any;

    beforeEach(async () => {
      const steps = [
        new MigrationStepStruct(
          1,
          'Test migration',
          mockImplementation,
          MigrationAction.MIGRATE_STORAGE,
          '0x',
          []
        )
      ];

      migrationPlan = new MigrationPlanStruct(steps, 200000, 300, false);
      
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      proposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );
      
      await upgradeManager.scheduleUpgrade(proposalId, 3);
    });

    test('should cast vote successfully', async () => {
      await upgradeManager.voteUpgrade(proposalId, true, 'Looks good');
      
      const votes = await upgradeManager.getVotes(proposalId);
      expect(votes).toHaveLength(1);
      expect(votes[0].support).toBe(true);
      expect(votes[0].reason).toBe('Looks good');
    });

    test('should approve proposal with sufficient votes', async () => {
      // Cast 3 votes (required approvals)
      await upgradeManager.voteUpgrade(proposalId, true);
      await upgradeManager.voteUpgrade(proposalId, true);
      await upgradeManager.voteUpgrade(proposalId, true);
      
      const proposal = await upgradeManager.getProposal(proposalId);
      expect(proposal.status).toBe(UpgradeStatus.APPROVED);
    });

    test('should reject voting on non-scheduled proposal', async () => {
      await expect(
        upgradeManager.voteUpgrade(999, true)
      ).rejects.toThrow('Proposal not scheduled for voting');
    });
  });

  describe('Upgrade Execution', () => {
    let proposalId: number;
    let migrationPlan: any;

    beforeEach(async () => {
      const steps = [
        new MigrationStepStruct(
          1,
          'Test migration',
          mockImplementation,
          MigrationAction.MIGRATE_STORAGE,
          '0x',
          []
        )
      ];

      migrationPlan = new MigrationPlanStruct(steps, 200000, 300, false);
      
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      proposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );
      
      await upgradeManager.scheduleUpgrade(proposalId, 1);
      await upgradeManager.voteUpgrade(proposalId, true);
    });

    test('should execute upgrade successfully', async () => {
      // Mock execution window to be active
      jest.spyOn(TimeUtils, 'now').mockReturnValue(TimeUtils.now() + DEFAULT_UPGRADE_DELAY + 1);
      
      await upgradeManager.executeUpgrade(proposalId);
      
      const proposal = await upgradeManager.getProposal(proposalId);
      expect(proposal.status).toBe(UpgradeStatus.EXECUTED);
      expect(proposal.executionTime).toBeGreaterThan(0);
      expect(proposal.gasUsed).toBeGreaterThan(0);
    });

    test('should reject execution of non-approved proposal', async () => {
      // Create proposal without approval
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      const newProposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );
      
      await expect(
        upgradeManager.executeUpgrade(newProposalId)
      ).rejects.toThrow('Cannot execute upgrade');
    });
  });

  describe('State Management', () => {
    test('should create state snapshot successfully', async () => {
      const snapshotId = await upgradeManager.createStateSnapshot(mockImplementation);
      
      expect(snapshotId).toBeDefined();
      expect(upgradeManager.getSnapshotCount()).toBe(1);
      
      const snapshot = await upgradeManager.getStateSnapshot(snapshotId);
      expect(snapshot.contract).toBe(mockImplementation);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    test('should verify state snapshot integrity', async () => {
      const snapshotId = await upgradeManager.createStateSnapshot(mockImplementation);
      
      const isValid = await upgradeManager.verifyStateSnapshot(snapshotId);
      expect(isValid).toBe(true);
    });

    test('should restore from state snapshot', async () => {
      const snapshotId = await upgradeManager.createStateSnapshot(mockImplementation);
      
      await expect(
        upgradeManager.restoreFromSnapshot(snapshotId)
      ).resolves.not.toThrow();
    });

    test('should reject restoring non-existent snapshot', async () => {
      await expect(
        upgradeManager.restoreFromSnapshot('non_existent')
      ).rejects.toThrow(ERROR_MESSAGES.SNAPSHOT_NOT_FOUND);
    });
  });

  describe('Proxy Management', () => {
    let proxy: UpgradeProxy;
    let proxyAddress: string;

    beforeEach(() => {
      proxy = ProxyFactory.createProxy(admin, mockImplementation);
      proxyAddress = '0xproxy1234567890123456789012345678901234567890';
    });

    test('should get proxy information', async () => {
      const info = await upgradeManager.getProxyInfo(proxyAddress);
      expect(info.implementation).toBeDefined();
      expect(info.admin).toBeDefined();
      expect(info.upgradeCount).toBeGreaterThanOrEqual(0);
    });

    test('should upgrade proxy successfully', async () => {
      await expect(
        upgradeManager.upgradeProxy(proxyAddress, newImplementation)
      ).resolves.not.toThrow();
    });

    test('should upgrade proxy with call data', async () => {
      await expect(
        upgradeManager.upgradeProxy(proxyAddress, newImplementation, '0x123456')
      ).resolves.not.toThrow();
    });

    test('should get implementation address', async () => {
      const implementation = await upgradeManager.getImplementation(proxyAddress);
      expect(implementation).toBeDefined();
    });
  });

  describe('Analytics and Monitoring', () => {
    test('should get upgrade analytics', async () => {
      const analytics = await upgradeManager.getUpgradeAnalytics();
      expect(analytics.totalUpgrades).toBe(0);
      expect(analytics.successfulUpgrades).toBe(0);
      expect(analytics.failedUpgrades).toBe(0);
      expect(analytics.rolledBackUpgrades).toBe(0);
    });

    test('should get upgrade history', async () => {
      const history = await upgradeManager.getUpgradeHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    test('should get active proposals', async () => {
      const activeProposals = await upgradeManager.getActiveProposals();
      expect(Array.isArray(activeProposals)).toBe(true);
    });

    test('should limit upgrade history', async () => {
      const history = await upgradeManager.getUpgradeHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Validation and Security', () => {
    let proposalId: number;
    let migrationPlan: any;

    beforeEach(async () => {
      const steps = [
        new MigrationStepStruct(
          1,
          'Test migration',
          mockImplementation,
          MigrationAction.MIGRATE_STORAGE,
          '0x',
          []
        )
      ];

      migrationPlan = new MigrationPlanStruct(steps, 200000, 300, false);
      
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      proposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );
    });

    test('should validate upgrade successfully', async () => {
      const isValid = await upgradeManager.validateUpgrade(proposalId);
      expect(isValid).toBe(true);
    });

    test('should validate implementation address', async () => {
      const isValid = await upgradeManager.validateImplementation(newImplementation);
      expect(isValid).toBe(true);
      
      const isInvalid = await upgradeManager.validateImplementation('invalid');
      expect(isInvalid).toBe(false);
    });

    test('should check compatibility', async () => {
      const isCompatible = await upgradeManager.checkCompatibility(
        mockImplementation,
        newImplementation
      );
      expect(isCompatible).toBe(true);
    });
  });

  describe('Emergency Functions', () => {
    test('should emergency pause successfully', async () => {
      await upgradeManager.emergencyPause();
      
      const paused = await upgradeManager.isPaused();
      expect(paused).toBe(true);
    });

    test('should emergency unpause successfully', async () => {
      await upgradeManager.emergencyPause();
      await upgradeManager.emergencyUnpause();
      
      const paused = await upgradeManager.isPaused();
      expect(paused).toBe(false);
    });

    test('should emergency upgrade successfully', async () => {
      await expect(
        upgradeManager.emergencyUpgrade(
          newImplementation,
          'Emergency fix',
          false
        )
      ).resolves.not.toThrow();
    });

    test('should emergency upgrade with multisig requirement', async () => {
      await expect(
        upgradeManager.emergencyUpgrade(
          newImplementation,
          'Emergency fix',
          true
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should set upgrade delay', async () => {
      await upgradeManager.setUpgradeDelay(86400); // 1 day
      
      const delay = await upgradeManager.getUpgradeDelay();
      expect(delay).toBe(86400);
    });

    test('should reject invalid upgrade delay', async () => {
      await expect(
        upgradeManager.setUpgradeDelay(3600) // Too low
      ).rejects.toThrow('Invalid upgrade delay');
    });

    test('should set timelock', async () => {
      await upgradeManager.setTimelock(3600);
      
      const timelock = await upgradeManager.getTimelock();
      expect(timelock).toBe(3600);
    });

    test('should set governance contract', async () => {
      const governance = '0xgovernance1234567890123456789012345678901234';
      
      await expect(
        upgradeManager.setGovernanceContract(governance)
      ).resolves.not.toThrow();
    });

    test('should set security module', async () => {
      const security = '0xsecurity123456789012345678901234567890123456';
      
      await expect(
        upgradeManager.setSecurityModule(security)
      ).resolves.not.toThrow();
    });
  });

  describe('Rollback Functionality', () => {
    let proposalId: number;
    let migrationPlan: any;

    beforeEach(async () => {
      const steps = [
        new MigrationStepStruct(
          1,
          'Test migration',
          mockImplementation,
          MigrationAction.MIGRATE_STORAGE,
          '0x',
          []
        )
      ];

      migrationPlan = new MigrationPlanStruct(steps, 200000, 300, false);
      
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      proposalId = await upgradeManager.proposeUpgrade(
        newImplementation,
        'Test upgrade proposal',
        '0x',
        scheduledAt,
        DEFAULT_EXECUTION_WINDOW,
        migrationPlan
      );
      
      await upgradeManager.scheduleUpgrade(proposalId, 1);
      await upgradeManager.voteUpgrade(proposalId, true);
    });

    test('should rollback executed upgrade', async () => {
      // Execute upgrade first
      jest.spyOn(TimeUtils, 'now').mockReturnValue(TimeUtils.now() + DEFAULT_UPGRADE_DELAY + 1);
      await upgradeManager.executeUpgrade(proposalId);
      
      // Then rollback
      await expect(
        upgradeManager.rollbackUpgrade(proposalId, 'Test rollback')
      ).resolves.not.toThrow();
      
      const proposal = await upgradeManager.getProposal(proposalId);
      expect(proposal.status).toBe(UpgradeStatus.ROLLED_BACK);
    });

    test('should reject rollback of non-executed upgrade', async () => {
      await expect(
        upgradeManager.rollbackUpgrade(proposalId, 'Test rollback')
      ).rejects.toThrow('Cannot rollback non-executed upgrade');
    });
  });

  describe('Error Handling', () => {
    test('should handle proposal not found error', async () => {
      await expect(
        upgradeManager.getProposal(999)
      ).rejects.toThrow(ERROR_MESSAGES.PROPOSAL_NOT_FOUND);
    });

    test('should handle snapshot not found error', async () => {
      await expect(
        upgradeManager.getStateSnapshot('non_existent')
      ).rejects.toThrow(ERROR_MESSAGES.SNAPSHOT_NOT_FOUND);
    });

    test('should handle operations when paused', async () => {
      await upgradeManager.emergencyPause();
      
      const scheduledAt = TimeUtils.now() + DEFAULT_UPGRADE_DELAY;
      
      await expect(
        upgradeManager.proposeUpgrade(
          newImplementation,
          'Test upgrade proposal',
          '0x',
          scheduledAt,
          DEFAULT_EXECUTION_WINDOW,
          new MigrationPlanStruct([], 200000, 300, false)
        )
      ).rejects.toThrow(ERROR_MESSAGES.UPGRADE_PAUSED);
    });
  });
});

describe('UpgradeProxy', () => {
  let proxy: UpgradeProxy;
  let admin: string;
  let implementation: string;
  let newImplementation: string;

  beforeEach(() => {
    admin = '0x1234567890123456789012345678901234567890';
    implementation = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    newImplementation = '0xfedcbafedcbafedcbafedcbafedcbafedcbafed';
    
    proxy = ProxyFactory.createProxy(admin, implementation);
  });

  describe('Initialization', () => {
    test('should initialize with correct parameters', () => {
      expect(proxy.getAdmin()).toBe(admin);
      expect(proxy.getImplementation()).toBe(implementation);
      expect(proxy.getUpgradeCount()).toBe(0);
    });

    test('should get proxy information', () => {
      const info = proxy.getProxyInfo();
      expect(info.admin).toBe(admin);
      expect(info.implementation).toBe(implementation);
      expect(info.isInitialized).toBe(false);
      expect(info.upgradeCount).toBe(0);
    });
  });

  describe('Upgrade Operations', () => {
    test('should upgrade implementation successfully', () => {
      proxy.upgradeTo(newImplementation, admin);
      
      expect(proxy.getImplementation()).toBe(newImplementation);
      expect(proxy.getUpgradeCount()).toBe(1);
      expect(proxy.getVersion()).not.toBe('1.0.0');
    });

    test('should upgrade and call successfully', () => {
      proxy.upgradeToAndCall(newImplementation, '0x123456', admin);
      
      expect(proxy.getImplementation()).toBe(newImplementation);
      expect(proxy.getUpgradeCount()).toBe(1);
    });

    test('should reject upgrade from non-admin', () => {
      const nonAdmin = '0xnonadmin1234567890123456789012345678901234';
      
      expect(() => {
        proxy.upgradeTo(newImplementation, nonAdmin);
      }).toThrow('Caller is not admin');
    });

    test('should reject upgrade to same implementation', () => {
      expect(() => {
        proxy.upgradeTo(implementation, admin);
      }).toThrow('New implementation cannot be same as current');
    });

    test('should reject upgrade to invalid address', () => {
      expect(() => {
        proxy.upgradeTo('invalid', admin);
      }).toThrow('Invalid implementation address');
    });
  });

  describe('Admin Operations', () => {
    test('should change admin successfully', () => {
      const newAdmin = '0xnewadmin1234567890123456789012345678901234';
      
      proxy.changeAdmin(newAdmin, admin);
      
      expect(proxy.getAdmin()).toBe(newAdmin);
    });

    test('should reject admin change from non-admin', () => {
      const nonAdmin = '0xnonadmin1234567890123456789012345678901234';
      const newAdmin = '0xnewadmin1234567890123456789012345678901234';
      
      expect(() => {
        proxy.changeAdmin(newAdmin, nonAdmin);
      }).toThrow('Caller is not admin');
    });

    test('should reject admin change to same address', () => {
      expect(() => {
        proxy.changeAdmin(admin, admin);
      }).toThrow('New admin cannot be same as current admin');
    });
  });

  describe('Pause Operations', () => {
    test('should pause successfully', () => {
      proxy.pause(admin);
      expect(proxy.isPaused()).toBe(true);
    });

    test('should unpause successfully', () => {
      proxy.pause(admin);
      proxy.unpause(admin);
      expect(proxy.isPaused()).toBe(false);
    });

    test('should reject pause from non-admin', () => {
      const nonAdmin = '0xnonadmin1234567890123456789012345678901234';
      
      expect(() => {
        proxy.pause(nonAdmin);
      }).toThrow('Caller is not admin');
    });
  });

  describe('Emergency Operations', () => {
    test('should emergency upgrade successfully', () => {
      proxy.emergencyUpgrade(newImplementation, '0x', admin);
      
      expect(proxy.getImplementation()).toBe(newImplementation);
      expect(proxy.getVersion()).toContain('emergency');
    });

    test('should rollback successfully', () => {
      proxy.upgradeTo(newImplementation, admin);
      proxy.rollbackTo(implementation, admin);
      
      expect(proxy.getImplementation()).toBe(implementation);
      expect(proxy.getVersion()).toContain('rollback');
    });
  });

  describe('State Management', () => {
    test('should create state snapshot', () => {
      const snapshotId = proxy.createStateSnapshot();
      expect(snapshotId).toBeDefined();
      expect(typeof snapshotId).toBe('string');
    });

    test('should restore from snapshot', () => {
      const snapshotId = proxy.createStateSnapshot();
      
      expect(() => {
        proxy.restoreFromSnapshot('{"test": "data"}', admin);
      }).not.toThrow();
    });

    test('should validate state', () => {
      const isValid = proxy.validateState();
      expect(isValid).toBe(true);
    });
  });

  describe('Gas Estimation', () => {
    test('should estimate gas for operations', () => {
      const upgradeGas = proxy.getGasEstimate('upgrade');
      const pauseGas = proxy.getGasEstimate('pause');
      
      expect(upgradeGas).toBeGreaterThan(0);
      expect(pauseGas).toBeGreaterThan(0);
    });

    test('should return default gas for unknown operation', () => {
      const gas = proxy.getGasEstimate('unknown');
      expect(gas).toBe(50000);
    });
  });
});

describe('UpgradeLib', () => {
  describe('UpgradeValidator', () => {
    test('should validate valid address', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(UpgradeValidator.isValidAddress(address)).toBe(true);
    });

    test('should reject invalid address', () => {
      expect(UpgradeValidator.isValidAddress('invalid')).toBe(false);
      expect(UpgradeValidator.isValidAddress('0x123')).toBe(false);
    });

    test('should validate compatibility', () => {
      const current = '0x1234567890123456789012345678901234567890';
      const newImpl = '0x2345678901234567890123456789012345678901';
      
      expect(UpgradeValidator.validateCompatibility(current, newImpl)).toBe(true);
      expect(UpgradeValidator.validateCompatibility(current, current)).toBe(false);
    });
  });

  describe('UpgradeSecurity', () => {
    test('should generate hash', () => {
      const data = 'test data';
      const hash = UpgradeSecurity.generateHash(data);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA256 hex length
    });

    test('should generate secure ID', () => {
      const id = UpgradeSecurity.generateSecureId();
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(32); // 16 bytes in hex
    });

    test('should validate upgrade data', () => {
      const safeData = '0x123456';
      const dangerousData = 'selfdestruct()';
      
      expect(UpgradeSecurity.validateUpgradeData(safeData)).toBe(true);
      expect(UpgradeSecurity.validateUpgradeData(dangerousData)).toBe(false);
    });
  });

  describe('GasOptimizer', () => {
    test('should estimate upgrade gas', () => {
      const migrationPlan = new MigrationPlanStruct(
        [new MigrationStepStruct(1, 'Test', '0x', MigrationAction.MIGRATE_STORAGE, '0x', [])],
        200000,
        300,
        false
      );
      
      const gas = GasOptimizer.estimateUpgradeGas(migrationPlan);
      expect(gas).toBeGreaterThan(0);
    });

    test('should optimize migration plan', () => {
      const steps = [
        new MigrationStepStruct(2, 'Expensive', '0x', MigrationAction.MIGRATE_STORAGE, '0x', []),
        new MigrationStepStruct(1, 'Cheap', '0x', MigrationAction.VALIDATE_STATE, '0x', [])
      ];
      
      const plan = new MigrationPlanStruct(steps, 400000, 300, false);
      const optimized = GasOptimizer.optimizeMigrationPlan(plan);
      
      expect(optimized.steps[0].id).toBe(1); // Cheap step first
      expect(optimized.steps[1].id).toBe(2); // Expensive step second
    });

    test('should batch operations', () => {
      const operations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const batches = GasOptimizer.batchOperations(operations, 3);
      
      expect(batches).toHaveLength(4);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[3]).toEqual([10]);
    });
  });

  describe('TimeUtils', () => {
    test('should get current timestamp', () => {
      const now = TimeUtils.now();
      expect(now).toBeGreaterThan(0);
      expect(now).toBeLessThan(Date.now() / 1000 + 1);
    });

    test('should check if time is past', () => {
      const past = TimeUtils.now() - 1000;
      const future = TimeUtils.now() + 1000;
      
      expect(TimeUtils.isPast(past)).toBe(true);
      expect(TimeUtils.isPast(future)).toBe(false);
    });

    test('should check if time is future', () => {
      const past = TimeUtils.now() - 1000;
      const future = TimeUtils.now() + 1000;
      
      expect(TimeUtils.isFuture(past)).toBe(false);
      expect(TimeUtils.isFuture(future)).toBe(true);
    });

    test('should calculate time remaining', () => {
      const future = TimeUtils.now() + 1000;
      const remaining = TimeUtils.getTimeRemaining(future);
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(1000);
    });

    test('should check execution window', () => {
      const scheduledAt = TimeUtils.now();
      const window = 3600;
      const within = scheduledAt + 1800;
      const outside = scheduledAt + 7200;
      
      expect(TimeUtils.isInExecutionWindow(within, scheduledAt, window)).toBe(true);
      expect(TimeUtils.isInExecutionWindow(outside, scheduledAt, window)).toBe(false);
    });
  });
});
