import { PriceOracle } from '../contracts/oracle/PriceOracle';
import { OracleMetadata } from '../contracts/oracle/interfaces/IPriceOracle';
import { DeviationThreshold } from '../contracts/oracle/structures/OracleStructure';
import { Address, u64 } from '../contracts/oracle/structures/OracleStructure';

// Deployment configuration
const DEPLOYMENT_CONFIG = {
    owner: "0xOwnerAddress", // Replace with actual owner address
    network: "testnet", // or "mainnet"
    gasLimit: 5000000,
    gasPrice: 1000000000, // 1 gwei
};

// Oracle configurations
const ORACLE_CONFIGS = [
    {
        address: "0xOracle1Address",
        metadata: {
            name: "Energy Price Oracle 1",
            description: "Primary energy price feed from renewable sources",
            website: "https://energy-oracle-1.com",
            contact: "oracle1@energy-oracle.com",
            fee: 100,
            minDelay: 60,
            supportedAssets: ["0xEnergyAssetToken"]
        } as OracleMetadata
    },
    {
        address: "0xOracle2Address", 
        metadata: {
            name: "Energy Price Oracle 2",
            description: "Secondary energy price feed with market data",
            website: "https://energy-oracle-2.com",
            contact: "oracle2@energy-oracle.com",
            fee: 150,
            minDelay: 120,
            supportedAssets: ["0xEnergyAssetToken"]
        } as OracleMetadata
    },
    {
        address: "0xOracle3Address",
        metadata: {
            name: "Energy Price Oracle 3",
            description: "Tertiary energy price feed for validation",
            website: "https://energy-oracle-3.com",
            contact: "oracle3@energy-oracle.com",
            fee: 200,
            minDelay: 180,
            supportedAssets: ["0xEnergyAssetToken"]
        } as OracleMetadata
    }
];

// Deviation thresholds for different assets
const DEVIATION_THRESHOLDS = [
    {
        assetId: "0xEnergyAssetToken",
        threshold: new DeviationThreshold(
            "0xEnergyAssetToken",
            500, // 5% max deviation
            3600, // 1 hour window
            3 // minimum samples
        )
    }
];

/**
 * Main deployment function
 */
async function deployPriceOracle(): Promise<void> {
    console.log("🚀 Starting Price Oracle deployment...");
    console.log(`📍 Network: ${DEPLOYMENT_CONFIG.network}`);
    console.log(`👤 Owner: ${DEPLOYMENT_CONFIG.owner}`);
    
    try {
        // Step 1: Deploy the PriceOracle contract
        console.log("\n📦 Deploying PriceOracle contract...");
        const priceOracle = new PriceOracle(DEPLOYMENT_CONFIG.owner as Address);
        console.log("✅ PriceOracle contract deployed successfully");
        
        // Step 2: Register oracles
        console.log("\n📝 Registering oracles...");
        for (const config of ORACLE_CONFIGS) {
            try {
                priceOracle.registerOracle(config.address as Address, config.metadata);
                console.log(`✅ Oracle registered: ${config.metadata.name} (${config.address})`);
            } catch (error) {
                console.error(`❌ Failed to register oracle ${config.address}:`, error);
                throw error;
            }
        }
        
        // Step 3: Set deviation thresholds
        console.log("\n⚙️ Setting deviation thresholds...");
        for (const { assetId, threshold } of DEVIATION_THRESHOLDS) {
            try {
                priceOracle.setDeviationThreshold(assetId as Address, threshold);
                console.log(`✅ Deviation threshold set for asset: ${assetId}`);
            } catch (error) {
                console.error(`❌ Failed to set deviation threshold for ${assetId}:`, error);
                throw error;
            }
        }
        
        // Step 4: Verify deployment
        console.log("\n🔍 Verifying deployment...");
        await verifyDeployment(priceOracle);
        
        // Step 5: Display deployment summary
        displayDeploymentSummary(priceOracle);
        
        console.log("\n🎉 Price Oracle deployment completed successfully!");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }
}

/**
 * Verify that the deployment was successful
 */
async function verifyDeployment(priceOracle: PriceOracle): Promise<void> {
    try {
        // Check active oracles
        const activeOracles = priceOracle.getActiveOracles();
        console.log(`📊 Active oracles: ${activeOracles.length}`);
        
        if (activeOracles.length !== ORACLE_CONFIGS.length) {
            throw new Error(`Expected ${ORACLE_CONFIGS.length} active oracles, got ${activeOracles.length}`);
        }
        
        // Check oracle info for each registered oracle
        for (const config of ORACLE_CONFIGS) {
            const oracleInfo = priceOracle.getOracleInfo(config.address as Address);
            console.log(`🔍 Oracle ${config.metadata.name}:`);
            console.log(`   - Active: ${oracleInfo.isActive}`);
            console.log(`   - Reputation: ${oracleInfo.reputation}`);
            console.log(`   - Total Submissions: ${oracleInfo.totalSubmissions}`);
        }
        
        console.log("✅ Deployment verification passed");
        
    } catch (error) {
        console.error("❌ Deployment verification failed:", error);
        throw error;
    }
}

/**
 * Display a summary of the deployment
 */
function displayDeploymentSummary(priceOracle: PriceOracle): void {
    console.log("\n📋 Deployment Summary");
    console.log("==================");
    console.log(`Contract Owner: ${DEPLOYMENT_CONFIG.owner}`);
    console.log(`Network: ${DEPLOYMENT_CONFIG.network}`);
    console.log(`Total Oracles Registered: ${ORACLE_CONFIGS.length}`);
    console.log(`Assets Configured: ${DEVIATION_THRESHOLDS.length}`);
    
    console.log("\n📝 Oracle Details:");
    ORACLE_CONFIGS.forEach((config, index) => {
        const oracleInfo = priceOracle.getOracleInfo(config.address as Address);
        console.log(`${index + 1}. ${config.metadata.name}`);
        console.log(`   Address: ${config.address}`);
        console.log(`   Fee: ${config.metadata.fee} wei`);
        console.log(`   Min Delay: ${config.metadata.minDelay} seconds`);
        console.log(`   Reputation: ${oracleInfo.reputation}`);
        console.log(`   Status: ${oracleInfo.isActive ? 'Active' : 'Inactive'}`);
    });
    
    console.log("\n⚙️ Deviation Thresholds:");
    DEVIATION_THRESHOLDS.forEach(({ assetId, threshold }) => {
        console.log(`Asset: ${assetId}`);
        console.log(`   Max Deviation: ${threshold.maxDeviationPercent / 100}%`);
        console.log(`   Window Size: ${threshold.windowSize} seconds`);
        console.log(`   Min Samples: ${threshold.minSamples}`);
    });
}

/**
 * Deploy to testnet
 */
async function deployToTestnet(): Promise<void> {
    console.log("🧪 Deploying to testnet...");
    
    // Override config for testnet
    DEPLOYMENT_CONFIG.network = "testnet";
    DEPLOYMENT_CONFIG.gasPrice = 1000000000; // 1 gwei
    
    await deployPriceOracle();
}

/**
 * Deploy to mainnet
 */
async function deployToMainnet(): Promise<void> {
    console.log("🚀 Deploying to mainnet...");
    
    // Override config for mainnet
    DEPLOYMENT_CONFIG.network = "mainnet";
    DEPLOYMENT_CONFIG.gasPrice = 20000000000; // 20 gwei
    DEPLOYMENT_CONFIG.gasLimit = 8000000;
    
    // Additional safety checks for mainnet
    console.log("⚠️ Mainnet deployment safety checks:");
    console.log("1. Verify owner address is correct");
    console.log("2. Verify oracle addresses are correct");
    console.log("3. Verify gas price is reasonable");
    console.log("4. Verify all configurations are production-ready");
    
    const proceed = await confirmDeployment();
    if (!proceed) {
        console.log("❌ Mainnet deployment cancelled");
        return;
    }
    
    await deployPriceOracle();
}

/**
 * Interactive confirmation for mainnet deployment
 */
async function confirmDeployment(): Promise<boolean> {
    // In a real implementation, this would be an interactive prompt
    // For now, we'll just log and return true
    console.log("⚠️ Please review the configuration carefully before proceeding.");
    console.log("Type 'confirm' to proceed with mainnet deployment");
    
    return true; // Auto-confirm for this example
}

/**
 * Update oracle configurations
 */
async function updateOracleConfigurations(): Promise<void> {
    console.log("🔄 Updating oracle configurations...");
    
    const priceOracle = new PriceOracle(DEPLOYMENT_CONFIG.owner as Address);
    
    // Example: Update oracle reputation
    for (const config of ORACLE_CONFIGS) {
        try {
            priceOracle.updateOracleReputation(config.address as Address, 10);
            console.log(`✅ Updated reputation for ${config.metadata.name}`);
        } catch (error) {
            console.error(`❌ Failed to update reputation for ${config.metadata.name}:`, error);
        }
    }
    
    console.log("✅ Oracle configurations updated");
}

/**
 * Health check function
 */
async function healthCheck(): Promise<void> {
    console.log("🏥 Performing health check...");
    
    try {
        const priceOracle = new PriceOracle(DEPLOYMENT_CONFIG.owner as Address);
        
        // Check if contract is accessible
        const activeOracles = priceOracle.getActiveOracles();
        console.log(`✅ Contract accessible. Active oracles: ${activeOracles.length}`);
        
        // Check each oracle
        for (const oracleAddress of activeOracles) {
            const oracleInfo = priceOracle.getOracleInfo(oracleAddress);
            console.log(`🔍 Oracle ${oracleAddress}: Active=${oracleInfo.isActive}, Reputation=${oracleInfo.reputation}`);
        }
        
        console.log("✅ Health check completed");
        
    } catch (error) {
        console.error("❌ Health check failed:", error);
        process.exit(1);
    }
}

// Command line interface
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case "deploy":
            await deployPriceOracle();
            break;
        case "deploy-testnet":
            await deployToTestnet();
            break;
        case "deploy-mainnet":
            await deployToMainnet();
            break;
        case "update":
            await updateOracleConfigurations();
            break;
        case "health":
            await healthCheck();
            break;
        default:
            console.log("Usage:");
            console.log("  npm run deploy-oracle deploy          - Deploy to default network");
            console.log("  npm run deploy-oracle deploy-testnet   - Deploy to testnet");
            console.log("  npm run deploy-oracle deploy-mainnet   - Deploy to mainnet");
            console.log("  npm run deploy-oracle update           - Update oracle configurations");
            console.log("  npm run deploy-oracle health           - Perform health check");
            process.exit(1);
    }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
}

export {
    deployPriceOracle,
    deployToTestnet,
    deployToMainnet,
    updateOracleConfigurations,
    healthCheck,
    DEPLOYMENT_CONFIG,
    ORACLE_CONFIGS,
    DEVIATION_THRESHOLDS
};
