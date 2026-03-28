import { AccessControlList } from '../../contracts/acl/AccessControlList';
import {
  AccessEffect,
  EmergencyActionType,
  GovernanceProposalType,
  GovernanceVoteChoice
} from '../../contracts/acl/interfaces/IAccessControlList';

describe('AccessControlList', () => {
  const governanceMembers = ['0xgov1', '0xgov2', '0xgov3'];
  const emergencyCouncil = ['0xemergency'];
  let acl: AccessControlList;

  beforeEach(() => {
    acl = new AccessControlList({
      config: {
        governanceMembers,
        emergencyCouncil,
        governanceThreshold: 2,
        communityQuorum: 1
      },
      bootstrapActor: '0xbootstrap'
    });
  });

  it('bootstraps 20+ predefined roles', () => {
    expect(acl.getRoles().length).toBeGreaterThanOrEqual(24);
    expect(acl.getRole('SUPER_ADMIN')).toBeDefined();
    expect(acl.getRole('READ_ONLY_OBSERVER')).toBeDefined();
  });

  it('supports granular function-level access through RBAC', async () => {
    await acl.assignRole('0xoperator', 'TREASURY_OPERATOR', '0xbootstrap');

    const allowed = await acl.hasAccess({
      subject: '0xoperator',
      contractId: 'TREASURY',
      functionName: 'withdraw'
    });
    const denied = await acl.hasAccess({
      subject: '0xoperator',
      contractId: 'DAO',
      functionName: 'execute'
    });

    expect(allowed.allowed).toBe(true);
    expect(allowed.matchedPermissions).toContain('EXECUTE_TREASURY_*');
    expect(denied.allowed).toBe(false);
  });

  it('supports permission inheritance through parent roles', async () => {
    const inheritedRole = await acl.createRole(
      {
        id: 'custom_ops',
        label: 'Custom Ops',
        description: 'Inherited treasury + security access',
        parentRoleIds: ['TREASURY_OPERATOR', 'SECURITY_ANALYST']
      },
      '0xbootstrap'
    );

    await acl.assignRole('0xmember', inheritedRole.id, '0xbootstrap');

    const treasuryDecision = await acl.hasAccess({
      subject: '0xmember',
      contractId: 'TREASURY',
      functionName: 'settle'
    });
    const securityDecision = await acl.hasAccess({
      subject: '0xmember',
      contractId: 'SECURITY',
      functionName: 'reviewIncident'
    });

    expect(treasuryDecision.allowed).toBe(true);
    expect(securityDecision.allowed).toBe(true);
    expect(treasuryDecision.inheritedViaRoles).toContain('TREASURY_MANAGER');
  });

  it('allows direct permissions to override role access', async () => {
    await acl.assignRole('0xuser', 'TREASURY_OPERATOR', '0xbootstrap');
    await acl.grantDirectPermission('0xuser', 'EXECUTE_TREASURY_WITHDRAW', '0xbootstrap', AccessEffect.DENY, 'Freeze withdrawals');

    const decision = await acl.hasAccess({
      subject: '0xuser',
      contractId: 'TREASURY',
      functionName: 'withdraw'
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('ACCESS_DENIED');
  });

  it('creates and executes governance-managed dynamic roles with community input', async () => {
    const proposal = await acl.createGovernanceProposal(
      GovernanceProposalType.CREATE_ROLE,
      'Create Integrations Role',
      'Allows controlled registry updates',
      governanceMembers[0],
      {
        id: 'integration_admin',
        label: 'Integration Admin',
        description: 'Manages integrations',
        parentRoleIds: ['REGISTRY_ADMIN']
      }
    );

    await acl.submitCommunityFeedback(proposal.id, '0xcommunity1', true, 'Useful operational role');
    await acl.castGovernanceVote(proposal.id, governanceMembers[0], GovernanceVoteChoice.FOR, 'Needed');
    await acl.castGovernanceVote(proposal.id, governanceMembers[1], GovernanceVoteChoice.FOR, 'Agreed');

    const evaluation = await acl.evaluateGovernanceProposal(proposal.id);
    expect(evaluation.approved).toBe(true);

    await acl.executeGovernanceProposal(proposal.id, governanceMembers[2]);

    expect(acl.getRole('INTEGRATION_ADMIN')).toBeDefined();
  });

  it('supports emergency function locks and global lockdown', async () => {
    await acl.assignRole('0xsecurity', 'SECURITY_ADMIN', '0xbootstrap');
    await acl.assignRole('0xtrader', 'LIQUIDITY_OPERATOR', '0xbootstrap');

    await acl.executeEmergencyAction(
      {
        action: EmergencyActionType.LOCK_FUNCTION,
        contractId: 'LIQUIDITY',
        functionName: 'bridge',
        reason: 'Bridge anomaly'
      },
      '0xsecurity'
    );

    const locked = await acl.hasAccess({
      subject: '0xtrader',
      contractId: 'LIQUIDITY',
      functionName: 'bridge'
    });

    expect(locked.allowed).toBe(false);
    expect(locked.reason).toBe('FUNCTION_LOCKED');

    await acl.executeEmergencyAction(
      {
        action: EmergencyActionType.ENABLE_GLOBAL_LOCKDOWN,
        reason: 'Critical incident'
      },
      '0xemergency'
    );

    const deniedDuringLockdown = await acl.hasAccess({
      subject: '0xtrader',
      contractId: 'LIQUIDITY',
      functionName: 'addLiquidity'
    });

    expect(deniedDuringLockdown.allowed).toBe(false);
    expect(deniedDuringLockdown.reason).toBe('EMERGENCY_LOCKDOWN');
  });

  it('records a complete audit trail for access and governance actions', async () => {
    await acl.assignRole('0xuser', 'FEE_OPERATOR', '0xbootstrap');
    await acl.hasAccess({
      subject: '0xuser',
      contractId: 'FEES',
      functionName: 'setFee'
    });

    const auditTrail = await acl.getAuditTrail();

    expect(auditTrail.some((entry) => entry.action === 'ROLE_ASSIGNED')).toBe(true);
    expect(auditTrail.some((entry) => entry.action === 'ACCESS_CHECK')).toBe(true);
  });

  it('tracks access-check gas under the target threshold', async () => {
    await acl.assignRole('0xadmin', 'SUPER_ADMIN', '0xbootstrap');

    const decision = await acl.hasAccess({
      subject: '0xadmin',
      contractId: 'DAO',
      functionName: 'configure'
    });
    const snapshot = await acl.getPerformanceSnapshot();

    expect(decision.gasEstimate).toBeLessThanOrEqual(30000);
    expect(snapshot.withinTarget).toBe(true);
    expect(snapshot.peakAccessCheckGas).toBeLessThanOrEqual(30000);
  });
});

declare var describe: any;
declare var it: any;
declare var expect: any;
declare var beforeEach: any;
