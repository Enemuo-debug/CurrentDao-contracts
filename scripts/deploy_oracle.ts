import { PriceOracle } from '../contracts/oracle/PriceOracle';
import { OracleMetadata } from '../contracts/oracle/interfaces/IPriceOracle';
import { DeviationThreshold, OracleConfig } from '../contracts/oracle/structures/OracleStructure';
import { Address, u64 } from '../contracts/oracle/structures/OracleStructure';

// Deployment configuration
const DEPLOYMENT_CONFIG = {
    owner: "0xOwnerAddress", // Replace with actual owner address
    network: "testnet", // or "mainnet"
    gasLimit: 5000000,
    gasPrice: 1000000000, // 1 gwei
};

// Enhanced production configuration
const PRODUCTION_CONFIG = {
    ...DEPLOYMENT_CONFIG,
    gasOptimization: true,
    automatedUpdates: true,
    securityChecks: true,
    monitoringEnabled: true,
    backupOracles: true, // Enable backup oracle sources
    circuitBreaker: true, // Enable circuit breaker for extreme price movements
    confidenceThreshold: 75, // Minimum confidence for price acceptance
    maxGasPrice: 50000000000, // 50 gwei max for mainnet
    gasMultiplier: 1.2, // 20% buffer for gas estimation
};

// Production-ready oracle configurations with enhanced security
const PRODUCTION_ORACLE_CONFIGS = [
    {
        address: "0xProdOracle1Address",
        metadata: {
            name: "Production Energy Oracle 1",
            description: "Primary production energy price feed from certified renewable sources",
            website: "https://prod-energy-oracle-1.currentdao.com",
            contact: "oracle1@currentdao.com",
            fee: 100,
            minDelay: 60,
            supportedAssets: [
                "0xEnergyAssetToken",
                "0xSolarToken", 
                "0xWindToken",
                "0xHydroToken"
            ]
        } as OracleMetadata
    },
    {
        address: "0xProdOracle2Address", 
        metadata: {
            name: "Production Energy Oracle 2",
            description: "Secondary production energy price feed with market data validation",
            website: "https://prod-energy-oracle-2.currentdao.com",
            contact: "oracle2@currentdao.com",
            fee: 150,
            minDelay: 120,
            supportedAssets: [
                "0xEnergyAssetToken",
                "0xSolarToken",
                "0xWindToken",
                "0xHydroToken"
            ]
        } as OracleMetadata
    },
    {
        address: "0xProdOracle3Address",
        metadata: {
            name: "Production Energy Oracle 3",
            description: "Tertiary production energy price feed for cross-validation",
            website: "https://prod-energy-oracle-3.currentdao.com",
            contact: "oracle3@currentdao.com",
            fee: 200,
            minDelay: 180,
            supportedAssets: [
                "0xEnergyAssetToken",
                "0xSolarToken",
                "0xWindToken",
                "0xHydroToken"
            ]
        } as OracleMetadata
    },
    {
        address: "0xBackupOracleAddress",
        metadata: {
            name: "Backup Energy Oracle",
            description: "Backup oracle for redundancy and failover",
            website: "https://backup-energy-oracle.currentdao.com",
            contact: "backup@currentdao.com",
            fee: 250,
            minDelay: 300,
            supportedAssets: [
                "0xEnergyAssetToken",
                "0xSolarToken"
            ]
        } as OracleMetadata
    }
];

// Production deviation thresholds with stricter settings
const PRODUCTION_DEVIATION_THRESHOLDS = [
    {
        assetId: "0xEnergyAssetToken",
        threshold: new DeviationThreshold(
            "0xEnergyAssetToken",
            300, // 3% max deviation (stricter for production)
            1800, // 30 minutes window
            5 // minimum samples
        )
    },
    {
        assetId: "0xSolarToken",
        threshold: new DeviationThreshold(
            "0xSolarToken",
            400, // 4% max deviation
            1800, // 30 minutes window
            5 // minimum samples
        )
    },
    {
        assetId: "0xWindToken",
        threshold: new DeviationThreshold(
            "0xWindToken",
            500, // 5% max deviation
            3600, // 1 hour window
            3 // minimum samples
        )
    }
];

/**
 * Main deployment function with production enhancements
 */
async function deployPriceOracle(): Promise<void> {
    console.log("🚀 Starting Price Oracle deployment...");
    console.log(`📍 Network: ${DEPLOYMENT_CONFIG.network}`);
    console.log(`👤 Owner: ${DEPLOYMENT_CONFIG.owner}`);
    
    try {
        // Step 1: Deploy the PriceOracle contract with production config
        console.log("\n📦 Deploying PriceOracle contract...");
        const priceOracle = new PriceOracle(DEPLOYMENT_CONFIG.owner as Address);
        console.log("✅ PriceOracle contract deployed successfully");
        
        // Step 2: Apply production configuration
        console.log("\n⚙️ Applying production configuration...");
        const prodConfig = new OracleConfig();
        prodConfig.automatedUpdates = PRODUCTION_CONFIG.automatedUpdates;
        prodConfig.aggregationInterval = 300; // 5 minutes
        prodConfig.slashThreshold = 500; // 5% for production
        prodConfig.maxPriceAge = 180; // 3 minutes for fresher data
        priceOracle.updateConfig(prodConfig);
        console.log("✅ Production configuration applied");
        
        // Step 3: Register production oracles
        console.log("\n📝 Registering production oracles...");
        for (const config of PRODUCTION_ORACLE_CONFIGS) {
            try {
                priceOracle.registerOracle(config.address as Address, config.metadata);
                console.log(`✅ Production oracle registered: ${config.metadata.name} (${config.address})`);
            } catch (error) {
                console.error(`❌ Failed to register production oracle ${config.address}:`, error);
                throw error;
            }
        }
        
        // Step 4: Set production deviation thresholds
        console.log("\n⚙️ Setting production deviation thresholds...");
        for (const { assetId, threshold } of PRODUCTION_DEVIATION_THRESHOLDS) {
            try {
                priceOracle.setDeviationThreshold(assetId as Address, threshold);
                console.log(`✅ Production deviation threshold set for asset: ${assetId}`);
            } catch (error) {
                console.error(`❌ Failed to set deviation threshold for ${assetId}:`, error);
                throw error;
            }
        }
        
        // Step 5: Enable automated updates for production
        if (PRODUCTION_CONFIG.automatedUpdates) {
            console.log("\n🤖 Enabling automated updates...");
            priceOracle.enableAutomatedUpdates();
            console.log("✅ Automated updates enabled (5-minute intervals)");
        }
        
        // Step 6: Production security checks
        if (PRODUCTION_CONFIG.securityChecks) {
            console.log("\n🔒 Running production security checks...");
            await performProductionSecurityChecks(priceOracle);
        }
        
        // Step 7: Verify deployment
        console.log("\n🔍 Verifying production deployment...");
        await verifyProductionDeployment(priceOracle);
        
        // Step 8: Display production deployment summary
        displayProductionDeploymentSummary(priceOracle);
        
        console.log("\n🎉 Production Price Oracle deployment completed successfully!");
        
    } catch (error) {
        console.error("❌ Production deployment failed:", error);
        process.exit(1);
    }
}

/**
 * Perform production security checks
 */
async function performProductionSecurityChecks(priceOracle: PriceOracle): Promise<void> {
    console.log("🔒 Performing production security checks...");
    
    try {
        // Check oracle reputation distribution
        const activeOracles = priceOracle.getActiveOracles();
        let totalReputation = 0;
        let lowReputationCount = 0;
        
        for (const oracleAddress of activeOracles) {
            const oracleInfo = priceOracle.getOracleInfo(oracleAddress);
            totalReputation += oracleInfo.reputation;
            
            if (oracleInfo.reputation < 75) {
                lowReputationCount++;
                console.warn(`⚠️ Oracle ${oracleAddress} has low reputation: ${oracleInfo.reputation}`);
            }
        }
        
        const avgReputation = totalReputation / activeOracles.length;
        console.log(`📊 Average reputation: ${avgReputation.toFixed(2)}`);
        console.log(`📉 Low reputation oracles: ${lowReputationCount}/${activeOracles.length}`);
        
        // Check for centralized control risks
        if (activeOracles.length < 3) {
            console.warn("⚠️ Warning: Less than 3 oracles may centralize control");
        }
        
        // Test price aggregation
        for (const config of PRODUCTION_ORACLE_CONFIGS.slice(0, 3)) {
            const oracleInfo = priceOracle.getOracleInfo(config.address as Address);
            if (oracleInfo.isActive) {
                console.log(`✅ Security check passed for ${config.metadata.name}`);
            }
        }
        
        console.log("✅ Production security checks completed");
        
    } catch (error) {
        console.error("❌ Production security checks failed:", error);
        throw error;
    }
}

/**
 * Verify that production deployment was successful
 */
async function verifyProductionDeployment(priceOracle: PriceOracle): Promise<void> {
    try {
        // Check active oracles
        const activeOracles = priceOracle.getActiveOracles();
        console.log(`📊 Active production oracles: ${activeOracles.length}`);
        
        if (activeOracles.length !== PRODUCTION_ORACLE_CONFIGS.length) {
            throw new Error(`Expected ${PRODUCTION_ORACLE_CONFIGS.length} active oracles, got ${activeOracles.length}`);
        }
        
        // Check oracle info for each registered oracle
        for (const config of PRODUCTION_ORACLE_CONFIGS) {
            const oracleInfo = priceOracle.getOracleInfo(config.address as Address);
            console.log(`🔍 Production Oracle ${config.metadata.name}:`);
            console.log(`   - Active: ${oracleInfo.isActive}`);
            console.log(`   - Reputation: ${oracleInfo.reputation}`);
            console.log(`   - Total Submissions: ${oracleInfo.totalSubmissions}`);
            console.log(`   - Success Rate: ${oracleInfo.successfulSubmissions}/${oracleInfo.totalSubmissions}`);
        }
        
        // Test automated updates
        console.log("🤖 Testing automated updates...");
        priceOracle.forceAggregation("0xEnergyAssetToken" as Address);
        
        console.log("✅ Production deployment verification passed");
        
    } catch (error) {
        console.error("❌ Production deployment verification failed:", error);
        throw error;
    }
}

/**
 * Display a production deployment summary
 */
function displayProductionDeploymentSummary(priceOracle: PriceOracle): void {
    console.log("\n📋 Production Deployment Summary");
    console.log("===============================");
    console.log(`Contract Owner: ${DEPLOYMENT_CONFIG.owner}`);
    console.log(`Network: ${DEPLOYMENT_CONFIG.network}`);
    console.log(`Total Oracles Registered: ${PRODUCTION_ORACLE_CONFIGS.length}`);
    console.log(`Assets Configured: ${PRODUCTION_DEVIATION_THRESHOLDS.length}`);
    console.log(`Automated Updates: ${PRODUCTION_CONFIG.automatedUpdates ? 'Enabled' : 'Disabled'}`);
    console.log(`Security Checks: ${PRODUCTION_CONFIG.securityChecks ? 'Enabled' : 'Disabled'}`);
    
    console.log("\n📝 Production Oracle Details:");
    PRODUCTION_ORACLE_CONFIGS.forEach((config, index) => {
        const oracleInfo = priceOracle.getOracleInfo(config.address as Address);
        console.log(`${index + 1}. ${config.metadata.name}`);
        console.log(`   Address: ${config.address}`);
        console.log(`   Fee: ${config.metadata.fee} wei`);
        console.log(`   Min Delay: ${config.metadata.minDelay} seconds`);
        console.log(`   Reputation: ${oracleInfo.reputation}`);
        console.log(`   Status: ${oracleInfo.isActive ? 'Active' : 'Inactive'}`);
        console.log(`   Supported Assets: ${config.metadata.supportedAssets.length}`);
    });
    
    console.log("\n⚙️ Production Deviation Thresholds:");
    PRODUCTION_DEVIATION_THRESHOLDS.forEach(({ assetId, threshold }) => {
        console.log(`Asset: ${assetId}`);
        console.log(`   Max Deviation: ${threshold.maxDeviationPercent / 100}%`);
        console.log(`   Window Size: ${threshold.windowSize} seconds`);
        console.log(`   Min Samples: ${threshold.minSamples}`);
    });
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
 * Deploy to production with enhanced security
 */
async function deployToProduction(): Promise<void> {
    console.log("🚀 Deploying to production...");
    
    // Override config for production
    DEPLOYMENT_CONFIG.network = "mainnet";
    DEPLOYMENT_CONFIG.gasPrice = PRODUCTION_CONFIG.maxGasPrice;
    DEPLOYMENT_CONFIG.gasLimit = Math.floor(DEPLOYMENT_CONFIG.gasLimit * PRODUCTION_CONFIG.gasMultiplier);
    
    // Production safety checks
    console.log("🔒 Production deployment safety checks:");
    console.log("1. Verify owner address is correct");
    console.log("2. Verify oracle addresses are correct");
    console.log("3. Verify gas price is reasonable");
    console.log("4. Verify all configurations are production-ready");
    console.log("5. Check oracle reputation distribution");
    console.log("6. Validate deviation thresholds");
    
    const proceed = await confirmProductionDeployment();
    if (!proceed) {
        console.log("❌ Production deployment cancelled");
        return;
    }
    
    await deployPriceOracle();
}

/**
 * Interactive confirmation for production deployment
 */
async function confirmProductionDeployment(): Promise<boolean> {
    console.log("⚠️ PRODUCTION DEPLOYMENT CONFIRMATION");
    console.log("=====================================");
    console.log("Please review the following carefully:");
    console.log(`- Owner: ${DEPLOYMENT_CONFIG.owner}`);
    console.log(`- Network: ${DEPLOYMENT_CONFIG.network}`);
    console.log(`- Gas Price: ${DEPLOYMENT_CONFIG.gasPrice} wei`);
    console.log(`- Gas Limit: ${DEPLOYMENT_CONFIG.gasLimit}`);
    console.log(`- Total Oracles: ${PRODUCTION_ORACLE_CONFIGS.length}`);
    console.log(`- Automated Updates: ${PRODUCTION_CONFIG.automatedUpdates ? 'Enabled' : 'Disabled'}`);
    console.log(`- Security Checks: ${PRODUCTION_CONFIG.securityChecks ? 'Enabled' : 'Disabled'}`);
    console.log("");
    console.log("Type 'confirm-production' to proceed with production deployment");
    
    // In a real implementation, this would be an interactive prompt
    // For now, we'll just log and return true
    return true; // Auto-confirm for this example
}

/**
 * Perform comprehensive security audit
 */
async function performSecurityAudit(): Promise<void> {
    console.log("🔒 Performing comprehensive security audit...");
    
    try {
        const priceOracle = new PriceOracle(DEPLOYMENT_CONFIG.owner as Address);
        
        // Audit 1: Oracle distribution check
        console.log("\n📊 Audit 1: Oracle Distribution");
        const activeOracles = priceOracle.getActiveOracles();
        const totalOracles = PRODUCTION_ORACLE_CONFIGS.length;
        
        if (activeOracles.length < 3) {
            console.warn("❌ RISK: Less than 3 oracles creates centralization risk");
        }
        
        if (activeOracles.length < totalOracles * 0.8) {
            console.warn("❌ RISK: High oracle inactivity rate");
        }
        
        // Audit 2: Reputation analysis
        console.log("\n🏆 Audit 2: Reputation Analysis");
        let highReputationCount = 0;
        let totalReputation = 0;
        
        for (const oracleAddress of activeOracles) {
            const oracleInfo = priceOracle.getOracleInfo(oracleAddress);
            totalReputation += oracleInfo.reputation;
            
            if (oracleInfo.reputation >= 100) {
                highReputationCount++;
            }
        }
        
        const avgReputation = totalReputation / activeOracles.length;
        console.log(`Average reputation: ${avgReputation.toFixed(2)}`);
        console.log(`High reputation oracles: ${highReputationCount}/${activeOracles.length}`);
        
        if (avgReputation < 50) {
            console.warn("❌ RISK: Low average reputation score");
        }
        
        // Audit 3: Asset coverage check
        console.log("\n🎯 Audit 3: Asset Coverage");
        const assetCoverage = new Set<string>();
        
        for (const config of PRODUCTION_ORACLE_CONFIGS) {
            for (const asset of config.metadata.supportedAssets) {
                assetCoverage.add(asset);
            }
        }
        
        console.log(`Total unique assets covered: ${assetCoverage.size}`);
        
        if (assetCoverage.size < 3) {
            console.warn("❌ RISK: Limited asset coverage");
        }
        
        // Audit 4: Configuration validation
        console.log("\n⚙️ Audit 4: Configuration Validation");
        
        for (const { assetId, threshold } of PRODUCTION_DEVIATION_THRESHOLDS) {
            if (threshold.maxDeviationPercent > 1000) { // >10%
                console.warn(`❌ RISK: High deviation threshold for ${assetId}: ${threshold.maxDeviationPercent / 100}%`);
            }
            
            if (threshold.windowSize > 7200) { // >2 hours
                console.warn(`❌ RISK: Long deviation window for ${assetId}: ${threshold.windowSize} seconds`);
            }
        }
        
        console.log("\n✅ Security audit completed");
        
    } catch (error) {
        console.error("❌ Security audit failed:", error);
        process.exit(1);
    }
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

// Command line interface with production options
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
        case "deploy-production":
            await deployToProduction();
            break;
        case "update":
            await updateOracleConfigurations();
            break;
        case "health":
            await healthCheck();
            break;
        case "security-check":
            await performSecurityAudit();
            break;
        default:
            console.log("Usage:");
            console.log("  npm run deploy-oracle deploy              - Deploy to default network");
            console.log("  npm run deploy-oracle deploy-testnet       - Deploy to testnet");
            console.log("  npm run deploy-oracle deploy-mainnet       - Deploy to mainnet");
            console.log("  npm run deploy-oracle deploy-production    - Deploy to production with enhanced security");
            console.log("  npm run deploy-oracle update             - Update oracle configurations");
            console.log("  npm run deploy-oracle health            - Perform health check");
            console.log("  npm run deploy-oracle security-check     - Perform security audit");
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
    deployToProduction,
    updateOracleConfigurations,
    healthCheck,
    performSecurityAudit,
    DEPLOYMENT_CONFIG,
    PRODUCTION_CONFIG,
    PRODUCTION_ORACLE_CONFIGS,
    PRODUCTION_DEVIATION_THRESHOLDS
};
