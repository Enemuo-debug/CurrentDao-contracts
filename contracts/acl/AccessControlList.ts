import {
  ACLConfig,
  ACL_ERROR,
  AccessControlListEvents,
  AccessDecision,
  AccessEffect,
  AccessRequest,
  AuditAction,
  AuditLogEntry,
  ConfigUpdatePayload,
  DEFAULT_ACL_CONFIG,
  EmergencyActionPayload,
  EmergencyActionType,
  EmergencyState,
  GovernanceEvaluation,
  GovernanceProposal,
  GovernanceProposalType,
  GovernanceVoteChoice,
  IAccessControlList,
  PermissionAssignmentPayload,
  PermissionDefinition,
  PermissionPayload,
  PerformanceSnapshot,
  PREDEFINED_ROLE_IDS,
  RoleCreationPayload,
  RoleDefinition,
  RoleMutationPayload,
  UpdateRolePayload
} from './interfaces/IAccessControlList';
import { ACLGovernance } from './governance/ACLGovernance';
import { ACLLib } from './libraries/ACLLib';
import { PermissionManager } from './permissions/PermissionManager';
import { RoleManager } from './roles/RoleManager';

type GovernancePayload =
  | RoleCreationPayload
  | UpdateRolePayload
  | RoleMutationPayload
  | PermissionPayload
  | PermissionAssignmentPayload
  | ConfigUpdatePayload
  | EmergencyActionPayload;

interface AccessMeasurement {
  gasEstimate: number;
  timestamp: number;
}

interface AccessControlListOptions {
  config?: Partial<ACLConfig>;
  eventHandlers?: AccessControlListEvents;
  bootstrapActor?: string;
}

const PLATFORM_FUNCTIONS: Record<string, string[]> = {
  DAO: ['propose', 'vote', 'execute', 'configure'],
  TREASURY: ['withdraw', 'deposit', 'rebalance', 'settle'],
  STAKING: ['stake', 'unstake', 'claimRewards', 'configurePool'],
  LIQUIDITY: ['addLiquidity', 'removeLiquidity', 'rebalancePool', 'bridge'],
  REGISTRY: ['register', 'update', 'remove', 'resolve'],
  REGULATORY: ['submitReport', 'approveReport', 'archiveReport'],
  SECURITY: ['pause', 'unpause', 'rotateKey', 'reviewIncident'],
  FEES: ['setFee', 'switchModel', 'sweepFees'],
  ORACLE: ['pushPrice', 'freezeFeed', 'resumeFeed'],
  ZKP: ['verifyProof', 'revealTradeDetails']
};

const PREDEFINED_ROLE_BLUEPRINTS: Array<{
  id: typeof PREDEFINED_ROLE_IDS[number];
  label: string;
  description: string;
  parents?: string[];
}> = [
  { id: 'SUPER_ADMIN', label: 'Super Admin', description: 'Platform-wide root administrator.' },
  { id: 'DAO_EXECUTIVE', label: 'DAO Executive', description: 'Executes approved DAO actions.', parents: ['SUPER_ADMIN'] },
  { id: 'DAO_GOVERNOR', label: 'DAO Governor', description: 'Creates and manages DAO governance flows.', parents: ['DAO_EXECUTIVE'] },
  { id: 'TREASURY_MANAGER', label: 'Treasury Manager', description: 'Manages treasury strategy.', parents: ['DAO_EXECUTIVE'] },
  { id: 'TREASURY_OPERATOR', label: 'Treasury Operator', description: 'Performs treasury operations.', parents: ['TREASURY_MANAGER'] },
  { id: 'COMPLIANCE_ADMIN', label: 'Compliance Admin', description: 'Owns compliance controls.', parents: ['DAO_EXECUTIVE'] },
  { id: 'COMPLIANCE_OFFICER', label: 'Compliance Officer', description: 'Runs day-to-day compliance operations.', parents: ['COMPLIANCE_ADMIN'] },
  { id: 'RISK_MANAGER', label: 'Risk Manager', description: 'Oversees protocol risk.', parents: ['DAO_EXECUTIVE'] },
  { id: 'SECURITY_ADMIN', label: 'Security Admin', description: 'Owns security posture and access hardening.', parents: ['DAO_EXECUTIVE'] },
  { id: 'SECURITY_ANALYST', label: 'Security Analyst', description: 'Monitors and reviews security operations.', parents: ['SECURITY_ADMIN'] },
  { id: 'EMERGENCY_RESPONDER', label: 'Emergency Responder', description: 'Can react to security incidents immediately.', parents: ['SECURITY_ADMIN'] },
  { id: 'ORACLE_MANAGER', label: 'Oracle Manager', description: 'Manages oracle feeds.', parents: ['DAO_EXECUTIVE'] },
  { id: 'ORACLE_OPERATOR', label: 'Oracle Operator', description: 'Operates oracle feeds.', parents: ['ORACLE_MANAGER'] },
  { id: 'REGISTRY_ADMIN', label: 'Registry Admin', description: 'Maintains contract registry.', parents: ['DAO_EXECUTIVE'] },
  { id: 'LIQUIDITY_MANAGER', label: 'Liquidity Manager', description: 'Owns liquidity strategy.', parents: ['DAO_EXECUTIVE'] },
  { id: 'LIQUIDITY_OPERATOR', label: 'Liquidity Operator', description: 'Executes liquidity operations.', parents: ['LIQUIDITY_MANAGER'] },
  { id: 'STAKING_MANAGER', label: 'Staking Manager', description: 'Owns staking policy.', parents: ['DAO_EXECUTIVE'] },
  { id: 'STAKING_OPERATOR', label: 'Staking Operator', description: 'Executes staking actions.', parents: ['STAKING_MANAGER'] },
  { id: 'FEE_MANAGER', label: 'Fee Manager', description: 'Owns fee policy.', parents: ['DAO_EXECUTIVE'] },
  { id: 'FEE_OPERATOR', label: 'Fee Operator', description: 'Operates fee updates.', parents: ['FEE_MANAGER'] },
  { id: 'REPORTING_MANAGER', label: 'Reporting Manager', description: 'Oversees reporting and disclosures.', parents: ['COMPLIANCE_ADMIN'] },
  { id: 'READ_ONLY_OBSERVER', label: 'Read Only Observer', description: 'Non-destructive read access role.' },
  { id: 'AUDITOR', label: 'Auditor', description: 'Read-only audit access across modules.', parents: ['READ_ONLY_OBSERVER'] },
  { id: 'SUPPORT_AGENT', label: 'Support Agent', description: 'Limited customer support operations.', parents: ['READ_ONLY_OBSERVER'] }
];

export class AccessControlList implements IAccessControlList {
  private readonly roleManager = new RoleManager();
  private readonly permissionManager = new PermissionManager();
  private governance: ACLGovernance;
  private readonly eventHandlers: AccessControlListEvents;
  private readonly auditTrail: AuditLogEntry[] = [];
  private readonly accessMeasurements: AccessMeasurement[] = [];
  private config: ACLConfig;
  private emergencyState: EmergencyState = {
    active: false,
    lockedFunctions: []
  };

  constructor(options: AccessControlListOptions = {}) {
    this.config = {
      ...DEFAULT_ACL_CONFIG,
      ...options.config,
      emergencyCouncil: [...(options.config?.emergencyCouncil || DEFAULT_ACL_CONFIG.emergencyCouncil)],
      governanceMembers: [...(options.config?.governanceMembers || DEFAULT_ACL_CONFIG.governanceMembers)]
    };
    this.eventHandlers = options.eventHandlers || {};
    this.governance = new ACLGovernance(this.config.governanceMembers);

    this.bootstrapPermissions(options.bootstrapActor || 'SYSTEM');
    this.bootstrapRoles(options.bootstrapActor || 'SYSTEM');
  }

  public async hasAccess(request: AccessRequest): Promise<AccessDecision> {
    const functionKey = ACLLib.buildPermissionKey(request.contractId, request.functionName);
    const effectiveRoleIds = this.roleManager.getEffectiveRoleIds(request.subject);
    const mergedPermissionIds = ACLLib.mergePermissions(effectiveRoleIds, this.roleManager.getRoleStore());
    const inheritedRoleIds = effectiveRoleIds.filter(
      (roleId) => !this.roleManager.getAssignedRoles(request.subject).some((assignment) => assignment.roleId === roleId)
    );
    const directGrants = this.permissionManager.getDirectGrants(request.subject);
    const directMatches = directGrants
      .map((grant) => ({
        grant,
        permission: this.permissionManager.getPermission(grant.permissionId)
      }))
      .filter((item): item is { grant: typeof directGrants[number]; permission: PermissionDefinition } => Boolean(item.permission))
      .filter((item) => ACLLib.permissionMatches(item.permission, request));
    const matchedRolePermissions = this.permissionManager.matchPermissions(
      mergedPermissionIds,
      request.contractId,
      request.functionName
    );

    const lockedFunction = this.emergencyState.lockedFunctions.includes(functionKey) || this.emergencyState.lockedFunctions.includes(`${request.contractId}::*`);
    const matchedPermissionCount = matchedRolePermissions.length + directMatches.length;
    const gasEstimate = ACLLib.estimateAccessCheckGas({
      roleCount: this.roleManager.getAssignedRoles(request.subject).length,
      inheritedRoleCount: inheritedRoleIds.length,
      directGrantCount: directGrants.length,
      locked: this.emergencyState.active || lockedFunction,
      matchedPermissionCount
    });

    let decision: AccessDecision;
    if (this.emergencyState.active) {
      decision = ACLLib.buildDeniedDecision(ACL_ERROR.EMERGENCY_LOCKDOWN, gasEstimate);
    } else if (lockedFunction) {
      decision = ACLLib.buildDeniedDecision(ACL_ERROR.FUNCTION_LOCKED, gasEstimate);
    } else if (directMatches.some(({ grant }) => grant.effect === AccessEffect.DENY)) {
      decision = ACLLib.buildDeniedDecision(ACL_ERROR.ACCESS_DENIED, gasEstimate);
    } else if (matchedRolePermissions.some((permission) => permission.effect === AccessEffect.DENY)) {
      decision = ACLLib.buildDeniedDecision(ACL_ERROR.ACCESS_DENIED, gasEstimate);
    } else if (directMatches.some(({ grant }) => grant.effect === AccessEffect.ALLOW) || matchedRolePermissions.some((permission) => permission.effect === AccessEffect.ALLOW)) {
      decision = ACLLib.buildDecision(
        true,
        'ACCESS_GRANTED',
        [...matchedRolePermissions.map((permission) => permission.id), ...directMatches.map(({ grant }) => grant.permissionId)],
        inheritedRoleIds,
        gasEstimate
      );
    } else {
      decision = ACLLib.buildDeniedDecision(ACL_ERROR.ACCESS_DENIED, gasEstimate);
    }

    ACLLib.assertGasTarget(gasEstimate, this.config.maxAccessCheckGas);
    this.recordAccessMeasurement(gasEstimate);
    this.logAudit(
      AuditAction.ACCESS_CHECK,
      request.actor || request.subject,
      decision.allowed,
      decision.reason,
      {
        contractId: request.contractId,
        functionName: request.functionName,
        matchedPermissionCount,
        inheritedRoleCount: inheritedRoleIds.length,
        subject: request.subject
      },
      {
        subject: request.subject,
        contractId: request.contractId,
        functionName: request.functionName,
        targetId: functionKey
      }
    );

    return decision;
  }

  public async assignRole(subject: string, roleId: string, actor: string, reason?: string, expiresAt?: number): Promise<void> {
    const assignment = this.roleManager.assignRole(subject, roleId, actor, reason, expiresAt);
    this.logAudit(
      AuditAction.ROLE_ASSIGNED,
      actor,
      true,
      reason || 'Role assigned',
      { roleId: assignment.roleId, expiresAt: expiresAt || 0 },
      { subject, targetId: assignment.roleId }
    );
    this.eventHandlers.onRoleAssigned?.(assignment);
  }

  public async revokeRole(subject: string, roleId: string, actor: string, reason?: string): Promise<void> {
    const revoked = this.roleManager.revokeRole(subject, roleId);
    this.logAudit(
      AuditAction.ROLE_REVOKED,
      actor,
      Boolean(revoked),
      reason || (revoked ? 'Role revoked' : 'Role assignment not found'),
      { roleId: ACLLib.normalizeId(roleId) },
      { subject, targetId: ACLLib.normalizeId(roleId) }
    );
    if (revoked) {
      this.eventHandlers.onRoleRevoked?.(revoked);
    }
  }

  public async createPermission(payload: PermissionPayload, actor: string): Promise<PermissionDefinition> {
    const permission = this.permissionManager.createPermission(payload, actor);
    this.logAudit(
      AuditAction.PERMISSION_CREATED,
      actor,
      true,
      'Permission created',
      { contractId: permission.contractId, functionName: permission.functionName },
      { targetId: permission.id, contractId: permission.contractId, functionName: permission.functionName }
    );
    return permission;
  }

  public async createGovernanceProposal<TPayload>(
    type: GovernanceProposalType,
    title: string,
    description: string,
    proposer: string,
    payload: TPayload,
    executionDelaySeconds: number = 0
  ): Promise<GovernanceProposal<TPayload>> {
    const proposal = this.governance.createProposal(type, title, description, proposer, payload, executionDelaySeconds);
    this.logAudit(
      AuditAction.GOVERNANCE_PROPOSAL_CREATED,
      proposer,
      true,
      'Governance proposal created',
      { type },
      { targetId: proposal.id }
    );
    return proposal;
  }

  public async executeGovernanceProposal(proposalId: string, executor: string): Promise<void> {
    const proposal = this.governance.getProposal<GovernancePayload>(proposalId);
    const evaluation = this.governance.evaluateProposal(
      proposalId,
      this.config.governanceThreshold,
      this.config.communityQuorum
    );

    if (!evaluation.approved) {
      throw new Error(ACL_ERROR.PROPOSAL_NOT_APPROVED);
    }

    await this.applyGovernancePayload(proposal);
    const executed = this.governance.markExecuted(proposalId);
    this.logAudit(
      AuditAction.GOVERNANCE_PROPOSAL_EXECUTED,
      executor,
      true,
      'Governance proposal executed',
      { type: executed.type },
      { targetId: proposalId }
    );
    this.eventHandlers.onGovernanceExecuted?.(executed);
  }

  public async getAuditTrail(subject?: string): Promise<AuditLogEntry[]> {
    return this.auditTrail
      .filter((entry) => !subject || entry.subject === subject || entry.actor === subject)
      .map((entry) => ({ ...entry, metadata: { ...entry.metadata } }));
  }

  public async getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
    if (this.accessMeasurements.length === 0) {
      return {
        averageAccessCheckGas: 0,
        peakAccessCheckGas: 0,
        totalChecks: 0,
        withinTarget: true
      };
    }

    const total = this.accessMeasurements.reduce((sum, entry) => sum + entry.gasEstimate, 0);
    const peak = this.accessMeasurements.reduce((max, entry) => Math.max(max, entry.gasEstimate), 0);

    return {
      averageAccessCheckGas: Math.round(total / this.accessMeasurements.length),
      peakAccessCheckGas: peak,
      totalChecks: this.accessMeasurements.length,
      withinTarget: peak <= this.config.maxAccessCheckGas
    };
  }

  public async createRole(payload: RoleCreationPayload, actor: string, governanceManaged: boolean = false): Promise<RoleDefinition> {
    const role = this.roleManager.createRole(payload, actor, false, governanceManaged);
    this.logAudit(
      AuditAction.ROLE_CREATED,
      actor,
      true,
      'Role created',
      { governanceManaged },
      { targetId: role.id }
    );
    return role;
  }

  public async updateRole(payload: UpdateRolePayload, actor: string): Promise<RoleDefinition> {
    const role = this.roleManager.updateRole(payload);
    this.logAudit(
      AuditAction.ROLE_CREATED,
      actor,
      true,
      'Role updated',
      {},
      { targetId: role.id }
    );
    return role;
  }

  public async assignPermissionToRole(payload: PermissionAssignmentPayload, actor: string): Promise<RoleDefinition> {
    const role = this.roleManager.addPermissionToRole(payload.roleId, payload.permissionId);
    this.logAudit(
      AuditAction.PERMISSION_ASSIGNED,
      actor,
      true,
      'Permission assigned to role',
      { permissionId: ACLLib.normalizeId(payload.permissionId) },
      { targetId: role.id }
    );
    return role;
  }

  public async grantDirectPermission(
    subject: string,
    permissionId: string,
    actor: string,
    effect: AccessEffect,
    reason?: string,
    expiresAt?: number
  ): Promise<void> {
    const grant = this.permissionManager.grantDirectPermission(subject, permissionId, actor, effect, reason, expiresAt);
    this.logAudit(
      effect === AccessEffect.ALLOW ? AuditAction.DIRECT_PERMISSION_GRANTED : AuditAction.DIRECT_PERMISSION_DENIED,
      actor,
      true,
      reason || 'Direct permission grant updated',
      { effect, expiresAt: expiresAt || 0 },
      { subject, targetId: grant.permissionId }
    );
  }

  public async revokeDirectPermission(subject: string, permissionId: string, actor: string): Promise<void> {
    const revoked = this.permissionManager.revokeDirectPermission(subject, permissionId);
    this.logAudit(
      AuditAction.DIRECT_PERMISSION_DENIED,
      actor,
      Boolean(revoked),
      revoked ? 'Direct permission revoked' : 'Direct permission not found',
      {},
      { subject, targetId: ACLLib.normalizeId(permissionId) }
    );
  }

  public async registerContractFunctions(contractId: string, functions: string[], actor: string): Promise<PermissionDefinition[]> {
    const permissions = this.permissionManager.registerFunctionPermissions(contractId, functions, actor);
    permissions.forEach((permission) =>
      this.logAudit(
        AuditAction.PERMISSION_CREATED,
        actor,
        true,
        'Function permission registered',
        {},
        { targetId: permission.id, contractId: permission.contractId, functionName: permission.functionName }
      )
    );
    return permissions;
  }

  public async castGovernanceVote(
    proposalId: string,
    voter: string,
    choice: GovernanceVoteChoice,
    reason?: string
  ): Promise<GovernanceProposal> {
    const proposal = this.governance.castVote(proposalId, voter, choice, reason);
    this.logAudit(
      AuditAction.GOVERNANCE_VOTE_CAST,
      voter,
      true,
      reason || 'Governance vote cast',
      { choice },
      { targetId: proposalId }
    );
    return proposal;
  }

  public async submitCommunityFeedback(
    proposalId: string,
    author: string,
    support: boolean,
    comment: string
  ): Promise<GovernanceProposal> {
    return this.governance.submitCommunityFeedback(proposalId, author, support, comment);
  }

  public async evaluateGovernanceProposal(proposalId: string): Promise<GovernanceEvaluation> {
    return this.governance.evaluateProposal(
      proposalId,
      this.config.governanceThreshold,
      this.config.communityQuorum
    );
  }

  public async executeEmergencyAction(payload: EmergencyActionPayload, actor: string): Promise<EmergencyState> {
    if (!this.isEmergencyAuthorized(actor)) {
      throw new Error(ACL_ERROR.ACCESS_DENIED);
    }

    const functionKey = payload.contractId && payload.functionName
      ? ACLLib.buildPermissionKey(payload.contractId, payload.functionName)
      : undefined;

    switch (payload.action) {
      case EmergencyActionType.ENABLE_GLOBAL_LOCKDOWN:
        this.emergencyState = {
          ...this.emergencyState,
          active: true,
          activatedBy: actor,
          activatedAt: ACLLib.now(),
          reason: payload.reason
        };
        break;
      case EmergencyActionType.DISABLE_GLOBAL_LOCKDOWN:
        this.emergencyState = {
          ...this.emergencyState,
          active: false,
          activatedBy: actor,
          activatedAt: ACLLib.now(),
          reason: payload.reason
        };
        break;
      case EmergencyActionType.LOCK_FUNCTION:
        if (!functionKey) {
          throw new Error('FUNCTION_IDENTIFIER_REQUIRED');
        }
        if (!this.emergencyState.lockedFunctions.includes(functionKey)) {
          this.emergencyState.lockedFunctions.push(functionKey);
        }
        break;
      case EmergencyActionType.UNLOCK_FUNCTION:
        if (!functionKey) {
          throw new Error('FUNCTION_IDENTIFIER_REQUIRED');
        }
        this.emergencyState.lockedFunctions = this.emergencyState.lockedFunctions.filter((lockedFunction) => lockedFunction !== functionKey);
        break;
      case EmergencyActionType.EMERGENCY_GRANT_ROLE:
        if (!payload.subject || !payload.roleId) {
          throw new Error('ROLE_AND_SUBJECT_REQUIRED');
        }
        await this.assignRole(payload.subject, payload.roleId, actor, payload.reason);
        break;
      case EmergencyActionType.EMERGENCY_REVOKE_ROLE:
        if (!payload.subject || !payload.roleId) {
          throw new Error('ROLE_AND_SUBJECT_REQUIRED');
        }
        await this.revokeRole(payload.subject, payload.roleId, actor, payload.reason);
        break;
      default:
        throw new Error('UNSUPPORTED_EMERGENCY_ACTION');
    }

    this.logAudit(
      AuditAction.EMERGENCY_ACTION_EXECUTED,
      actor,
      true,
      payload.reason,
      { action: payload.action },
      { subject: payload.subject, targetId: payload.roleId || functionKey }
    );
    this.eventHandlers.onEmergencyAction?.({ ...this.emergencyState, lockedFunctions: [...this.emergencyState.lockedFunctions] });
    return this.getEmergencyState();
  }

  public getRoles(): RoleDefinition[] {
    return this.roleManager.getRoles();
  }

  public getRole(roleId: string): RoleDefinition | undefined {
    return this.roleManager.getRole(roleId);
  }

  public getPermissions(): PermissionDefinition[] {
    return this.permissionManager.getPermissions();
  }

  public getPermission(permissionId: string): PermissionDefinition | undefined {
    return this.permissionManager.getPermission(permissionId);
  }

  public getConfig(): ACLConfig {
    return {
      ...this.config,
      emergencyCouncil: [...this.config.emergencyCouncil],
      governanceMembers: [...this.config.governanceMembers]
    };
  }

  public getEmergencyState(): EmergencyState {
    return {
      ...this.emergencyState,
      lockedFunctions: [...this.emergencyState.lockedFunctions]
    };
  }

  public getGovernanceMembers(): string[] {
    return this.governance.getGovernanceMembers();
  }

  public getProposal<TPayload = GovernancePayload>(proposalId: string): GovernanceProposal<TPayload> {
    return this.governance.getProposal<TPayload>(proposalId);
  }

  public getProposals(): GovernanceProposal[] {
    return this.governance.getProposals();
  }

  private bootstrapPermissions(actor: string): void {
    for (const [contractId, functions] of Object.entries(PLATFORM_FUNCTIONS)) {
      this.permissionManager.registerFunctionPermissions(contractId, functions, actor);
    }

    for (const contractId of Object.keys(PLATFORM_FUNCTIONS)) {
      const wildcardId = ACLLib.normalizeId(`EXECUTE_${contractId}_*`);
      if (!this.permissionManager.getPermission(wildcardId)) {
        this.permissionManager.createPermission(
          {
            id: wildcardId,
            contractId,
            functionName: '*',
            description: `Execute any function on ${contractId}`,
            effect: AccessEffect.ALLOW,
            riskLevel: 'HIGH'
          },
          actor
        );
      }
    }

    const globalRead = ACLLib.normalizeId('EXECUTE_*_*');
    if (!this.permissionManager.getPermission(globalRead)) {
      this.permissionManager.createPermission(
        {
          id: globalRead,
          contractId: '*',
          functionName: '*',
          description: 'Global wildcard access for root roles',
          effect: AccessEffect.ALLOW,
          riskLevel: 'CRITICAL'
        },
        actor
      );
    }
  }

  private bootstrapRoles(actor: string): void {
    PREDEFINED_ROLE_BLUEPRINTS.forEach((role) => {
      const permissionIds = this.getBootstrapPermissionsForRole(role.id);
      this.roleManager.createRole(
        {
          id: role.id,
          label: role.label,
          description: role.description,
          parentRoleIds: role.parents,
          permissionIds,
          metadata: { predefined: 'true' }
        },
        actor,
        true,
        role.id !== 'SUPER_ADMIN'
      );
    });
  }

  private getBootstrapPermissionsForRole(roleId: string): string[] {
    const wildcard = (contractId: string) => ACLLib.normalizeId(`EXECUTE_${contractId}_*`);
    switch (roleId) {
      case 'SUPER_ADMIN':
        return [ACLLib.normalizeId('EXECUTE_*_*')];
      case 'DAO_EXECUTIVE':
      case 'DAO_GOVERNOR':
        return [wildcard('DAO')];
      case 'TREASURY_MANAGER':
      case 'TREASURY_OPERATOR':
        return [wildcard('TREASURY')];
      case 'COMPLIANCE_ADMIN':
      case 'COMPLIANCE_OFFICER':
      case 'REPORTING_MANAGER':
        return [wildcard('REGULATORY')];
      case 'RISK_MANAGER':
        return [wildcard('DAO'), wildcard('TREASURY'), wildcard('LIQUIDITY')];
      case 'SECURITY_ADMIN':
      case 'SECURITY_ANALYST':
      case 'EMERGENCY_RESPONDER':
        return [wildcard('SECURITY')];
      case 'ORACLE_MANAGER':
      case 'ORACLE_OPERATOR':
        return [wildcard('ORACLE')];
      case 'REGISTRY_ADMIN':
        return [wildcard('REGISTRY')];
      case 'LIQUIDITY_MANAGER':
      case 'LIQUIDITY_OPERATOR':
        return [wildcard('LIQUIDITY')];
      case 'STAKING_MANAGER':
      case 'STAKING_OPERATOR':
        return [wildcard('STAKING')];
      case 'FEE_MANAGER':
      case 'FEE_OPERATOR':
        return [wildcard('FEES')];
      case 'AUDITOR':
      case 'SUPPORT_AGENT':
      case 'READ_ONLY_OBSERVER':
        return [ACLLib.normalizeId('EXECUTE_REGISTRY_RESOLVE')];
      default:
        return [];
    }
  }

  private logAudit(
    action: AuditAction,
    actor: string,
    success: boolean,
    reason: string,
    metadata: Record<string, string | number | boolean>,
    overrides: Partial<AuditLogEntry> = {}
  ): void {
    const entry = ACLLib.createAuditEntry(action, actor, success, reason, metadata, overrides);
    this.auditTrail.push(entry);
    if (action === AuditAction.ACCESS_CHECK) {
      this.eventHandlers.onAccessCheck?.(entry);
    }
  }

  private recordAccessMeasurement(gasEstimate: number): void {
    this.accessMeasurements.push({
      gasEstimate,
      timestamp: ACLLib.now()
    });
  }

  private isEmergencyAuthorized(actor: string): boolean {
    return this.config.emergencyCouncil.includes(actor) || this.roleManager.getEffectiveRoleIds(actor).includes('SECURITY_ADMIN');
  }

  private async applyGovernancePayload(proposal: GovernanceProposal<GovernancePayload>): Promise<void> {
    switch (proposal.type) {
      case GovernanceProposalType.CREATE_ROLE:
        await this.createRole(proposal.payload as RoleCreationPayload, proposal.proposer, true);
        break;
      case GovernanceProposalType.UPDATE_ROLE:
        await this.updateRole(proposal.payload as UpdateRolePayload, proposal.proposer);
        break;
      case GovernanceProposalType.GRANT_ROLE: {
        const payload = proposal.payload as RoleMutationPayload;
        await this.assignRole(payload.subject, payload.roleId, proposal.proposer, payload.reason, payload.expiresAt);
        break;
      }
      case GovernanceProposalType.REVOKE_ROLE: {
        const payload = proposal.payload as RoleMutationPayload;
        await this.revokeRole(payload.subject, payload.roleId, proposal.proposer, payload.reason);
        break;
      }
      case GovernanceProposalType.CREATE_PERMISSION:
        await this.createPermission(proposal.payload as PermissionPayload, proposal.proposer);
        break;
      case GovernanceProposalType.ASSIGN_PERMISSION:
        await this.assignPermissionToRole(proposal.payload as PermissionAssignmentPayload, proposal.proposer);
        break;
      case GovernanceProposalType.UPDATE_CONFIG:
        this.applyConfigUpdate(proposal.payload as ConfigUpdatePayload);
        break;
      case GovernanceProposalType.EMERGENCY_ACTION:
        await this.executeEmergencyAction(proposal.payload as EmergencyActionPayload, proposal.proposer);
        break;
      default:
        throw new Error('UNSUPPORTED_PROPOSAL_TYPE');
    }
  }

  private applyConfigUpdate(payload: ConfigUpdatePayload): void {
    const nextGovernanceMembers = payload.governanceMembers ? [...payload.governanceMembers] : [...this.config.governanceMembers];
    this.config = {
      ...this.config,
      ...payload,
      emergencyCouncil: payload.emergencyCouncil ? [...payload.emergencyCouncil] : [...this.config.emergencyCouncil],
      governanceMembers: nextGovernanceMembers
    };

    this.governance.replaceGovernanceMembers(nextGovernanceMembers);
  }
}
