/**
 * @title Location Registry Deployment Script
 * @dev Deployment script for the geographic location registry
 * @author CurrentDAO
 */

import { LocationRegistry } from '../contracts/location/LocationRegistry';
import { 
    LocationType, 
    PrivacyLevel,
    Coordinates,
    ZoneRestrictions,
    VerificationMethod
} from '../contracts/location/structures/LocationStructure';

// Configuration
const DEPLOY_CONFIG = {
    // Network settings
    network: 'development',
    gasLimit: 8000000,
    gasPrice: 20000000000, // 20 gwei
    
    // Admin settings
    adminAddress: '0x0000000000000000000000000000000000000000',
    
    // Default grid zones
    defaultGridZones: [
        {
            name: 'North America East',
            boundaries: [
                { latitude: 50.0, longitude: -100.0 },
                { latitude: 50.0, longitude: -60.0 },
                { latitude: 25.0, longitude: -60.0 },
                { latitude: 25.0, longitude: -100.0 }
            ],
            pricingZone: 'na_east_price',
            restrictions: {
                maxProductionCapacity: 10000000, // 10 GW
                maxConsumptionDemand: 8000000,    // 8 GW
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER, LocationType.PROSUMER],
                verificationRequired: true
            }
        },
        {
            name: 'North America West',
            boundaries: [
                { latitude: 50.0, longitude: -125.0 },
                { latitude: 50.0, longitude: -100.0 },
                { latitude: 25.0, longitude: -100.0 },
                { latitude: 25.0, longitude: -125.0 }
            ],
            pricingZone: 'na_west_price',
            restrictions: {
                maxProductionCapacity: 15000000, // 15 GW
                maxConsumptionDemand: 12000000,   // 12 GW
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER, LocationType.PROSUMER],
                verificationRequired: true
            }
        },
        {
            name: 'Europe Central',
            boundaries: [
                { latitude: 55.0, longitude: 10.0 },
                { latitude: 55.0, longitude: 25.0 },
                { latitude: 45.0, longitude: 25.0 },
                { latitude: 45.0, longitude: 10.0 }
            ],
            pricingZone: 'eu_central_price',
            restrictions: {
                maxProductionCapacity: 12000000, // 12 GW
                maxConsumptionDemand: 10000000,  // 10 GW
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER, LocationType.PROSUMER],
                verificationRequired: true
            }
        },
        {
            name: 'Asia Pacific',
            boundaries: [
                { latitude: 35.0, longitude: 110.0 },
                { latitude: 35.0, longitude: 140.0 },
                { latitude: 20.0, longitude: 140.0 },
                { latitude: 20.0, longitude: 110.0 }
            ],
            pricingZone: 'apac_price',
            restrictions: {
                maxProductionCapacity: 20000000, // 20 GW
                maxConsumptionDemand: 18000000,   // 18 GW
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER, LocationType.PROSUMER],
                verificationRequired: true
            }
        }
    ],
    
    // Default pricing zones
    defaultPricingZones: [
        {
            name: 'North America East Pricing',
            basePrice: 0.12,        // $0.12 per kWh
            peakMultiplier: 1.8,    // 80% higher during peak
            offPeakMultiplier: 0.7, // 30% lower during off-peak
            regionalAdjustment: 0.05 // 5% regional adjustment
        },
        {
            name: 'North America West Pricing',
            basePrice: 0.10,        // $0.10 per kWh
            peakMultiplier: 2.0,    // 100% higher during peak
            offPeakMultiplier: 0.6, // 40% lower during off-peak
            regionalAdjustment: 0.03 // 3% regional adjustment
        },
        {
            name: 'Europe Central Pricing',
            basePrice: 0.15,        // $0.15 per kWh
            peakMultiplier: 1.6,    // 60% higher during peak
            offPeakMultiplier: 0.8, // 20% lower during off-peak
            regionalAdjustment: 0.08 // 8% regional adjustment
        },
        {
            name: 'Asia Pacific Pricing',
            basePrice: 0.08,        // $0.08 per kWh
            peakMultiplier: 2.2,    // 120% higher during peak
            offPeakMultiplier: 0.5, // 50% lower during off-peak
            regionalAdjustment: 0.02 // 2% regional adjustment
        }
    ]
};

/**
 * Main deployment function
 */
async function deployLocationRegistry(): Promise<void> {
    console.log('🚀 Starting Location Registry deployment...');
    console.log(`📋 Network: ${DEPLOY_CONFIG.network}`);
    console.log(`⛽ Gas Limit: ${DEPLOY_CONFIG.gasLimit}`);
    console.log(`💰 Gas Price: ${DEPLOY_CONFIG.gasPrice} wei`);

    try {
        // Step 1: Deploy the Location Registry contract
        console.log('📦 Deploying Location Registry contract...');
        const locationRegistry = new LocationRegistry();
        console.log('✅ Location Registry deployed successfully!');

        // Step 2: Create default pricing zones
        console.log('💱 Creating default pricing zones...');
        const pricingZoneIds: string[] = [];
        
        for (const pricingConfig of DEPLOY_CONFIG.defaultPricingZones) {
            const pricingZoneId = await locationRegistry.createPricingZone(
                pricingConfig.name,
                pricingConfig.basePrice,
                pricingConfig.peakMultiplier,
                pricingConfig.offPeakMultiplier,
                pricingConfig.regionalAdjustment,
                DEPLOY_CONFIG.adminAddress
            );
            
            pricingZoneIds.push(pricingZoneId);
            console.log(`   ✅ Created pricing zone: ${pricingConfig.name} (${pricingZoneId})`);
        }

        // Step 3: Create default grid zones
        console.log('🗺️  Creating default grid zones...');
        const gridZoneIds: string[] = [];
        
        for (let i = 0; i < DEPLOY_CONFIG.defaultGridZones.length; i++) {
            const gridConfig = DEPLOY_CONFIG.defaultGridZones[i];
            const pricingZoneId = pricingZoneIds[i];
            
            const gridZoneId = await locationRegistry.createGridZone(
                gridConfig.name,
                gridConfig.boundaries,
                pricingZoneId,
                gridConfig.restrictions,
                DEPLOY_CONFIG.adminAddress
            );
            
            gridZoneIds.push(gridZoneId);
            console.log(`   ✅ Created grid zone: ${gridConfig.name} (${gridZoneId})`);
        }

        // Step 4: Register sample locations for testing
        console.log('📍 Registering sample locations...');
        const sampleLocations = [
            {
                name: 'New York Solar Farm',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                type: LocationType.PRODUCER,
                privacy: PrivacyLevel.PUBLIC,
                metadata: 'Large-scale solar installation in NYC area'
            },
            {
                name: 'California Wind Farm',
                coordinates: { latitude: 36.7783, longitude: -119.4179 },
                type: LocationType.PRODUCER,
                privacy: PrivacyLevel.PUBLIC,
                metadata: 'Wind farm in Central California'
            },
            {
                name: 'Berlin Office Building',
                coordinates: { latitude: 52.5200, longitude: 13.4050 },
                type: LocationType.CONSUMER,
                privacy: PrivacyLevel.PRIVACY_ZONE,
                metadata: 'Commercial office building in Berlin'
            },
            {
                name: 'Tokyo Data Center',
                coordinates: { latitude: 35.6762, longitude: 139.6503 },
                type: LocationType.CONSUMER,
                privacy: PrivacyLevel.PRIVATE,
                metadata: 'High-density data center in Tokyo'
            },
            {
                name: 'Texas Solar Prosumer',
                coordinates: { latitude: 32.7767, longitude: -96.7970 },
                type: LocationType.PROSUMER,
                privacy: PrivacyLevel.PUBLIC,
                metadata: 'Residential solar installation with battery storage'
            }
        ];

        const sampleLocationIds: string[] = [];
        
        for (const sample of sampleLocations) {
            const locationId = await locationRegistry.registerLocation(
                sample.coordinates,
                sample.type,
                sample.privacy,
                sample.metadata,
                'sample_user'
            );
            
            sampleLocationIds.push(locationId);
            console.log(`   ✅ Registered sample location: ${sample.name} (${locationId})`);
        }

        // Step 5: Verify sample locations
        console.log('🔍 Verifying sample locations...');
        for (const locationId of sampleLocationIds) {
            await locationRegistry.verifyLocation(
                locationId,
                VerificationMethod.GPS_COORDINATES,
                'Automated verification during deployment',
                DEPLOY_CONFIG.adminAddress
            );
            console.log(`   ✅ Verified location: ${locationId}`);
        }

        // Step 6: Deployment summary
        console.log('\n🎉 Deployment completed successfully!');
        console.log('\n📊 Deployment Summary:');
        console.log(`   - Location Registry Contract: Deployed`);
        console.log(`   - Pricing Zones Created: ${pricingZoneIds.length}`);
        console.log(`   - Grid Zones Created: ${gridZoneIds.length}`);
        console.log(`   - Sample Locations Registered: ${sampleLocationIds.length}`);
        
        console.log('\n🔗 Important Addresses:');
        console.log(`   - Admin Address: ${DEPLOY_CONFIG.adminAddress}`);
        
        console.log('\n📋 Pricing Zone IDs:');
        pricingZoneIds.forEach((id, index) => {
            console.log(`   - ${DEPLOY_CONFIG.defaultPricingZones[index].name}: ${id}`);
        });
        
        console.log('\n🗺️  Grid Zone IDs:');
        gridZoneIds.forEach((id, index) => {
            console.log(`   - ${DEPLOY_CONFIG.defaultGridZones[index].name}: ${id}`);
        });
        
        console.log('\n📍 Sample Location IDs:');
        sampleLocations.forEach((location, index) => {
            console.log(`   - ${location.name}: ${sampleLocationIds[index]}`);
        });

        console.log('\n⚙️  Next Steps:');
        console.log('   1. Update your application configuration with the deployed contract address');
        console.log('   2. Add additional verifiers as needed');
        console.log('   3. Configure additional grid zones and pricing zones for your specific region');
        console.log('   4. Set up monitoring and alerting for the location registry');
        console.log('   5. Run the test suite to verify deployment integrity');

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

/**
 * Verification function to test the deployment
 */
async function verifyDeployment(): Promise<void> {
    console.log('🔍 Verifying deployment...');
    
    try {
        const locationRegistry = new LocationRegistry();
        
        // Test basic functionality
        const testCoordinates: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
        const locationId = await locationRegistry.registerLocation(
            testCoordinates,
            LocationType.PRODUCER,
            PrivacyLevel.PUBLIC,
            'Verification test location',
            'verifier'
        );
        
        const location = await locationRegistry.getLocation(locationId);
        
        if (location.coordinates.latitude === testCoordinates.latitude &&
            location.coordinates.longitude === testCoordinates.longitude) {
            console.log('✅ Deployment verification passed!');
        } else {
            throw new Error('Location data mismatch');
        }
        
    } catch (error) {
        console.error('❌ Deployment verification failed:', error);
        process.exit(1);
    }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'deploy':
            await deployLocationRegistry();
            break;
        case 'verify':
            await verifyDeployment();
            break;
        default:
            console.log('Usage:');
            console.log('  npm run deploy:location deploy    - Deploy the location registry');
            console.log('  npm run deploy:location verify    - Verify the deployment');
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
    main().catch((error) => {
        console.error('Script execution failed:', error);
        process.exit(1);
    });
}

export { deployLocationRegistry, verifyDeployment };
