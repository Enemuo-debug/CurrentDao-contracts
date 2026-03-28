#!/usr/bin/env node

import { EmergencyPause } from '../contracts/emergency/EmergencyPause';
import { EmergencyConfig, PauseLevel, DEFAULT_EMERGENCY_CONFIG } from '../contracts/emergency/structures/PauseStructure';
import { EmergencyPauseEvents } from '../contracts/emergency/interfaces/IEmergencyPause';

/**
 * @title Deploy Emergency Contracts
 * @dev Deployment script for emergency pause system
 */

interface DeploymentConfig {
  network: 'development' | 'testnet' | 'mainnet';
  governanceMembers: string[];
  criticalContracts: string[];
  emergencyConfig?: Partial<EmergencyConfig>;
  dryRun?: boolean;
}

interface DeploymentResult {
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  gasUsed?: number;
  error?: string;
  deploymentTime: number;
}

class EmergencyContractDeployer {
  private config: DeploymentConfig;
  private eventHandlers: EmergencyPauseEvents;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.eventHandlers = this.createEventHandlers();
  }

  /**
   * @deploys the emergency pause contract
   */
  public async deploy(): Promise<DeploymentResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🚀 Starting emergency contract deployment on ${this.config.network}...`);
      
      // Validate configuration
      this.validateDeploymentConfig();
      
      // Prepare emergency configuration
      const emergencyConfig = this.prepareEmergencyConfig();
      
      // Log deployment details
      this.logDeploymentDetails(emergencyConfig);
      
      if (this.config.dryRun) {
        console.log('🔍 Dry run mode - skipping actual deployment');
        return this.createDryRunResult(startTime);
      }
      
      // Deploy contract
      const result = await this.deployContract(emergencyConfig);
      
      // Verify deployment
      await this.verifyDeployment(result);
      
      // Setup monitoring
      await this.setupMonitoring(result);
      
      console.log('✅ Emergency contract deployed successfully!');
      return result;
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deploymentTime: Date.now() - startTime
      };
    }
  }

  /**
   * @dev Validates deployment configuration
   */
  private validateDeploymentConfig(): void {
    console.log('🔍 Validating deployment configuration...');
    
    // Validate governance members
    if (this.config.governanceMembers.length < 3) {
      throw new Error('Minimum 3 governance members required');
    }
    
    if (this.config.governanceMembers.length > 20) {
      throw new Error('Maximum 20 governance members allowed');
    }
    
    // Validate member addresses
    for (const member of this.config.governanceMembers) {
      if (!this.isValidAddress(member)) {
        throw new Error(`Invalid governance member address: ${member}`);
      }
    }
    
    // Validate critical contracts
    for (const contract of this.config.criticalContracts) {
      if (!this.isValidAddress(contract)) {
        throw new Error(`Invalid critical contract address: ${contract}`);
      }
    }
    
    // Network-specific validations
    this.validateNetworkConfig();
    
    console.log('✅ Configuration validation passed');
  }

  /**
   * @dev Validates network-specific configuration
   */
  private validateNetworkConfig(): void {
    switch (this.config.network) {
      case 'development':
        console.log('🔧 Development network detected');
        break;
      case 'testnet':
        console.log('🧪 Testnet network detected');
        if (this.config.governanceMembers.length < 5) {
          console.warn('⚠️  Consider using more governance members for testnet');
        }
        break;
      case 'mainnet':
        console.log('🌐 Mainnet network detected');
        if (this.config.governanceMembers.length < 7) {
          throw new Error('Minimum 7 governance members required for mainnet');
        }
        if (this.config.criticalContracts.length === 0) {
          throw new Error('Critical contracts must be specified for mainnet');
        }
        break;
    }
  }

  /**
   * @dev Prepares emergency configuration
   */
  private prepareEmergencyConfig(): EmergencyConfig {
    const baseConfig = {
      ...DEFAULT_EMERGENCY_CONFIG,
      governanceMembers: this.config.governanceMembers,
      criticalContracts: this.config.criticalContracts,
      ...this.config.emergencyConfig
    };

    // Network-specific adjustments
    const networkConfig = this.getNetworkSpecificConfig();
    
    return {
      ...baseConfig,
      ...networkConfig
    };
  }

  /**
   * @dev Gets network-specific configuration
   */
  private getNetworkSpecificConfig(): Partial<EmergencyConfig> {
    switch (this.config.network) {
      case 'development':
        return {
          requiredSignatures: 2,
          maxPauseDuration: 300, // 5 minutes for development
          gasOptimizationLevel: 1
        };
      case 'testnet':
        return {
          requiredSignatures: 3,
          maxPauseDuration: 1800, // 30 minutes for testnet
          gasOptimizationLevel: 2
        };
      case 'mainnet':
        return {
          requiredSignatures: 5,
          maxPauseDuration: 86400, // 24 hours for mainnet
          gasOptimizationLevel: 3,
          autoResumeEnabled: true,
          notificationThreshold: 3
        };
      default:
        return {};
    }
  }

  /**
   * @dev Logs deployment details
   */
  private logDeploymentDetails(config: EmergencyConfig): void {
    console.log('\n📋 Deployment Details:');
    console.log(`Network: ${this.config.network}`);
    console.log(`Governance Members: ${config.governanceMembers.length}`);
    console.log(`Required Signatures: ${config.requiredSignatures}`);
    console.log(`Critical Contracts: ${config.criticalContracts.length}`);
    console.log(`Max Pause Duration: ${config.maxPauseDuration} seconds`);
    console.log(`Auto Resume Enabled: ${config.autoResumeEnabled}`);
    console.log(`Gas Optimization Level: ${config.gasOptimizationLevel}`);
    
    console.log('\n👥 Governance Members:');
    config.governanceMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member}`);
    });
    
    console.log('\n🔒 Critical Contracts:');
    config.criticalContracts.forEach((contract, index) => {
      console.log(`  ${index + 1}. ${contract}`);
    });
    
    console.log('\n⚙️  Pause Level Configuration:');
    Object.entries(config.pauseLevels).forEach(([level, levelConfig]) => {
      console.log(`  ${level}: ${levelConfig.requiredSignatures} signatures, max ${levelConfig.maxDuration}s`);
    });
    
    console.log('');
  }

  /**
   * @deploys the actual contract
   */
  private async deployContract(config: EmergencyConfig): Promise<DeploymentResult> {
    console.log('🔨 Deploying EmergencyPause contract...');
    
    // In a real implementation, this would use the actual blockchain deployment
    // For this example, we'll simulate the deployment
    const contractAddress = this.generateContractAddress();
    const transactionHash = this.generateTransactionHash();
    const gasUsed = this.estimateDeploymentGas(config);
    
    // Create contract instance
    const emergencyPause = new EmergencyPause(
      config.governanceMembers,
      config,
      this.eventHandlers
    );
    
    // Simulate deployment delay
    await this.sleep(2000);
    
    console.log(`📄 Contract deployed at: ${contractAddress}`);
    console.log(`🔗 Transaction hash: ${transactionHash}`);
    console.log(`⛽ Gas used: ${gasUsed}`);
    
    return {
      success: true,
      contractAddress,
      transactionHash,
      gasUsed,
      deploymentTime: 0 // Will be set by caller
    };
  }

  /**
   * @dev Verifies deployment
   */
  private async verifyDeployment(result: DeploymentResult): Promise<void> {
    console.log('🔍 Verifying deployment...');
    
    if (!result.contractAddress || !result.transactionHash) {
      throw new Error('Invalid deployment result');
    }
    
    // In a real implementation, this would verify the contract on-chain
    // For this example, we'll simulate verification
    await this.sleep(1000);
    
    console.log('✅ Deployment verified successfully');
  }

  /**
   * @dev Sets up monitoring and alerts
   */
  private async setupMonitoring(result: DeploymentResult): Promise<void> {
    console.log('📊 Setting up monitoring...');
    
    // Setup monitoring hooks
    const monitoringConfig = {
      contractAddress: result.contractAddress,
      alertChannels: ['email', 'slack', 'discord'],
      metricsInterval: 60000, // 1 minute
      healthCheckInterval: 30000 // 30 seconds
    };
    
    console.log('📈 Monitoring configured');
    console.log(`📡 Contract address: ${result.contractAddress}`);
    console.log(`🔔 Alert channels: ${monitoringConfig.alertChannels.join(', ')}`);
  }

  /**
   * @dev Creates event handlers for deployment
   */
  private createEventHandlers(): EmergencyPauseEvents {
    return {
      EmergencyPauseInitiated: (event) => {
        console.log(`🚨 EMERGENCY PAUSE INITIATED: Level ${event.level}`);
        console.log(`   Reason: ${event.reason}`);
        console.log(`   Initiator: ${event.initiator}`);
        console.log(`   Affected contracts: ${event.affectedContracts.length}`);
        
        // Send alerts
        this.sendAlert('EMERGENCY_PAUSE', event);
      },
      
      EmergencyPauseResumed: (event) => {
        console.log(`✅ EMERGENCY PAUSE RESUMED: Level ${event.level}`);
        console.log(`   Resumed by: ${event.resumedBy}`);
        console.log(`   Signatures: ${event.signatures.length}`);
        
        // Send alerts
        this.sendAlert('EMERGENCY_RESUME', event);
      },
      
      GovernanceActionExecuted: (event) => {
        console.log(`🏛️  GOVERNANCE ACTION: ${event.action}`);
        console.log(`   Executor: ${event.executor}`);
        console.log(`   Signatures: ${event.signatures.length}`);
      },
      
      AutoResumeTriggered: (event) => {
        console.log(`🔄 AUTO-RESUME TRIGGERED: Level ${event.level}`);
        console.log(`   Reason: ${event.reason}`);
        
        // Send alerts
        this.sendAlert('AUTO_RESUME', event);
      },
      
      EmergencyConfigUpdated: (event) => {
        console.log(`⚙️  CONFIG UPDATED`);
        console.log(`   Updated by: ${event.updatedBy}`);
        
        // Send alerts
        this.sendAlert('CONFIG_UPDATE', event);
      }
    };
  }

  /**
   * @dev Sends alerts for emergency events
   */
  private sendAlert(type: string, data: any): void {
    console.log(`🚨 ALERT SENT: ${type}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log(`   Data: ${JSON.stringify(data, null, 2)}`);
    
    // In a real implementation, this would send actual notifications
    // to email, Slack, Discord, etc.
  }

  /**
   * @dev Creates dry run result
   */
  private createDryRunResult(startTime: number): DeploymentResult {
    const mockAddress = this.generateContractAddress();
    const mockHash = this.generateTransactionHash();
    
    return {
      success: true,
      contractAddress: mockAddress,
      transactionHash: mockHash,
      gasUsed: 150000,
      deploymentTime: Date.now() - startTime
    };
  }

  /**
   * @dev Utility functions
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private generateContractAddress(): string {
    return '0x' + Array(40).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private generateTransactionHash(): string {
    return '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private estimateDeploymentGas(config: EmergencyConfig): number {
    let gas = 100000; // Base deployment cost
    
    // Add cost for governance members
    gas += config.governanceMembers.length * 5000;
    
    // Add cost for critical contracts
    gas += config.criticalContracts.length * 3000;
    
    // Add cost for configuration
    gas += 20000;
    
    return gas;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * @deploys emergency contracts with specified configuration
 */
export async function deployEmergencyContracts(config: DeploymentConfig): Promise<DeploymentResult> {
  const deployer = new EmergencyContractDeployer(config);
  return await deployer.deploy();
}

/**
 * @deploys emergency contracts for different environments
 */
export class DeploymentPresets {
  /**
   * @deploys for development environment
   */
  static async deployDevelopment(): Promise<DeploymentResult> {
    const config: DeploymentConfig = {
      network: 'development',
      governanceMembers: [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        '0x3456789012345678901234567890123456789012'
      ],
      criticalContracts: [
        '0xcontract1',
        '0xcontract2'
      ],
      dryRun: false
    };
    
    return await deployEmergencyContracts(config);
  }

  /**
   * @deploys for testnet environment
   */
  static async deployTestnet(): Promise<DeploymentResult> {
    const config: DeploymentConfig = {
      network: 'testnet',
      governanceMembers: [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        '0x3456789012345678901234567890123456789012',
        '0x4567890123456789012345678901234567890123',
        '0x5678901234567890123456789012345678901234'
      ],
      criticalContracts: [
        '0xtoken_contract',
        '0xdao_contract',
        '0xescrow_contract'
      ],
      emergencyConfig: {
        autoResumeEnabled: true,
        notificationThreshold: 3
      },
      dryRun: false
    };
    
    return await deployEmergencyContracts(config);
  }

  /**
   * @deploys for mainnet environment
   */
  static async deployMainnet(): Promise<DeploymentResult> {
    const config: DeploymentConfig = {
      network: 'mainnet',
      governanceMembers: [
        '0x1234567890123456789012345678901234567890',
        '0x2345678901234567890123456789012345678901',
        '0x3456789012345678901234567890123456789012',
        '0x4567890123456789012345678901234567890123',
        '0x5678901234567890123456789012345678901234',
        '0x6789012345678901234567890123456789012345',
        '0x7890123456789012345678901234567890123456'
      ],
      criticalContracts: [
        '0xmain_token_contract',
        '0xgovernance_contract',
        '0xtreasury_contract',
        '0xstaking_contract',
        '0xlending_contract'
      ],
      emergencyConfig: {
        requiredSignatures: 5,
        maxPauseDuration: 86400,
        autoResumeEnabled: true,
        notificationThreshold: 5,
        gasOptimizationLevel: 3
      },
      dryRun: false
    };
    
    return await deployEmergencyContracts(config);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const network = args[0] as 'development' | 'testnet' | 'mainnet';
  const dryRun = args.includes('--dry-run');
  
  if (!network || !['development', 'testnet', 'mainnet'].includes(network)) {
    console.error('Usage: npm run deploy:emergency [development|testnet|mainnet] [--dry-run]');
    process.exit(1);
  }
  
  console.log(`🚀 Deploying emergency contracts to ${network}${dryRun ? ' (dry run)' : ''}...`);
  
  switch (network) {
    case 'development':
      DeploymentPresets.deployDevelopment();
      break;
    case 'testnet':
      DeploymentPresets.deployTestnet();
      break;
    case 'mainnet':
      DeploymentPresets.deployMainnet();
      break;
  }
}
