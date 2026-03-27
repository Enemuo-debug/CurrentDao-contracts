/**
 * @title IAccessControl
 * @dev Interface for the comprehensive Role-Based Access Control system
 * @dev Supports hierarchical roles, time-based permissions, and multi-signature requirements
 */

// Events (using TypeScript interfaces for better type safety)
export interface RoleGrantedEvent {
  account: string;
  role: string;
  granter: string;
}

export interface RoleRevokedEvent {
  account: string;
  role: string;
  revoker: string;
}

export interface RoleCreatedEvent {
  role: string;
  parentRole: string;
  priority: number;
}

export interface PermissionSetEvent {
  role: string;
  permission: string;
  granted: boolean;
}

export interface TimePermissionSetEvent {
  role: string;
  permission: string;
  startTime: number;
  endTime: number;
}

export interface MultiSigRequirementSetEvent {
  permission: string;
  requiredSignatures: number;
}

export interface EmergencyPauseActivatedEvent {
  activator: string;
}

export interface EmergencyPauseDeactivatedEvent {
  deactivator: string;
}

export interface PermissionAuditLogEvent {
  account: string;
  role: string;
  permission: string;
  granted: boolean;
  timestamp: number;
}

// Main interface
export interface IAccessControl {
  // Role Management Functions
  createRole(role: string, parentRole: string, priority: number): Promise<void>;
  grantRole(role: string, account: string): Promise<void>;
  revokeRole(role: string, account: string): Promise<void>;
  hasRole(role: string, account: string): Promise<boolean>;
  getRoleMembers(role: string): Promise<string[]>;

  // Permission Management Functions
  setPermission(role: string, permission: string, granted: boolean): Promise<void>;
  setTimeBasedPermission(role: string, permission: string, startTime: number, endTime: number): Promise<void>;
  hasPermission(role: string, permission: string, account: string): Promise<boolean>;
  hasPermissionWithTime(role: string, permission: string, account: string): Promise<{hasPermission: boolean, timeLeft: number}>;

  // Hierarchical Functions
  getRoleHierarchy(role: string): Promise<string[]>;
  inheritsPermission(role: string, permission: string): Promise<boolean>;

  // Multi-signature Functions
  setMultiSigRequirement(permission: string, requiredSignatures: number): Promise<void>;
  submitMultiSigTransaction(permission: string, data: string, signers: string[]): Promise<number>;
  confirmMultiSigTransaction(transactionId: number, signer: string): Promise<void>;
  executeMultiSigTransaction(transactionId: number): Promise<void>;

  // Emergency Controls
  emergencyPause(): Promise<void>;
  emergencyUnpause(): Promise<void>;
  isPaused(): Promise<boolean>;

  // Audit Functions
  getPermissionAuditTrail(account: string, role: string): Promise<AuditEntry[]>;
  getRoleAuditTrail(role: string): Promise<AuditEntry[]>;

  // Gas Optimization Functions
  batchGrantRole(role: string, accounts: string[]): Promise<void>;
  batchRevokeRole(role: string, accounts: string[]): Promise<void>;
  batchSetPermissions(role: string, permissions: string[], granted: boolean[]): Promise<void>;
}

// Enums
export enum Role {
  ADMIN = 0,
  OPERATOR = 1,
  USER = 2,
  VIEWER = 3
}

// Structs and Classes
export class RoleData {
  role: string;
  parentRole: string;
  priority: number;
  memberCount: number;
  members: Map<string, boolean> = new Map();
  permissions: Map<string, boolean> = new Map();
  timePermissions: Map<string, TimePermission> = new Map();

  constructor(role: string, parentRole: string, priority: number) {
    this.role = role;
    this.parentRole = parentRole;
    this.priority = priority;
    this.memberCount = 0;
  }
}

export class TimePermission {
  hasTimeLimit: boolean;
  startTime: number;
  endTime: number;

  constructor(hasTimeLimit: boolean = false, startTime: number = 0, endTime: number = 0) {
    this.hasTimeLimit = hasTimeLimit;
    this.startTime = startTime;
    this.endTime = endTime;
  }
}

export class MultiSigTransaction {
  permission: string;
  data: string;
  signers: string[];
  requiredSignatures: number;
  confirmationCount: number;
  executed: boolean;
  timestamp: number;

  constructor(
    permission: string,
    data: string,
    signers: string[],
    requiredSignatures: number
  ) {
    this.permission = permission;
    this.data = data;
    this.signers = signers;
    this.requiredSignatures = requiredSignatures;
    this.confirmationCount = 0;
    this.executed = false;
    this.timestamp = Date.now();
  }
}

export class AuditEntry {
  account: string;
  role: string;
  permission: string;
  granted: boolean;
  timestamp: number;
  actor: string;
  action: string;

  constructor(
    account: string,
    role: string,
    permission: string,
    granted: boolean,
    actor: string,
    action: string
  ) {
    this.account = account;
    this.role = role;
    this.permission = permission;
    this.granted = granted;
    this.timestamp = Date.now();
    this.actor = actor;
    this.action = action;
  }
}

export class PermissionCheck {
  hasPermission: boolean;
  timeLeft: number;
  requiresMultiSig: boolean;
  requiredSignatures: number;

  constructor(
    hasPermission: boolean,
    timeLeft: number = 0,
    requiresMultiSig: boolean = false,
    requiredSignatures: number = 0
  ) {
    this.hasPermission = hasPermission;
    this.timeLeft = timeLeft;
    this.requiresMultiSig = requiresMultiSig;
    this.requiredSignatures = requiredSignatures;
  }
}

// Constants
export const DEFAULT_ADMIN_ROLE = "DEFAULT_ADMIN_ROLE";
export const OPERATOR_ROLE = "OPERATOR_ROLE";
export const USER_ROLE = "USER_ROLE";
export const VIEWER_ROLE = "VIEWER_ROLE";

export const PERMISSION_ADMIN = "PERMISSION_ADMIN";
export const PERMISSION_MINT = "PERMISSION_MINT";
export const PERMISSION_BURN = "PERMISSION_BURN";
export const PERMISSION_TRANSFER = "PERMISSION_TRANSFER";
export const PERMISSION_PAUSE = "PERMISSION_PAUSE";
export const PERMISSION_EMERGENCY = "PERMISSION_EMERGENCY";
export const PERMISSION_GRANT_ROLE = "PERMISSION_GRANT_ROLE";
export const PERMISSION_REVOKE_ROLE = "PERMISSION_REVOKE_ROLE";
export const PERMISSION_SET_PERMISSION = "PERMISSION_SET_PERMISSION";
export const PERMISSION_MULTISIG_ADMIN = "PERMISSION_MULTISIG_ADMIN";
export const PERMISSION_VIEW = "PERMISSION_VIEW";
export const PERMISSION_VIEW_OWN_DATA = "PERMISSION_VIEW_OWN_DATA";
