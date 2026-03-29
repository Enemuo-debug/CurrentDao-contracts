import { GovernanceAnalytics } from '../contracts/analytics/GovernanceAnalytics';
import { Governance } from '../contracts/dao/Governance';
import { WattToken } from '../contracts/token/WattToken';

/**
 * Script to deploy and initialize governance analytics.
 */
async function deploy() {
    console.log("🚀 Starting Governance Analytics Deployment...");

    const deployer = "0xDeployer";
    
    // 1. Deploy WATT Token
    const wattToken = new WattToken(deployer);
    console.log(`✅ WATT Token initialized.`);

    // 2. Deploy Governance
    const governance = new Governance(wattToken, deployer);
    console.log(`✅ Governance contract initialized.`);

    // 3. Deploy Analytics
    const analytics = new GovernanceAnalytics(governance);
    console.log(`📊 Governance Analytics contract initialized and linked to Governance.`);

    console.log("✨ Governance Analytics Deployment Complete!");
    return { wattToken, governance, analytics };
}

deploy().catch(console.error);
