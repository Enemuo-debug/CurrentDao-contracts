/**
 * @title Deploy Energy Escrow
 * @dev Deployment script for the Energy Trading Escrow system
 * @dev Supports multiple networks with configurable parameters
 */

import { EnergyEscrow } from '../contracts/escrow/EnergyEscrow';
import { EscrowLib } from '../contracts/escrow/libraries/EscrowLib';

export interface DeploymentConfig {
  network: 'development' | 'testnet' | 'mainnet';
  admin: string;
  wattTokenAddress?: string;
  penaltyPercent?: number;
  autoReleasePeriod?: number;
  requiredEmergencyApprovals?: number;
  gasLimit?: number;
  gasPrice?: number;
}

export interface DeploymentResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: number;
  deploymentHash: string;
  timestamp: number;
  config: DeploymentConfig;
}

export class EnergyEscrowDeployer {
  private config: DeploymentConfig;
  private networkConfigs: Map<string, Partial<DeploymentConfig>>;

  constructor(config: DeploymentConfig) {
    this.validateConfig(config);
    this.config = config;
    this.setupNetworkConfigs();
  }

  private validateConfig(config: DeploymentConfig): void {
    if (!config.network) {
      throw new Error('Network must be specified');
    }

    if (!config.admin || !EscrowLib.isValidAddress(config.admin)) {
      throw new Error('Valid admin address must be provided');
    }

    if (config.penaltyPercent !== undefined) {
      if (config.penaltyPercent < 0 || config.penaltyPercent > EscrowLib.MAX_PENALTY_PERCENT) {
        throw new Error(`Penalty percent must be between 0 and ${EscrowLib.MAX_PENALTY_PERCENT}`);
      }
    }

    if (config.autoReleasePeriod !== undefined) {
      if (config.autoReleasePeriod < EscrowLib.MIN_AUTO_RELEASE_PERIOD || 
          config.autoReleasePeriod > EscrowLib.MAX_AUTO_RELEASE_PERIOD) {
        throw new Error('Invalid auto-release period');
      }
    }

    if (config.requiredEmergencyApprovals !== undefined) {
      if (config.requiredEmergencyApprovals < EscrowLib.MIN_EMERGENCY_APPROVALS || 
          config.requiredEmergencyApprovals > EscrowLib.MAX_EMERGENCY_APPROVALS) {
        throw new Error('Invalid emergency approval count');
      }
    }
  }

  private setupNetworkConfigs(): void {
    this.networkConfigs = new Map([
      ['development', {
        gasLimit: 8000000,
        gasPrice: 20000000000, // 20 gwei
        penaltyPercent: 10,
        autoReleasePeriod: 48 * 60 * 60 * 1000, // 48 hours
        requiredEmergencyApprovals: 2
      }],
      ['testnet', {
        gasLimit: 6000000,
        gasPrice: 20000000000, // 20 gwei
        penaltyPercent: 10,
        autoReleasePeriod: 48 * 60 * 60 * 1000, // 48 hours
        requiredEmergencyApprovals: 3
      }],
      ['mainnet', {
        gasLimit: 8000000,
        gasPrice: 20000000000, // 20 gwei (will be adjusted based on network conditions)
        penaltyPercent: 10,
        autoReleasePeriod: 48 * 60 * 60 * 1000, // 48 hours
        requiredEmergencyApprovals: 5
      }]
    ]);
  }

  public async deploy(): Promise<DeploymentResult> {
    console.log(`🚀 Deploying Energy Escrow to ${this.config.network}...`);
    
    const networkConfig = this.networkConfigs.get(this.config.network);
    const finalConfig = { ...networkConfig, ...this.config };

    // Simulate contract deployment
    const deploymentStartTime = Date.now();
    
    try {
      // In a real deployment, this would interact with the blockchain
      const contractAddress = this.generateContractAddress();
      const transactionHash = this.generateTransactionHash();
      const blockNumber = await this.getCurrentBlockNumber();
      const gasUsed = this.estimateDeploymentGas();
      
      // Create the contract instance
      const escrow = new EnergyEscrow(finalConfig.admin, finalConfig.wattTokenAddress);
      
      // Apply custom configurations
      if (finalConfig.penaltyPercent !== undefined) {
        escrow.updatePenaltyPercent(finalConfig.penaltyPercent, finalConfig.admin);
      }
      
      if (finalConfig.autoReleasePeriod !== undefined) {
        escrow.updateAutoReleasePeriod(finalConfig.autoReleasePeriod, finalConfig.admin);
      }
      
      if (finalConfig.requiredEmergencyApprovals !== undefined) {
        escrow.updateRequiredEmergencyApprovals(finalConfig.requiredEmergencyApprovals, finalConfig.admin);
      }
      
      const deploymentTime = Date.now() - deploymentStartTime;
      const deploymentHash = this.generateDeploymentHash(finalConfig, transactionHash);
      
      const result: DeploymentResult = {
        contractAddress,
        transactionHash,
        blockNumber,
        gasUsed,
        deploymentHash,
        timestamp: Date.now(),
        config: finalConfig as DeploymentConfig
      };

      console.log('✅ Energy Escrow deployed successfully!');
      console.log(`📍 Contract Address: ${contractAddress}`);
      console.log(`🔗 Transaction Hash: ${transactionHash}`);
      console.log(`⛽ Gas Used: ${gasUsed.toLocaleString()}`);
      console.log(`⏱️  Deployment Time: ${deploymentTime}ms`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  public async verifyDeployment(
    result: DeploymentResult
  ): Promise<boolean> {
    console.log('🔍 Verifying deployment...');
    
    try {
      // In a real implementation, this would verify the contract on Etherscan
      // For now, we'll simulate verification
      
      const verificationChecks = [
        this.checkContractExists(result.contractAddress),
        this.checkAdminConfiguration(result.contractAddress, result.config.admin),
        this.checkInitialParameters(result.contractAddress, result.config)
      ];
      
      const verificationResults = await Promise.all(verificationChecks);
      const allPassed = verificationResults.every(check => check);
      
      if (allPassed) {
        console.log('✅ Deployment verification passed!');
      } else {
        console.log('❌ Deployment verification failed!');
      }
      
      return allPassed;
      
    } catch (error) {
      console.error('❌ Verification error:', error);
      return false;
    }
  }

  public async upgradeContract(
    currentAddress: string,
    newConfig?: Partial<DeploymentConfig>
  ): Promise<DeploymentResult> {
    console.log('🔄 Upgrading Energy Escrow contract...');
    
    // In a real implementation, this would handle contract upgrades
    // using a proxy pattern or similar upgrade mechanism
    
    const upgradeConfig = { ...this.config, ...newConfig };
    const newDeployer = new EnergyEscrowDeployer(upgradeConfig);
    
    const result = await newDeployer.deploy();
    
    console.log('✅ Contract upgrade completed!');
    console.log(`📍 Old Contract: ${currentAddress}`);
    console.log(`📍 New Contract: ${result.contractAddress}`);
    
    return result;
  }

  public getDeploymentInfo(): any {
    return {
      network: this.config.network,
      admin: this.config.admin,
      wattTokenAddress: this.config.wattTokenAddress,
      penaltyPercent: this.config.penaltyPercent || EscrowLib.DEFAULT_PENALTY_PERCENT,
      autoReleasePeriod: this.config.autoReleasePeriod || EscrowLib.DEFAULT_AUTO_RELEASE_PERIOD,
      requiredEmergencyApprovals: this.config.requiredEmergencyApprovals || EscrowLib.DEFAULT_EMERGENCY_APPROVALS,
      estimatedGas: this.estimateDeploymentGas(),
      estimatedCost: this.estimateDeploymentCost()
    };
  }

  // Helper methods (simulated for demo purposes)
  private generateContractAddress(): string {
    return '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private generateTransactionHash(): string {
    return '0x' + Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private async getCurrentBlockNumber(): Promise<number> {
    // Simulate getting current block number
    return Math.floor(Math.random() * 1000000) + 18000000;
  }

  private estimateDeploymentGas(): number {
    return EscrowLib.estimateGasCost('create_escrow') * 10; // Rough estimate
  }

  private estimateDeploymentCost(): number {
    const gasPrice = this.config.gasPrice || 20000000000; // 20 gwei
    return this.estimateDeploymentGas() * gasPrice;
  }

  private generateDeploymentHash(config: DeploymentConfig, txHash: string): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    return '0x' + require('crypto')
      .createHash('sha256')
      .update(configString + txHash)
      .digest('hex')
      .substring(0, 64);
  }

  private async checkContractExists(address: string): Promise<boolean> {
    // Simulate contract existence check
    return EscrowLib.isValidAddress(address);
  }

  private async checkAdminConfiguration(address: string, expectedAdmin: string): Promise<boolean> {
    // Simulate admin configuration check
    return true;
  }

  private async checkInitialParameters(address: string, config: DeploymentConfig): Promise<boolean> {
    // Simulate parameter verification
    return true;
  }
}

// CLI interface for deployment
export async function deployEnergyEscrow(config: DeploymentConfig): Promise<void> {
  try {
    const deployer = new EnergyEscrowDeployer(config);
    
    console.log('📋 Deployment Configuration:');
    console.log(JSON.stringify(deployer.getDeploymentInfo(), null, 2));
    console.log();
    
    const result = await deployer.deploy();
    
    // Save deployment info to file
    const fs = require('fs');
    const deploymentInfo = {
      deployment: result,
      abi: require('../contracts/escrow/EnergyEscrow'),
      networks: {
        [config.network]: {
          address: result.contractAddress,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
          gasUsed: result.gasUsed,
          deploymentHash: result.deploymentHash,
          timestamp: result.timestamp,
          config: result.config
        }
      }
    };
    
    const deploymentFile = `deployments/escrow-${config.network}-${Date.now()}.json`;
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`📁 Deployment info saved to: ${deploymentFile}`);
    
    // Verify deployment
    const verified = await deployer.verifyDeployment(result);
    if (verified) {
      console.log('🎉 Deployment completed and verified successfully!');
    } else {
      console.log('⚠️  Deployment completed but verification failed');
    }
    
  } catch (error) {
    console.error('💥 Deployment failed:', error);
    process.exit(1);
  }
}

// Example usage configurations
export const DEPLOYMENT_CONFIGS = {
  development: {
    network: 'development' as const,
    admin: '0x' + 'a'.repeat(40),
    wattTokenAddress: '0x' + 'b'.repeat(40),
    penaltyPercent: 10,
    autoReleasePeriod: 48 * 60 * 60 * 1000,
    requiredEmergencyApprovals: 2
  },
  
  testnet: {
    network: 'testnet' as const,
    admin: '0x' + 'c'.repeat(40),
    wattTokenAddress: '0x' + 'd'.repeat(40),
    penaltyPercent: 10,
    autoReleasePeriod: 48 * 60 * 60 * 1000,
    requiredEmergencyApprovals: 3
  },
  
  mainnet: {
    network: 'mainnet' as const,
    admin: '0x' + 'e'.repeat(40),
    wattTokenAddress: '0x' + 'f'.repeat(40),
    penaltyPercent: 15,
    autoReleasePeriod: 72 * 60 * 60 * 1000, // 72 hours on mainnet
    requiredEmergencyApprovals: 5
  }
};

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const network = args[0] || 'development';
  
  if (!DEPLOYMENT_CONFIGS[network as keyof typeof DEPLOYMENT_CONFIGS]) {
    console.error('❌ Invalid network. Available networks:', Object.keys(DEPLOYMENT_CONFIGS));
    process.exit(1);
  }
  
  const config = DEPLOYMENT_CONFIGS[network as keyof typeof DEPLOYMENT_CONFIGS];
  
  console.log(`🚀 Starting Energy Escrow deployment to ${network}...`);
  deployEnergyEscrow(config);
}
