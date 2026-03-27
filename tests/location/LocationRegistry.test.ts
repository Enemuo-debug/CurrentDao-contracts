/**
 * @title Location Registry Test Suite
 * @dev Comprehensive tests for the geographic location registry
 * @author CurrentDAO
 */

import { LocationRegistry } from '../../contracts/location/LocationRegistry';
import { GeoLib } from '../../contracts/location/libraries/GeoLib';
import { 
    LocationType, 
    PrivacyLevel, 
    VerificationStatus, 
    VerificationMethod,
    Coordinates,
    ZoneRestrictions
} from '../../contracts/location/structures/LocationStructure';

describe('LocationRegistry', () => {
    let locationRegistry: LocationRegistry;
    let testOwner: string;
    let testVerifier: string;

    beforeEach(() => {
        locationRegistry = new LocationRegistry();
        testOwner = 'test_owner_123';
        testVerifier = 'test_verifier_456';
    });

    describe('Location Registration', () => {
        const validCoordinates: Coordinates = { latitude: 40.7128, longitude: -74.0060 };

        it('should register a new location successfully', async () => {
            const locationId = await locationRegistry.registerLocation(
                validCoordinates,
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Solar panel installation',
                testOwner
            );

            expect(locationId).toBeDefined();
            expect(locationId).toContain('loc_');

            const location = await locationRegistry.getLocation(locationId);
            expect(location.owner).toBe(testOwner);
            expect(location.coordinates).toEqual(validCoordinates);
            expect(location.locationType).toBe(LocationType.PRODUCER);
            expect(location.privacyLevel).toBe(PrivacyLevel.PUBLIC);
            expect(location.verificationStatus).toBe(VerificationStatus.UNVERIFIED);
        });

        it('should reject invalid coordinates', async () => {
            const invalidCoordinates: Coordinates = { latitude: 91, longitude: 0 };

            await expect(
                locationRegistry.registerLocation(
                    invalidCoordinates,
                    LocationType.PRODUCER,
                    PrivacyLevel.PUBLIC,
                    'Invalid location',
                    testOwner
                )
            ).rejects.toThrow('Invalid coordinates');
        });

        it('should enforce maximum locations per owner', async () => {
            // Register maximum locations
            for (let i = 0; i < 100; i++) {
                await locationRegistry.registerLocation(
                    { latitude: 40.7128 + i * 0.01, longitude: -74.0060 },
                    LocationType.PRODUCER,
                    PrivacyLevel.PUBLIC,
                    `Location ${i}`,
                    testOwner
                );
            }

            // Should reject the 101st location
            await expect(
                locationRegistry.registerLocation(
                    { latitude: 41.7128, longitude: -74.0060 },
                    LocationType.PRODUCER,
                    PrivacyLevel.PUBLIC,
                    'Too many locations',
                    testOwner
                )
            ).rejects.toThrow('Maximum locations per owner exceeded');
        });

        it('should assign grid zone automatically', async () => {
            const locationId = await locationRegistry.registerLocation(
                validCoordinates,
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Test location',
                testOwner
            );

            const location = await locationRegistry.getLocation(locationId);
            expect(location.gridZone).toBeDefined();
            expect(location.gridZone).toContain('zone_');
        });
    });

    describe('Location Updates', () => {
        let locationId: string;

        beforeEach(async () => {
            locationId = await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 },
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Original location',
                testOwner
            );
        });

        it('should update location coordinates successfully', async () => {
            const newCoordinates: Coordinates = { latitude: 40.7580, longitude: -73.9855 };
            
            const result = await locationRegistry.updateLocation(
                locationId,
                newCoordinates,
                'Updated location',
                testOwner
            );

            expect(result).toBe(true);

            const location = await locationRegistry.getLocation(locationId);
            expect(location.coordinates).toEqual(newCoordinates);
            expect(location.metadata).toBe('Updated location');
            expect(location.verificationStatus).toBe(VerificationStatus.UNVERIFIED);
        });

        it('should reject unauthorized updates', async () => {
            const newCoordinates: Coordinates = { latitude: 40.7580, longitude: -73.9855 };
            
            await expect(
                locationRegistry.updateLocation(
                    locationId,
                    newCoordinates,
                    'Unauthorized update',
                    'unauthorized_user'
                )
            ).rejects.toThrow('Unauthorized access');
        });

        it('should reject invalid coordinates on update', async () => {
            const invalidCoordinates: Coordinates = { latitude: 91, longitude: 0 };
            
            await expect(
                locationRegistry.updateLocation(
                    locationId,
                    invalidCoordinates,
                    'Invalid update',
                    testOwner
                )
            ).rejects.toThrow('Invalid coordinates');
        });
    });

    describe('Location Deactivation', () => {
        let locationId: string;

        beforeEach(async () => {
            locationId = await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 },
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Test location',
                testOwner
            );
        });

        it('should deactivate location successfully', async () => {
            const result = await locationRegistry.deactivateLocation(locationId, testOwner);
            expect(result).toBe(true);

            await expect(locationRegistry.getLocation(locationId)).rejects.toThrow('Location not found');
        });

        it('should reject unauthorized deactivation', async () => {
            await expect(
                locationRegistry.deactivateLocation(locationId, 'unauthorized_user')
            ).rejects.toThrow('Unauthorized access');
        });
    });

    describe('Location Queries', () => {
        const owner1 = 'owner1';
        const owner2 = 'owner2';

        beforeEach(async () => {
            // Register locations for testing
            await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 },
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Producer 1',
                owner1
            );

            await locationRegistry.registerLocation(
                { latitude: 40.7580, longitude: -73.9855 },
                LocationType.CONSUMER,
                PrivacyLevel.PRIVACY_ZONE,
                'Consumer 1',
                owner1
            );

            await locationRegistry.registerLocation(
                { latitude: 40.7831, longitude: -73.9712 },
                LocationType.PRODUCER,
                PrivacyLevel.PRIVATE,
                'Producer 2',
                owner2
            );
        });

        it('should get locations by owner', async () => {
            const owner1Locations = await locationRegistry.getLocationsByOwner(owner1);
            expect(owner1Locations).toHaveLength(2);
            expect(owner1Locations.every(loc => loc.owner === owner1)).toBe(true);

            const owner2Locations = await locationRegistry.getLocationsByOwner(owner2);
            expect(owner2Locations).toHaveLength(1);
            expect(owner2Locations[0].owner).toBe(owner2);
        });

        it('should get locations by type', async () => {
            const producers = await locationRegistry.getLocationsByType(LocationType.PRODUCER);
            expect(producers).toHaveLength(2);
            expect(producers.every(loc => loc.locationType === LocationType.PRODUCER)).toBe(true);

            const consumers = await locationRegistry.getLocationsByType(LocationType.CONSUMER);
            expect(consumers).toHaveLength(1);
            expect(consumers[0].locationType).toBe(LocationType.CONSUMER);
        });

        it('should get locations by grid zone', async () => {
            // All locations should be in the default grid zone
            const locations = await locationRegistry.getLocationsByGridZone('zone_1');
            expect(locations.length).toBeGreaterThan(0);
        });
    });

    describe('Grid Zone Management', () => {
        it('should create a new grid zone', async () => {
            await locationRegistry.addVerifier(testVerifier);

            const boundaries: Coordinates[] = [
                { latitude: 40.7, longitude: -74.1 },
                { latitude: 40.8, longitude: -74.1 },
                { latitude: 40.8, longitude: -73.9 },
                { latitude: 40.7, longitude: -73.9 }
            ];

            const restrictions: ZoneRestrictions = {
                maxProductionCapacity: 1000,
                maxConsumptionDemand: 800,
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER],
                verificationRequired: true
            };

            const zoneId = await locationRegistry.createGridZone(
                'Test Zone',
                boundaries,
                'test_price_zone',
                restrictions,
                testVerifier
            );

            expect(zoneId).toBeDefined();
            expect(zoneId).toContain('zone_');
        });

        it('should reject unauthorized grid zone creation', async () => {
            const boundaries: Coordinates[] = [
                { latitude: 40.7, longitude: -74.1 },
                { latitude: 40.8, longitude: -74.1 },
                { latitude: 40.8, longitude: -73.9 },
                { latitude: 40.7, longitude: -73.9 }
            ];

            const restrictions: ZoneRestrictions = {
                maxProductionCapacity: 1000,
                maxConsumptionDemand: 800,
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER],
                verificationRequired: true
            };

            await expect(
                locationRegistry.createGridZone(
                    'Unauthorized Zone',
                    boundaries,
                    'test_price_zone',
                    restrictions,
                    'unauthorized_user'
                )
            ).rejects.toThrow('Unauthorized access');
        });
    });

    describe('Location Verification', () => {
        let locationId: string;

        beforeEach(async () => {
            await locationRegistry.addVerifier(testVerifier);
            
            locationId = await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 },
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Test location',
                testOwner
            );
        });

        it('should verify location with GPS coordinates method', async () => {
            const result = await locationRegistry.verifyLocation(
                locationId,
                VerificationMethod.GPS_COORDINATES,
                'GPS verification data',
                testVerifier
            );

            expect(result).toBe(true);

            const location = await locationRegistry.getLocation(locationId);
            expect(location.verificationStatus).toBe(VerificationStatus.VERIFIED);
            expect(location.lastVerified).toBeGreaterThan(0);
        });

        it('should reject unauthorized verification', async () => {
            await expect(
                locationRegistry.verifyLocation(
                    locationId,
                    VerificationMethod.GPS_COORDINATES,
                    'Unauthorized verification',
                    'unauthorized_user'
                )
            ).rejects.toThrow('Unauthorized verifier');
        });

        it('should record verification history', async () => {
            await locationRegistry.verifyLocation(
                locationId,
                VerificationMethod.GPS_COORDINATES,
                'First verification',
                testVerifier
            );

            await locationRegistry.verifyLocation(
                locationId,
                VerificationMethod.SATELLITE_IMAGERY,
                'Second verification',
                testVerifier
            );

            const history = await locationRegistry.getVerificationHistory(locationId);
            expect(history).toHaveLength(2);
            expect(history[0].verificationMethod).toBe(VerificationMethod.GPS_COORDINATES);
            expect(history[1].verificationMethod).toBe(VerificationMethod.SATELLITE_IMAGERY);
        });
    });

    describe('Privacy Controls', () => {
        let locationId: string;

        beforeEach(async () => {
            locationId = await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 },
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Test location',
                testOwner
            );
        });

        it('should update privacy level', async () => {
            const result = await locationRegistry.updatePrivacyLevel(
                locationId,
                PrivacyLevel.PRIVACY_ZONE,
                testOwner
            );

            expect(result).toBe(true);

            const location = await locationRegistry.getLocation(locationId);
            expect(location.privacyLevel).toBe(PrivacyLevel.PRIVACY_ZONE);
        });

        it('should return public coordinates for public locations', async () => {
            const publicCoords = await locationRegistry.getPublicCoordinates(locationId);
            const location = await locationRegistry.getLocation(locationId);
            expect(publicCoords).toEqual(location.coordinates);
        });

        it('should return obscured coordinates for private locations', async () => {
            await locationRegistry.updatePrivacyLevel(locationId, PrivacyLevel.PRIVATE, testOwner);
            
            const publicCoords = await locationRegistry.getPublicCoordinates(locationId);
            const location = await locationRegistry.getLocation(locationId);
            
            expect(publicCoords).not.toEqual(location.coordinates);
            expect(publicCoords.latitude).toBeDefined();
            expect(publicCoords.longitude).toBeDefined();
        });

        it('should check privacy zone membership', async () => {
            await locationRegistry.updatePrivacyLevel(locationId, PrivacyLevel.PRIVACY_ZONE, testOwner);
            
            const location = await locationRegistry.getLocation(locationId);
            const isWithin = await locationRegistry.isWithinPrivacyZone(
                locationId,
                location.coordinates
            );
            
            expect(isWithin).toBe(true);
        });
    });

    describe('Distance Calculations', () => {
        let locationId1: string;
        let locationId2: string;

        beforeEach(async () => {
            locationId1 = await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 }, // NYC
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'NYC Location',
                testOwner
            );

            locationId2 = await locationRegistry.registerLocation(
                { latitude: 40.7580, longitude: -73.9855 }, // Nearby NYC
                LocationType.CONSUMER,
                PrivacyLevel.PUBLIC,
                'Nearby NYC Location',
                testOwner
            );
        });

        it('should calculate distance between locations', async () => {
            const calculation = await locationRegistry.calculateDistance(locationId1, locationId2);
            
            expect(calculation.fromLocation).toBe(locationId1);
            expect(calculation.toLocation).toBe(locationId2);
            expect(calculation.distance).toBeGreaterThan(0);
            expect(calculation.calculationMethod).toBeDefined();
            expect(calculation.calculatedAt).toBeDefined();
        });

        it('should determine if trading is possible within distance', async () => {
            const canTrade = await locationRegistry.canTrade(locationId1, locationId2, 10); // 10km radius
            expect(canTrade).toBe(true);

            const cannotTrade = await locationRegistry.canTrade(locationId1, locationId2, 0.1); // 100m radius
            expect(cannotTrade).toBe(false);
        });

        it('should find nearby locations', async () => {
            const nearby = await locationRegistry.getNearbyLocations(
                locationId1,
                10, // 10km radius
                LocationType.CONSUMER
            );
            
            expect(nearby).toHaveLength(1);
            expect(nearby[0].id).toBe(locationId2);
            expect(nearby[0].locationType).toBe(LocationType.CONSUMER);
        });
    });

    describe('Pricing Zones', () => {
        it('should create a pricing zone', async () => {
            await locationRegistry.addVerifier(testVerifier);

            const pricingZoneId = await locationRegistry.createPricingZone(
                'Test Pricing Zone',
                0.10, // $0.10 per kWh
                1.5,  // 50% higher during peak
                0.8,  // 20% lower during off-peak
                0.05, // 5% regional adjustment
                testVerifier
            );

            expect(pricingZoneId).toBeDefined();
            expect(pricingZoneId).toContain('price_');

            const pricingZone = await locationRegistry.getPricingZone(pricingZoneId);
            expect(pricingZone.name).toBe('Test Pricing Zone');
            expect(pricingZone.basePrice).toBe(0.10);
            expect(pricingZone.peakMultiplier).toBe(1.5);
            expect(pricingZone.offPeakMultiplier).toBe(0.8);
            expect(pricingZone.regionalAdjustment).toBe(0.05);
            expect(pricingZone.isActive).toBe(true);
        });

        it('should update pricing zone', async () => {
            await locationRegistry.addVerifier(testVerifier);

            const pricingZoneId = await locationRegistry.createPricingZone(
                'Original Pricing Zone',
                0.10,
                1.5,
                0.8,
                0.05,
                testVerifier
            );

            const result = await locationRegistry.updatePricingZone(
                pricingZoneId,
                0.12, // Increased base price
                1.6,  // Higher peak multiplier
                0.7,  // Lower off-peak multiplier
                0.06, // Higher regional adjustment
                testVerifier
            );

            expect(result).toBe(true);

            const pricingZone = await locationRegistry.getPricingZone(pricingZoneId);
            expect(pricingZone.basePrice).toBe(0.12);
            expect(pricingZone.peakMultiplier).toBe(1.6);
            expect(pricingZone.offPeakMultiplier).toBe(0.7);
            expect(pricingZone.regionalAdjustment).toBe(0.06);
        });

        it('should get pricing zone for location', async () => {
            const locationId = await locationRegistry.registerLocation(
                { latitude: 40.7128, longitude: -74.0060 },
                LocationType.PRODUCER,
                PrivacyLevel.PUBLIC,
                'Test location',
                testOwner
            );

            const pricingZone = await locationRegistry.getPricingZoneForLocation(locationId);
            expect(pricingZone).toBeDefined();
            expect(pricingZone.id).toBe('default_price');
        });
    });

    describe('Admin Functions', () => {
        it('should add and remove verifiers', async () => {
            // Add verifier
            const addResult = await locationRegistry.addVerifier(testVerifier, 'admin');
            expect(addResult).toBe(true);

            // Verify verifier can perform privileged operations
            const boundaries: Coordinates[] = [
                { latitude: 40.7, longitude: -74.1 },
                { latitude: 40.8, longitude: -74.1 },
                { latitude: 40.8, longitude: -73.9 },
                { latitude: 40.7, longitude: -73.9 }
            ];

            const restrictions: ZoneRestrictions = {
                maxProductionCapacity: 1000,
                maxConsumptionDemand: 800,
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER],
                verificationRequired: true
            };

            await expect(
                locationRegistry.createGridZone(
                    'Verifier Zone',
                    boundaries,
                    'test_price_zone',
                    restrictions,
                    testVerifier
                )
            ).resolves.toBeDefined();

            // Remove verifier
            const removeResult = await locationRegistry.removeVerifier(testVerifier, 'admin');
            expect(removeResult).toBe(true);

            // Verify verifier can no longer perform privileged operations
            await expect(
                locationRegistry.createGridZone(
                    'Unauthorized Zone',
                    boundaries,
                    'test_price_zone_2',
                    restrictions,
                    testVerifier
                )
            ).rejects.toThrow('Unauthorized access');
        });

        it('should pause and unpause registration', async () => {
            // Pause registration
            const pauseResult = await locationRegistry.pauseRegistration('admin');
            expect(pauseResult).toBe(true);

            // Should reject new registrations
            await expect(
                locationRegistry.registerLocation(
                    { latitude: 40.7128, longitude: -74.0060 },
                    LocationType.PRODUCER,
                    PrivacyLevel.PUBLIC,
                    'Paused registration test',
                    testOwner
                )
            ).rejects.toThrow('Registration is currently paused');

            // Unpause registration
            const unpauseResult = await locationRegistry.unpauseRegistration('admin');
            expect(unpauseResult).toBe(true);

            // Should allow new registrations
            await expect(
                locationRegistry.registerLocation(
                    { latitude: 40.7128, longitude: -74.0060 },
                    LocationType.PRODUCER,
                    PrivacyLevel.PUBLIC,
                    'Unpaused registration test',
                    testOwner
                )
            ).resolves.toBeDefined();
        });
    });
});

describe('GeoLib', () => {
    describe('Distance Calculations', () => {
        const nyc: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
        const la: Coordinates = { latitude: 34.0522, longitude: -118.2437 };

        it('should calculate Haversine distance', () => {
            const distance = GeoLib.calculateDistance(nyc, la, 'HAVERSINE');
            expect(distance).toBeCloseTo(3935.75, 1); // Approximately 3936 km
        });

        it('should calculate Euclidean distance', () => {
            const distance = GeoLib.calculateDistance(nyc, la, 'EUCLIDEAN');
            expect(distance).toBeGreaterThan(0);
        });

        it('should calculate Manhattan distance', () => {
            const distance = GeoLib.calculateDistance(nyc, la, 'MANHATTAN');
            expect(distance).toBeGreaterThan(0);
        });

        it('should use Haversine as default method', () => {
            const haversineDistance = GeoLib.calculateDistance(nyc, la, 'HAVERSINE');
            const defaultDistance = GeoLib.calculateDistance(nyc, la);
            expect(haversineDistance).toBe(defaultDistance);
        });
    });

    describe('Coordinate Validation', () => {
        it('should validate correct coordinates', () => {
            expect(GeoLib.validateCoordinates({ latitude: 40.7128, longitude: -74.0060 })).toBe(true);
            expect(GeoLib.validateCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
            expect(GeoLib.validateCoordinates({ latitude: -90, longitude: 180 })).toBe(true);
            expect(GeoLib.validateCoordinates({ latitude: 90, longitude: -180 })).toBe(true);
        });

        it('should reject invalid coordinates', () => {
            expect(GeoLib.validateCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
            expect(GeoLib.validateCoordinates({ latitude: -91, longitude: 0 })).toBe(false);
            expect(GeoLib.validateCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
            expect(GeoLib.validateCoordinates({ latitude: 0, longitude: -181 })).toBe(false);
        });
    });

    describe('Radius and Zone Checks', () => {
        const center: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
        const nearby: Coordinates = { latitude: 40.7130, longitude: -74.0062 };
        const far: Coordinates = { latitude: 41.7128, longitude: -74.0060 };

        it('should check if point is within radius', () => {
            expect(GeoLib.isWithinRadius(center, nearby, 1)).toBe(true); // Within 1km
            expect(GeoLib.isWithinRadius(center, far, 1)).toBe(false); // Far from center
            expect(GeoLib.isWithinRadius(center, far, 200)).toBe(true); // Within 200km
        });

        it('should generate privacy zones', () => {
            const privacyZone = GeoLib.generatePrivacyZone(center, 1);
            expect(privacyZone.center).toEqual(center);
            expect(privacyZone.radius).toBe(5); // 5km for privacy level 1
            expect(privacyZone.obscuredCoordinates).not.toEqual(center);
            expect(privacyZone.level).toBe(1);
        });

        it('should verify coordinates', () => {
            expect(GeoLib.verifyCoordinates(center, center, 0.1)).toBe(true);
            expect(GeoLib.verifyCoordinates(center, nearby, 0.1)).toBe(true);
            expect(GeoLib.verifyCoordinates(center, far, 0.1)).toBe(false);
        });
    });

    describe('Grid Zone Operations', () => {
        const point: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
        const squareZone = {
            id: 'test_zone',
            name: 'Test Square',
            boundaries: [
                { latitude: 40.7, longitude: -74.1 },
                { latitude: 40.8, longitude: -74.1 },
                { latitude: 40.8, longitude: -73.9 },
                { latitude: 40.7, longitude: -73.9 }
            ],
            pricingZone: 'test_price',
            isActive: true,
            restrictions: {
                maxProductionCapacity: 1000,
                maxConsumptionDemand: 800,
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER],
                verificationRequired: true
            }
        };

        it('should check if point is within grid zone', () => {
            expect(GeoLib.isWithinGridZone(point, squareZone)).toBe(true);
        });

        it('should find nearest grid zone', () => {
            const zones = [squareZone];
            const nearest = GeoLib.findNearestGridZone(point, zones);
            expect(nearest).toBe(squareZone);
        });

        it('should calculate polygon area', () => {
            const area = GeoLib.calculatePolygonArea(squareZone.boundaries);
            expect(area).toBeGreaterThan(0);
        });
    });

    describe('Trading and Distance Functions', () => {
        const location1: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
        const location2: Coordinates = { latitude: 40.7580, longitude: -73.9855 };

        it('should check if trading is possible', () => {
            expect(GeoLib.canTrade(location1, location2, 10)).toBe(true); // Within 10km
            expect(GeoLib.canTrade(location1, location2, 0.1)).toBe(false); // Within 100m
        });

        it('should calculate bearing between points', () => {
            const bearing = GeoLib.calculateBearing(location1, location2);
            expect(bearing).toBeGreaterThanOrEqual(0);
            expect(bearing).toBeLessThan(360);
        });

        it('should generate location hash', () => {
            const hash1 = GeoLib.generateLocationHash(location1);
            const hash2 = GeoLib.generateLocationHash(location1, 3); // Lower precision
            const hash3 = GeoLib.generateLocationHash(location2);

            expect(hash1).toBeDefined();
            expect(hash2).toBeDefined();
            expect(hash3).toBeDefined();
            expect(hash1).not.toBe(hash3);
        });
    });
});
