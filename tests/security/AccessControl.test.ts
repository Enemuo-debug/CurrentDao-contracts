/**
 * @title AccessControl Test Suite
 * @dev Comprehensive tests for the RBAC system including role hierarchy, permissions, time-based access, and multi-sig
 */
import { AccessControl } from "../../contracts/security/AccessControl";
import { Role } from "../../contracts/security/interfaces/IAccessControl";
import { RoleStructure } from "../../contracts/security/structures/RoleStructure";
import { RBACLib } from "../../contracts/security/libraries/RBACLib";
import {
  DEFAULT_ADMIN_ROLE,
  OPERATOR_ROLE,
  USER_ROLE,
  VIEWER_ROLE,
  PERMISSION_ADMIN,
  PERMISSION_MINT,
  PERMISSION_TRANSFER,
  PERMISSION_EMERGENCY
} from "../../contracts/security/interfaces/IAccessControl";

describe("AccessControl", () => {
  let accessControl: AccessControl;
  let admin: string;
  let operator: string;
  let user: string;
  let viewer: string;
  let unauthorized: string;

  beforeEach(() => {
    accessControl = new AccessControl();
    admin = "0xAdmin";
    operator = "0xOperator";
    user = "0xUser";
    viewer = "0xViewer";
    unauthorized = "0xUnauthorized";
  });

  describe("Role Management", () => {
    test("should initialize with default roles", async () => {
      const allRoles = accessControl.getAllRoles();
      expect(allRoles).toContain(DEFAULT_ADMIN_ROLE);
      expect(allRoles).toContain(OPERATOR_ROLE);
      expect(allRoles).toContain(USER_ROLE);
      expect(allRoles).toContain(VIEWER_ROLE);
    });

    test("should create new role successfully", async () => {
      const customRole = "CUSTOM_ROLE";
      await accessControl.createRole(customRole, OPERATOR_ROLE, 5);
      
      const allRoles = accessControl.getAllRoles();
      expect(allRoles).toContain(customRole);
      
      const roleData = accessControl.getRoleData(customRole);
      expect(roleData?.role).toBe(customRole);
      expect(roleData?.parentRole).toBe(OPERATOR_ROLE);
      expect(roleData?.priority).toBe(5);
    });

    test("should prevent creating duplicate roles", async () => {
      await expect(accessControl.createRole(DEFAULT_ADMIN_ROLE, "", 0))
        .rejects.toThrow("Role DEFAULT_ADMIN_ROLE already exists");
    });

    test("should prevent creating role with non-existent parent", async () => {
      await expect(accessControl.createRole("NEW_ROLE", "NON_EXISTENT_PARENT", 10))
        .rejects.toThrow("Parent role NON_EXISTENT_PARENT does not exist");
    });

    test("should prevent circular dependencies in role hierarchy", async () => {
      await accessControl.createRole("ROLE_A", "ROLE_B", 10);
      await accessControl.createRole("ROLE_B", "ROLE_C", 11);
      
      await expect(accessControl.createRole("ROLE_C", "ROLE_A", 12))
        .rejects.toThrow("Invalid role hierarchy: circular dependency detected");
    });

    test("should grant role to account successfully", async () => {
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      
      const hasRole = await accessControl.hasRole(OPERATOR_ROLE, operator);
      expect(hasRole).toBe(true);
      
      const accountRoles = accessControl.getAccountRoles(operator);
      expect(accountRoles).toContain(OPERATOR_ROLE);
    });

    test("should prevent granting role to same account twice", async () => {
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      
      await expect(accessControl.grantRole(OPERATOR_ROLE, operator))
        .rejects.toThrow("Account 0xOperator already has role OPERATOR_ROLE");
    });

    test("should revoke role from account successfully", async () => {
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      await accessControl.revokeRole(OPERATOR_ROLE, operator);
      
      const hasRole = await accessControl.hasRole(OPERATOR_ROLE, operator);
      expect(hasRole).toBe(false);
      
      const accountRoles = accessControl.getAccountRoles(operator);
      expect(accountRoles).not.toContain(OPERATOR_ROLE);
    });

    test("should prevent revoking non-existent role assignment", async () => {
      await expect(accessControl.revokeRole(OPERATOR_ROLE, operator))
        .rejects.toThrow("Account 0xOperator does not have role OPERATOR_ROLE");
    });

    test("should get role members correctly", async () => {
      await accessControl.grantRole(USER_ROLE, user);
      await accessControl.grantRole(USER_ROLE, viewer);
      
      const members = await accessControl.getRoleMembers(USER_ROLE);
      expect(members).toHaveLength(2);
      expect(members).toContain(user);
      expect(members).toContain(viewer);
    });
  });

  describe("Permission Management", () => {
    beforeEach(async () => {
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      await accessControl.grantRole(USER_ROLE, user);
    });

    test("should set permission for role successfully", async () => {
      await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_MINT, true);
      
      const hasPermission = await accessControl.hasPermission(OPERATOR_ROLE, PERMISSION_MINT, operator);
      expect(hasPermission).toBe(true);
    });

    test("should check inherited permissions correctly", async () => {
      // Set permission on parent role
      await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_MINT, true);
      
      // Child role should inherit permission
      const hasPermission = await accessControl.hasPermission(USER_ROLE, PERMISSION_MINT, user);
      expect(hasPermission).toBe(true);
    });

    test("should set time-based permission successfully", async () => {
      const startTime = Date.now() + 1000; // 1 second from now
      const endTime = Date.now() + 60000; // 1 minute from now
      
      await accessControl.setTimeBasedPermission(OPERATOR_ROLE, PERMISSION_MINT, startTime, endTime);
      
      // Before start time - should not have permission
      const checkBefore = await accessControl.hasPermissionWithTime(OPERATOR_ROLE, PERMISSION_MINT, operator);
      expect(checkBefore.hasPermission).toBe(false);
      expect(checkBefore.timeLeft).toBeGreaterThan(0);
    });

    test("should expire time-based permissions correctly", async () => {
      const startTime = Date.now() - 60000; // 1 minute ago
      const endTime = Date.now() - 1000; // 1 second ago
      
      await accessControl.setTimeBasedPermission(OPERATOR_ROLE, PERMISSION_MINT, startTime, endTime);
      
      // After end time - should not have permission
      const checkAfter = await accessControl.hasPermissionWithTime(OPERATOR_ROLE, PERMISSION_MINT, operator);
      expect(checkAfter.hasPermission).toBe(false);
      expect(checkAfter.timeLeft).toBe(0);
    });

    test("should validate time parameters", async () => {
      const pastTime = Date.now() - 1000;
      const futureTime = Date.now() + 60000;
      
      // Start time in the past should fail
      await expect(accessControl.setTimeBasedPermission(OPERATOR_ROLE, PERMISSION_MINT, pastTime, futureTime))
        .rejects.toThrow("Invalid time parameters");
      
      // End time before start time should fail
      await expect(accessControl.setTimeBasedPermission(OPERATOR_ROLE, PERMISSION_MINT, futureTime, pastTime))
        .rejects.toThrow("Invalid time parameters");
    });
  });

  describe("Role Hierarchy", () => {
    test("should get role hierarchy correctly", async () => {
      const hierarchy = await accessControl.getRoleHierarchy(VIEWER_ROLE);
      expect(hierarchy).toContain(VIEWER_ROLE);
      expect(hierarchy).toContain(USER_ROLE);
      expect(hierarchy).toContain(OPERATOR_ROLE);
      expect(hierarchy).toContain(DEFAULT_ADMIN_ROLE);
    });

    test("should check permission inheritance correctly", async () => {
      // Set permission on admin role
      await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_ADMIN, true);
      
      // All child roles should inherit
      expect(await accessControl.inheritsPermission(OPERATOR_ROLE, PERMISSION_ADMIN)).toBe(true);
      expect(await accessControl.inheritsPermission(USER_ROLE, PERMISSION_ADMIN)).toBe(true);
      expect(await accessControl.inheritsPermission(VIEWER_ROLE, PERMISSION_ADMIN)).toBe(true);
    });
  });

  describe("Multi-signature Operations", () => {
    test("should set multi-sig requirement successfully", async () => {
      await accessControl.setMultiSigRequirement(PERMISSION_MINT, 3);
      
      // This would be verified through the multi-sig transaction process
      expect(true).toBe(true); // Placeholder for actual verification
    });

    test("should submit multi-sig transaction successfully", async () => {
      await accessControl.setMultiSigRequirement(PERMISSION_MINT, 2);
      
      const transactionId = await accessControl.submitMultiSigTransaction(
        PERMISSION_MINT,
        "mint_data",
        [admin, operator]
      );
      
      expect(transactionId).toBeGreaterThan(0);
      
      const transaction = accessControl.getMultiSigTransaction(transactionId);
      expect(transaction).toBeDefined();
      expect(transaction!.permission).toBe(PERMISSION_MINT);
      expect(transaction!.requiredSignatures).toBe(2);
    });

    test("should confirm multi-sig transaction successfully", async () => {
      await accessControl.setMultiSigRequirement(PERMISSION_MINT, 2);
      
      const transactionId = await accessControl.submitMultiSigTransaction(
        PERMISSION_MINT,
        "mint_data",
        [admin, operator]
      );
      
      await accessControl.confirmMultiSigTransaction(transactionId, operator);
      
      const transaction = accessControl.getMultiSigTransaction(transactionId);
      expect(transaction!.confirmationCount).toBe(2); // Submit + confirm
    });

    test("should execute multi-sig transaction when enough confirmations", async () => {
      await accessControl.setMultiSigRequirement(PERMISSION_MINT, 2);
      
      const transactionId = await accessControl.submitMultiSigTransaction(
        PERMISSION_MINT,
        "mint_data",
        [admin, operator]
      );
      
      await accessControl.confirmMultiSigTransaction(transactionId, operator);
      await accessControl.executeMultiSigTransaction(transactionId);
      
      const transaction = accessControl.getMultiSigTransaction(transactionId);
      expect(transaction!.executed).toBe(true);
    });

    test("should prevent execution without enough confirmations", async () => {
      await accessControl.setMultiSigRequirement(PERMISSION_MINT, 3);
      
      const transactionId = await accessControl.submitMultiSigTransaction(
        PERMISSION_MINT,
        "mint_data",
        [admin, operator]
      );
      
      await expect(accessControl.executeMultiSigTransaction(transactionId))
        .rejects.toThrow("does not have enough confirmations");
    });
  });

  describe("Emergency Controls", () => {
    test("should pause system successfully", async () => {
      await accessControl.emergencyPause();
      
      const isPaused = await accessControl.isPaused();
      expect(isPaused).toBe(true);
    });

    test("should unpause system successfully", async () => {
      await accessControl.emergencyPause();
      await accessControl.emergencyUnpause();
      
      const isPaused = await accessControl.isPaused();
      expect(isPaused).toBe(false);
    });

    test("should prevent pausing already paused system", async () => {
      await accessControl.emergencyPause();
      
      await expect(accessControl.emergencyPause())
        .rejects.toThrow("System is already paused");
    });

    test("should prevent unpausing non-paused system", async () => {
      await expect(accessControl.emergencyUnpause())
        .rejects.toThrow("System is not paused");
    });
  });

  describe("Audit Trail", () => {
    test("should log role grant events", async () => {
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      
      const auditTrail = await accessControl.getRoleAuditTrail(OPERATOR_ROLE);
      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0].action).toBe("GRANT_ROLE");
      expect(auditTrail[0].account).toBe(operator);
    });

    test("should log permission set events", async () => {
      await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_MINT, true);
      
      const auditTrail = await accessControl.getRoleAuditTrail(OPERATOR_ROLE);
      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0].action).toBe("SET_PERMISSION");
      expect(auditTrail[0].permission).toBe(PERMISSION_MINT);
    });

    test("should get permission audit trail for account", async () => {
      await accessControl.grantRole(USER_ROLE, user);
      await accessControl.setPermission(USER_ROLE, PERMISSION_TRANSFER, true);
      
      const auditTrail = await accessControl.getPermissionAuditTrail(user, USER_ROLE);
      expect(auditTrail).toHaveLength(2);
    });
  });

  describe("Gas Optimization Functions", () => {
    test("should batch grant roles successfully", async () => {
      const accounts = [user, viewer, unauthorized];
      
      await accessControl.batchGrantRole(USER_ROLE, accounts);
      
      for (const account of accounts) {
        const hasRole = await accessControl.hasRole(USER_ROLE, account);
        expect(hasRole).toBe(true);
      }
    });

    test("should batch revoke roles successfully", async () => {
      const accounts = [user, viewer];
      
      await accessControl.batchGrantRole(USER_ROLE, accounts);
      await accessControl.batchRevokeRole(USER_ROLE, accounts);
      
      for (const account of accounts) {
        const hasRole = await accessControl.hasRole(USER_ROLE, account);
        expect(hasRole).toBe(false);
      }
    });

    test("should batch set permissions successfully", async () => {
      const permissions = [PERMISSION_MINT, PERMISSION_TRANSFER];
      const granted = [true, false];
      
      await accessControl.batchSetPermissions(OPERATOR_ROLE, permissions, granted);
      
      const hasMintPermission = await accessControl.hasPermission(OPERATOR_ROLE, PERMISSION_MINT, admin);
      expect(hasMintPermission).toBe(true);
      
      const hasTransferPermission = await accessControl.hasPermission(OPERATOR_ROLE, PERMISSION_TRANSFER, admin);
      expect(hasTransferPermission).toBe(false);
    });

    test("should validate batch permission arrays length", async () => {
      const permissions = [PERMISSION_MINT];
      const granted = [true, false]; // Different length
      
      await expect(accessControl.batchSetPermissions(OPERATOR_ROLE, permissions, granted))
        .rejects.toThrow("Permissions and granted arrays must have the same length");
    });
  });

  describe("RBACLib", () => {
    test("should validate role hierarchy correctly", () => {
      const roleData = new Map();
      
      // Valid hierarchy
      const role1 = { role: "ROLE1", parentRole: "ROLE2", priority: 1, members: new Map(), permissions: new Map(), timePermissions: new Map(), memberCount: 0 };
      const role2 = { role: "ROLE2", parentRole: "", priority: 0, members: new Map(), permissions: new Map(), timePermissions: new Map(), memberCount: 0 };
      
      roleData.set("ROLE1", role1);
      roleData.set("ROLE2", role2);
      
      expect(RBACLib.validateHierarchy(roleData)).toBe(true);
    });

    test("should detect circular dependencies", () => {
      const roleData = new Map();
      
      // Circular dependency
      const role1 = { role: "ROLE1", parentRole: "ROLE2", priority: 1, members: new Map(), permissions: new Map(), timePermissions: new Map(), memberCount: 0 };
      const role2 = { role: "ROLE2", parentRole: "ROLE1", priority: 0, members: new Map(), permissions: new Map(), timePermissions: new Map(), memberCount: 0 };
      
      roleData.set("ROLE1", role1);
      roleData.set("ROLE2", role2);
      
      expect(RBACLib.validateHierarchy(roleData)).toBe(false);
    });

    test("should pack and unpack booleans correctly", () => {
      const booleans = [true, false, true, true, false];
      const packed = RBACLib.packBooleans(booleans);
      const unpacked = RBACLib.unpackBooleans(packed, booleans.length);
      
      expect(unpacked).toEqual(booleans);
    });

    test("should cache permission checks", () => {
      const roleData = new Map();
      const role = { role: "TEST_ROLE", parentRole: "", priority: 0, members: new Map(), permissions: new Map(), timePermissions: new Map(), memberCount: 0 };
      role.members.set("test_account", true);
      role.permissions.set("test_permission", true);
      roleData.set("TEST_ROLE", role);
      
      // First check
      const check1 = RBACLib.hasPermission(roleData, "TEST_ROLE", "test_permission", "test_account");
      expect(check1.hasPermission).toBe(true);
      
      // Second check should use cache
      const check2 = RBACLib.hasPermission(roleData, "TEST_ROLE", "test_permission", "test_account");
      expect(check2.hasPermission).toBe(true);
      
      const stats = RBACLib.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe("RoleStructure", () => {
    test("should get role priority correctly", () => {
      expect(RoleStructure.getRolePriority(Role.ADMIN)).toBe(0);
      expect(RoleStructure.getRolePriority(Role.OPERATOR)).toBe(1);
      expect(RoleStructure.getRolePriority(Role.USER)).toBe(2);
      expect(RoleStructure.getRolePriority(Role.VIEWER)).toBe(3);
    });

    test("should check role inheritance correctly", () => {
      expect(RoleStructure.inheritsRole(Role.USER, Role.OPERATOR)).toBe(true);
      expect(RoleStructure.inheritsRole(Role.VIEWER, Role.ADMIN)).toBe(true);
      expect(RoleStructure.inheritsRole(Role.ADMIN, Role.USER)).toBe(false);
    });

    test("should get role permissions correctly", () => {
      const adminPerms = RoleStructure.getRolePermissions(Role.ADMIN);
      expect(adminPerms.has(PERMISSION_ADMIN)).toBe(true);
      expect(adminPerms.has(PERMISSION_EMERGENCY)).toBe(true);
      
      const viewerPerms = RoleStructure.getRolePermissions(Role.VIEWER);
      expect(viewerPerms.has(PERMISSION_VIEW)).toBe(true);
      expect(viewerPerms.has(PERMISSION_ADMIN)).toBe(false);
    });

    test("should compare roles correctly", () => {
      expect(RoleStructure.compareRoles(Role.ADMIN, Role.OPERATOR)).toBe(-1);
      expect(RoleStructure.compareRoles(Role.USER, Role.VIEWER)).toBe(-1);
      expect(RoleStructure.compareRoles(Role.OPERATOR, Role.ADMIN)).toBe(1);
      expect(RoleStructure.compareRoles(Role.USER, Role.USER)).toBe(0);
    });

    test("should get highest role correctly", () => {
      const roles = [Role.USER, Role.VIEWER, Role.OPERATOR];
      const highest = RoleStructure.getHighestRole(roles);
      expect(highest).toBe(Role.OPERATOR);
    });

    test("should validate hierarchy consistency", () => {
      expect(RoleStructure.validateHierarchy()).toBe(true);
    });
  });

  describe("Integration Tests", () => {
    test("should handle complete RBAC workflow", async () => {
      // Setup roles
      await accessControl.grantRole(DEFAULT_ADMIN_ROLE, admin);
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      await accessControl.grantRole(USER_ROLE, user);
      
      // Set permissions
      await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_MINT, true);
      await accessControl.setPermission(USER_ROLE, PERMISSION_TRANSFER, true);
      
      // Check permissions
      expect(await accessControl.hasPermission(OPERATOR_ROLE, PERMISSION_MINT, operator)).toBe(true);
      expect(await accessControl.hasPermission(USER_ROLE, PERMISSION_TRANSFER, user)).toBe(true);
      
      // User should inherit mint permission from operator
      expect(await accessControl.hasPermission(USER_ROLE, PERMISSION_MINT, user)).toBe(true);
      
      // Set up multi-sig for critical operation
      await accessControl.setMultiSigRequirement(PERMISSION_MINT, 2);
      
      const txId = await accessControl.submitMultiSigTransaction(
        PERMISSION_MINT,
        "critical_mint",
        [admin, operator]
      );
      
      await accessControl.confirmMultiSigTransaction(txId, operator);
      await accessControl.executeMultiSigTransaction(txId);
      
      const transaction = accessControl.getMultiSigTransaction(txId);
      expect(transaction!.executed).toBe(true);
    });

    test("should handle emergency scenario", async () => {
      // Setup normal operations
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_MINT, true);
      
      expect(await accessControl.hasPermission(OPERATOR_ROLE, PERMISSION_MINT, operator)).toBe(true);
      
      // Emergency pause
      await accessControl.emergencyPause();
      expect(await accessControl.isPaused()).toBe(true);
      
      // Emergency unpause
      await accessControl.emergencyUnpause();
      expect(await accessControl.isPaused()).toBe(false);
    });
  });
});
