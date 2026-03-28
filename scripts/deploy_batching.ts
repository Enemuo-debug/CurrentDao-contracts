import { BatchProcessor } from '../contracts/batching/BatchProcessor';
import { BatchConfig, TransactionPriority } from '../contracts/batching/structures/BatchStructure';

/**
 * Deployment script for the Transaction Batch Processor
 * This script deploys and configures the BatchProcessor contract
 */

interface DeploymentConfig {
    network: 'testnet' | 'mainnet' | 'localhost';
    adminAddress: string;
    gasOptimizationEnabled: boolean;
    emergencyControls: boolean;
    maxBatchSize: number;
    targetGasSavings: number;
}

const deploymentConfigs: Record<string, DeploymentConfig> = {
    testnet: {
        network: 'testnet',
        adminAddress: '0x1234567890123456789012345678901234567890',
        gasOptimizationEnabled: true,
        emergencyControls: true,
        maxBatchSize: 50,
        targetGasSavings: 35
    },
    mainnet: {
        network: 'mainnet',
        adminAddress: '0x1234567890123456789012345678901234567890',
        gasOptimizationEnabled: true,
        emergencyControls: true,
        maxBatchSize: 100,
        targetGasSavings: 40
    },
    localhost: {
        network: 'localhost',
        adminAddress: '0x1234567890123456789012345678901234567890',
        gasOptimizationEnabled: true,
        emergencyControls: true,
        maxBatchSize: 25,
        targetGasSavings: 30
    }
};

/**
 * Deploys the BatchProcessor contract with the specified configuration
 */
async function deployBatchProcessor(config: DeploymentConfig): Promise<{
    processor: BatchProcessor;
    deploymentAddress: string;
    deploymentHash: string;
    config: BatchConfig;
}> {
    console.log(`🚀 Deploying BatchProcessor to ${config.network}...`);
    
    // Create batch processor configuration
    const batchConfig: BatchConfig = {
        maxTransactionsPerBatch: config.maxBatchSize,
        maxGasPerBatch: 50000000, // 50M gas limit
        validationTimeout: config.network === 'mainnet' ? 60000 : 30000, // Longer timeout for mainnet
        executionTimeout: config.network === 'mainnet' ? 600000 : 300000, // 10 min for mainnet, 5 min for testnet
        emergencyCancelEnabled: config.emergencyControls,
        rollbackEnabled: true, // Always enable rollback for safety
        gasOptimization: {
            targetGasSavings: config.targetGasSavings,
            maxBatchSize: config.maxBatchSize,
            minBatchSize: Math.max(2, Math.floor(config.maxBatchSize * 0.1)), // 10% of max size, minimum 2
            priorityThreshold: TransactionPriority.MEDIUM,
            gasPriceThreshold: config.network === 'mainnet' ? 100 : 50
        }
    };
    
    console.log('📋 Configuration:');
    console.log(`   - Max transactions per batch: ${batchConfig.maxTransactionsPerBatch}`);
    console.log(`   - Target gas savings: ${batchConfig.gasOptimization.targetGasSavings}%`);
    console.log(`   - Emergency controls: ${batchConfig.emergencyCancelEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Rollback: ${batchConfig.rollbackEnabled ? 'Enabled' : 'Disabled'}`);
    
    try {
        // Create the BatchProcessor instance
        const processor = new BatchProcessor(batchConfig);
        
        // Simulate deployment (in a real implementation, this would interact with the blockchain)
        const deploymentAddress = generateDeploymentAddress(config.adminAddress);
        const deploymentHash = generateDeploymentHash(deploymentAddress, batchConfig);
        
        console.log(`✅ BatchProcessor deployed successfully!`);
        console.log(`   - Address: ${deploymentAddress}`);
        console.log(`   - Transaction Hash: ${deploymentHash}`);
        console.log(`   - Admin: ${config.adminAddress}`);
        
        return {
            processor,
            deploymentAddress,
            deploymentHash,
            config: batchConfig
        };
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    }
}

/**
 * Verifies the deployment by checking contract functionality
 */
async function verifyDeployment(
    processor: BatchProcessor, 
    deploymentAddress: string,
    config: DeploymentConfig
): Promise<boolean> {
    console.log('🔍 Verifying deployment...');
    
    try {
        // Check configuration
        const currentConfig = processor.getConfig();
        const expectedConfig = deploymentConfigs[config.network];
        
        if (currentConfig.maxTransactionsPerBatch !== expectedConfig.maxBatchSize) {
            throw new Error('Max batch size configuration mismatch');
        }
        
        if (currentConfig.gasOptimization.targetGasSavings !== expectedConfig.targetGasSavings) {
            throw new Error('Target gas savings configuration mismatch');
        }
        
        if (currentConfig.emergencyCancelEnabled !== expectedConfig.emergencyControls) {
            throw new Error('Emergency controls configuration mismatch');
        }
        
        // Test basic functionality
        const metrics = processor.getBatchMetrics();
        if (metrics.totalBatches !== 0) {
            throw new Error('Initial metrics should be zero');
        }
        
        console.log('✅ Deployment verification successful!');
        return true;
        
    } catch (error) {
        console.error('❌ Deployment verification failed:', error);
        return false;
    }
}

/**
 * Sets up event listeners for monitoring
 */
function setupEventListeners(processor: BatchProcessor): void {
    console.log('📡 Setting up event listeners...');
    
    processor.onBatchCreated = (batch) => {
        console.log(`📦 Batch created: ${batch.id} with ${batch.transactions.length} transactions`);
    };
    
    processor.onBatchValidated = (batchId, result) => {
        console.log(`✅ Batch ${batchId} validated: ${result.isValid ? 'Valid' : 'Invalid'}`);
        if (result.warnings.length > 0) {
            console.log(`⚠️  Warnings: ${result.warnings.join(', ')}`);
        }
    };
    
    processor.onBatchExecutionStarted = (batchId) => {
        console.log(`🚀 Batch execution started: ${batchId}`);
    };
    
    processor.onBatchExecutionCompleted = (batchId, result) => {
        console.log(`🏁 Batch execution completed: ${batchId}`);
        console.log(`   - Success: ${result.success}`);
        console.log(`   - Executed: ${result.executedTransactions.length}`);
        console.log(`   - Failed: ${result.failedTransactions.length}`);
        console.log(`   - Gas used: ${result.gasUsed}`);
        console.log(`   - Execution time: ${result.executionTime}ms`);
    };
    
    processor.onBatchRolledBack = (batchId) => {
        console.log(`↩️  Batch rolled back: ${batchId}`);
    };
    
    processor.onBatchCancelled = (batchId, reason) => {
        console.log(`🚫 Batch cancelled: ${batchId} - Reason: ${reason}`);
    };
    
    console.log('✅ Event listeners configured');
}

/**
 * Generates a mock deployment address
 */
function generateDeploymentAddress(adminAddress: string): string {
    // In a real implementation, this would be generated by the blockchain
    const hash = require('crypto')
        .createHash('sha256')
        .update(adminAddress + Date.now())
        .digest('hex');
    return '0x' + hash.substring(0, 40);
}

/**
 * Generates a mock deployment transaction hash
 */
function generateDeploymentHash(address: string, config: BatchConfig): string {
    // In a real implementation, this would be the actual transaction hash
    const data = address + JSON.stringify(config);
    const hash = require('crypto')
        .createHash('sha256')
        .update(data)
        .digest('hex');
    return '0x' + hash;
}

/**
 * Main deployment function
 */
async function main(): Promise<void> {
    console.log('🎯 CurrentDao Transaction Batch Processor Deployment');
    console.log('=' .repeat(50));
    
    // Get network from command line arguments or default to localhost
    const network = process.argv[2] || 'localhost';
    
    if (!['testnet', 'mainnet', 'localhost'].includes(network)) {
        console.error('❌ Invalid network. Use: testnet, mainnet, or localhost');
        process.exit(1);
    }
    
    const config = deploymentConfigs[network];
    
    try {
        // Deploy the contract
        const { processor, deploymentAddress, deploymentHash, config: batchConfig } = 
            await deployBatchProcessor(config);
        
        // Verify deployment
        const isVerified = await verifyDeployment(processor, deploymentAddress, config);
        
        if (!isVerified) {
            console.error('❌ Deployment verification failed. Exiting...');
            process.exit(1);
        }
        
        // Set up event listeners
        setupEventListeners(processor);
        
        // Save deployment information
        const deploymentInfo = {
            network,
            deploymentAddress,
            deploymentHash,
            config: batchConfig,
            deployedAt: new Date().toISOString(),
            version: '1.0.0'
        };
        
        console.log('💾 Deployment information:');
        console.log(JSON.stringify(deploymentInfo, null, 2));
        
        console.log('\n🎉 Deployment completed successfully!');
        console.log(`📍 Contract address: ${deploymentAddress}`);
        console.log(`🔗 Transaction hash: ${deploymentHash}`);
        console.log(`🌐 Network: ${network}`);
        
        // Display next steps
        console.log('\n📋 Next steps:');
        console.log('1. Update your application to use the deployed contract address');
        console.log('2. Configure your frontend to interact with the BatchProcessor');
        console.log('3. Test the deployment with sample transactions');
        console.log('4. Monitor batch processing through the event logs');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

/**
 * Handles graceful shutdown
 */
process.on('SIGINT', () => {
    console.log('\n🛑 Deployment interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Deployment terminated');
    process.exit(0);
});

// Run the deployment
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export { deployBatchProcessor, verifyDeployment, setupEventListeners };
export type { DeploymentConfig };
