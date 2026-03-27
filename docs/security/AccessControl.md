# Access Control System Documentation

## Overview

The CurrentDAO Access Control system is a comprehensive Role-Based Access Control (RBAC) implementation that provides hierarchical permissions, time-based access control, multi-signature requirements, and emergency controls. This system ensures secure and flexible management of permissions across all platform contracts.

## Architecture

### Core Components

1. **IAccessControl Interface** - Defines the complete API for the access control system
2. **AccessControl Contract** - Main implementation of the RBAC system
3. **RoleStructure** - Manages hierarchical role definitions and inheritance
4. **RBACLib** - Gas-optimized library for permission checking logic
5. **Multi-Signature System** - Handles critical operations requiring multiple approvals

### Key Features

- **Hierarchical Roles**: Role inheritance allows automatic permission propagation
- **Time-Based Permissions**: Temporary access with automatic expiration
- **Multi-Signature Requirements**: Critical operations need multiple approvals
- **Emergency Controls**: System-wide pause functionality for security incidents
- **Audit Trail**: Complete logging of all permission changes
- **Gas Optimization**: Efficient permission checking with caching
- **Dynamic Role Management**: Runtime role and permission updates

## Role Hierarchy

### Default Roles

```
ADMIN (Priority: 0)
├── OPERATOR (Priority: 1)
│   ├── USER (Priority: 2)
│   │   └── VIEWER (Priority: 3)
```

### Role Definitions

#### ADMIN
- **Priority**: 0 (Highest)
- **Permissions**: All permissions including system administration
- **Capabilities**: 
  - Create/modify roles and permissions
  - Emergency controls
  - Multi-signature administration
  - Full system access

#### OPERATOR
- **Priority**: 1
- **Permissions**: Operational permissions
- **Capabilities**:
  - Mint and burn tokens
  - Transfer operations
  - Pause system functions
  - Manage user roles

#### USER
- **Priority**: 2
- **Permissions**: Basic user permissions
- **Capabilities**:
  - Transfer own tokens
  - View own data
  - Basic platform interactions

#### VIEWER
- **Priority**: 3 (Lowest)
- **Permissions**: Read-only access
- **Capabilities**:
  - View public data
  - Read platform information

## Permission System

### Permission Types

#### Core Permissions
- `PERMISSION_ADMIN` - Administrative operations
- `PERMISSION_MINT` - Token minting
- `PERMISSION_BURN` - Token burning
- `PERMISSION_TRANSFER` - Token transfers
- `PERMISSION_PAUSE` - System pause operations
- `PERMISSION_EMERGENCY` - Emergency controls

#### Role Management Permissions
- `PERMISSION_GRANT_ROLE` - Grant roles to accounts
- `PERMISSION_REVOKE_ROLE` - Revoke roles from accounts
- `PERMISSION_SET_PERMISSION` - Modify role permissions
- `PERMISSION_MULTISIG_ADMIN` - Configure multi-signature requirements

#### Data Access Permissions
- `PERMISSION_VIEW` - Read access to data
- `PERMISSION_VIEW_OWN_DATA` - Access to own data only

### Permission Inheritance

Permissions automatically flow down the hierarchy:
- Child roles inherit all permissions from parent roles
- Inheritance is transitive (VIEWER inherits from USER, OPERATOR, and ADMIN)
- Permissions can be explicitly denied on child roles if needed

## Time-Based Permissions

### Features
- **Temporary Access**: Grant permissions for specific time periods
- **Automatic Expiration**: Permissions expire without manual intervention
- **Time Validation**: Prevents invalid time ranges
- **Graceful Degradation**: Falls back to permanent permissions if time-based expire

### Implementation
```typescript
// Grant time-based permission
await accessControl.setTimeBasedPermission(
  "OPERATOR_ROLE",
  "PERMISSION_MINT",
  startTime: Date.now() + 1000,  // Starts in 1 second
  endTime: Date.now() + 3600000    // Expires in 1 hour
);

// Check permission with time remaining
const check = await accessControl.hasPermissionWithTime(
  "OPERATOR_ROLE", 
  "PERMISSION_MINT", 
  "0xOperator"
);
// Returns: { hasPermission: true, timeLeft: 1800000 }
```

## Multi-Signature System

### Purpose
Critical operations require multiple authorized parties to approve, preventing single points of failure and malicious actions.

### Configurable Operations
- Token minting and burning
- Emergency controls
- Administrative changes
- System pauses

### Process Flow
1. **Submission**: Authorized user submits transaction with required signers
2. **Confirmation**: Each signer independently confirms the transaction
3. **Execution**: Once threshold is reached, anyone can execute the transaction
4. **Audit**: All multi-sig operations are logged

### Example
```typescript
// Set requirement: 3 signatures for minting
await accessControl.setMultiSigRequirement("PERMISSION_MINT", 3);

// Submit multi-sig transaction
const txId = await accessControl.submitMultiSigTransaction(
  "PERMISSION_MINT",
  "mint_data",
  ["admin1", "admin2", "admin3", "admin4"]
);

// Confirmations
await accessControl.confirmMultiSigTransaction(txId, "admin1");
await accessControl.confirmMultiSigTransaction(txId, "admin2");
await accessControl.confirmMultiSigTransaction(txId, "admin3");

// Execute (threshold met)
await accessControl.executeMultiSigTransaction(txId);
```

## Emergency Controls

### Emergency Pause
- **Immediate Effect**: Halts all critical operations
- **Selective Impact**: Read operations and emergency unpause remain available
- **Audit Trail**: Emergency actions are fully logged
- **Recovery**: Only authorized accounts can unpause

### Implementation
```typescript
// Activate emergency pause
await accessControl.emergencyPause();

// Check if paused
const isPaused = await accessControl.isPaused();

// Deactivate emergency pause
await accessControl.emergencyUnpause();
```

## Audit Trail

### Logged Events
- Role grants and revocations
- Permission changes
- Multi-signature operations
- Emergency controls
- Time-based permission modifications

### Audit Structure
```typescript
interface AuditEntry {
  account: string;      // Account affected
  role: string;         // Role involved
  permission: string;    // Permission modified
  granted: boolean;      // Permission status
  timestamp: number;     // When the action occurred
  actor: string;        // Who performed the action
  action: string;        // Action type
}
```

### Querying Audit Trail
```typescript
// Get all audit entries for a role
const roleAudit = await accessControl.getRoleAuditTrail("OPERATOR_ROLE");

// Get permission audit for specific account
const permissionAudit = await accessControl.getPermissionAuditTrail(
  "0xOperator", 
  "OPERATOR_ROLE"
);
```

## Gas Optimization

### Caching System
- **Permission Cache**: Stores recent permission checks for 30 seconds
- **Batch Operations**: Reduced transaction costs for multiple operations
- **Packed Booleans**: Efficient storage of multiple boolean values

### Batch Functions
```typescript
// Grant multiple roles at once
await accessControl.batchGrantRole("USER_ROLE", [
  "0xUser1", "0xUser2", "0xUser3"
]);

// Set multiple permissions at once
await accessControl.batchSetPermissions("OPERATOR_ROLE", [
  "PERMISSION_MINT", "PERMISSION_BURN"
], [true, true]);
```

### Boolean Packing
```typescript
// Pack 32 booleans into a single integer
const packed = RBACLib.packBooleans([
  true, false, true, true, false, // ... up to 32 values
]);

// Unpack back to boolean array
const unpacked = RBACLib.unpackBooleans(packed, 5);
```

## Security Considerations

### Threat Mitigation
1. **Circular Dependencies**: Automatic detection prevents infinite loops in role hierarchy
2. **Privilege Escalation**: Strict validation prevents unauthorized role grants
3. **Time-Based Attacks**: Validation prevents invalid time ranges
4. **Multi-Sig Collusion**: Threshold requirements prevent single-party control
5. **Emergency Abuse**: Audit trail and authorization requirements

### Best Practices
1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Regular Audits**: Review audit trail for suspicious activities
3. **Multi-Sig Thresholds**: Set appropriate thresholds based on risk
4. **Time-Based Access**: Use temporary permissions for short-term needs
5. **Emergency Planning**: Test emergency procedures regularly

## Integration Guide

### Contract Integration
```typescript
import { AccessControl } from "./security/AccessControl";

class MyContract {
  private accessControl: AccessControl;
  
  constructor(accessControlAddress: string) {
    this.accessControl = new AccessControl();
  }
  
  async mintTokens(to: string, amount: number) {
    // Check permission
    const hasPermission = await this.accessControl.hasPermission(
      "OPERATOR_ROLE",
      "PERMISSION_MINT",
      msg.sender
    );
    
    if (!hasPermission) {
      throw new Error("Unauthorized: MINT permission required");
    }
    
    // Proceed with minting
    // ...
  }
}
```

### Frontend Integration
```typescript
// Check user permissions before showing UI elements
const userAddress = await getUserAddress();
const userRoles = await accessControl.getAccountRoles(userAddress);

const canMint = await accessControl.hasPermission(
  "OPERATOR_ROLE",
  "PERMISSION_MINT",
  userAddress
);

if (canMint) {
  showMintButton();
}
```

## Deployment

### Environment Configuration
```bash
# Development
npm run deploy:security -- development

# Testnet
npm run deploy:security -- testnet

# Mainnet
npm run deploy:security -- mainnet
```

### Environment Variables
```bash
# Mainnet configuration
MAINNET_ADMIN=0x...
MAINNET_OPERATOR_1=0x...
MAINNET_OPERATOR_2=0x...
MAINNET_OPERATOR_3=0x...
MAINNET_MULTISIG_MINT=3
MAINNET_MULTISIG_EMERGENCY=5
```

## Testing

### Test Coverage
- **Unit Tests**: Individual component testing (>90% coverage)
- **Integration Tests**: End-to-end workflow testing
- **Security Tests**: Vulnerability scanning and penetration testing
- **Gas Tests**: Optimization validation
- **Performance Tests**: Load and stress testing

### Running Tests
```bash
# Run all tests
npm test

# Run security tests only
npm run test:security

# Run with coverage
npm run test:coverage
```

## API Reference

### Core Methods

#### Role Management
- `createRole(role, parentRole, priority)` - Create new role
- `grantRole(role, account)` - Grant role to account
- `revokeRole(role, account)` - Revoke role from account
- `hasRole(role, account)` - Check if account has role
- `getRoleMembers(role)` - Get all members of a role

#### Permission Management
- `setPermission(role, permission, granted)` - Set permission for role
- `setTimeBasedPermission(role, permission, startTime, endTime)` - Set temporary permission
- `hasPermission(role, permission, account)` - Check permission
- `hasPermissionWithTime(role, permission, account)` - Check with time remaining

#### Multi-Signature
- `setMultiSigRequirement(permission, requiredSignatures)` - Set signature requirement
- `submitMultiSigTransaction(permission, data, signers)` - Submit transaction
- `confirmMultiSigTransaction(transactionId, signer)` - Confirm transaction
- `executeMultiSigTransaction(transactionId)` - Execute confirmed transaction

#### Emergency Controls
- `emergencyPause()` - Pause system operations
- `emergencyUnpause()` - Resume system operations
- `isPaused()` - Check pause status

#### Audit Functions
- `getPermissionAuditTrail(account, role)` - Get permission audit log
- `getRoleAuditTrail(role)` - Get role audit log

#### Batch Operations
- `batchGrantRole(role, accounts)` - Grant role to multiple accounts
- `batchRevokeRole(role, accounts)` - Revoke role from multiple accounts
- `batchSetPermissions(role, permissions, granted)` - Set multiple permissions

## Troubleshooting

### Common Issues

#### Permission Denied
- Check if user has the required role
- Verify role has the necessary permission
- Ensure time-based permissions haven't expired
- Check if system is in emergency pause mode

#### Circular Dependency Error
- Review role hierarchy structure
- Ensure no role eventually inherits from itself
- Use `validateHierarchy()` to check structure

#### Multi-Sig Issues
- Verify all required signers have confirmed
- Check if transaction was already executed
- Ensure signers are authorized for the permission

#### Performance Issues
- Clear permission cache if stale
- Use batch operations for multiple changes
- Review gas optimization settings

### Debug Tools
```typescript
// Check cache statistics
const cacheStats = accessControl.getCacheStats();

// Validate role hierarchy
const isValid = RBACLib.validateHierarchy(roleData);

// Get complete role hierarchy
const hierarchy = await accessControl.getRoleHierarchy("USER_ROLE");

// Check inherited permissions
const inherits = await accessControl.inheritsPermission("USER_ROLE", "PERMISSION_MINT");
```

## Version History

### v1.0.0
- Initial implementation
- Core RBAC functionality
- Multi-signature system
- Emergency controls
- Audit trail
- Gas optimization

### Future Enhancements
- Dynamic role creation with voting
- Permission templates
- Advanced time-based scheduling
- Cross-chain access control
- Zero-knowledge proof integration

## Support

For questions, issues, or contributions:
- GitHub Issues: [Repository Issues]
- Documentation: [Full Documentation]
- Security: [Security Reporting Process]

---

**Security Note**: This system handles critical security functions. Always test thoroughly in development environments before mainnet deployment. Regular security audits are recommended.
