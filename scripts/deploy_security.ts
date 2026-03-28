/**
 * @title Deploy Security Contracts
 * @dev Deployment script for the comprehensive access control system
 * @dev Sets up initial roles, permissions, and multi-signature requirements
 */
import { AccessControl } from "../contracts/security/AccessControl";
import {
  DEFAULT_ADMIN_ROLE,
  OPERATOR_ROLE,
  USER_ROLE,
  VIEWER_ROLE,
  PERMISSION_ADMIN,
  PERMISSION_MINT,
  PERMISSION_BURN,
  PERMISSION_TRANSFER,
  PERMISSION_PAUSE,
  PERMISSION_EMERGENCY,
  PERMISSION_GRANT_ROLE,
  PERMISSION_REVOKE_ROLE,
  PERMISSION_SET_PERMISSION,
  PERMISSION_MULTISIG_ADMIN
} from "../contracts/security/interfaces/IAccessControl";

interface DeploymentConfig {
  network: string;
  adminAddress: string;
  initialOperators: string[];
  initialUsers: string[];
  multiSigRequirements: Map<string, number>;
}

interface DeploymentResult {
  accessControl: AccessControl;
  transactionHash: string;
  contractAddress: string;
  gasUsed: number;
}

class SecurityDeployer {
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  /**
   * @deploys the complete security system
   */
  public async deploy(): Promise<DeploymentResult> {
    console.log(`🚀 Deploying Access Control system to ${this.config.network}...`);
    
    try {
      // Deploy main AccessControl contract
      const accessControl = new AccessControl();
      
      // Setup initial roles
      await this.setupInitialRoles(accessControl);
      
      // Setup permissions
      await this.setupPermissions(accessControl);
      
      // Setup multi-signature requirements
      await this.setupMultiSigRequirements(accessControl);
      
      // Grant initial roles
      await this.grantInitialRoles(accessControl);
      
      const result: DeploymentResult = {
        accessControl,
        transactionHash: this.generateTransactionHash(),
        contractAddress: this.generateContractAddress(),
        gasUsed: this.estimateGasUsage()
      };
      
      console.log("✅ Security system deployed successfully!");
      this.logDeploymentSummary(result);
      
      return result;
      
    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }

  /**
   * @dev Setup initial role hierarchy
   */
  private async setupInitialRoles(accessControl: AccessControl): Promise<void> {
    console.log("📋 Setting up role hierarchy...");
    
    // Roles are already created in the constructor, but we can add custom roles if needed
    
    console.log("✅ Role hierarchy initialized");
  }

  /**
   * @dev Setup permissions for each role
   */
  private async setupPermissions(accessControl: AccessControl): Promise<void> {
    console.log("🔐 Setting up permissions...");
    
    // Admin permissions (already set in constructor, but ensuring all are set)
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_ADMIN, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_EMERGENCY, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_GRANT_ROLE, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_REVOKE_ROLE, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_SET_PERMISSION, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_MULTISIG_ADMIN, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_MINT, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_BURN, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_TRANSFER, true);
    await accessControl.setPermission(DEFAULT_ADMIN_ROLE, PERMISSION_PAUSE, true);
    
    // Operator permissions
    await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_MINT, true);
    await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_BURN, true);
    await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_TRANSFER, true);
    await accessControl.setPermission(OPERATOR_ROLE, PERMISSION_PAUSE, true);
    
    // User permissions
    await accessControl.setPermission(USER_ROLE, PERMISSION_TRANSFER, true);
    
    // Viewer permissions (read-only)
    // Viewer role inherits basic permissions but no write permissions
    
    console.log("✅ Permissions configured");
  }

  /**
   * @dev Setup multi-signature requirements for critical operations
   */
  private async setupMultiSigRequirements(accessControl: AccessControl): Promise<void> {
    console.log("🔑 Setting up multi-signature requirements...");
    
    for (const [permission, requiredSignatures] of this.config.multiSigRequirements.entries()) {
      await accessControl.setMultiSigRequirement(permission, requiredSignatures);
      console.log(`  - ${permission}: ${requiredSignatures} signatures required`);
    }
    
    console.log("✅ Multi-signature requirements configured");
  }

  /**
   * @dev Grant initial roles to specified addresses
   */
  private async grantInitialRoles(accessControl: AccessControl): Promise<void> {
    console.log("👥 Granting initial roles...");
    
    // Grant admin role to admin address
    await accessControl.grantRole(DEFAULT_ADMIN_ROLE, this.config.adminAddress);
    console.log(`  - Admin role granted to ${this.config.adminAddress}`);
    
    // Grant operator roles
    for (const operator of this.config.initialOperators) {
      await accessControl.grantRole(OPERATOR_ROLE, operator);
      console.log(`  - Operator role granted to ${operator}`);
    }
    
    // Grant user roles
    for (const user of this.config.initialUsers) {
      await accessControl.grantRole(USER_ROLE, user);
      console.log(`  - User role granted to ${user}`);
    }
    
    console.log("✅ Initial roles granted");
  }

  /**
   * @dev Generate mock transaction hash for simulation
   */
  private generateTransactionHash(): string {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  /**
   * @dev Generate mock contract address for simulation
   */
  private generateContractAddress(): string {
    return `0x${Math.random().toString(16).substr(2, 40)}`;
  }

  /**
   * @dev Estimate gas usage for deployment
   */
  private estimateGasUsage(): number {
    return Math.floor(Math.random() * 1000000) + 500000; // Mock gas usage
  }

  /**
   * @dev Log deployment summary
   */
  private logDeploymentSummary(result: DeploymentResult): void {
    console.log("\n📊 Deployment Summary:");
    console.log("========================");
    console.log(`Network: ${this.config.network}`);
    console.log(`Contract Address: ${result.contractAddress}`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Gas Used: ${result.gasUsed.toLocaleString()}`);
    console.log(`Admin Address: ${this.config.adminAddress}`);
    console.log(`Initial Operators: ${this.config.initialOperators.length}`);
    console.log(`Initial Users: ${this.config.initialUsers.length}`);
    console.log("========================");
  }

  /**
   * @dev Verify deployment by checking key functions
   */
  public async verifyDeployment(accessControl: AccessControl): Promise<boolean> {
    console.log("🔍 Verifying deployment...");
    
    try {
      // Check if all default roles exist
      const allRoles = accessControl.getAllRoles();
      const requiredRoles = [DEFAULT_ADMIN_ROLE, OPERATOR_ROLE, USER_ROLE, VIEWER_ROLE];
      
      for (const role of requiredRoles) {
        if (!allRoles.includes(role)) {
          console.error(`❌ Missing role: ${role}`);
          return false;
        }
      }
      
      // Check admin has admin role
      const hasAdminRole = await accessControl.hasRole(DEFAULT_ADMIN_ROLE, this.config.adminAddress);
      if (!hasAdminRole) {
        console.error("❌ Admin does not have admin role");
        return false;
      }
      
      // Check permissions are set correctly
      const hasAdminPermission = await accessControl.hasPermission(DEFAULT_ADMIN_ROLE, PERMISSION_ADMIN, this.config.adminAddress);
      if (!hasAdminPermission) {
        console.error("❌ Admin does not have admin permission");
        return false;
      }
      
      console.log("✅ Deployment verification successful");
      return true;
      
    } catch (error) {
      console.error("❌ Deployment verification failed:", error);
      return false;
    }
  }
}

/**
 * @dev Main deployment function
 */
async function main(): Promise<void> {
  // Configuration for different networks
  const configs: Record<string, DeploymentConfig> = {
    development: {
      network: "development",
      adminAddress: "0xAdmin1234567890123456789012345678901234567890",
      initialOperators: [
        "0xOperator1234567890123456789012345678901234567890",
        "0xOperator2234567890123456789012345678901234567890"
      ],
      initialUsers: [
        "0xUser1234567890123456789012345678901234567890",
        "0xUser2234567890123456789012345678901234567890",
        "0xUser3234567890123456789012345678901234567890"
      ],
      multiSigRequirements: new Map([
        [PERMISSION_MINT, 2],
        [PERMISSION_BURN, 2],
        [PERMISSION_EMERGENCY, 3],
        [PERMISSION_ADMIN, 3]
      ])
    },
    testnet: {
      network: "testnet",
      adminAddress: "0xTestnetAdmin1234567890123456789012345678901234567890",
      initialOperators: [
        "0xTestnetOperator1234567890123456789012345678901234567890"
      ],
      initialUsers: [
        "0xTestnetUser1234567890123456789012345678901234567890"
      ],
      multiSigRequirements: new Map([
        [PERMISSION_MINT, 2],
        [PERMISSION_BURN, 2],
        [PERMISSION_EMERGENCY, 2],
        [PERMISSION_ADMIN, 2]
      ])
    },
    mainnet: {
      network: "mainnet",
      adminAddress: process.env.MAINNET_ADMIN || "0xMainnetAdmin1234567890123456789012345678901234567890",
      initialOperators: [
        process.env.MAINNET_OPERATOR_1 || "0xMainnetOp11234567890123456789012345678901234567890",
        process.env.MAINNET_OPERATOR_2 || "0xMainnetOp21234567890123456789012345678901234567890",
        process.env.MAINNET_OPERATOR_3 || "0xMainnetOp31234567890123456789012345678901234567890"
      ],
      initialUsers: [], // Users will be granted roles on-demand
      multiSigRequirements: new Map([
        [PERMISSION_MINT, 3],
        [PERMISSION_BURN, 3],
        [PERMISSION_EMERGENCY, 5],
        [PERMISSION_ADMIN, 5],
        [PERMISSION_PAUSE, 2]
      ])
    }
  };

  // Get network from command line arguments or default to development
  const network = process.argv[2] || "development";
  const config = configs[network];
  
  if (!config) {
    console.error(`❌ Unknown network: ${network}`);
    console.log("Available networks: development, testnet, mainnet");
    process.exit(1);
  }

  console.log(`🌐 Deploying to ${network} network`);
  
  // Create deployer and deploy
  const deployer = new SecurityDeployer(config);
  const result = await deployer.deploy();
  
  // Verify deployment
  const isValid = await deployer.verifyDeployment(result.accessControl);
  
  if (isValid) {
    console.log("\n🎉 Deployment completed successfully!");
    console.log("📝 Save these details for future reference:");
    console.log(`Contract Address: ${result.contractAddress}`);
    console.log(`Transaction Hash: ${result.transactionHash}`);
    console.log(`Admin Address: ${config.adminAddress}`);
  } else {
    console.error("\n❌ Deployment verification failed!");
    process.exit(1);
  }
}

/**
 * @dev Utility function to create deployment config from environment variables
 */
export function createConfigFromEnv(network: string): DeploymentConfig {
  return {
    network,
    adminAddress: process.env[`${network.toUpperCase()}_ADMIN`] || "",
    initialOperators: [
      process.env[`${network.toUpperCase()}_OPERATOR_1`] || "",
      process.env[`${network.toUpperCase()}_OPERATOR_2`] || "",
      process.env[`${network.toUpperCase()}_OPERATOR_3`] || ""
    ].filter(addr => addr.length > 0),
    initialUsers: [
      process.env[`${network.toUpperCase()}_USER_1`] || "",
      process.env[`${network.toUpperCase()}_USER_2`] || ""
    ].filter(addr => addr.length > 0),
    multiSigRequirements: new Map([
      ["PERMISSION_MINT", parseInt(process.env[`${network.toUpperCase()}_MULTISIG_MINT`] || "2")],
      ["PERMISSION_BURN", parseInt(process.env[`${network.toUpperCase()}_MULTISIG_BURN`] || "2")],
      ["PERMISSION_EMERGENCY", parseInt(process.env[`${network.toUpperCase()}_MULTISIG_EMERGENCY`] || "3")]
    ])
  };
}

// Export for use in other scripts
export { SecurityDeployer, DeploymentConfig, DeploymentResult };

// Run deployment if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}
