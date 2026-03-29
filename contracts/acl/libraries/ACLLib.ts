import {
  ACL_ERROR,
  AccessDecision,
  AccessRequest,
  AuditAction,
  AuditLogEntry,
  PermissionDefinition,
  RoleDefinition
} from '../interfaces/IAccessControlList';

/**
 * @title ACLLib
 * @dev Shared helpers for access control normalization, matching, inheritance, and gas estimation
 */
export class ACLLib {
  static now(): number {
    return Math.floor(Date.now() / 1000);
  }

  static buildPermissionKey(contractId: string, functionName: string): string {
    return `${contractId}::${functionName}`;
  }

  static normalizeId(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_*:]/g, '_');
  }

  static ensureRoleExists(role: RoleDefinition | undefined): RoleDefinition {
    if (!role) {
      throw new Error(ACL_ERROR.ROLE_NOT_FOUND);
    }

    return role;
  }

  static ensurePermissionExists(permission: PermissionDefinition | undefined): PermissionDefinition {
    if (!permission) {
      throw new Error(ACL_ERROR.PERMISSION_NOT_FOUND);
    }

    return permission;
  }

  static createAuditEntry(
    action: AuditAction,
    actor: string,
    success: boolean,
    reason: string,
    metadata: Record<string, string | number | boolean> = {},
    overrides: Partial<AuditLogEntry> = {}
  ): AuditLogEntry {
    return {
      id: `${action}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      action,
      actor,
      success,
      reason,
      metadata,
      timestamp: this.now(),
      ...overrides
    };
  }

  static permissionMatches(permission: PermissionDefinition, request: AccessRequest): boolean {
    if (permission.contractId !== '*' && permission.contractId !== request.contractId) {
      return false;
    }

    return permission.functionName === '*' || permission.functionName === request.functionName;
  }

  static estimateAccessCheckGas(params: {
    roleCount: number;
    inheritedRoleCount: number;
    directGrantCount: number;
    locked: boolean;
    matchedPermissionCount: number;
  }): number {
    const base = 11200;
    const roleCost = params.roleCount * 850;
    const inheritedCost = params.inheritedRoleCount * 620;
    const directCost = params.directGrantCount * 350;
    const matchCost = params.matchedPermissionCount * 475;
    const emergencyCost = params.locked ? 900 : 0;

    return base + roleCost + inheritedCost + directCost + matchCost + emergencyCost;
  }

  static buildDeniedDecision(reason: string, gasEstimate: number): AccessDecision {
    return {
      allowed: false,
      reason,
      matchedPermissions: [],
      inheritedViaRoles: [],
      gasEstimate
    };
  }

  static buildDecision(
    allowed: boolean,
    reason: string,
    matchedPermissions: string[],
    inheritedViaRoles: string[],
    gasEstimate: number
  ): AccessDecision {
    return {
      allowed,
      reason,
      matchedPermissions: [...new Set(matchedPermissions)],
      inheritedViaRoles: [...new Set(inheritedViaRoles)],
      gasEstimate
    };
  }

  static collectRoleLineage(
    roleId: string,
    roles: Map<string, RoleDefinition>,
    visited: Set<string> = new Set()
  ): string[] {
    const normalizedId = this.normalizeId(roleId);
    if (visited.has(normalizedId)) {
      return [];
    }

    const role = roles.get(normalizedId);
    if (!role) {
      return [];
    }

    visited.add(normalizedId);

    const lineage: string[] = [normalizedId];
    for (const parentId of role.parentRoleIds) {
      const parentLineage = this.collectRoleLineage(parentId, roles, visited);
      for (const id of parentLineage) {
        if (!lineage.includes(id)) {
          lineage.push(id);
        }
      }
    }

    return lineage;
  }

  static mergePermissions(roleIds: string[], roles: Map<string, RoleDefinition>): string[] {
    const permissions = new Set<string>();

    for (const roleId of roleIds) {
      const lineage = this.collectRoleLineage(roleId, roles);
      for (const lineageRoleId of lineage) {
        const role = roles.get(lineageRoleId);
        if (!role) {
          continue;
        }

        role.permissionIds.forEach((permissionId) => permissions.add(permissionId));
      }
    }

    return [...permissions];
  }

  static assertGasTarget(gasEstimate: number, maxGas: number): void {
    if (gasEstimate > maxGas) {
      throw new Error(`${ACL_ERROR.GAS_TARGET_EXCEEDED}:${gasEstimate}`);
    }
  }
}
