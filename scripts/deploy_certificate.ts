import { EnergyCertificate } from '../contracts/nft/EnergyCertificate';

async function main() {
    console.log("Starting Energy Certificate Deployment...");

    // The oracle address would normally be fetched from environment variables or configuration
    const ORACLE_ADDRESS = process.env.ORACLE_ADDRESS || "0xDefaultOracleAddress";

    console.log(`Deploying with Oracle Address: ${ORACLE_ADDRESS}`);

    const energyCertificate = new EnergyCertificate(ORACLE_ADDRESS);

    console.log("EnergyCertificate Contract successfully deployed!");
    console.log("Initialization complete.");
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
});