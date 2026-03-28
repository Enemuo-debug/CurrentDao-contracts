# Access Control List

## Overview

`AccessControlList` is the platform-wide authorization layer for CurrentDao contracts. It combines role-based access control, per-function permissions, inheritance, emergency controls, governance-managed mutations, and audit logging in one module so the rest of the platform can depend on a single source of truth for access decisions.

## Architecture

### Core pieces

- `AccessControlList.ts`: main orchestration layer for access checks, governance execution, emergency handling, and audit logging.
- `RoleManager.ts`: role definitions, inheritance graph, and subject-to-role assignments.
- `PermissionManager.ts`: permission registry plus direct allow/deny overrides.
- `ACLGovernance.ts`: proposal, voting, and community-feedback workflow for dynamic ACL changes.
- `ACLLib.ts`: helpers for normalization, inheritance traversal, audit entry construction, and gas estimation.

### Access evaluation order

1. Check emergency global lockdown.
2. Check emergency function locks.
3. Resolve assigned roles plus inherited parent roles.
4. Merge role permissions and individual direct overrides.
5. Apply direct deny before allow.
6. Apply role-level deny before allow.
7. Return the access decision and record an audit log.

This priority keeps the system conservative under stress while still allowing targeted overrides when governance or operations need them.

## Roles and Permissions

### Predefined roles

The contract boots with 24 predefined roles, including:

- `SUPER_ADMIN`
- `DAO_EXECUTIVE`
- `DAO_GOVERNOR`
- `TREASURY_MANAGER`
- `TREASURY_OPERATOR`
- `COMPLIANCE_ADMIN`
- `COMPLIANCE_OFFICER`
- `RISK_MANAGER`
- `SECURITY_ADMIN`
- `SECURITY_ANALYST`
- `EMERGENCY_RESPONDER`
- `AUDITOR`
- `ORACLE_MANAGER`
- `ORACLE_OPERATOR`
- `REGISTRY_ADMIN`
- `LIQUIDITY_MANAGER`
- `LIQUIDITY_OPERATOR`
- `STAKING_MANAGER`
- `STAKING_OPERATOR`
- `FEE_MANAGER`
- `FEE_OPERATOR`
- `REPORTING_MANAGER`
- `SUPPORT_AGENT`
- `READ_ONLY_OBSERVER`

### Function-level permissions

Permissions are stored per contract and function. Example:

```ts
await acl.createPermission(
  {
    id: 'EXECUTE_TREASURY_WITHDRAW',
    contractId: 'TREASURY',
    functionName: 'withdraw',
    description: 'Withdraw treasury funds'
  },
  '0xadmin'
);
```

Roles can then receive that exact permission:

```ts
await acl.assignPermissionToRole(
  {
    roleId: 'TREASURY_OPERATOR',
    permissionId: 'EXECUTE_TREASURY_WITHDRAW'
  },
  '0xadmin'
);
```

## Governance

Dynamic roles and configuration changes are controlled through governance proposals.

### Supported proposal types

- `CREATE_ROLE`
- `UPDATE_ROLE`
- `GRANT_ROLE`
- `REVOKE_ROLE`
- `CREATE_PERMISSION`
- `ASSIGN_PERMISSION`
- `UPDATE_CONFIG`
- `EMERGENCY_ACTION`

### Community input

Each proposal supports:

- Governance-member voting
- Community feedback comments
- Quorum-sensitive evaluation before execution

This gives the community visibility into ACL mutations before they take effect.

## Emergency Controls

Emergency actors can:

- Enable a global lockdown
- Disable a global lockdown
- Lock a single function
- Unlock a single function
- Emergency grant a role
- Emergency revoke a role

These controls are immediate and are intended for operational response, with all actions written to the audit trail.

## Audit Trail

The ACL emits audit entries for:

- Access checks
- Role creation, assignment, and revocation
- Permission creation and assignment
- Direct allow/deny overrides
- Governance proposal creation, voting, and execution
- Emergency actions

Use `getAuditTrail()` to retrieve the full log or filter by actor/subject.

## Performance

Access checks use a lightweight estimator and are designed to remain under the configured `maxAccessCheckGas` threshold, defaulting to `30000`.

Use:

```ts
const snapshot = await acl.getPerformanceSnapshot();
```

to monitor average and peak access-check gas estimates.

## Deployment

Run:

```bash
ts-node scripts/deploy_acl.ts
```

The deploy script initializes governance members, emergency council members, predefined roles, and the built-in function permission catalog.
