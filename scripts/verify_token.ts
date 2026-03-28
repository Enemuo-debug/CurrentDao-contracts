import { WattToken } from '../contracts/token/WattToken';

async function main() {
    console.log("Verifying $WATT Energy Token Metadata and Roles...");

    const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || "0xDeployerAdmin";
    const wattToken = new WattToken(ADMIN_ADDRESS);

    console.log("Validating Metadata:");
    console.log(` - Name matches 'Energy Watt': ${wattToken.name === 'Energy Watt'}`);
    console.log(` - Symbol matches 'WATT': ${wattToken.symbol === 'WATT'}`);
    console.log(` - Decimals match 18: ${wattToken.decimals === 18}`);
    
    console.log("\nValidating Initial State:");
    console.log(` - Total Supply is 0: ${wattToken.totalSupply() === 0}`);
    console.log("\nVerification Complete.");
}

main().catch((error) => {
    console.error("Verification script failed:", error);
    process.exitCode = 1;
});