import {
  ACL_ERROR,
  AccessEffect,
  DirectPermissionGrant,
  PermissionDefinition,
  PermissionPayload
} from '../interfaces/IAccessControlList';
import { ACLLib } from '../libraries/ACLLib';

/**
 * @title PermissionManager
 * @dev Stores permission definitions, per-subject overrides, and function-level permission registration
 */
export class PermissionManager {
  private readonly permissions = new Map<string, PermissionDefinition>();
  private readonly directGrants = new Map<string, Map<string, DirectPermissionGrant>>();

  public createPermission(payload: PermissionPayload, actor: string): PermissionDefinition {
    const permissionId = ACLLib.normalizeId(payload.id);
    if (this.permissions.has(permissionId)) {
      throw new Error(ACL_ERROR.PERMISSION_ALREADY_EXISTS);
    }

    const permission: PermissionDefinition = {
      id: permissionId,
      contractId: payload.contractId,
      functionName: payload.functionName,
      description: payload.description,
      effect: payload.effect || AccessEffect.ALLOW,
      isWildcard: payload.functionName === '*' || payload.contractId === '*',
      riskLevel: payload.riskLevel || 'MEDIUM',
      gasEstimate: this.estimatePermissionGas(payload.functionName, payload.contractId),
      createdBy: actor,
      createdAt: ACLLib.now()
    };

    this.permissions.set(permissionId, permission);
    return { ...permission };
  }

  public registerFunctionPermissions(contractId: string, functions: string[], actor: string): PermissionDefinition[] {
    const created: PermissionDefinition[] = [];

    for (const functionName of functions) {
      const permissionId = ACLLib.normalizeId(`EXECUTE_${contractId}_${functionName}`);
      if (this.permissions.has(permissionId)) {
        created.push({ ...ACLLib.ensurePermissionExists(this.permissions.get(permissionId)) });
        continue;
      }

      created.push(
        this.createPermission(
          {
            id: permissionId,
            contractId,
            functionName,
            description: `Execute ${contractId}.${functionName}`,
            effect: AccessEffect.ALLOW,
            riskLevel: 'MEDIUM'
          },
          actor
        )
      );
    }

    return created;
  }

  public grantDirectPermission(
    subject: string,
    permissionId: string,
    actor: string,
    effect: AccessEffect,
    reason?: string,
    expiresAt?: number
  ): DirectPermissionGrant {
    const normalizedPermissionId = ACLLib.normalizeId(permissionId);
    ACLLib.ensurePermissionExists(this.permissions.get(normalizedPermissionId));
    const subjectGrants = this.directGrants.get(subject) || new Map<string, DirectPermissionGrant>();
    const grant: DirectPermissionGrant = {
      subject,
      permissionId: normalizedPermissionId,
      effect,
      grantedBy: actor,
      grantedAt: ACLLib.now(),
      ...(reason ? { reason } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {})
    };

    subjectGrants.set(permissionId, grant);
    this.directGrants.set(subject, subjectGrants);
    return { ...grant };
  }

  public revokeDirectPermission(subject: string, permissionId: string): DirectPermissionGrant | undefined {
    const normalizedPermissionId = ACLLib.normalizeId(permissionId);
    const subjectGrants = this.directGrants.get(subject);
    const grant = subjectGrants?.get(normalizedPermissionId);
    if (!subjectGrants || !grant) {
      return undefined;
    }

    subjectGrants.delete(normalizedPermissionId);
    if (subjectGrants.size === 0) {
      this.directGrants.delete(subject);
    }

    return { ...grant };
  }

  public getPermission(permissionId: string): PermissionDefinition | undefined {
    const permission = this.permissions.get(ACLLib.normalizeId(permissionId));
    return permission ? { ...permission } : undefined;
  }

  public getPermissions(): PermissionDefinition[] {
    return [...this.permissions.values()].map((permission) => ({ ...permission }));
  }

  public getDirectGrants(subject: string): DirectPermissionGrant[] {
    const now = ACLLib.now();
    const grants = this.directGrants.get(subject);
    if (!grants) {
      return [];
    }

    return [...grants.values()]
      .filter((grant) => grant.expiresAt === undefined || grant.expiresAt > now)
      .map((grant) => ({ ...grant }));
  }

  public matchPermissions(permissionIds: string[], contractId: string, functionName: string): PermissionDefinition[] {
    const matched: PermissionDefinition[] = [];

    for (const permissionId of permissionIds) {
      const permission = this.permissions.get(permissionId);
      if (!permission) {
        continue;
      }

      if (permission.contractId !== '*' && permission.contractId !== contractId) {
        continue;
      }

      if (permission.functionName !== '*' && permission.functionName !== functionName) {
        continue;
      }

      matched.push({ ...permission });
    }

    return matched;
  }

  public getPermissionStore(): Map<string, PermissionDefinition> {
    return this.permissions;
  }

  private estimatePermissionGas(functionName: string, contractId: string): number {
    const base = 2500;
    const wildcardPenalty = functionName === '*' || contractId === '*' ? 200 : 0;
    return base + functionName.length * 35 + contractId.length * 20 + wildcardPenalty;
  }
}
