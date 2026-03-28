import { FeeManager } from '../contracts/fees/FeeManager';
import { FeeType, FeeTier, FeeDistribution } from '../contracts/fees/structures/FeeStructure';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deployment script for the Fee Management System
 * This script deploys and configures the complete fee management infrastructure
 */

interface DeploymentConfig {
    network: 'development' | 'testnet' | 'mainnet';
    owner: string;
    treasury: string;
    validators: string;
    developers: string;
    enableDynamicFees: boolean;
    initialNetworkCongestion: number;
}

interface DeploymentResult {
    feeManager: FeeManager;
    config: DeploymentConfig;
    deploymentHash: string;
    timestamp: number;
    gasUsed: number;
}

class FeeSystemDeployer {
    private config: DeploymentConfig;
    private deploymentResults: DeploymentResult[] = [];

    constructor(config: DeploymentConfig) {
        this.config = config;
    }

    /**
     * Deploy the complete fee management system
     */
    public async deploy(): Promise<DeploymentResult> {
        console.log(`🚀 Deploying Fee Management System to ${this.config.network}...`);
        console.log(`📋 Configuration:`, this.config);

        const startTime = Date.now();
        let gasUsed = 0;

        try {
            // Step 1: Deploy FeeManager contract
            console.log('📦 Deploying FeeManager contract...');
            const feeManager = new FeeManager(this.config.owner);
            gasUsed += 2100000; // Estimated deployment gas

            // Step 2: Configure fee structures
            console.log('⚙️  Configuring fee structures...');
            await this.configureFeeStructures(feeManager);
            gasUsed += 500000;

            // Step 3: Setup fee distributions
            console.log('💰 Setting up fee distributions...');
            await this.setupFeeDistributions(feeManager);
            gasUsed += 300000;

            // Step 4: Configure initial tiers
            console.log('🏆 Setting up fee tiers...');
            await this.setupFeeTiers(feeManager);
            gasUsed += 200000;

            // Step 5: Set initial network conditions
            console.log('🌐 Setting initial network conditions...');
            feeManager.setNetworkCongestionLevel(this.config.initialNetworkCongestion);
            gasUsed += 50000;

            // Step 6: Create promotional exemptions (for testnet/dev)
            if (this.config.network !== 'mainnet') {
                console.log('🎫 Creating promotional exemptions...');
                await this.createPromotionalExemptions(feeManager);
                gasUsed += 100000;
            }

            const endTime = Date.now();
            const deploymentTime = endTime - startTime;

            const result: DeploymentResult = {
                feeManager,
                config: this.config,
                deploymentHash: this.generateDeploymentHash(),
                timestamp: endTime,
                gasUsed
            };

            this.deploymentResults.push(result);

            // Save deployment result
            await this.saveDeploymentResult(result);

            console.log(`✅ Fee Management System deployed successfully!`);
            console.log(`⏱️  Deployment time: ${deploymentTime}ms`);
            console.log(`⛽ Gas used: ${gasUsed.toLocaleString()}`);
            console.log(`🔗 Deployment hash: ${result.deploymentHash}`);

            return result;

        } catch (error) {
            console.error('❌ Deployment failed:', error);
            throw error;
        }
    }

    /**
     * Configure fee structures for different transaction types
     */
    private async configureFeeStructures(feeManager: FeeManager): Promise<void> {
        // Trading fees - tiered with dynamic adjustment
        const tradingStructure = {
            feeType: FeeType.TIERED,
            baseFee: 1,
            percentageFee: 50, // 0.5%
            minFee: 0.5,
            maxFee: 100,
            dynamicAdjustment: {
                enabled: this.config.enableDynamicFees,
                minRate: 25, // 0.25%
                maxRate: 250, // 2.5%
                congestionMultiplier: 1.5
            },
            volumeThresholds: {
                discountThresholds: [
                    { volume: 1000, discount: 500 }, // 5% discount
                    { volume: 10000, discount: 1000 }, // 10% discount
                    { volume: 100000, discount: 2000 } // 20% discount
                ],
                resetPeriod: 'monthly' as const
            }
        };

        feeManager.updateFeeStructure('TRADE', tradingStructure);

        // Transfer fees - hybrid structure
        const transferStructure = {
            feeType: FeeType.HYBRID,
            baseFee: 0.5,
            percentageFee: 10, // 0.1%
            minFee: 0.1,
            maxFee: 10,
            dynamicAdjustment: {
                enabled: false,
                minRate: 10,
                maxRate: 50,
                congestionMultiplier: 1.2
            },
            volumeThresholds: {
                discountThresholds: [
                    { volume: 500, discount: 200 }, // 2% discount
                    { volume: 5000, discount: 500 } // 5% discount
                ],
                resetPeriod: 'monthly' as const
            }
        };

        feeManager.updateFeeStructure('TRANSFER', transferStructure);

        // Staking fees - fixed structure
        const stakingStructure = {
            feeType: FeeType.FIXED,
            baseFee: 2,
            percentageFee: 0,
            minFee: 2,
            maxFee: 2,
            dynamicAdjustment: {
                enabled: false,
                minRate: 0,
                maxRate: 0,
                congestionMultiplier: 1
            },
            volumeThresholds: {
                discountThresholds: [],
                resetPeriod: 'monthly' as const
            }
        };

        feeManager.updateFeeStructure('STAKING', stakingStructure);

        console.log('  ✓ Fee structures configured');
    }

    /**
     * Setup fee distributions for different transaction types
     */
    private async setupFeeDistributions(feeManager: FeeManager): Promise<void> {
        // Trading fee distribution
        const tradingDistribution: FeeDistribution = {
            transactionType: 'TRADE',
            recipients: [
                { address: this.config.treasury, percentage: 5000, name: 'Treasury' },
                { address: this.config.validators, percentage: 3000, name: 'Validators' },
                { address: this.config.developers, percentage: 2000, name: 'Developers' }
            ],
            totalPercentage: 10000
        };

        feeManager.setFeeDistribution('TRADE', tradingDistribution);

        // Transfer fee distribution
        const transferDistribution: FeeDistribution = {
            transactionType: 'TRANSFER',
            recipients: [
                { address: this.config.treasury, percentage: 6000, name: 'Treasury' },
                { address: this.config.validators, percentage: 4000, name: 'Validators' }
            ],
            totalPercentage: 10000
        };

        feeManager.setFeeDistribution('TRANSFER', transferDistribution);

        // Staking fee distribution
        const stakingDistribution: FeeDistribution = {
            transactionType: 'STAKING',
            recipients: [
                { address: this.config.treasury, percentage: 7000, name: 'Treasury' },
                { address: this.config.validators, percentage: 3000, name: 'Validators' }
            ],
            totalPercentage: 10000
        };

        feeManager.setFeeDistribution('STAKING', stakingDistribution);

        console.log('  ✓ Fee distributions configured');
    }

    /**
     * Setup fee tiers for different user levels
     */
    private async setupFeeTiers(feeManager: FeeManager): Promise<void> {
        // Bronze tier
        const bronzeTier: FeeTier = {
            id: 'bronze',
            name: 'Bronze Trader',
            minVolume: 0,
            maxVolume: 999,
            discountPercentage: 0,
            priority: 3
        };

        // Silver tier
        const silverTier: FeeTier = {
            id: 'silver',
            name: 'Silver Trader',
            minVolume: 1000,
            maxVolume: 9999,
            discountPercentage: 500, // 5% discount
            priority: 2
        };

        // Gold tier
        const goldTier: FeeTier = {
            id: 'gold',
            name: 'Gold Trader',
            minVolume: 10000,
            maxVolume: 99999,
            discountPercentage: 1000, // 10% discount
            priority: 1
        };

        // Platinum tier
        const platinumTier: FeeTier = {
            id: 'platinum',
            name: 'Platinum Trader',
            minVolume: 100000,
            discountPercentage: 2000, // 20% discount
            priority: 0
        };

        // Add tiers to trading structure
        feeManager.addFeeTier('TRADE', bronzeTier);
        feeManager.addFeeTier('TRADE', silverTier);
        feeManager.addFeeTier('TRADE', goldTier);
        feeManager.addFeeTier('TRADE', platinumTier);

        console.log('  ✓ Fee tiers configured');
    }

    /**
     * Create promotional exemptions for testnet/development
     */
    private async createPromotionalExemptions(feeManager: FeeManager): Promise<void> {
        // Create a promotional exemption for early users
        const promotionalExemptionId = feeManager.createExemption(
            '0x0000000000000000000000000000000000000000', // Placeholder for all users
            '*',
            'PERCENTAGE',
            1000, // 10% discount
            Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
        );

        console.log(`  ✓ Promotional exemption created: ${promotionalExemptionId}`);
    }

    /**
     * Generate a unique deployment hash
     */
    private generateDeploymentHash(): string {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2);
        return `deploy_${timestamp}_${random}`;
    }

    /**
     * Save deployment result to file
     */
    private async saveDeploymentResult(result: DeploymentResult): Promise<void> {
        const deploymentsDir = path.join(__dirname, '../deployments');
        
        // Create deployments directory if it doesn't exist
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const filename = `fee_system_${this.config.network}_${result.timestamp}.json`;
        const filepath = path.join(deploymentsDir, filename);

        const deploymentData = {
            ...result,
            config: this.config,
            network: this.config.network,
            contractAddress: '0x' + Math.random().toString(36).substring(2, 15), // Mock address
            blockNumber: Math.floor(Math.random() * 1000000),
            transactionHash: '0x' + Math.random().toString(36).substring(2, 67)
        };

        fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));
        console.log(`  📄 Deployment saved to: ${filepath}`);
    }

    /**
     * Verify deployment
     */
    public async verifyDeployment(result: DeploymentResult): Promise<boolean> {
        console.log('🔍 Verifying deployment...');

        try {
            const feeManager = result.feeManager;

            // Verify fee structures exist
            const tradeStructure = feeManager.getFeeStructure('TRADE');
            const transferStructure = feeManager.getFeeStructure('TRANSFER');
            const stakingStructure = feeManager.getFeeStructure('STAKING');

            if (!tradeStructure || !transferStructure || !stakingStructure) {
                throw new Error('Missing fee structures');
            }

            // Verify fee distributions exist
            const tradeDistribution = feeManager.getFeeDistribution('TRADE');
            const transferDistribution = feeManager.getFeeDistribution('TRANSFER');
            const stakingDistribution = feeManager.getFeeDistribution('STAKING');

            if (!tradeDistribution || !transferDistribution || !stakingDistribution) {
                throw new Error('Missing fee distributions');
            }

            // Test fee calculation
            const testResult = feeManager.calculateFee(1000, '0xtest', 'TRADE');
            if (testResult.totalFee <= 0) {
                throw new Error('Fee calculation not working');
            }

            console.log('  ✓ All verifications passed');
            return true;

        } catch (error) {
            console.error('  ❌ Verification failed:', error);
            return false;
        }
    }
}

/**
 * Main deployment function
 */
async function main(): Promise<void> {
    console.log('🎯 CurrentDao Fee Management System Deployment');
    console.log('='.repeat(50));

    // Define deployment configurations for different networks
    const configs: Record<string, DeploymentConfig> = {
        development: {
            network: 'development',
            owner: '0xowner',
            treasury: '0xtreasury',
            validators: '0xvalidators',
            developers: '0xdevelopers',
            enableDynamicFees: true,
            initialNetworkCongestion: 20
        },
        testnet: {
            network: 'testnet',
            owner: '0xtestnet_owner',
            treasury: '0xtestnet_treasury',
            validators: '0xtestnet_validators',
            developers: '0xtestnet_developers',
            enableDynamicFees: true,
            initialNetworkCongestion: 30
        },
        mainnet: {
            network: 'mainnet',
            owner: process.env.MAINNET_OWNER || '0xmainnet_owner',
            treasury: process.env.MAINNET_TREASURY || '0xmainnet_treasury',
            validators: process.env.MAINNET_VALIDATORS || '0xmainnet_validators',
            developers: process.env.MAINNET_DEVELOPERS || '0xmainnet_developers',
            enableDynamicFees: true,
            initialNetworkCongestion: 0
        }
    };

    // Get network from command line arguments or default to development
    const network = process.argv[2] || 'development';
    const config = configs[network];

    if (!config) {
        console.error(`❌ Unknown network: ${network}`);
        console.log('Available networks: development, testnet, mainnet');
        process.exit(1);
    }

    const deployer = new FeeSystemDeployer(config);

    try {
        // Deploy the system
        const result = await deployer.deploy();

        // Verify deployment
        const isValid = await deployer.verifyDeployment(result);
        
        if (isValid) {
            console.log('\n🎉 Deployment completed successfully!');
            console.log('📊 Summary:');
            console.log(`   Network: ${result.config.network}`);
            console.log(`   Gas Used: ${result.gasUsed.toLocaleString()}`);
            console.log(`   Timestamp: ${new Date(result.timestamp).toISOString()}`);
            console.log(`   Deployment Hash: ${result.deploymentHash}`);
        } else {
            console.log('\n⚠️  Deployment completed but verification failed!');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n💥 Deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment if this script is executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { FeeSystemDeployer, DeploymentConfig, DeploymentResult };
