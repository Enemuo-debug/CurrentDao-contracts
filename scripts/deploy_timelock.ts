import { TimelockController } from '../contracts/timelock/TimelockController';

/**
 * Script to deploy and configure the Timelock controller.
 */
async function deploy() {
    console.log("🚀 Starting Timelock Deployment...");

    const deployer = "0xDeployer"; // Simplified for mock environment
    const governance = "0xGovernanceAddress"; // Address of the governance contract

    const minDelay = 2 * 24 * 60 * 60 * 1000; // 48 hours in ms
    
    // 1. Deploy Timelock
    const timelock = new TimelockController(
        minDelay, 
        [governance], // Proposers: Governance contract sets the tasks
        [governance], // Executors: Governance or independent community members
        deployer
    );

    console.log(`✅ Timelock deployed with ${minDelay/(1000*60*60)}h minimum delay.`);
    console.log(`🔒 Initial Proposer & Executor role granted to Governance: ${governance}`);

    // 2. Grant roles for community-driven execution if needed
    const communityMember = "0xCommunityAccount";
    timelock.grantRole('EXECUTOR', communityMember, deployer);
    console.log(`✅ Community executor added: ${communityMember}`);

    console.log("✨ Timelock Deployment and Configuration Complete!");
    return { timelock };
}

deploy().catch(console.error);
