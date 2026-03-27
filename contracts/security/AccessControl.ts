/**
 * @title AccessControl
 * @dev Comprehensive Role-Based Access Control system with hierarchical roles, time-based permissions, and multi-signature requirements
 * @dev Implements gas-optimized permission checking and emergency controls
 */
import {
  IAccessControl,
  Role,
  RoleData,
  TimePermission,
  MultiSigTransaction,
  AuditEntry,
  PermissionCheck,
  RoleGrantedEvent,
  RoleRevokedEvent,
  RoleCreatedEvent,
  PermissionSetEvent,
  TimePermissionSetEvent,
  MultiSigRequirementSetEvent,
  EmergencyPauseActivatedEvent,
  EmergencyPauseDeactivatedEvent,
  PermissionAuditLogEvent,
  DEFAULT_ADMIN_ROLE,
  OPERATOR_ROLE,
  USER_ROLE,
  VIEWER_ROLE,
  PERMISSION_ADMIN,
  PERMISSION_EMERGENCY
} from "./interfaces/IAccessControl";
import { RoleStructure } from "./structures/RoleStructure";
import { RBACLib } from "./libraries/RBACLib";

export class AccessControl implements IAccessControl {
  // Storage
  private roles: Map<string, RoleData> = new Map();
  private accountRoles: Map<string, Set<string>> = new Map(); // account -> set of roles
  private multiSigRequirements: Map<string, number> = new Map();
  private multiSigTransactions: Map<number, MultiSigTransaction> = new Map();
  private auditTrail: AuditEntry[] = [];
  private paused: boolean = false;
  private nextTransactionId: number = 1;

  // Events (for integration with event systems)
  public onRoleGranted?: (event: RoleGrantedEvent) => void;
  public onRoleRevoked?: (event: RoleRevokedEvent) => void;
  public onRoleCreated?: (event: RoleCreatedEvent) => void;
  public onPermissionSet?: (event: PermissionSetEvent) => void;
  public onTimePermissionSet?: (event: TimePermissionSetEvent) => void;
  public onMultiSigRequirementSet?: (event: MultiSigRequirementSetEvent) => void;
  public onEmergencyPauseActivated?: (event: EmergencyPauseActivatedEvent) => void;
  public onEmergencyPauseDeactivated?: (event: EmergencyPauseDeactivatedEvent) => void;
  public onPermissionAuditLog?: (event: PermissionAuditLogEvent) => void;

  constructor() {
    this.initializeDefaultRoles();
  }

  /**
   * @dev Initialize default role hierarchy
   */
  private initializeDefaultRoles(): void {
    // Create default roles with hierarchy
    this.createRole(DEFAULT_ADMIN_ROLE, "", 0);
    this.createRole(OPERATOR_ROLE, DEFAULT_ADMIN_ROLE, 1);
    this.createRole(USER_ROLE, OPERATOR_ROLE, 2);
    this.createRole(VIEWER_ROLE, USER_ROLE, 3);

    // Set default permissions
    this.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_ADMIN, true);
    this.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_EMERGENCY, true);
  }

  // Role Management Functions
  public async createRole(role: string, parentRole: string, priority: number): Promise<void> {
    if (this.roles.has(role)) {
      throw new Error(`Role ${role} already exists`);
    }

    if (parentRole && !this.roles.has(parentRole)) {
      throw new Error(`Parent role ${parentRole} does not exist`);
    }

    const roleData = new RoleData(role, parentRole, priority);
    this.roles.set(role, roleData);

    // Validate hierarchy
    if (!RBACLib.validateHierarchy(this.roles)) {
      this.roles.delete(role);
      throw new Error("Invalid role hierarchy: circular dependency detected");
    }

    this.logAudit("", role, "", false, "CREATE_ROLE");
    this.onRoleCreated?.({ role, parentRole, priority });
  }

  public async grantRole(role: string, account: string): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const roleData = this.roles.get(role)!;
    
    if (roleData.members.get(account)) {
      throw new Error(`Account ${account} already has role ${role}`);
    }

    roleData.members.set(account, true);
    roleData.memberCount++;

    // Update account roles mapping
    if (!this.accountRoles.has(account)) {
      this.accountRoles.set(account, new Set());
    }
    this.accountRoles.get(account)!.add(role);

    this.logAudit(account, role, "", true, "GRANT_ROLE");
    this.onRoleGranted?.({ account, role, granter: "system" });
  }

  public async revokeRole(role: string, account: string): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const roleData = this.roles.get(role)!;
    
    if (!roleData.members.get(account)) {
      throw new Error(`Account ${account} does not have role ${role}`);
    }

    roleData.members.set(account, false);
    roleData.memberCount--;

    // Update account roles mapping
    const accountRoleSet = this.accountRoles.get(account);
    if (accountRoleSet) {
      accountRoleSet.delete(role);
      if (accountRoleSet.size === 0) {
        this.accountRoles.delete(account);
      }
    }

    this.logAudit(account, role, "", false, "REVOKE_ROLE");
    this.onRoleRevoked?.({ account, role, revoker: "system" });
  }

  public async hasRole(role: string, account: string): Promise<boolean> {
    return RBACLib.hasRole(this.roles, role, account);
  }

  public async getRoleMembers(role: string): Promise<string[]> {
    const roleData = this.roles.get(role);
    if (!roleData) {
      return [];
    }

    const members: string[] = [];
    for (const [account, hasRole] of roleData.members.entries()) {
      if (hasRole) {
        members.push(account);
      }
    }
    return members;
  }

  // Permission Management Functions
  public async setPermission(role: string, permission: string, granted: boolean): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const roleData = this.roles.get(role)!;
    roleData.permissions.set(permission, granted);

    this.logAudit("", role, permission, granted, "SET_PERMISSION");
    this.onPermissionSet?.({ role, permission, granted });
  }

  public async setTimeBasedPermission(
    role: string,
    permission: string,
    startTime: number,
    endTime: number
  ): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const timePermission = RBACLib.createTimePermission(startTime, endTime);
    const roleData = this.roles.get(role)!;
    roleData.timePermissions.set(permission, timePermission);

    this.logAudit("", role, permission, true, "SET_TIME_PERMISSION");
    this.onTimePermissionSet?.({ role, permission, startTime, endTime });
  }

  public async hasPermission(role: string, permission: string, account: string): Promise<boolean> {
    const check = await this.hasPermissionWithTime(role, permission, account);
    return check.hasPermission;
  }

  public async hasPermissionWithTime(
    role: string,
    permission: string,
    account: string
  ): Promise<{ hasPermission: boolean; timeLeft: number }> {
    const check = RBACLib.hasPermission(this.roles, role, permission, account);
    return { hasPermission: check.hasPermission, timeLeft: check.timeLeft };
  }

  // Hierarchical Functions
  public async getRoleHierarchy(role: string): Promise<string[]> {
    return RBACLib.getRoleHierarchy(this.roles, role);
  }

  public async inheritsPermission(role: string, permission: string): Promise<boolean> {
    const roleData = this.roles.get(role);
    if (!roleData) return false;

    // Check direct permission
    if (roleData.permissions.get(permission)) return true;

    // Check inherited permissions
    const inheritedRoles = RBACLib.getInheritedRoles(this.roles, role);
    for (const inheritedRole of inheritedRoles) {
      const inheritedRoleData = this.roles.get(inheritedRole);
      if (inheritedRoleData && inheritedRoleData.permissions.get(permission)) {
        return true;
      }
    }

    return false;
  }

  // Multi-signature Functions
  public async setMultiSigRequirement(permission: string, requiredSignatures: number): Promise<void> {
    if (requiredSignatures < 1) {
      throw new Error("Required signatures must be at least 1");
    }

    this.multiSigRequirements.set(permission, requiredSignatures);
    this.onMultiSigRequirementSet?.({ permission, requiredSignatures });
  }

  public async submitMultiSigTransaction(
    permission: string,
    data: string,
    signers: string[]
  ): Promise<number> {
    const requiredSignatures = this.multiSigRequirements.get(permission) || 0;
    if (requiredSignatures === 0) {
      throw new Error(`No multi-sig requirement set for permission ${permission}`);
    }

    const transaction = new MultiSigTransaction(permission, data, signers, requiredSignatures);
    const transactionId = this.nextTransactionId++;
    
    this.multiSigTransactions.set(transactionId, transaction);
    
    // Auto-confirm if submitter is one of the signers
    for (const signer of signers) {
      await this.confirmMultiSigTransaction(transactionId, signer);
      break; // Only confirm once per submitter
    }

    return transactionId;
  }

  public async confirmMultiSigTransaction(transactionId: number, signer: string): Promise<void> {
    const transaction = this.multiSigTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} does not exist`);
    }

    if (transaction.executed) {
      throw new Error(`Transaction ${transactionId} already executed`);
    }

    if (!transaction.signers.includes(signer)) {
      throw new Error(`Signer ${signer} is not authorized for this transaction`);
    }

    // Check if already confirmed
    const alreadyConfirmed = transaction.signers.slice(0, transaction.confirmationCount).includes(signer);
    if (alreadyConfirmed) {
      throw new Error(`Signer ${signer} already confirmed this transaction`);
    }

    // Move signer to confirmed position
    const signerIndex = transaction.signers.indexOf(signer);
    [transaction.signers[signerIndex], transaction.signers[transaction.confirmationCount]] = 
      [transaction.signers[transaction.confirmationCount], transaction.signers[signerIndex]];
    transaction.confirmationCount++;
  }

  public async executeMultiSigTransaction(transactionId: number): Promise<void> {
    const transaction = this.multiSigTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} does not exist`);
    }

    if (!RBACLib.validateMultiSigTransaction(transaction, transaction.requiredSignatures)) {
      throw new Error(`Transaction ${transactionId} does not have enough confirmations`);
    }

    transaction.executed = true;
    // In a real implementation, this would execute the transaction data
  }

  // Emergency Controls
  public async emergencyPause(): Promise<void> {
    if (this.paused) {
      throw new Error("System is already paused");
    }

    this.paused = true;
    this.onEmergencyPauseActivated?.({ activator: "system" });
  }

  public async emergencyUnpause(): Promise<void> {
    if (!this.paused) {
      throw new Error("System is not paused");
    }

    this.paused = false;
    this.onEmergencyPauseDeactivated?.({ deactivator: "system" });
  }

  public async isPaused(): Promise<boolean> {
    return this.paused;
  }

  // Audit Functions
  public async getPermissionAuditTrail(account: string, role: string): Promise<AuditEntry[]> {
    return this.auditTrail.filter(entry => 
      entry.account === account && entry.role === role
    );
  }

  public async getRoleAuditTrail(role: string): Promise<AuditEntry[]> {
    return this.auditTrail.filter(entry => entry.role === role);
  }

  // Gas Optimization Functions
  public async batchGrantRole(role: string, accounts: string[]): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const roleData = this.roles.get(role)!;
    
    for (const account of accounts) {
      if (!roleData.members.get(account)) {
        roleData.members.set(account, true);
        roleData.memberCount++;

        if (!this.accountRoles.has(account)) {
          this.accountRoles.set(account, new Set());
        }
        this.accountRoles.get(account)!.add(role);

        this.logAudit(account, role, "", true, "BATCH_GRANT_ROLE");
      }
    }
  }

  public async batchRevokeRole(role: string, accounts: string[]): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    const roleData = this.roles.get(role)!;
    
    for (const account of accounts) {
      if (roleData.members.get(account)) {
        roleData.members.set(account, false);
        roleData.memberCount--;

        const accountRoleSet = this.accountRoles.get(account);
        if (accountRoleSet) {
          accountRoleSet.delete(role);
          if (accountRoleSet.size === 0) {
            this.accountRoles.delete(account);
          }
        }

        this.logAudit(account, role, "", false, "BATCH_REVOKE_ROLE");
      }
    }
  }

  public async batchSetPermissions(
    role: string,
    permissions: string[],
    granted: boolean[]
  ): Promise<void> {
    if (!this.roles.has(role)) {
      throw new Error(`Role ${role} does not exist`);
    }

    if (permissions.length !== granted.length) {
      throw new Error("Permissions and granted arrays must have the same length");
    }

    const roleData = this.roles.get(role)!;
    
    for (let i = 0; i < permissions.length; i++) {
      roleData.permissions.set(permissions[i], granted[i]);
      this.logAudit("", role, permissions[i], granted[i], "BATCH_SET_PERMISSION");
    }
  }

  // Internal Functions
  private logAudit(
    account: string,
    role: string,
    permission: string,
    granted: boolean,
    action: string
  ): void {
    const entry = new AuditEntry(account, role, permission, granted, "system", action);
    this.auditTrail.push(entry);
    
    this.onPermissionAuditLog?.({
      account,
      role,
      permission,
      granted,
      timestamp: entry.timestamp
    });
  }

  // Utility Functions
  public getAccountRoles(account: string): string[] {
    const roleSet = this.accountRoles.get(account);
    return roleSet ? Array.from(roleSet) : [];
  }

  public getAllRoles(): string[] {
    return Array.from(this.roles.keys());
  }

  public getRoleData(role: string): RoleData | undefined {
    return this.roles.get(role);
  }

  public getMultiSigTransaction(transactionId: number): MultiSigTransaction | undefined {
    return this.multiSigTransactions.get(transactionId);
  }

  public getAuditTrail(): AuditEntry[] {
    return [...this.auditTrail];
  }

  public clearCache(): void {
    RBACLib.clearCache();
  }

  public getCacheStats(): { size: number; maxSize: number } {
    return RBACLib.getCacheStats();
  }
}
