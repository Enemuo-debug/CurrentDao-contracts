export enum AccessEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY'
}

export enum EmergencyActionType {
  ENABLE_GLOBAL_LOCKDOWN = 'ENABLE_GLOBAL_LOCKDOWN',
  DISABLE_GLOBAL_LOCKDOWN = 'DISABLE_GLOBAL_LOCKDOWN',
  LOCK_FUNCTION = 'LOCK_FUNCTION',
  UNLOCK_FUNCTION = 'UNLOCK_FUNCTION',
  EMERGENCY_GRANT_ROLE = 'EMERGENCY_GRANT_ROLE',
  EMERGENCY_REVOKE_ROLE = 'EMERGENCY_REVOKE_ROLE'
}

export enum GovernanceProposalType {
  CREATE_ROLE = 'CREATE_ROLE',
  UPDATE_ROLE = 'UPDATE_ROLE',
  GRANT_ROLE = 'GRANT_ROLE',
  REVOKE_ROLE = 'REVOKE_ROLE',
  CREATE_PERMISSION = 'CREATE_PERMISSION',
  ASSIGN_PERMISSION = 'ASSIGN_PERMISSION',
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  EMERGENCY_ACTION = 'EMERGENCY_ACTION'
}

export enum AuditAction {
  ACCESS_CHECK = 'ACCESS_CHECK',
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REVOKED = 'ROLE_REVOKED',
  PERMISSION_CREATED = 'PERMISSION_CREATED',
  PERMISSION_ASSIGNED = 'PERMISSION_ASSIGNED',
  DIRECT_PERMISSION_GRANTED = 'DIRECT_PERMISSION_GRANTED',
  DIRECT_PERMISSION_DENIED = 'DIRECT_PERMISSION_DENIED',
  GOVERNANCE_PROPOSAL_CREATED = 'GOVERNANCE_PROPOSAL_CREATED',
  GOVERNANCE_VOTE_CAST = 'GOVERNANCE_VOTE_CAST',
  GOVERNANCE_PROPOSAL_EXECUTED = 'GOVERNANCE_PROPOSAL_EXECUTED',
  EMERGENCY_ACTION_EXECUTED = 'EMERGENCY_ACTION_EXECUTED'
}

export enum GovernanceVoteChoice {
  FOR = 'FOR',
  AGAINST = 'AGAINST',
  ABSTAIN = 'ABSTAIN'
}

export interface PermissionDefinition {
  id: string;
  contractId: string;
  functionName: string;
  description: string;
  effect: AccessEffect;
  isWildcard: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  gasEstimate: number;
  createdBy: string;
  createdAt: number;
}

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  parentRoleIds: string[];
  permissionIds: string[];
  isSystemRole: boolean;
  governanceManaged: boolean;
  metadata: Record<string, string>;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoleAssignment {
  subject: string;
  roleId: string;
  assignedBy: string;
  assignedAt: number;
  expiresAt?: number;
  reason?: string;
}

export interface DirectPermissionGrant {
  subject: string;
  permissionId: string;
  effect: AccessEffect;
  grantedBy: string;
  grantedAt: number;
  reason?: string;
  expiresAt?: number;
}

export interface AccessRequest {
  subject: string;
  contractId: string;
  functionName: string;
  callData?: string;
  actor?: string;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  matchedPermissions: string[];
  inheritedViaRoles: string[];
  gasEstimate: number;
}

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actor: string;
  subject?: string;
  targetId?: string;
  contractId?: string;
  functionName?: string;
  success: boolean;
  reason: string;
  metadata: Record<string, string | number | boolean>;
  timestamp: number;
}

export interface EmergencyState {
  active: boolean;
  activatedBy?: string;
  reason?: string;
  activatedAt?: number;
  lockedFunctions: string[];
}

export interface ACLConfig {
  governanceThreshold: number;
  communityQuorum: number;
  maxAccessCheckGas: number;
  defaultRoleAdmin: string;
  emergencyCouncil: string[];
  governanceMembers: string[];
}

export interface GovernanceVote {
  voter: string;
  choice: GovernanceVoteChoice;
  weight: number;
  reason?: string;
  timestamp: number;
}

export interface CommunityFeedback {
  author: string;
  support: boolean;
  comment: string;
  timestamp: number;
}

export interface GovernanceProposal<TPayload = unknown> {
  id: string;
  type: GovernanceProposalType;
  title: string;
  description: string;
  proposer: string;
  payload: TPayload;
  votes: GovernanceVote[];
  feedback: CommunityFeedback[];
  createdAt: number;
  executableAt: number;
  executedAt?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}

export interface GovernanceEvaluation {
  approved: boolean;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  communitySupport: number;
  communityOpposition: number;
}

export interface PerformanceSnapshot {
  averageAccessCheckGas: number;
  peakAccessCheckGas: number;
  totalChecks: number;
  withinTarget: boolean;
}

export interface RoleCreationPayload {
  id: string;
  label: string;
  description: string;
  parentRoleIds?: string[];
  permissionIds?: string[];
  metadata?: Record<string, string>;
}

export interface UpdateRolePayload {
  roleId: string;
  label?: string;
  description?: string;
  parentRoleIds?: string[];
  permissionIds?: string[];
  metadata?: Record<string, string>;
}

export interface RoleMutationPayload {
  subject: string;
  roleId: string;
  reason?: string;
  expiresAt?: number;
}

export interface PermissionPayload {
  id: string;
  contractId: string;
  functionName: string;
  description: string;
  effect?: AccessEffect;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PermissionAssignmentPayload {
  roleId: string;
  permissionId: string;
}

export interface ConfigUpdatePayload {
  governanceThreshold?: number;
  communityQuorum?: number;
  maxAccessCheckGas?: number;
  emergencyCouncil?: string[];
  governanceMembers?: string[];
}

export interface EmergencyActionPayload {
  action: EmergencyActionType;
  subject?: string;
  roleId?: string;
  contractId?: string;
  functionName?: string;
  reason: string;
}

export interface AccessControlListEvents {
  onAccessCheck?: (entry: AuditLogEntry) => void;
  onRoleAssigned?: (assignment: RoleAssignment) => void;
  onRoleRevoked?: (assignment: RoleAssignment) => void;
  onGovernanceExecuted?: (proposal: GovernanceProposal) => void;
  onEmergencyAction?: (state: EmergencyState) => void;
}

export interface IAccessControlList {
  hasAccess(request: AccessRequest): Promise<AccessDecision>;
  assignRole(subject: string, roleId: string, actor: string, reason?: string, expiresAt?: number): Promise<void>;
  revokeRole(subject: string, roleId: string, actor: string, reason?: string): Promise<void>;
  createPermission(payload: PermissionPayload, actor: string): Promise<PermissionDefinition>;
  createGovernanceProposal<TPayload>(
    type: GovernanceProposalType,
    title: string,
    description: string,
    proposer: string,
    payload: TPayload,
    executionDelaySeconds?: number
  ): Promise<GovernanceProposal<TPayload>>;
  executeGovernanceProposal(proposalId: string, executor: string): Promise<void>;
  getAuditTrail(subject?: string): Promise<AuditLogEntry[]>;
  getPerformanceSnapshot(): Promise<PerformanceSnapshot>;
}

export const ACL_ERROR = {
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  PERMISSION_NOT_FOUND: 'PERMISSION_NOT_FOUND',
  ROLE_ALREADY_EXISTS: 'ROLE_ALREADY_EXISTS',
  PERMISSION_ALREADY_EXISTS: 'PERMISSION_ALREADY_EXISTS',
  INVALID_GOVERNANCE_MEMBER: 'INVALID_GOVERNANCE_MEMBER',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PROPOSAL_NOT_APPROVED: 'PROPOSAL_NOT_APPROVED',
  PROPOSAL_NOT_EXECUTABLE: 'PROPOSAL_NOT_EXECUTABLE',
  ACCESS_DENIED: 'ACCESS_DENIED',
  EMERGENCY_LOCKDOWN: 'EMERGENCY_LOCKDOWN',
  FUNCTION_LOCKED: 'FUNCTION_LOCKED',
  GAS_TARGET_EXCEEDED: 'GAS_TARGET_EXCEEDED'
} as const;

export const DEFAULT_ACL_CONFIG: ACLConfig = {
  governanceThreshold: 3,
  communityQuorum: 2,
  maxAccessCheckGas: 30000,
  defaultRoleAdmin: 'SUPER_ADMIN',
  emergencyCouncil: [],
  governanceMembers: []
};

export const PREDEFINED_ROLE_IDS = [
  'SUPER_ADMIN',
  'DAO_EXECUTIVE',
  'DAO_GOVERNOR',
  'TREASURY_MANAGER',
  'TREASURY_OPERATOR',
  'COMPLIANCE_ADMIN',
  'COMPLIANCE_OFFICER',
  'RISK_MANAGER',
  'SECURITY_ADMIN',
  'SECURITY_ANALYST',
  'EMERGENCY_RESPONDER',
  'AUDITOR',
  'ORACLE_MANAGER',
  'ORACLE_OPERATOR',
  'REGISTRY_ADMIN',
  'LIQUIDITY_MANAGER',
  'LIQUIDITY_OPERATOR',
  'STAKING_MANAGER',
  'STAKING_OPERATOR',
  'FEE_MANAGER',
  'FEE_OPERATOR',
  'REPORTING_MANAGER',
  'SUPPORT_AGENT',
  'READ_ONLY_OBSERVER'
] as const;
