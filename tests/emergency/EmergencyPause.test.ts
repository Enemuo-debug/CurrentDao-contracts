import { EmergencyPause } from '../../contracts/emergency/EmergencyPause';
import { EmergencyGovernance } from '../../contracts/emergency/governance/EmergencyGovernance';
import { EmergencyLib } from '../../contracts/emergency/libraries/EmergencyLib';
import { 
  PauseLevel, 
  EmergencyConfig,
  GovernanceAction,
  DEFAULT_EMERGENCY_CONFIG
} from '../../contracts/emergency/structures/PauseStructure';
import { EmergencyPauseError } from '../../contracts/emergency/interfaces/IEmergencyPause';

describe('EmergencyPause', () => {
  let emergencyPause: EmergencyPause;
  let governanceMembers: string[];
  let testConfig: EmergencyConfig;

  beforeEach(() => {
    governanceMembers = [
      '0x1234567890123456789012345678901234567890',
      '0x2345678901234567890123456789012345678901',
      '0x3456789012345678901234567890123456789012',
      '0x4567890123456789012345678901234567890123',
      '0x5678901234567890123456789012345678901234'
    ];

    testConfig = {
      ...DEFAULT_EMERGENCY_CONFIG,
      governanceMembers,
      criticalContracts: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        '0x3333333333333333333333333333333333333333'
      ]
    };

    emergencyPause = new EmergencyPause(governanceMembers, testConfig);
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const pause = new EmergencyPause(governanceMembers);
      expect(pause).toBeInstanceOf(EmergencyPause);
    });

    it('should initialize with custom configuration', () => {
      const pause = new EmergencyPause(governanceMembers, testConfig);
      expect(pause).toBeInstanceOf(EmergencyPause);
    });

    it('should initialize with custom event handlers', () => {
      const eventHandlers = {
        EmergencyPauseInitiated: jest.fn(),
        EmergencyPauseResumed: jest.fn(),
        GovernanceActionExecuted: jest.fn(),
        AutoResumeTriggered: jest.fn(),
        EmergencyConfigUpdated: jest.fn()
      };

      const pause = new EmergencyPause(governanceMembers, testConfig, eventHandlers);
      expect(pause).toBeInstanceOf(EmergencyPause);
    });
  });

  describe('emergencyPause', () => {
    it('should initiate emergency pause at SELECTIVE level', async () => {
      const affectedContracts = ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'];
      
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Security threat detected',
        3600,
        affectedContracts
      );

      const status = await emergencyPause.getPauseStatus();
      expect(status.level).toBe(PauseLevel.SELECTIVE);
      expect(status.isActive).toBe(true);
      expect(status.reason).toBe('Security threat detected');
      expect(status.affectedContracts).toEqual(affectedContracts);
    });

    it('should initiate emergency pause at PARTIAL level', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.PARTIAL,
        'Critical bug discovered',
        7200,
        []
      );

      const status = await emergencyPause.getPauseStatus();
      expect(status.level).toBe(PauseLevel.PARTIAL);
      expect(status.isActive).toBe(true);
      expect(status.affectedContracts).toEqual(testConfig.criticalContracts);
    });

    it('should initiate emergency pause at FULL level', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.FULL,
        'System-wide emergency',
        86400,
        []
      );

      const status = await emergencyPause.getPauseStatus();
      expect(status.level).toBe(PauseLevel.FULL);
      expect(status.isActive).toBe(true);
    });

    it('should reject pause with invalid level', async () => {
      await expect(
        emergencyPause.emergencyPause(
          PauseLevel.NONE,
          'Invalid pause',
          3600,
          []
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should reject pause with empty reason', async () => {
      await expect(
        emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          '',
          3600,
          ['0x1111111111111111111111111111111111111111']
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should reject pause with excessive duration', async () => {
      await expect(
        emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          'Valid reason',
          10000, // Exceeds max duration for SELECTIVE
          ['0x1111111111111111111111111111111111111111']
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should reject selective pause without affected contracts', async () => {
      await expect(
        emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          'Valid reason',
          3600,
          []
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should reject pause when already active', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'First pause',
        3600,
        ['0x1111111111111111111111111111111111111111']
      );

      await expect(
        emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          'Second pause',
          3600,
          ['0x2222222222222222222222222222222222222222']
        )
      ).rejects.toThrow(EmergencyPauseError.EMERGENCY_ALREADY_ACTIVE);
    });

    it('should reject pause with invalid contract addresses', async () => {
      await expect(
        emergencyPause.emergencyPause(
          PauseLevel.SELECTIVE,
          'Valid reason',
          3600,
          ['invalid_address']
        )
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('resumeOperations', () => {
    beforeEach(async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Test pause',
        3600,
        ['0x1111111111111111111111111111111111111111']
      );
    });

    it('should resume operations with sufficient signatures', async () => {
      const signatures = ['sig1', 'sig2', 'sig3'];
      
      await emergencyPause.resumeOperations(
        PauseLevel.SELECTIVE,
        signatures,
        'proof'
      );

      const status = await emergencyPause.getPauseStatus();
      expect(status.isActive).toBe(false);
    });

    it('should reject resume with insufficient signatures', async () => {
      const signatures = ['sig1']; // Less than required
      
      await expect(
        emergencyPause.resumeOperations(
          PauseLevel.SELECTIVE,
          signatures,
          'proof'
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should reject resume when no pause is active', async () => {
      // First resume
      await emergencyPause.resumeOperations(
        PauseLevel.SELECTIVE,
        ['sig1', 'sig2', 'sig3'],
        'proof'
      );

      // Second resume should fail
      await expect(
        emergencyPause.resumeOperations(
          PauseLevel.SELECTIVE,
          ['sig1', 'sig2', 'sig3'],
          'proof'
        )
      ).rejects.toThrow('Validation failed');
    });

    it('should reject resume with wrong pause level', async () => {
      await expect(
        emergencyPause.resumeOperations(
          PauseLevel.PARTIAL,
          ['sig1', 'sig2', 'sig3'],
          'proof'
        )
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('triggerAutoResume', () => {
    it('should trigger auto-resume when conditions are met', async () => {
      // Create pause with auto-resume enabled
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Test pause',
        1, // 1 second duration
        ['0x1111111111111111111111111111111111111111']
      );

      // Wait for auto-resume time (in real implementation)
      // For testing, we'll manually trigger
      await emergencyPause.triggerAutoResume();

      const status = await emergencyPause.getPauseStatus();
      expect(status.isActive).toBe(false);
    });

    it('should reject auto-resume when conditions not met', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Test pause',
        3600, // Long duration
        ['0x1111111111111111111111111111111111111111']
      );

      await expect(
        emergencyPause.triggerAutoResume()
      ).rejects.toThrow(EmergencyPauseError.AUTO_RESUME_CONDITIONS_NOT_MET);
    });
  });

  describe('isContractPaused', () => {
    it('should return true for paused contracts', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Test pause',
        3600,
        ['0x1111111111111111111111111111111111111111']
      );

      const isPaused = await emergencyPause.isContractPaused('0x1111111111111111111111111111111111111111');
      expect(isPaused).toBe(true);
    });

    it('should return false for non-paused contracts', async () => {
      const isPaused = await emergencyPause.isContractPaused('0x1111111111111111111111111111111111111111');
      expect(isPaused).toBe(false);
    });
  });

  describe('getAffectedContracts', () => {
    it('should return affected contracts for SELECTIVE level', async () => {
      const affectedContracts = ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'];
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Test pause',
        3600,
        affectedContracts
      );

      const contracts = await emergencyPause.getAffectedContracts(PauseLevel.SELECTIVE);
      expect(contracts).toEqual(affectedContracts);
    });

    it('should return critical contracts for PARTIAL level', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.PARTIAL,
        'Test pause',
        3600,
        []
      );

      const contracts = await emergencyPause.getAffectedContracts(PauseLevel.PARTIAL);
      expect(contracts).toEqual(testConfig.criticalContracts);
    });

    it('should return empty array for NONE level', async () => {
      const contracts = await emergencyPause.getAffectedContracts(PauseLevel.NONE);
      expect(contracts).toEqual([]);
    });
  });

  describe('getPauseAnalytics', () => {
    it('should return analytics data', async () => {
      await emergencyPause.emergencyPause(
        PauseLevel.SELECTIVE,
        'Test pause',
        3600,
        ['0x1111111111111111111111111111111111111111']
      );

      const analytics = await emergencyPause.getPauseAnalytics();
      expect(analytics.totalPauses).toBe(1);
      expect(analytics.pauseHistory).toHaveLength(1);
      expect(analytics.lastPauseTime).toBeGreaterThan(0);
    });

    it('should return zero analytics for no pauses', async () => {
      const analytics = await emergencyPause.getPauseAnalytics();
      expect(analytics.totalPauses).toBe(0);
      expect(analytics.averageDuration).toBe(0);
      expect(analytics.pauseFrequency).toBe(0);
    });
  });

  describe('getGasOptimizationData', () => {
    it('should return gas optimization data', async () => {
      const gasData = await emergencyPause.getGasOptimizationData();
      expect(gasData.pauseGasCost).toBeGreaterThan(0);
      expect(gasData.resumeGasCost).toBeGreaterThan(0);
      expect(gasData.notificationGasCost).toBeGreaterThan(0);
    });
  });

  describe('Governance Operations', () => {
    describe('addGovernanceMember', () => {
      it('should add new governance member', async () => {
        const newMember = '0x1111111111111111111111111111111111111111';
        const signatures = ['sig1', 'sig2', 'sig3'];
        
        await emergencyPause.addGovernanceMember(newMember, signatures);
        
        const stats = emergencyPause.getGovernanceStats();
        expect(stats.totalMembers).toBe(governanceMembers.length + 1);
      });
    });

    describe('removeGovernanceMember', () => {
      it('should remove governance member', async () => {
        const memberToRemove = governanceMembers[0];
        const signatures = ['sig1', 'sig2', 'sig3'];
        
        await emergencyPause.removeGovernanceMember(memberToRemove, signatures);
        
        const stats = emergencyPause.getGovernanceStats();
        expect(stats.totalMembers).toBe(governanceMembers.length - 1);
      });
    });

    describe('validateGovernanceAction', () => {
      it('should validate governance action with sufficient signatures', async () => {
        const signatures = ['sig1', 'sig2', 'sig3'];
        
        const isValid = await emergencyPause.validateGovernanceAction(
          GovernanceAction.UPDATE_CONFIG,
          signatures
        );
        
        expect(isValid).toBe(true);
      });

      it('should reject governance action with insufficient signatures', async () => {
        const signatures = ['sig1'];
        
        const isValid = await emergencyPause.validateGovernanceAction(
          GovernanceAction.UPDATE_CONFIG,
          signatures
        );
        
        expect(isValid).toBe(false);
      });
    });
  });

  describe('updateEmergencyConfig', () => {
    it('should update emergency configuration', async () => {
      const newConfig: EmergencyConfig = {
        ...testConfig,
        requiredSignatures: 4
      };
      const signatures = ['sig1', 'sig2', 'sig3', 'sig4'];
      
      await emergencyPause.updateEmergencyConfig(newConfig, signatures);
      
      const config = await emergencyPause.getEmergencyConfig();
      expect(config.requiredSignatures).toBe(4);
    });

    it('should reject config update with insufficient signatures', async () => {
      const newConfig: EmergencyConfig = {
        ...testConfig,
        requiredSignatures: 4
      };
      const signatures = ['sig1', 'sig2']; // Insufficient
      
      await expect(
        emergencyPause.updateEmergencyConfig(newConfig, signatures)
      ).rejects.toThrow('Governance validation failed');
    });
  });

  describe('Utility Methods', () => {
    it('should get contract pause state', () => {
      const state = emergencyPause.getContractPauseState('0x1111111111111111111111111111111111111111');
      expect(state).toBeUndefined(); // No pause initiated yet
    });

    it('should get notifications', () => {
      const notifications = emergencyPause.getNotifications();
      expect(notifications).toEqual([]); // No notifications yet
    });

    it('should check if auto-resume should be triggered', () => {
      const shouldResume = emergencyPause.shouldAutoResume();
      expect(typeof shouldResume).toBe('boolean');
    });

    it('should get emergency metrics', () => {
      const metrics = emergencyPause.getEmergencyMetrics();
      expect(metrics.responseTime).toBe(0); // No events yet
      expect(metrics.haltTime).toBe(0);
      expect(metrics.resumeTime).toBe(0);
    });
  });
});

describe('EmergencyGovernance', () => {
  let governance: EmergencyGovernance;
  const members = [
    '0x1234567890123456789012345678901234567890',
    '0x2345678901234567890123456789012345678901',
    '0x3456789012345678901234567890123456789012'
  ];

  beforeEach(() => {
    governance = new EmergencyGovernance(members, 2);
  });

  describe('Constructor', () => {
    it('should initialize with correct parameters', () => {
      expect(governance.getGovernanceMembers()).toEqual(members);
      expect(governance.getRequiredSignatures()).toBe(2);
    });

    it('should reject insufficient members', () => {
      expect(() => {
        new EmergencyGovernance(['0x1234567890123456789012345678901234567890'], 2);
      }).toThrow('Minimum 3 governance members required');
    });

    it('should reject too many members', () => {
      const tooManyMembers = Array(25).fill('0x1234567890123456789012345678901234567890');
      expect(() => {
        new EmergencyGovernance(tooManyMembers, 2);
      }).toThrow('Maximum 20 governance members allowed');
    });
  });

  describe('createProposal', () => {
    it('should create governance proposal', () => {
      const proposal = governance.createProposal(
        GovernanceAction.ADD_MEMBER,
        members[0],
        undefined,
        undefined,
        '0x1111111111111111111111111111111111111111'
      );

      expect(proposal.action).toBe(GovernanceAction.ADD_MEMBER);
      expect(proposal.proposer).toBe(members[0]);
      expect(proposal.targetMember).toBe('0x1111111111111111111111111111111111111111');
      expect(proposal.executed).toBe(false);
    });

    it('should reject proposal from non-member', () => {
      expect(() => {
        governance.createProposal(
          GovernanceAction.ADD_MEMBER,
          '0x1111111111111111111111111111111111111111',
          undefined,
          undefined,
          '0x2222222222222222222222222222222222222222'
        );
      }).toThrow(EmergencyPauseError.UNAUTHORIZED_GOVERNANCE_ACTION);
    });
  });

  describe('signProposal', () => {
    let proposalId: string;

    beforeEach(() => {
      const proposal = governance.createProposal(
        GovernanceAction.ADD_MEMBER,
        members[0],
        undefined,
        undefined,
        '0x1111111111111111111111111111111111111111'
      );
      proposalId = proposal.id;
    });

    it('should add signature to proposal', () => {
      governance.signProposal(proposalId, members[1], 'sig1');
      
      const proposal = governance.getProposal(proposalId);
      expect(proposal?.signatures).toContain('sig1');
    });

    it('should execute proposal when threshold reached', () => {
      governance.signProposal(proposalId, members[1], 'sig1');
      governance.signProposal(proposalId, members[2], 'sig2');
      
      const proposal = governance.getProposal(proposalId);
      expect(proposal?.executed).toBe(true);
    });

    it('should reject signature from non-member', () => {
      expect(() => {
        governance.signProposal(proposalId, '0x1111111111111111111111111111111111111111', 'sig1');
      }).toThrow(EmergencyPauseError.UNAUTHORIZED_GOVERNANCE_ACTION);
    });
  });

  describe('isGovernanceMember', () => {
    it('should return true for members', () => {
      expect(governance.isGovernanceMember(members[0])).toBe(true);
    });

    it('should return false for non-members', () => {
      expect(governance.isGovernanceMember('0x1111111111111111111111111111111111111111')).toBe(false);
    });
  });

  describe('getGovernanceStats', () => {
    it('should return governance statistics', () => {
      const stats = governance.getGovernanceStats();
      expect(stats.totalMembers).toBe(3);
      expect(stats.requiredSignatures).toBe(2);
      expect(stats.totalProposals).toBe(0);
      expect(stats.activeProposals).toBe(0);
      expect(stats.executedProposals).toBe(0);
    });
  });
});

describe('EmergencyLib', () => {
  const config: EmergencyConfig = {
    ...DEFAULT_EMERGENCY_CONFIG,
    governanceMembers: ['0x1234567890123456789012345678901234567890', '0x2345678901234567890123456789012345678901', '0x3456789012345678901234567890123456789012']
  };

  describe('validatePauseRequest', () => {
    it('should validate correct pause request', () => {
      const result = EmergencyLib.validatePauseRequest(
        PauseLevel.SELECTIVE,
        'Valid reason',
        3600,
        ['0x1111111111111111111111111111111111111111'],
        config
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid pause level', () => {
      const result = EmergencyLib.validatePauseRequest(
        PauseLevel.NONE,
        'Valid reason',
        3600,
        ['0x1111111111111111111111111111111111111111'],
        config
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid pause level: NONE');
    });

    it('should reject empty reason', () => {
      const result = EmergencyLib.validatePauseRequest(
        PauseLevel.SELECTIVE,
        '',
        3600,
        ['0x1111111111111111111111111111111111111111'],
        config
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Pause reason cannot be empty');
    });

    it('should reject excessive duration', () => {
      const result = EmergencyLib.validatePauseRequest(
        PauseLevel.SELECTIVE,
        'Valid reason',
        10000,
        ['0x1111111111111111111111111111111111111111'],
        config
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duration exceeds maximum');
    });
  });

  describe('validateResumeRequest', () => {
    const pauseStatus = {
      level: PauseLevel.SELECTIVE,
      isActive: true,
      startTime: Math.floor(Date.now() / 1000) - 3600,
      duration: 3600,
      reason: 'Test pause',
      initiator: '0x1234567890123456789012345678901234567890',
      affectedContracts: ['0x1111111111111111111111111111111111111111'],
      autoResumeTime: 0,
      lastUpdateTime: Math.floor(Date.now() / 1000) - 3600
    };

    it('should validate correct resume request', () => {
      const result = EmergencyLib.validateResumeRequest(
        PauseLevel.SELECTIVE,
        ['sig1', 'sig2'],
        pauseStatus,
        config
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject resume when not active', () => {
      const inactiveStatus = { ...pauseStatus, isActive: false };
      
      const result = EmergencyLib.validateResumeRequest(
        PauseLevel.SELECTIVE,
        ['sig1', 'sig2'],
        inactiveStatus,
        config
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No active pause to resume');
    });
  });

  describe('shouldAutoResume', () => {
    it('should return true when conditions are met', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 100;
      const status = {
        level: PauseLevel.SELECTIVE,
        isActive: true,
        startTime: pastTime - 3600,
        duration: 3600,
        reason: 'Test',
        initiator: '0x1234567890123456789012345678901234567890',
        affectedContracts: [],
        autoResumeTime: pastTime,
        lastUpdateTime: pastTime
      };

      const result = EmergencyLib.shouldAutoResume(status, config);
      expect(result).toBe(true);
    });

    it('should return false when conditions not met', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      const status = {
        level: PauseLevel.SELECTIVE,
        isActive: true,
        startTime: Math.floor(Date.now() / 1000) - 100,
        duration: 3600,
        reason: 'Test',
        initiator: '0x1234567890123456789012345678901234567890',
        affectedContracts: [],
        autoResumeTime: futureTime,
        lastUpdateTime: Math.floor(Date.now() / 1000) - 100
      };

      const result = EmergencyLib.shouldAutoResume(status, config);
      expect(result).toBe(false);
    });
  });

  describe('calculateAnalytics', () => {
    it('should calculate correct analytics', () => {
      const events = [
        {
          id: 'pause1',
          level: PauseLevel.SELECTIVE,
          startTime: Math.floor(Date.now() / 1000) - 7200,
          endTime: Math.floor(Date.now() / 1000) - 3600,
          duration: 3600,
          reason: 'Security threat',
          initiator: '0x1234567890123456789012345678901234567890',
          affectedContracts: ['0x1111111111111111111111111111111111111111'],
          resumeSignatures: ['sig1', 'sig2'],
          autoResumed: false,
          gasUsed: 50000
        }
      ];

      const analytics = EmergencyLib.calculateAnalytics(events);
      expect(analytics.totalPauses).toBe(1);
      expect(analytics.totalDuration).toBe(3600);
      expect(analytics.averageDuration).toBe(3600);
      expect(analytics.pauseByLevel[PauseLevel.SELECTIVE]).toBe(1);
    });

    it('should return zero analytics for empty events', () => {
      const analytics = EmergencyLib.calculateAnalytics([]);
      expect(analytics.totalPauses).toBe(0);
      expect(analytics.totalDuration).toBe(0);
      expect(analytics.averageDuration).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should validate address format', () => {
      expect(EmergencyLib.isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
      expect(EmergencyLib.isValidAddress('invalid')).toBe(false);
      expect(EmergencyLib.isValidAddress('')).toBe(false);
    });

    it('should validate signature format', () => {
      expect(EmergencyLib.isValidSignature('valid_signature')).toBe(true);
      expect(EmergencyLib.isValidSignature('')).toBe(false);
    });

    it('should generate pause event ID', () => {
      const id = EmergencyLib.generatePauseEventId(PauseLevel.SELECTIVE, '0x1234567890123456789012345678901234567890');
      expect(id).toContain('pause_1_0x1234567890123456789012345678901234567890');
      expect(typeof id).toBe('string');
    });

    it('should format duration', () => {
      expect(EmergencyLib.formatDuration(30)).toBe('30 seconds');
      expect(EmergencyLib.formatDuration(120)).toBe('2 minutes');
      expect(EmergencyLib.formatDuration(7200)).toBe('2 hours');
      expect(EmergencyLib.formatDuration(172800)).toBe('2 days');
    });
  });
});
