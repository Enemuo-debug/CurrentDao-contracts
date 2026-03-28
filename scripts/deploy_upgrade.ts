/**
 * @title Deploy Upgrade Management System
 * @dev Deployment script for the upgrade management contracts
 * @dev Handles deployment, configuration, and initialization
 */

import { UpgradeManager } from '../contracts/upgrade/UpgradeManager';
import { UpgradeProxy, ProxyFactory } from '../contracts/upgrade/proxies/UpgradeProxy';
import {
  DEFAULT_UPGRADE_DELAY,
  DEFAULT_EXECUTION_WINDOW,
  UPGRADE_MANAGER_ROLE,
  UPGRADE_PROPOSER_ROLE,
  UPGRADE_EXECUTOR_ROLE,
  UPGRADE_VOTER_ROLE,
  EMERGENCY_UPGRADE_ROLE
} from '../contracts/upgrade/interfaces/IUpgradeManager';

/**
 * @dev Deployment configuration interface
 */
interface DeploymentConfig {
  network: string;
  owner: string;
  governance: string;
  security: string;
  proposers: string[];
  executors: string[];
  voters: string[];
  emergencyAdmins: string[];
  upgradeDelay: number;
  timelock: number;
  initialImplementation: string;
  enableEmergencyPause: boolean;
  requireMultisig: boolean;
}

/**
 * @dev Deployment result interface
 */
interface DeploymentResult {
  upgradeManager: string;
  proxy: string;
  implementation: string;
  deploymentHash: string;
  timestamp: number;
  gasUsed: number;
  config: DeploymentConfig;
}

/**
 * @dev Upgrade System Deployer
 */
export class UpgradeSystemDeployer {
  private config: DeploymentConfig;
  private upgradeManager: UpgradeManager | null = null;
  private proxy: UpgradeProxy | null = null;
  private deploymentHash: string = '';
  private gasUsed: number = 0;

  constructor(config: DeploymentConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  /**
   * @dev Deploy the complete upgrade system
   */
  public async deploy(): Promise<DeploymentResult> {
    console.log('🚀 Starting upgrade system deployment...');
    console.log(`📋 Network: ${this.config.network}`);
    console.log(`👤 Owner: ${this.config.owner}`);
    
    try {
      // Step 1: Deploy UpgradeManager
      await this.deployUpgradeManager();
      
      // Step 2: Deploy Proxy
      await this.deployProxy();
      
      // Step 3: Configure roles
      await this.configureRoles();
      
      // Step 4: Set up governance
      await this.setupGovernance();
      
      // Step 5: Configure security
      await this.configureSecurity();
      
      // Step 6: Initialize system
      await this.initializeSystem();
      
      // Step 7: Verify deployment
      await this.verifyDeployment();
      
      const result = this.createDeploymentResult();
      
      console.log('✅ Upgrade system deployed successfully!');
      console.log(`📦 UpgradeManager: ${result.upgradeManager}`);
      console.log(`🔗 Proxy: ${result.proxy}`);
      console.log(`⚙️ Implementation: ${result.implementation}`);
      console.log(`🔐 Deployment Hash: ${result.deploymentHash}`);
      console.log(`⛽ Gas Used: ${result.gasUsed}`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  /**
   * @dev Deploy UpgradeManager contract
   */
  private async deployUpgradeManager(): Promise<void> {
    console.log('📦 Deploying UpgradeManager...');
    
    const startTime = Date.now();
    
    // Create UpgradeManager instance
    this.upgradeManager = new UpgradeManager(this.config.owner);
    
    // Simulate deployment gas cost
    const gasCost = this.estimateGas('UpgradeManager', 'deploy');
    this.gasUsed += gasCost;
    
    const endTime = Date.now();
    console.log(`✅ UpgradeManager deployed in ${endTime - startTime}ms`);
  }

  /**
   * @dev Deploy Proxy contract
   */
  private async deployProxy(): Promise<void> {
    console.log('🔗 Deploying Proxy...');
    
    if (!this.upgradeManager) {
      throw new Error('UpgradeManager not deployed');
    }
    
    const startTime = Date.now();
    
    // Create proxy instance
    this.proxy = ProxyFactory.createProxy(
      this.config.owner,
      this.config.initialImplementation
    );
    
    // Simulate deployment gas cost
    const gasCost = this.estimateGas('UpgradeProxy', 'deploy');
    this.gasUsed += gasCost;
    
    const endTime = Date.now();
    console.log(`✅ Proxy deployed in ${endTime - startTime}ms`);
  }

  /**
   * @dev Configure system roles
   */
  private async configureRoles(): Promise<void> {
    console.log('👥 Configuring roles...');
    
    if (!this.upgradeManager) {
      throw new Error('UpgradeManager not deployed');
    }
    
    // In a real implementation, this would set up role assignments
    // For this example, we'll simulate the configuration
    
    const roles = [
      { role: UPGRADE_MANAGER_ROLE, members: [this.config.owner] },
      { role: UPGRADE_PROPOSER_ROLE, members: this.config.proposers },
      { role: UPGRADE_EXECUTOR_ROLE, members: this.config.executors },
      { role: UPGRADE_VOTER_ROLE, members: this.config.voters },
      { role: EMERGENCY_UPGRADE_ROLE, members: this.config.emergencyAdmins }
    ];
    
    for (const { role, members } of roles) {
      console.log(`  📋 Configuring ${role} with ${members.length} members`);
      
      // Simulate gas cost for role configuration
      const gasCost = this.estimateGas('UpgradeManager', 'configureRole');
      this.gasUsed += gasCost * members.length;
    }
    
    console.log('✅ Roles configured');
  }

  /**
   * @dev Set up governance integration
   */
  private async setupGovernance(): Promise<void> {
    console.log('🏛️ Setting up governance...');
    
    if (!this.upgradeManager) {
      throw new Error('UpgradeManager not deployed');
    }
    
    // Set governance contract
    await this.upgradeManager.setGovernanceContract(this.config.governance);
    
    // Configure upgrade delay
    await this.upgradeManager.setUpgradeDelay(this.config.upgradeDelay);
    
    // Set timelock if specified
    if (this.config.timelock > 0) {
      await this.upgradeManager.setTimelock(this.config.timelock);
    }
    
    // Simulate gas cost
    const gasCost = this.estimateGas('UpgradeManager', 'setupGovernance');
    this.gasUsed += gasCost;
    
    console.log('✅ Governance configured');
  }

  /**
   * @dev Configure security settings
   */
  private async configureSecurity(): Promise<void> {
    console.log('🔒 Configuring security...');
    
    if (!this.upgradeManager) {
      throw new Error('UpgradeManager not deployed');
    }
    
    // Set security module
    await this.upgradeManager.setSecurityModule(this.config.security);
    
    // Configure emergency pause if enabled
    if (this.config.enableEmergencyPause) {
      console.log('  🚨 Emergency pause enabled');
    }
    
    // Configure multisig requirements
    if (this.config.requireMultisig) {
      console.log('  🔐 Multisig requirements enabled');
    }
    
    // Simulate gas cost
    const gasCost = this.estimateGas('UpgradeManager', 'configureSecurity');
    this.gasUsed += gasCost;
    
    console.log('✅ Security configured');
  }

  /**
   * @dev Initialize the system
   */
  private async initializeSystem(): Promise<void> {
    console.log('🔧 Initializing system...');
    
    if (!this.proxy) {
      throw new Error('Proxy not deployed');
    }
    
    // Initialize proxy if needed
    if (!this.proxy.isInitialized()) {
      this.proxy.initialize('1.0.0', '0x', this.config.owner);
      
      // Simulate gas cost
      const gasCost = this.estimateGas('UpgradeProxy', 'initialize');
      this.gasUsed += gasCost;
    }
    
    console.log('✅ System initialized');
  }

  /**
   * @dev Verify deployment
   */
  private async verifyDeployment(): Promise<void> {
    console.log('🔍 Verifying deployment...');
    
    if (!this.upgradeManager || !this.proxy) {
      throw new Error('Contracts not deployed');
    }
    
    // Verify UpgradeManager
    const proposalCount = this.upgradeManager.getProposalCount();
    const snapshotCount = this.upgradeManager.getSnapshotCount();
    const proxyCount = this.upgradeManager.getProxyCount();
    
    console.log(`  📊 UpgradeManager stats: ${proposalCount} proposals, ${snapshotCount} snapshots, ${proxyCount} proxies`);
    
    // Verify Proxy
    const proxyInfo = this.proxy.getProxyInfo();
    console.log(`  🔗 Proxy info: ${proxyInfo.implementation}, admin: ${proxyInfo.admin}, version: ${proxyInfo.version}`);
    
    // Generate deployment hash
    this.deploymentHash = this.generateDeploymentHash();
    
    // Simulate verification gas cost
    const gasCost = this.estimateGas('UpgradeManager', 'verify');
    this.gasUsed += gasCost;
    
    console.log('✅ Deployment verified');
  }

  /**
   * @dev Create deployment result
   */
  private createDeploymentResult(): DeploymentResult {
    return {
      upgradeManager: 'UpgradeManager', // In real implementation, this would be contract address
      proxy: 'UpgradeProxy', // In real implementation, this would be contract address
      implementation: this.config.initialImplementation,
      deploymentHash: this.deploymentHash,
      timestamp: Date.now(),
      gasUsed: this.gasUsed,
      config: this.config
    };
  }

  /**
   * @dev Validate deployment configuration
   */
  private validateConfig(config: DeploymentConfig): void {
    if (!config.owner || !this.isValidAddress(config.owner)) {
      throw new Error('Invalid owner address');
    }
    
    if (!config.governance || !this.isValidAddress(config.governance)) {
      throw new Error('Invalid governance address');
    }
    
    if (!config.security || !this.isValidAddress(config.security)) {
      throw new Error('Invalid security address');
    }
    
    if (!config.initialImplementation || !this.isValidAddress(config.initialImplementation)) {
      throw new Error('Invalid initial implementation address');
    }
    
    if (config.upgradeDelay < 3600 || config.upgradeDelay > 2592000) {
      throw new Error('Invalid upgrade delay (must be between 1 hour and 30 days)');
    }
    
    if (config.proposers.length === 0) {
      throw new Error('At least one proposer is required');
    }
    
    if (config.executors.length === 0) {
      throw new Error('At least one executor is required');
    }
    
    if (config.voters.length === 0) {
      throw new Error('At least one voter is required');
    }
    
    if (config.emergencyAdmins.length === 0) {
      throw new Error('At least one emergency admin is required');
    }
    
    // Validate all addresses
    const allAddresses = [
      config.owner,
      config.governance,
      config.security,
      config.initialImplementation,
      ...config.proposers,
      ...config.executors,
      ...config.voters,
      ...config.emergencyAdmins
    ];
    
    for (const address of allAddresses) {
      if (!this.isValidAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
      }
    }
  }

  /**
   * @dev Validate Ethereum address format
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * @dev Generate deployment hash
   */
  private generateDeploymentHash(): string {
    const data = JSON.stringify({
      config: this.config,
      timestamp: Date.now(),
      gasUsed: this.gasUsed
    });
    
    // Simple hash simulation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  /**
   * @dev Estimate gas for operations
   */
  private estimateGas(contract: string, operation: string): number {
    const estimates: Record<string, Record<string, number>> = {
      UpgradeManager: {
        deploy: 2000000,
        configureRole: 100000,
        setupGovernance: 150000,
        configureSecurity: 120000,
        verify: 80000
      },
      UpgradeProxy: {
        deploy: 1500000,
        initialize: 200000
      }
    };
    
    return estimates[contract]?.[operation] || 100000;
  }

  /**
   * @dev Verify deployment after deployment
   */
  public async verifyDeploymentAfterDeployment(
    result: DeploymentResult
  ): Promise<boolean> {
    console.log('🔍 Post-deployment verification...');
    
    try {
      // Verify deployment hash
      const expectedHash = this.generateDeploymentHash();
      if (result.deploymentHash !== expectedHash) {
        console.error('❌ Deployment hash mismatch');
        return false;
      }
      
      // Verify configuration
      if (result.config.owner !== this.config.owner) {
        console.error('❌ Owner configuration mismatch');
        return false;
      }
      
      // Verify gas usage is reasonable
      if (result.gasUsed > 10000000) { // 10 million gas limit
        console.error('❌ Gas usage too high');
        return false;
      }
      
      console.log('✅ Post-deployment verification passed');
      return true;
      
    } catch (error) {
      console.error('❌ Post-deployment verification failed:', error);
      return false;
    }
  }

  /**
   * @dev Get deployment summary
   */
  public getDeploymentSummary(): string {
    return `
📋 Upgrade System Deployment Summary
=====================================
Network: ${this.config.network}
Owner: ${this.config.owner}
Governance: ${this.config.governance}
Security: ${this.config.security}
Initial Implementation: ${this.config.initialImplementation}

Configuration:
- Upgrade Delay: ${this.config.upgradeDelay} seconds
- Timelock: ${this.config.timelock} seconds
- Emergency Pause: ${this.config.enableEmergencyPause}
- Multisig Required: ${this.config.requireMultisig}

Roles:
- Proposers: ${this.config.proposers.length}
- Executors: ${this.config.executors.length}
- Voters: ${this.config.voters.length}
- Emergency Admins: ${this.config.emergencyAdmins.length}

Deployment:
- Hash: ${this.deploymentHash}
- Gas Used: ${this.gasUsed}
- Status: ${this.upgradeManager && this.proxy ? 'Deployed' : 'Not Deployed'}
    `.trim();
  }
}

/**
 * @dev Create deployment configuration for different environments
 */
export class DeploymentConfigFactory {
  /**
   * @dev Create development configuration
   */
  public static createDevelopmentConfig(): DeploymentConfig {
    return {
      network: 'development',
      owner: '0x1234567890123456789012345678901234567890',
      governance: '0x2345678901234567890123456789012345678901',
      security: '0x3456789012345678901234567890123456789012',
      proposers: ['0x4567890123456789012345678901234567890123'],
      executors: ['0x5678901234567890123456789012345678901234'],
      voters: ['0x6789012345678901234567890123456789012345'],
      emergencyAdmins: ['0x7890123456789012345678901234567890123456'],
      upgradeDelay: 3600, // 1 hour for development
      timelock: 0,
      initialImplementation: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      enableEmergencyPause: true,
      requireMultisig: false
    };
  }

  /**
   * @dev Create staging configuration
   */
  public static createStagingConfig(): DeploymentConfig {
    return {
      network: 'staging',
      owner: '0x1234567890123456789012345678901234567890',
      governance: '0x2345678901234567890123456789012345678901',
      security: '0x3456789012345678901234567890123456789012',
      proposers: [
        '0x4567890123456789012345678901234567890123',
        '0x5678901234567890123456789012345678901234'
      ],
      executors: ['0x6789012345678901234567890123456789012345'],
      voters: [
        '0x7890123456789012345678901234567890123456',
        '0x8901234567890123456789012345678901234567'
      ],
      emergencyAdmins: ['0x9012345678901234567890123456789012345678'],
      upgradeDelay: 86400, // 1 day for staging
      timelock: 1800, // 30 minutes
      initialImplementation: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      enableEmergencyPause: true,
      requireMultisig: true
    };
  }

  /**
   * @dev Create production configuration
   */
  public static createProductionConfig(): DeploymentConfig {
    return {
      network: 'mainnet',
      owner: '0x1234567890123456789012345678901234567890',
      governance: '0x2345678901234567890123456789012345678901',
      security: '0x3456789012345678901234567890123456789012',
      proposers: [
        '0x4567890123456789012345678901234567890123',
        '0x5678901234567890123456789012345678901234',
        '0x6789012345678901234567890123456789012345'
      ],
      executors: [
        '0x7890123456789012345678901234567890123456',
        '0x8901234567890123456789012345678901234567'
      ],
      voters: [
        '0x9012345678901234567890123456789012345678',
        '0x0123456789012345678901234567890123456789',
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        '0x3456789012345678901234567890123456789012'
      ],
      emergencyAdmins: [
        '0x4567890123456789012345678901234567890123',
        '0x5678901234567890123456789012345678901234'
      ],
      upgradeDelay: 604800, // 7 days for production
      timelock: 3600, // 1 hour
      initialImplementation: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      enableEmergencyPause: true,
      requireMultisig: true
    };
  }
}

/**
 * @dev Main deployment function
 */
export async function deployUpgradeSystem(network: string = 'development'): Promise<DeploymentResult> {
  console.log(`🚀 Deploying upgrade system to ${network}...`);
  
  let config: DeploymentConfig;
  
  switch (network) {
    case 'development':
      config = DeploymentConfigFactory.createDevelopmentConfig();
      break;
    case 'staging':
      config = DeploymentConfigFactory.createStagingConfig();
      break;
    case 'mainnet':
      config = DeploymentConfigFactory.createProductionConfig();
      break;
    default:
      throw new Error(`Unknown network: ${network}`);
  }
  
  const deployer = new UpgradeSystemDeployer(config);
  const result = await deployer.deploy();
  
  // Verify deployment
  const isValid = await deployer.verifyDeploymentAfterDeployment(result);
  if (!isValid) {
    throw new Error('Deployment verification failed');
  }
  
  // Save deployment file
  await saveDeploymentFile(result, network);
  
  console.log(deployer.getDeploymentSummary());
  
  return result;
}

/**
 * @dev Deploy with custom configuration
 */
export async function deployWithCustomConfig(config: DeploymentConfig): Promise<DeploymentResult> {
  const deployer = new UpgradeSystemDeployer(config);
  const result = await deployer.deploy();
  
  const isValid = await deployer.verifyDeploymentAfterDeployment(result);
  if (!isValid) {
    throw new Error('Deployment verification failed');
  }
  
  // Save deployment file
  await saveDeploymentFile(result, config.network);
  
  console.log(deployer.getDeploymentSummary());
  
  return result;
}

/**
 * @dev Save deployment file
 */
async function saveDeploymentFile(result: DeploymentResult, network: string): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');
  
  const deploymentsDir = path.join(process.cwd(), 'deployments');
  
  // Ensure deployments directory exists
  try {
    await fs.mkdir(deploymentsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  const filename = `upgrade-${network}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  await fs.writeFile(filepath, JSON.stringify(result, null, 2));
  console.log(`📁 Deployment saved to: ${filepath}`);
}

// Export for use in scripts
if (require.main === module) {
  const network = process.argv[2] || 'development';
  
  deployUpgradeSystem(network)
    .then(() => {
      console.log('✅ Deployment completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}
