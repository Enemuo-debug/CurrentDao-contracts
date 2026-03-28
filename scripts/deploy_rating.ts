import { QualityRating } from '../contracts/rating/QualityRating';
import { 
    OracleMetadataImpl,
    RatingConfigImpl,
    RatingWeightsImpl,
    RatingThresholdsImpl,
    DisputeConfigImpl,
    OracleConfigImpl
} from '../contracts/rating/structures/RatingStructure';
import { AggregationMethod } from '../contracts/rating/interfaces/IQualityRating';

/**
 * Deployment script for Quality Rating System
 * Deploys and configures the energy quality rating contract
 */

interface DeploymentConfig {
    network: 'development' | 'testnet' | 'mainnet';
    owner: string;
    initialOracles: OracleConfig[];
    enableAdvancedFeatures: boolean;
    gasOptimization: boolean;
}

interface OracleConfig {
    address: string;
    metadata: {
        name: string;
        description: string;
        website: string;
        contact: string;
        fee: string;
        reputation: string;
        specialization: string[];
        certification: string;
    };
}

export class QualityRatingDeployer {
    private config: DeploymentConfig;
    private contract: QualityRating | null = null;
    private deploymentHash: string = '';
    private deploymentTimestamp: number = 0;

    constructor(config: DeploymentConfig) {
        this.config = config;
    }

    /**
     * Deploy the Quality Rating contract
     */
    async deploy(): Promise<QualityRating> {
        console.log(`🚀 Deploying Quality Rating System to ${this.config.network}...`);
        
        try {
            // Create contract instance
            this.contract = new QualityRating(this.config.owner);
            
            // Configure the contract
            await this.configureContract();
            
            // Register initial oracles
            await this.registerInitialOracles();
            
            // Verify deployment
            await this.verifyDeployment();
            
            console.log('✅ Quality Rating System deployed successfully!');
            return this.contract;
            
        } catch (error) {
            console.error('❌ Deployment failed:', error);
            throw error;
        }
    }

    /**
     * Configure contract parameters
     */
    private async configureContract(): Promise<void> {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }

        console.log('📋 Configuring contract parameters...');

        // Create rating configuration
        const weights = new RatingWeightsImpl(
            3000n, // 30% renewable
            2500n, // 25% carbon
            2000n, // 20% reliability
            1500n, // 15% efficiency
            1000n  // 10% availability
        );

        const thresholds = new RatingThresholdsImpl(
            1000n,  // 10% minimum renewable
            500n,   // 500 gCO2/kWh maximum carbon
            70n,    // 70% minimum reliability
            8000n,  // 80% minimum efficiency
            9000n,  // 90% minimum availability
            2000n   // 20% anomaly detection threshold
        );

        const disputeConfig = new DisputeConfigImpl(
            this.parseEther('0.001'), // 0.001 ETH dispute fee
            604800n,                  // 7 days max dispute duration
            1n,                       // Minimum 1 evidence required
            8000n                     // 80% auto-resolve threshold
        );

        const oracleConfig = new OracleConfigImpl(
            0n,                        // Minimum reputation
            100n,                      // Max 100 submissions per day
            true,                      // Enable signature verification
            AggregationMethod.REPUTATION_WEIGHTED
        );

        const ratingConfig = new RatingConfigImpl(
            weights,
            thresholds,
            disputeConfig,
            oracleConfig
        );

        // Apply network-specific adjustments
        this.applyNetworkSpecificConfig(ratingConfig);

        // Update contract configuration
        this.contract.updateConfig(ratingConfig);

        console.log('✅ Contract configuration applied');
    }

    /**
     * Apply network-specific configuration adjustments
     */
    private applyNetworkSpecificConfig(config: RatingConfigImpl): void {
        switch (this.config.network) {
            case 'development':
                // Development settings - more lenient
                config.thresholds.minimumRenewable = 500n;  // 5% minimum
                config.thresholds.minimumReliability = 50n; // 50% minimum
                config.oracleConfig.maxSubmissionsPerDay = 1000n;
                break;

            case 'testnet':
                // Testnet settings - moderate
                config.thresholds.minimumRenewable = 800n;  // 8% minimum
                config.thresholds.minimumReliability = 60n; // 60% minimum
                config.oracleConfig.maxSubmissionsPerDay = 200n;
                break;

            case 'mainnet':
                // Mainnet settings - strict
                config.thresholds.minimumRenewable = 1000n; // 10% minimum
                config.thresholds.minimumReliability = 70n; // 70% minimum
                config.oracleConfig.maxSubmissionsPerDay = 100n;
                config.disputeConfig.disputeFee = this.parseEther('0.01'); // Higher fee
                break;
        }

        if (this.config.gasOptimization) {
            // Enable gas optimization features
            config.oracleConfig.signatureVerification = false; // Disable for gas savings
            config.thresholds.anomalyDetectionThreshold = 3000n; // Higher threshold
        }
    }

    /**
     * Register initial oracles
     */
    private async registerInitialOracles(): Promise<void> {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }

        console.log(`🔮 Registering ${this.config.initialOracles.length} initial oracles...`);

        for (const oracleConfig of this.config.initialOracles) {
            const metadata = new OracleMetadataImpl(
                oracleConfig.metadata.name,
                oracleConfig.metadata.description,
                oracleConfig.metadata.website,
                oracleConfig.metadata.contact,
                BigInt(oracleConfig.metadata.fee),
                BigInt(oracleConfig.metadata.reputation),
                oracleConfig.metadata.specialization,
                oracleConfig.metadata.certification
            );

            this.contract.registerQualityOracle(oracleConfig.address, metadata);
            console.log(`✅ Registered oracle: ${oracleConfig.metadata.name} (${oracleConfig.address})`);
        }
    }

    /**
     * Verify deployment
     */
    private async verifyDeployment(): Promise<void> {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }

        console.log('🔍 Verifying deployment...');

        // Check contract state
        const activeOracles = this.contract.getActiveQualityOracles();
        const config = this.contract.getConfig();

        // Verify oracles
        if (activeOracles.length !== this.config.initialOracles.length) {
            throw new Error(`Oracle count mismatch: expected ${this.config.initialOracles.length}, got ${activeOracles.length}`);
        }

        // Verify configuration
        if (!config.validate()) {
            throw new Error('Invalid configuration detected');
        }

        // Generate deployment hash
        this.deploymentHash = this.generateDeploymentHash();
        this.deploymentTimestamp = Date.now();

        console.log('✅ Deployment verified successfully');
        console.log(`📋 Deployment Hash: ${this.deploymentHash}`);
    }

    /**
     * Generate deployment hash for verification
     */
    private generateDeploymentHash(): string {
        const deploymentData = {
            network: this.config.network,
            owner: this.config.owner,
            oracles: this.config.initialOracles.length,
            timestamp: Date.now()
        };

        // Simple hash generation (in production, use proper cryptographic hash)
        return Buffer.from(JSON.stringify(deploymentData)).toString('base64').slice(0, 16);
    }

    /**
     * Get deployment information
     */
    getDeploymentInfo(): {
        contract: QualityRating | null;
        hash: string;
        timestamp: number;
        network: string;
        oracles: number;
    } {
        return {
            contract: this.contract,
            hash: this.deploymentHash,
            timestamp: this.deploymentTimestamp,
            network: this.config.network,
            oracles: this.config.initialOracles.length
        };
    }

    /**
     * Verify deployment after the fact
     */
    async verifyDeploymentAfterDeploy(
        contract: QualityRating,
        config: RatingConfigImpl,
        deploymentHash: string,
        timestamp: number,
        gasUsed: number = 0
    ): Promise<boolean> {
        try {
            console.log('🔍 Verifying existing deployment...');

            // Check configuration validity
            if (!config.validate()) {
                console.error('❌ Invalid configuration');
                return false;
            }

            // Check deployment age (should be recent)
            const age = Date.now() - timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (age > maxAge) {
                console.warn('⚠️ Deployment is quite old, verification may be less reliable');
            }

            // Check gas usage (if provided)
            if (gasUsed > 0) {
                const maxGas = 5000000; // 5M gas limit
                if (gasUsed > maxGas) {
                    console.warn('⚠️ High gas usage detected');
                }
            }

            console.log('✅ Deployment verification successful');
            return true;

        } catch (error) {
            console.error('❌ Deployment verification failed:', error);
            return false;
        }
    }

    /**
     * Parse ether string to wei
     */
    private parseEther(ether: string): bigint {
        return BigInt(parseFloat(ether) * 1e18);
    }

    /**
     * Get gas estimation for deployment
     */
    async estimateGas(): Promise<number> {
        console.log('⛽ Estimating gas requirements...');

        let baseGas = 2000000; // Base deployment cost
        let oracleGas = this.config.initialOracles.length * 100000; // Per oracle
        let configGas = 500000; // Configuration cost

        if (this.config.enableAdvancedFeatures) {
            configGas += 300000; // Additional features cost
        }

        if (this.config.gasOptimization) {
            baseGas = Math.floor(baseGas * 0.8); // 20% reduction
            oracleGas = Math.floor(oracleGas * 0.9); // 10% reduction
        }

        const totalGas = baseGas + oracleGas + configGas;

        console.log(`⛽ Estimated gas requirement: ${totalGas.toLocaleString()} units`);
        return totalGas;
    }

    /**
     * Print deployment summary
     */
    printSummary(): void {
        console.log('\n📊 Deployment Summary');
        console.log('=====================');
        console.log(`Network: ${this.config.network}`);
        console.log(`Owner: ${this.config.owner}`);
        console.log(`Oracles: ${this.config.initialOracles.length}`);
        console.log(`Advanced Features: ${this.config.enableAdvancedFeatures}`);
        console.log(`Gas Optimization: ${this.config.gasOptimization}`);
        
        if (this.deploymentHash) {
            console.log(`Deployment Hash: ${this.deploymentHash}`);
            console.log(`Deployment Time: ${new Date(this.deploymentTimestamp).toISOString()}`);
        }
        
        console.log('=====================\n');
    }
}

// Pre-configured deployment scenarios
export const DEPLOYMENT_SCENARIOS = {
    development: {
        network: 'development' as const,
        owner: '0x1234567890123456789012345678901234567890',
        initialOracles: [
            {
                address: '0x1111111111111111111111111111111111111111',
                metadata: {
                    name: 'Development Oracle 1',
                    description: 'Test oracle for development',
                    website: 'https://dev-oracle1.com',
                    contact: 'dev1@oracle.com',
                    fee: '0',
                    reputation: '100',
                    specialization: ['energy', 'quality', 'testing'],
                    certification: 'DEV-CERT-001'
                }
            },
            {
                address: '0x2222222222222222222222222222222222222222',
                metadata: {
                    name: 'Development Oracle 2',
                    description: 'Test oracle for development',
                    website: 'https://dev-oracle2.com',
                    contact: 'dev2@oracle.com',
                    fee: '0',
                    reputation: '100',
                    specialization: ['energy', 'quality', 'testing'],
                    certification: 'DEV-CERT-002'
                }
            }
        ],
        enableAdvancedFeatures: true,
        gasOptimization: false
    },

    testnet: {
        network: 'testnet' as const,
        owner: '0x1234567890123456789012345678901234567890',
        initialOracles: [
            {
                address: '0x3333333333333333333333333333333333333333',
                metadata: {
                    name: 'Testnet Oracle 1',
                    description: 'Production-like oracle for testing',
                    website: 'https://testnet-oracle1.com',
                    contact: 'testnet1@oracle.com',
                    fee: '1000000000000000', // 0.001 ETH
                    reputation: '500',
                    specialization: ['energy', 'quality', 'renewable'],
                    certification: 'ISO-9001'
                }
            }
        ],
        enableAdvancedFeatures: true,
        gasOptimization: true
    },

    mainnet: {
        network: 'mainnet' as const,
        owner: '0x1234567890123456789012345678901234567890',
        initialOracles: [
            {
                address: '0x4444444444444444444444444444444444444444',
                metadata: {
                    name: 'Mainnet Oracle 1',
                    description: 'Production oracle for main energy sources',
                    website: 'https://mainnet-oracle1.com',
                    contact: 'mainnet1@oracle.com',
                    fee: '10000000000000000', // 0.01 ETH
                    reputation: '1000',
                    specialization: ['energy', 'quality', 'renewable', 'carbon'],
                    certification: 'ISO-14001'
                }
            },
            {
                address: '0x5555555555555555555555555555555555555555',
                metadata: {
                    name: 'Mainnet Oracle 2',
                    description: 'Production oracle for grid energy',
                    website: 'https://mainnet-oracle2.com',
                    contact: 'mainnet2@oracle.com',
                    fee: '10000000000000000', // 0.01 ETH
                    reputation: '1000',
                    specialization: ['energy', 'quality', 'grid', 'reliability'],
                    certification: 'ISO-50001'
                }
            }
        ],
        enableAdvancedFeatures: true,
        gasOptimization: true
    }
};

// CLI helper function
export async function deployRatingSystem(network: string = 'development'): Promise<QualityRating> {
    const scenario = DEPLOYMENT_SCENARIOS[network as keyof typeof DEPLOYMENT_SCENARIOS];
    
    if (!scenario) {
        throw new Error(`Unknown deployment scenario: ${network}`);
    }

    console.log(`🚀 Starting deployment for ${network} network...`);
    
    const deployer = new QualityRatingDeployer(scenario);
    const gasEstimate = await deployer.estimateGas();
    console.log(`⛽ Estimated gas: ${gasEstimate.toLocaleString()} units`);
    
    const contract = await deployer.deploy();
    deployer.printSummary();
    
    return contract;
}

// Export for use in other scripts
export { QualityRatingDeployer };
