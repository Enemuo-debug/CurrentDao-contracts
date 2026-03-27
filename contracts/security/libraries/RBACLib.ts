/**
 * @title RBACLib
 * @dev Library for core permission checking logic and RBAC utilities
 * @dev Provides gas-optimized functions for role and permission validation
 */
import { Role, RoleData, TimePermission, PermissionCheck } from "../interfaces/IAccessControl";
import { RoleStructure } from "../structures/RoleStructure";

export class RBACLib {
  // Cache for permission checks to optimize gas
  private static permissionCache: Map<string, { result: boolean; timestamp: number }> = new Map();
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * @dev Checks if an account has a specific role
   * @param roleData Role data mapping
   * @param role Role to check
   * @param account Account to check
   * @return True if account has the role
   */
  public static hasRole(roleData: Map<string, RoleData>, role: string, account: string): boolean {
    const roleInfo = roleData.get(role);
    if (!roleInfo) return false;
    
    return roleInfo.members.get(account) || false;
  }

  /**
   * @dev Checks if an account has a specific permission (including inheritance)
   * @param roleData Role data mapping
   * @param role Role to check
   * @param permission Permission to check
   * @param account Account to check
   * @return PermissionCheck object with detailed information
   */
  public static hasPermission(
    roleData: Map<string, RoleData>,
    role: string,
    permission: string,
    account: string
  ): PermissionCheck {
    // First check if account has the role
    if (!this.hasRole(roleData, role, account)) {
      return new PermissionCheck(false, 0, false, 0);
    }

    // Check cache first
    const cacheKey = `${role}_${permission}_${account}`;
    const cached = this.permissionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return new PermissionCheck(cached.result, 0, false, 0);
    }

    // Get role info
    const roleInfo = roleData.get(role);
    if (!roleInfo) {
      return new PermissionCheck(false, 0, false, 0);
    }

    // Check direct permission
    let hasPermission = roleInfo.permissions.get(permission) || false;
    let timeLeft = 0;

    // Check time-based permission if it exists
    const timePerm = roleInfo.timePermissions.get(permission);
    if (timePerm && timePerm.hasTimeLimit) {
      const currentTime = Date.now();
      if (currentTime < timePerm.startTime) {
        hasPermission = false;
        timeLeft = timePerm.startTime - currentTime;
      } else if (currentTime > timePerm.endTime) {
        hasPermission = false;
        timeLeft = 0;
      } else {
        timeLeft = timePerm.endTime - currentTime;
      }
    }

    // Check inherited permissions if no direct permission
    if (!hasPermission) {
      const inheritedRoles = this.getInheritedRoles(roleData, role);
      for (const inheritedRole of inheritedRoles) {
        const inheritedRoleInfo = roleData.get(inheritedRole);
        if (inheritedRoleInfo) {
          const inheritedPermission = inheritedRoleInfo.permissions.get(permission) || false;
          if (inheritedPermission) {
            hasPermission = true;
            break;
          }
        }
      }
    }

    // Cache the result
    this.permissionCache.set(cacheKey, { result: hasPermission, timestamp: Date.now() });

    return new PermissionCheck(hasPermission, timeLeft, false, 0);
  }

  /**
   * @dev Gets all roles that inherit from a given role
   * @param roleData Role data mapping
   * @param role Parent role
   * @return Array of child role names
   */
  public static getInheritedRoles(roleData: Map<string, RoleData>, role: string): string[] {
    const inherited: string[] = [];
    
    for (const [roleName, roleInfo] of roleData.entries()) {
      if (roleInfo.parentRole === role) {
        inherited.push(roleName);
        // Recursively get children of this role
        inherited.push(...this.getInheritedRoles(roleData, roleName));
      }
    }
    
    return inherited;
  }

  /**
   * @dev Gets the complete role hierarchy for a role
   * @param roleData Role data mapping
   * @param role Role to get hierarchy for
   * @return Array of role names in hierarchy order (highest to lowest)
   */
  public static getRoleHierarchy(roleData: Map<string, RoleData>, role: string): string[] {
    const hierarchy: string[] = [role];
    let currentRole = role;
    
    while (true) {
      const roleInfo = roleData.get(currentRole);
      if (!roleInfo || !roleInfo.parentRole) break;
      
      hierarchy.push(roleInfo.parentRole);
      currentRole = roleInfo.parentRole;
    }
    
    return hierarchy;
  }

  /**
   * @dev Validates role hierarchy for consistency
   * @param roleData Role data mapping
   * @return True if hierarchy is valid
   */
  public static validateHierarchy(roleData: Map<string, RoleData>): boolean {
    const visited = new Set<string>();
    
    for (const [roleName, roleInfo] of roleData.entries()) {
      if (this.hasCircularDependency(roleData, roleName, visited)) {
        return false;
      }
      visited.clear();
    }
    
    return true;
  }

  /**
   * @dev Helper method to detect circular dependencies
   * @param roleData Role data mapping
   * @param role Role to check
   * @param visited Set of visited roles
   * @return True if circular dependency detected
   */
  private static hasCircularDependency(
    roleData: Map<string, RoleData>,
    role: string,
    visited: Set<string>
  ): boolean {
    if (visited.has(role)) {
      return true; // Circular dependency detected
    }
    
    visited.add(role);
    const roleInfo = roleData.get(role);
    
    if (roleInfo && roleInfo.parentRole) {
      return this.hasCircularDependency(roleData, roleInfo.parentRole, new Set(visited));
    }
    
    return false;
  }

  /**
   * @dev Optimized batch role checking
   * @param roleData Role data mapping
   * @param role Role to check
   * @param accounts Array of accounts to check
   * @return Array of booleans indicating role membership
   */
  public static batchHasRole(
    roleData: Map<string, RoleData>,
    role: string,
    accounts: string[]
  ): boolean[] {
    const roleInfo = roleData.get(role);
    if (!roleInfo) {
      return new Array(accounts.length).fill(false);
    }
    
    return accounts.map(account => roleInfo.members.get(account) || false);
  }

  /**
   * @dev Optimized batch permission checking
   * @param roleData Role data mapping
   * @param role Role to check
   * @param permissions Array of permissions to check
   * @param account Account to check
   * @return Array of PermissionCheck objects
   */
  public static batchHasPermission(
    roleData: Map<string, RoleData>,
    role: string,
    permissions: string[],
    account: string
  ): PermissionCheck[] {
    return permissions.map(permission => 
      this.hasPermission(roleData, role, permission, account)
    );
  }

  /**
   * @dev Gets the highest priority role for an account
   * @param roleData Role data mapping
   * @param account Account to check
   * @return Highest priority role name or null if no roles
   */
  public static getHighestPriorityRole(
    roleData: Map<string, RoleData>,
    account: string
  ): string | null {
    let highestRole: string | null = null;
    let highestPriority = Infinity;
    
    for (const [roleName, roleInfo] of roleData.entries()) {
      if (roleInfo.members.get(account) && roleInfo.priority < highestPriority) {
        highestRole = roleName;
        highestPriority = roleInfo.priority;
      }
    }
    
    return highestRole;
  }

  /**
   * @dev Checks if a role change is allowed based on hierarchy
   * @param roleData Role data mapping
   * @param fromRole Current role
   * @param toRole Target role
   * @param actor Account making the change
   * @return True if change is allowed
   */
  public static canChangeRole(
    roleData: Map<string, RoleData>,
    fromRole: string,
    toRole: string,
    actor: string
  ): boolean {
    // Get actor's highest role
    const actorRole = this.getHighestPriorityRole(roleData, actor);
    if (!actorRole) return false;
    
    const actorRoleInfo = roleData.get(actorRole);
    const fromRoleInfo = roleData.get(fromRole);
    const toRoleInfo = roleData.get(toRole);
    
    if (!actorRoleInfo || !fromRoleInfo || !toRoleInfo) return false;
    
    // Actor must have higher or equal priority than both roles
    return actorRoleInfo.priority <= fromRoleInfo.priority && 
           actorRoleInfo.priority <= toRoleInfo.priority;
  }

  /**
   * @dev Clears the permission cache
   */
  public static clearCache(): void {
    this.permissionCache.clear();
  }

  /**
   * @dev Gets cache statistics
   * @return Cache size and hit rate information
   */
  public static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.permissionCache.size,
      maxSize: 1000 // Configurable max cache size
    };
  }

  /**
   * @dev Validates time-based permission parameters
   * @param startTime Start timestamp
   * @param endTime End timestamp
   * @return True if parameters are valid
   */
  public static validateTimeParameters(startTime: number, endTime: number): boolean {
    const now = Date.now();
    return startTime >= now && endTime > startTime;
  }

  /**
   * @dev Creates a time permission object
   * @param startTime Start timestamp
   * @param endTime End timestamp
   * @return TimePermission object
   */
  public static createTimePermission(startTime: number, endTime: number): TimePermission {
    if (!this.validateTimeParameters(startTime, endTime)) {
      throw new Error("Invalid time parameters");
    }
    
    return new TimePermission(true, startTime, endTime);
  }

  /**
   * @dev Checks if a permission requires multi-signature
   * @param permission Permission to check
   * @param multiSigRequirements Multi-sig requirement mapping
   * @return Number of required signatures
   */
  public static getMultiSigRequirement(
    permission: string,
    multiSigRequirements: Map<string, number>
  ): number {
    return multiSigRequirements.get(permission) || 0;
  }

  /**
   * @dev Validates multi-signature transaction
   * @param transaction Transaction to validate
   * @param requiredSignatures Required number of signatures
   * @return True if transaction is valid
   */
  public static validateMultiSigTransaction(
    transaction: any, // MultiSigTransaction type
    requiredSignatures: number
  ): boolean {
    return transaction.confirmationCount >= requiredSignatures && !transaction.executed;
  }

  /**
   * @dev Gas optimization: pack multiple boolean checks into a single integer
   * @param checks Array of boolean values
   * @return Packed integer representation
   */
  public static packBooleans(checks: boolean[]): number {
    let packed = 0;
    for (let i = 0; i < Math.min(checks.length, 32); i++) {
      if (checks[i]) {
        packed |= (1 << i);
      }
    }
    return packed;
  }

  /**
   * @dev Gas optimization: unpack boolean checks from integer
   * @param packed Packed integer
   * @param count Number of booleans to unpack
   * @return Array of boolean values
   */
  public static unpackBooleans(packed: number, count: number): boolean[] {
    const checks: boolean[] = [];
    for (let i = 0; i < Math.min(count, 32); i++) {
      checks.push((packed & (1 << i)) !== 0);
    }
    return checks;
  }
}
