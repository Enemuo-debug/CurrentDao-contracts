import {
  ACL_ERROR,
  RoleAssignment,
  RoleCreationPayload,
  RoleDefinition,
  UpdateRolePayload
} from '../interfaces/IAccessControlList';
import { ACLLib } from '../libraries/ACLLib';

/**
 * @title RoleManager
 * @dev Maintains role definitions, inheritance, and subject assignments
 */
export class RoleManager {
  private readonly roles = new Map<string, RoleDefinition>();
  private readonly assignments = new Map<string, Map<string, RoleAssignment>>();

  public createRole(
    payload: RoleCreationPayload,
    actor: string,
    isSystemRole: boolean,
    governanceManaged: boolean
  ): RoleDefinition {
    const roleId = ACLLib.normalizeId(payload.id);
    if (this.roles.has(roleId)) {
      throw new Error(ACL_ERROR.ROLE_ALREADY_EXISTS);
    }

    const normalizedParentRoleIds = [...new Set((payload.parentRoleIds || []).map((parentRoleId) => ACLLib.normalizeId(parentRoleId)))];
    const normalizedPermissionIds = [...new Set((payload.permissionIds || []).map((permissionId) => ACLLib.normalizeId(permissionId)))];

    for (const parentRoleId of normalizedParentRoleIds) {
      if (!this.roles.has(parentRoleId)) {
        throw new Error(`${ACL_ERROR.ROLE_NOT_FOUND}:${parentRoleId}`);
      }
    }

    const now = ACLLib.now();
    const role: RoleDefinition = {
      id: roleId,
      label: payload.label,
      description: payload.description,
      parentRoleIds: normalizedParentRoleIds,
      permissionIds: normalizedPermissionIds,
      isSystemRole,
      governanceManaged,
      metadata: { ...(payload.metadata || {}) },
      createdBy: actor,
      createdAt: now,
      updatedAt: now
    };

    this.roles.set(roleId, role);
    return {
      ...role,
      parentRoleIds: [...role.parentRoleIds],
      permissionIds: [...role.permissionIds],
      metadata: { ...role.metadata }
    };
  }

  public updateRole(payload: UpdateRolePayload): RoleDefinition {
    const normalizedRoleId = ACLLib.normalizeId(payload.roleId);
    const role = ACLLib.ensureRoleExists(this.roles.get(normalizedRoleId));
    const updatedParentRoleIds = payload.parentRoleIds
      ? [...new Set(payload.parentRoleIds.map((parentRoleId) => ACLLib.normalizeId(parentRoleId)))]
      : [...role.parentRoleIds];
    const updatedPermissionIds = payload.permissionIds
      ? [...new Set(payload.permissionIds.map((permissionId) => ACLLib.normalizeId(permissionId)))]
      : [...role.permissionIds];

    const updated: RoleDefinition = {
      ...role,
      label: payload.label || role.label,
      description: payload.description || role.description,
      parentRoleIds: updatedParentRoleIds,
      permissionIds: updatedPermissionIds,
      metadata: payload.metadata ? { ...payload.metadata } : { ...role.metadata },
      updatedAt: ACLLib.now()
    };

    updated.parentRoleIds.forEach((parentRoleId) => ACLLib.ensureRoleExists(this.roles.get(parentRoleId)));
    if (updated.parentRoleIds.includes(normalizedRoleId)) {
      throw new Error('ROLE_CANNOT_INHERIT_ITSELF');
    }

    const inheritedRoleIds = ACLLib.collectRoleLineage(normalizedRoleId, new Map(this.roles).set(normalizedRoleId, updated));
    const selfReferences = inheritedRoleIds.filter((roleId) => roleId === normalizedRoleId);
    if (selfReferences.length > 1) {
      throw new Error('ROLE_INHERITANCE_CYCLE');
    }

    this.roles.set(updated.id, updated);
    return {
      ...updated,
      parentRoleIds: [...updated.parentRoleIds],
      permissionIds: [...updated.permissionIds],
      metadata: { ...updated.metadata }
    };
  }

  public assignRole(subject: string, roleId: string, actor: string, reason?: string, expiresAt?: number): RoleAssignment {
    const normalizedRoleId = ACLLib.normalizeId(roleId);
    ACLLib.ensureRoleExists(this.roles.get(normalizedRoleId));

    const subjectAssignments = this.assignments.get(subject) || new Map<string, RoleAssignment>();
    const assignment: RoleAssignment = {
      subject,
      roleId: normalizedRoleId,
      assignedBy: actor,
      assignedAt: ACLLib.now(),
      ...(reason ? { reason } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {})
    };

    subjectAssignments.set(roleId, assignment);
    this.assignments.set(subject, subjectAssignments);
    return { ...assignment };
  }

  public revokeRole(subject: string, roleId: string): RoleAssignment | undefined {
    const normalizedRoleId = ACLLib.normalizeId(roleId);
    const subjectAssignments = this.assignments.get(subject);
    const existing = subjectAssignments?.get(normalizedRoleId);

    if (!subjectAssignments || !existing) {
      return undefined;
    }

    subjectAssignments.delete(normalizedRoleId);
    if (subjectAssignments.size === 0) {
      this.assignments.delete(subject);
    }

    return { ...existing };
  }

  public addPermissionToRole(roleId: string, permissionId: string): RoleDefinition {
    const normalizedRoleId = ACLLib.normalizeId(roleId);
    const normalizedPermissionId = ACLLib.normalizeId(permissionId);
    const role = ACLLib.ensureRoleExists(this.roles.get(normalizedRoleId));
    if (!role.permissionIds.includes(normalizedPermissionId)) {
      role.permissionIds.push(normalizedPermissionId);
      role.updatedAt = ACLLib.now();
    }

    this.roles.set(normalizedRoleId, role);
    return {
      ...role,
      parentRoleIds: [...role.parentRoleIds],
      permissionIds: [...role.permissionIds],
      metadata: { ...role.metadata }
    };
  }

  public removePermissionFromRole(roleId: string, permissionId: string): RoleDefinition {
    const normalizedRoleId = ACLLib.normalizeId(roleId);
    const normalizedPermissionId = ACLLib.normalizeId(permissionId);
    const role = ACLLib.ensureRoleExists(this.roles.get(normalizedRoleId));
    role.permissionIds = role.permissionIds.filter((currentPermissionId) => currentPermissionId !== normalizedPermissionId);
    role.updatedAt = ACLLib.now();
    this.roles.set(normalizedRoleId, role);
    return {
      ...role,
      parentRoleIds: [...role.parentRoleIds],
      permissionIds: [...role.permissionIds],
      metadata: { ...role.metadata }
    };
  }

  public getRole(roleId: string): RoleDefinition | undefined {
    const role = this.roles.get(ACLLib.normalizeId(roleId));
    if (!role) {
      return undefined;
    }

    return {
      ...role,
      parentRoleIds: [...role.parentRoleIds],
      permissionIds: [...role.permissionIds],
      metadata: { ...role.metadata }
    };
  }

  public getRoles(): RoleDefinition[] {
    return [...this.roles.values()].map((role) => ({
      ...role,
      parentRoleIds: [...role.parentRoleIds],
      permissionIds: [...role.permissionIds],
      metadata: { ...role.metadata }
    }));
  }

  public getAssignedRoles(subject: string): RoleAssignment[] {
    const now = ACLLib.now();
    const subjectAssignments = this.assignments.get(subject);
    if (!subjectAssignments) {
      return [];
    }

    return [...subjectAssignments.values()]
      .filter((assignment) => assignment.expiresAt === undefined || assignment.expiresAt > now)
      .map((assignment) => ({ ...assignment }));
  }

  public getEffectiveRoleIds(subject: string): string[] {
    const roles = new Set<string>();

    for (const assignment of this.getAssignedRoles(subject)) {
      ACLLib.collectRoleLineage(assignment.roleId, this.roles).forEach((roleId) => roles.add(roleId));
    }

    return [...roles];
  }

  public getInheritanceChain(roleId: string): string[] {
    const normalizedRoleId = ACLLib.normalizeId(roleId);
    ACLLib.ensureRoleExists(this.roles.get(normalizedRoleId));
    return ACLLib.collectRoleLineage(normalizedRoleId, this.roles);
  }

  public getRoleStore(): Map<string, RoleDefinition> {
    return this.roles;
  }
}
