/**
 * @title RoleStructure
 * @dev Defines hierarchical roles and permissions for the access control system
 * @dev Implements role inheritance and priority-based access
 */
import { Role, TimePermission, AuditEntry } from "../interfaces/IAccessControl";

export class RoleStructure {
  // Role hierarchy with inheritance
  private static readonly ROLE_HIERARCHY: Map<Role, Role[]> = new Map([
    [Role.ADMIN, [Role.OPERATOR, Role.USER, Role.VIEWER]],
    [Role.OPERATOR, [Role.USER, Role.VIEWER]],
    [Role.USER, [Role.VIEWER]],
    [Role.VIEWER, []]
  ]);

  // Role priorities (lower number = higher priority)
  private static readonly ROLE_PRIORITIES: Map<Role, number> = new Map([
    [Role.ADMIN, 0],
    [Role.OPERATOR, 1],
    [Role.USER, 2],
    [Role.VIEWER, 3]
  ]);

  // Permission sets for each role
  private static readonly ROLE_PERMISSIONS: Map<Role, Set<string>> = new Map([
    [Role.ADMIN, new Set([
      "PERMISSION_ADMIN",
      "PERMISSION_MINT",
      "PERMISSION_BURN",
      "PERMISSION_TRANSFER",
      "PERMISSION_PAUSE",
      "PERMISSION_EMERGENCY",
      "PERMISSION_GRANT_ROLE",
      "PERMISSION_REVOKE_ROLE",
      "PERMISSION_SET_PERMISSION",
      "PERMISSION_MULTISIG_ADMIN"
    ])],
    [Role.OPERATOR, new Set([
      "PERMISSION_MINT",
      "PERMISSION_BURN",
      "PERMISSION_TRANSFER",
      "PERMISSION_PAUSE"
    ])],
    [Role.USER, new Set([
      "PERMISSION_TRANSFER",
      "PERVIEW_OWN_DATA"
    ])],
    [Role.VIEWER, new Set([
      "PERMISSION_VIEW"
    ])]
  ]);

  // Time-based permission storage
  private timePermissions: Map<string, TimePermission> = new Map();
  
  // Audit trail storage
  private auditTrail: AuditEntry[] = [];

  /**
   * @dev Gets the priority of a role (lower number = higher priority)
   */
  public static getRolePriority(role: Role): number {
    return this.ROLE_PRIORITIES.get(role) || 999;
  }

  /**
   * @dev Checks if a role inherits from another role
   */
  public static inheritsRole(childRole: Role, parentRole: Role): boolean {
    const inheritedRoles = this.ROLE_HIERARCHY.get(parentRole);
    if (!inheritedRoles) return false;
    
    return inheritedRoles.includes(childRole) || 
           inheritedRoles.some(role => this.inheritsRole(childRole, role));
  }

  /**
   * @dev Gets all permissions for a role including inherited permissions
   */
  public static getRolePermissions(role: Role): Set<string> {
    const permissions = new Set(this.ROLE_PERMISSIONS.get(role) || []);
    
    // Add permissions from inherited roles
    const inheritedRoles = this.ROLE_HIERARCHY.get(role);
    if (inheritedRoles) {
      for (const inheritedRole of inheritedRoles) {
        const inheritedPerms = this.getRolePermissions(inheritedRole);
        for (const perm of inheritedPerms) {
          permissions.add(perm);
        }
      }
    }
    
    return permissions;
  }

  /**
   * @dev Checks if a role has a specific permission (including inheritance)
   */
  public static roleHasPermission(role: Role, permission: string): boolean {
    return this.getRolePermissions(role).has(permission);
  }

  /**
   * @dev Sets a time-based permission for a role
   */
  public setTimeBasedPermission(role: Role, permission: string, startTime: number, endTime: number): void {
    const key = `${Role[role]}_${permission}`;
    this.timePermissions.set(key, {
      hasTimeLimit: true,
      startTime,
      endTime
    });
  }

  /**
   * @dev Removes time-based permission for a role
   */
  public removeTimeBasedPermission(role: Role, permission: string): void {
    const key = `${Role[role]}_${permission}`;
    this.timePermissions.delete(key);
  }

  /**
   * @dev Checks if a time-based permission is still valid
   */
  public isTimeBasedPermissionValid(role: Role, permission: string, currentTime: number): boolean {
    const key = `${Role[role]}_${permission}`;
    const timePerm = this.timePermissions.get(key);
    
    if (!timePerm || !timePerm.hasTimeLimit) {
      return true; // No time limit means always valid
    }
    
    return currentTime >= timePerm.startTime && currentTime <= timePerm.endTime;
  }

  /**
   * @dev Gets time remaining for a time-based permission
   */
  public getTimeRemaining(role: Role, permission: string, currentTime: number): number {
    const key = `${Role[role]}_${permission}`;
    const timePerm = this.timePermissions.get(key);
    
    if (!timePerm || !timePerm.hasTimeLimit) {
      return 0; // No time limit
    }
    
    if (currentTime < timePerm.startTime) {
      return timePerm.startTime - currentTime;
    }
    
    if (currentTime > timePerm.endTime) {
      return 0; // Expired
    }
    
    return timePerm.endTime - currentTime;
  }

  /**
   * @dev Adds an audit entry
   */
  public addAuditEntry(entry: AuditEntry): void {
    this.auditTrail.push(entry);
  }

  /**
   * @dev Gets audit trail for a specific account and role
   */
  public getAuditTrail(account?: string, role?: Role): AuditEntry[] {
    if (!account && !role) {
      return this.auditTrail;
    }
    
    return this.auditTrail.filter(entry => {
      if (account && entry.account !== account) return false;
      if (role && entry.role !== role.toString()) return false;
      return true;
    });
  }

  /**
   * @dev Gets the complete role hierarchy path from a role to the top
   */
  public static getRoleHierarchyPath(role: Role): Role[] {
    const path: Role[] = [role];
    
    // Find all parent roles that this role inherits from
    for (const [parentRole, childRoles] of this.ROLE_HIERARCHY.entries()) {
      if (childRoles.includes(role)) {
        path.push(parentRole);
        // Recursively get parent's hierarchy
        const parentPath = this.getRoleHierarchyPath(parentRole);
        path.push(...parentPath.filter(r => !path.includes(r)));
      }
    }
    
    return path;
  }

  /**
   * @dev Compares two roles by priority
   * @return -1 if role1 has higher priority, 1 if role2 has higher priority, 0 if equal
   */
  public static compareRoles(role1: Role, role2: Role): number {
    const priority1 = this.getRolePriority(role1);
    const priority2 = this.getRolePriority(role2);
    
    if (priority1 < priority2) return -1;
    if (priority1 > priority2) return 1;
    return 0;
  }

  /**
   * @dev Gets the highest role among multiple roles
   */
  public static getHighestRole(roles: Role[]): Role | null {
    if (roles.length === 0) return null;
    
    return roles.reduce((highest, current) => {
      return this.compareRoles(current, highest) < 0 ? current : highest;
    });
  }

  /**
   * @dev Validates role hierarchy consistency
   */
  public static validateHierarchy(): boolean {
    // Check for circular dependencies
    for (const role of Object.values(Role)) {
      if (this.hasCircularDependency(role, new Set())) {
        return false;
      }
    }
    
    // Check for valid priorities
    const priorities = Array.from(this.ROLE_PRIORITIES.values());
    const uniquePriorities = new Set(priorities);
    if (priorities.length !== uniquePriorities.size) {
      return false; // Duplicate priorities
    }
    
    return true;
  }

  /**
   * @dev Helper method to detect circular dependencies in role hierarchy
   */
  private static hasCircularDependency(role: Role, visited: Set<Role>): boolean {
    if (visited.has(role)) {
      return true; // Circular dependency detected
    }
    
    visited.add(role);
    const childRoles = this.ROLE_HIERARCHY.get(role) || [];
    
    for (const childRole of childRoles) {
      if (this.hasCircularDependency(childRole, new Set(visited))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * @dev Gets all roles that inherit from a given role
   */
  public static getInheritingRoles(parentRole: Role): Role[] {
    const inheriting: Role[] = [];
    
    for (const [role, childRoles] of this.ROLE_HIERARCHY.entries()) {
      if (childRoles.includes(parentRole)) {
        inheriting.push(role);
        // Recursively add roles that inherit from this role
        inheriting.push(...this.getInheritingRoles(role));
      }
    }
    
    return [...new Set(inheriting)]; // Remove duplicates
  }
}
