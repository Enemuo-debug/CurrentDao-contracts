import { Governance } from '../contracts/dao/Governance';
import { WattToken } from '../contracts/token/WattToken';

/**
 * Script to deploy current DAO governance system.
 */
async function deploy() {
    console.log("🚀 Starting DAO Governance Deployment...");

    const deployer = "0xDeployer"; // Simplified for mock environment
    
    // 1. Deploy WATT Token
    const wattToken = new WattToken(deployer);
    console.log(`✅ WATT Token deployed at: ${wattToken.symbol}`);

    // 2. Deploy Governance contract
    const governance = new Governance(wattToken, deployer);
    console.log(`✅ Governance contract initialized with ${wattToken.name} staking.`);

    // 3. Configure parameters
    governance.setQuorum(500, deployer); // Custom quorum
    console.log("✅ Quorum set to 500 votes.");

    governance.setVotingPeriod(72 * 60 * 60 * 1000, deployer); // 3 days
    console.log("✅ Voting period set to 3 days.");

    // 4. Initial setup for DAO
    wattToken.grantMinterRole(deployer, deployer);
    wattToken.mint(deployer, "0xInitialDAOAccount", 1_000_000);
    console.log("💰 Initial WATT tokens minted for DAO.");

    console.log("✨ DAO Governance Deployment Complete!");
    return { wattToken, governance };
}

deploy().catch(console.error);
