/**
 * @title Location Registry Contract
 * @dev Geographic location registry for energy production and consumption
 * @author CurrentDAO
 */

import { GeoLib } from './libraries/GeoLib';
import { 
    Coordinates, 
    LocationData, 
    LocationType, 
    VerificationStatus, 
    PrivacyLevel,
    GridZone,
    PricingZone,
    LocationVerification,
    DistanceCalculation,
    LocationEvent,
    VerificationMethod,
    ZoneRestrictions,
    PrivacyZone,
    DistanceMethod
} from './structures/LocationStructure';
import { ILocationRegistry } from './interfaces/ILocationRegistry';

export class LocationRegistry implements ILocationRegistry {
    // Storage
    private locations: Map<string, LocationData> = new Map();
    private ownerLocations: Map<string, string[]> = new Map();
    private gridZoneLocations: Map<string, string[]> = new Map();
    private typeLocations: Map<LocationType, string[]> = new Map();
    private gridZones: Map<string, GridZone> = new Map();
    private pricingZones: Map<string, PricingZone> = new Map();
    private verificationHistory: Map<string, LocationVerification[]> = new Map();
    private verifiers: Map<string, boolean> = new Map();
    private privacyZones: Map<string, PrivacyZone> = new Map();
    private distanceCache: Map<string, DistanceCalculation[]> = new Map();

    // State variables
    private registrationPaused: boolean = false;
    private locationCounter: number = 0;
    private gridZoneCounter: number = 0;
    private pricingZoneCounter: number = 0;

    // Constants
    private static readonly MAX_LOCATIONS_PER_OWNER = 100;
    private static readonly VERIFICATION_TIMEOUT = 86400; // 24 hours in seconds
    private static readonly DISTANCE_CACHE_SIZE = 1000;

    constructor() {
        // Initialize with default admin
        this.verifiers.set('admin', true);
    }

    // Core location management functions
    async registerLocation(
        coordinates: Coordinates,
        locationType: LocationType,
        privacyLevel: PrivacyLevel,
        metadata: string,
        owner: string = 'default' // In real implementation, this would be msg.sender
    ): Promise<string> {
        if (this.registrationPaused) {
            throw new Error('Registration is currently paused');
        }

        if (!GeoLib.validateCoordinates(coordinates)) {
            throw new Error('Invalid coordinates');
        }

        // Check owner limit
        const ownerLocs = this.ownerLocations.get(owner) || [];
        if (ownerLocs.length >= LocationRegistry.MAX_LOCATIONS_PER_OWNER) {
            throw new Error('Maximum locations per owner exceeded');
        }

        // Generate unique location ID
        const locationId = this.generateLocationId(owner);
        
        // Find appropriate grid zone
        const gridZoneId = await this.findGridZoneForLocation(coordinates);
        
        // Create privacy zone if needed
        let privacyZone: PrivacyZone | undefined;
        if (privacyLevel !== PrivacyLevel.PUBLIC) {
            privacyZone = GeoLib.generatePrivacyZone(coordinates, privacyLevel);
            this.privacyZones.set(locationId, privacyZone);
        }

        const locationData: LocationData = {
            id: locationId,
            owner,
            coordinates,
            gridZone: gridZoneId,
            locationType,
            verificationStatus: VerificationStatus.UNVERIFIED,
            privacyLevel,
            registeredAt: Date.now(),
            lastVerified: 0,
            metadata
        };

        // Store location
        this.locations.set(locationId, locationData);
        
        // Update indexes
        ownerLocs.push(locationId);
        this.ownerLocations.set(owner, ownerLocs);
        
        const gridZoneLocs = this.gridZoneLocations.get(gridZoneId) || [];
        gridZoneLocs.push(locationId);
        this.gridZoneLocations.set(gridZoneId, gridZoneLocs);
        
        const typeLocs = this.typeLocations.get(locationType) || [];
        typeLocs.push(locationId);
        this.typeLocations.set(locationType, typeLocs);

        // Emit event (in real implementation)
        console.log(`LocationRegistered: ${locationId}, owner: ${owner}`);

        return locationId;
    }

    async updateLocation(
        locationId: string,
        coordinates: Coordinates,
        metadata: string,
        caller: string = 'default' // In real implementation, this would be msg.sender
    ): Promise<boolean> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        if (location.owner !== caller && !this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        if (!GeoLib.validateCoordinates(coordinates)) {
            throw new Error('Invalid coordinates');
        }

        // Update location
        location.coordinates = coordinates;
        location.metadata = metadata;
        location.lastVerified = 0; // Reset verification status

        // Update grid zone if coordinates changed significantly
        const newGridZoneId = await this.findGridZoneForLocation(coordinates);
        if (newGridZoneId !== location.gridZone) {
            // Remove from old grid zone
            const oldGridZoneLocs = this.gridZoneLocations.get(location.gridZone) || [];
            const oldIndex = oldGridZoneLocs.indexOf(locationId);
            if (oldIndex > -1) {
                oldGridZoneLocs.splice(oldIndex, 1);
                this.gridZoneLocations.set(location.gridZone, oldGridZoneLocs);
            }

            // Add to new grid zone
            const newGridZoneLocs = this.gridZoneLocations.get(newGridZoneId) || [];
            newGridZoneLocs.push(locationId);
            this.gridZoneLocations.set(newGridZoneId, newGridZoneLocs);

            location.gridZone = newGridZoneId;
        }

        // Update privacy zone if needed
        if (location.privacyLevel !== PrivacyLevel.PUBLIC) {
            const privacyZone = GeoLib.generatePrivacyZone(coordinates, location.privacyLevel);
            this.privacyZones.set(locationId, privacyZone);
        }

        this.locations.set(locationId, location);

        // Emit event
        console.log(`LocationUpdated: ${locationId}`);

        return true;
    }

    async deactivateLocation(
        locationId: string,
        caller: string = 'default' // In real implementation, this would be msg.sender
    ): Promise<boolean> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        if (location.owner !== caller && !this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        // Remove from indexes
        const ownerLocs = this.ownerLocations.get(location.owner) || [];
        const ownerIndex = ownerLocs.indexOf(locationId);
        if (ownerIndex > -1) {
            ownerLocs.splice(ownerIndex, 1);
            this.ownerLocations.set(location.owner, ownerLocs);
        }

        const gridZoneLocs = this.gridZoneLocations.get(location.gridZone) || [];
        const gridZoneIndex = gridZoneLocs.indexOf(locationId);
        if (gridZoneIndex > -1) {
            gridZoneLocs.splice(gridZoneIndex, 1);
            this.gridZoneLocations.set(location.gridZone, gridZoneLocs);
        }

        const typeLocs = this.typeLocations.get(location.locationType) || [];
        const typeIndex = typeLocs.indexOf(locationId);
        if (typeIndex > -1) {
            typeLocs.splice(typeIndex, 1);
            this.typeLocations.set(location.locationType, typeLocs);
        }

        // Remove location
        this.locations.delete(locationId);
        this.privacyZones.delete(locationId);

        // Emit event
        console.log(`LocationDeactivated: ${locationId}`);

        return true;
    }

    // Location query functions
    async getLocation(locationId: string): Promise<LocationData> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }
        return location;
    }

    async getLocationsByOwner(owner: string): Promise<LocationData[]> {
        const locationIds = this.ownerLocations.get(owner) || [];
        const locations: LocationData[] = [];
        
        for (const id of locationIds) {
            const location = this.locations.get(id);
            if (location) {
                locations.push(location);
            }
        }
        
        return locations;
    }

    async getLocationsByGridZone(gridZoneId: string): Promise<LocationData[]> {
        const locationIds = this.gridZoneLocations.get(gridZoneId) || [];
        const locations: LocationData[] = [];
        
        for (const id of locationIds) {
            const location = this.locations.get(id);
            if (location) {
                locations.push(location);
            }
        }
        
        return locations;
    }

    async getLocationsByType(locationType: LocationType): Promise<LocationData[]> {
        const locationIds = this.typeLocations.get(locationType) || [];
        const locations: LocationData[] = [];
        
        for (const id of locationIds) {
            const location = this.locations.get(id);
            if (location) {
                locations.push(location);
            }
        }
        
        return locations;
    }

    // Grid zone management
    async createGridZone(
        name: string,
        boundaries: Coordinates[],
        pricingZoneId: string,
        restrictions: ZoneRestrictions,
        caller: string = 'system' // In real implementation, this would be msg.sender
    ): Promise<string> {
        // System and verified verifiers can create zones
        if (caller !== 'system' && !this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        if (boundaries.length < 3) {
            throw new Error('Invalid grid zone boundaries');
        }

        const gridZoneId = this.generateGridZoneId();
        
        const gridZone: GridZone = {
            id: gridZoneId,
            name,
            boundaries,
            pricingZone: pricingZoneId,
            isActive: true,
            restrictions
        };

        this.gridZones.set(gridZoneId, gridZone);

        // Emit event
        console.log(`GridZoneCreated: ${gridZoneId}`);

        return gridZoneId;
    }

    async assignGridZone(locationId: string, caller: string = 'default'): Promise<string> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        if (location.owner !== caller && !this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        const newGridZoneId = await this.findGridZoneForLocation(location.coordinates);
        
        if (newGridZoneId !== location.gridZone) {
            // Remove from old grid zone
            const oldGridZoneLocs = this.gridZoneLocations.get(location.gridZone) || [];
            const oldIndex = oldGridZoneLocs.indexOf(locationId);
            if (oldIndex > -1) {
                oldGridZoneLocs.splice(oldIndex, 1);
                this.gridZoneLocations.set(location.gridZone, oldGridZoneLocs);
            }

            // Add to new grid zone
            const newGridZoneLocs = this.gridZoneLocations.get(newGridZoneId) || [];
            newGridZoneLocs.push(locationId);
            this.gridZoneLocations.set(newGridZoneId, newGridZoneLocs);

            location.gridZone = newGridZoneId;
            this.locations.set(locationId, location);

            // Emit event
            console.log(`GridZoneAssigned: ${locationId} -> ${newGridZoneId}`);
        }

        return newGridZoneId;
    }

    async updateGridZoneBoundaries(
        zoneId: string, 
        boundaries: Coordinates[], 
        caller: string = 'default'
    ): Promise<boolean> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        const gridZone = this.gridZones.get(zoneId);
        if (!gridZone) {
            throw new Error('Grid zone not found');
        }

        if (boundaries.length < 3) {
            throw new Error('Invalid grid zone boundaries');
        }

        gridZone.boundaries = boundaries;
        this.gridZones.set(zoneId, gridZone);

        return true;
    }

    // Verification functions
    async verifyLocation(
        locationId: string,
        verificationMethod: VerificationMethod,
        evidence: string,
        verifier: string = 'default' // In real implementation, this would be msg.sender
    ): Promise<boolean> {
        if (!this.verifiers.get(verifier)) {
            throw new Error('Unauthorized verifier');
        }

        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        // Perform verification based on method
        let confidenceScore = 0;
        let verified = false;

        switch (verificationMethod) {
            case VerificationMethod.GPS_COORDINATES:
                // Simple GPS coordinate verification
                verified = GeoLib.validateCoordinates(location.coordinates);
                confidenceScore = verified ? 95 : 0;
                break;
            
            case VerificationMethod.SATELLITE_IMAGERY:
                // In real implementation, this would use satellite imagery API
                verified = true; // Placeholder
                confidenceScore = 90;
                break;
            
            case VerificationMethod.THIRD_PARTY_ORACLE:
                // In real implementation, this would call external oracle
                verified = true; // Placeholder
                confidenceScore = 85;
                break;
            
            case VerificationMethod.MANUAL_VERIFICATION:
                // Manual verification by authorized verifier
                verified = true;
                confidenceScore = 100;
                break;
        }

        if (!verified) {
            throw new Error('Verification failed');
        }

        // Update location verification status
        location.verificationStatus = VerificationStatus.VERIFIED;
        location.lastVerified = Date.now();
        this.locations.set(locationId, location);

        // Record verification
        const verification: LocationVerification = {
            locationId,
            verifier,
            verificationMethod,
            confidenceScore,
            verifiedAt: Date.now(),
            evidence
        };

        const history = this.verificationHistory.get(locationId) || [];
        history.push(verification);
        this.verificationHistory.set(locationId, history);

        // Emit event
        console.log(`LocationVerified: ${locationId} by ${verifier}`);

        return true;
    }

    async requestVerification(locationId: string): Promise<boolean> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        if (location.verificationStatus === VerificationStatus.PENDING) {
            throw new Error('Verification already pending');
        }

        location.verificationStatus = VerificationStatus.PENDING;
        this.locations.set(locationId, location);

        return true;
    }

    async getVerificationHistory(locationId: string): Promise<LocationVerification[]> {
        return this.verificationHistory.get(locationId) || [];
    }

    // Privacy functions
    async updatePrivacyLevel(
        locationId: string, 
        privacyLevel: PrivacyLevel, 
        caller: string = 'default'
    ): Promise<boolean> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        if (location.owner !== caller && !this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        const oldLevel = location.privacyLevel;
        location.privacyLevel = privacyLevel;
        this.locations.set(locationId, location);

        // Update privacy zone
        if (privacyLevel === PrivacyLevel.PUBLIC) {
            this.privacyZones.delete(locationId);
        } else {
            const privacyZone = GeoLib.generatePrivacyZone(location.coordinates, privacyLevel);
            this.privacyZones.set(locationId, privacyZone);
        }

        // Emit event
        console.log(`PrivacyLevelUpdated: ${locationId} from ${oldLevel} to ${privacyLevel}`);

        return true;
    }

    async getPublicCoordinates(locationId: string): Promise<Coordinates> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        if (location.privacyLevel === PrivacyLevel.PUBLIC) {
            return location.coordinates;
        }

        const privacyZone = this.privacyZones.get(locationId);
        if (privacyZone) {
            return privacyZone.obscuredCoordinates;
        }

        return location.coordinates;
    }

    async isWithinPrivacyZone(locationId: string, coordinates: Coordinates): Promise<boolean> {
        const privacyZone = this.privacyZones.get(locationId);
        if (!privacyZone) {
            return false;
        }

        return GeoLib.isWithinRadius(privacyZone.center, coordinates, privacyZone.radius);
    }

    // Distance and trading functions
    async calculateDistance(
        fromLocationId: string,
        toLocationId: string
    ): Promise<DistanceCalculation> {
        const fromLocation = this.locations.get(fromLocationId);
        const toLocation = this.locations.get(toLocationId);

        if (!fromLocation || !toLocation) {
            throw new Error('Location not found');
        }

        const distance = GeoLib.calculateDistance(
            fromLocation.coordinates,
            toLocation.coordinates
        );

        const calculation: DistanceCalculation = {
            fromLocation: fromLocationId,
            toLocation: toLocationId,
            distance,
            calculationMethod: DistanceMethod.HAVERSINE,
            calculatedAt: Date.now()
        };

        // Cache the calculation
        const cacheKey = `${fromLocationId}-${toLocationId}`;
        const cache = this.distanceCache.get(cacheKey) || [];
        cache.push(calculation);
        
        // Limit cache size
        if (cache.length > LocationRegistry.DISTANCE_CACHE_SIZE) {
            cache.shift();
        }
        
        this.distanceCache.set(cacheKey, cache);

        return calculation;
    }

    async canTrade(
        locationId1: string,
        locationId2: string,
        maxDistanceKm: number
    ): Promise<boolean> {
        const location1 = this.locations.get(locationId1);
        const location2 = this.locations.get(locationId2);

        if (!location1 || !location2) {
            throw new Error('Location not found');
        }

        return GeoLib.canTrade(location1.coordinates, location2.coordinates, maxDistanceKm);
    }

    async getNearbyLocations(
        locationId: string,
        radiusKm: number,
        locationType: LocationType
    ): Promise<LocationData[]> {
        const centerLocation = this.locations.get(locationId);
        if (!centerLocation) {
            throw new Error('Location not found');
        }

        const nearbyLocations: LocationData[] = [];
        
        // Get all locations of the specified type
        const typeLocations = await this.getLocationsByType(locationType);
        
        for (const location of typeLocations) {
            if (location.id === locationId) continue; // Skip self
            
            const distance = GeoLib.calculateDistance(
                centerLocation.coordinates,
                location.coordinates
            );
            
            if (distance <= radiusKm) {
                nearbyLocations.push(location);
            }
        }

        return nearbyLocations;
    }

    // Pricing zone functions
    async createPricingZone(
        name: string,
        basePrice: number,
        peakMultiplier: number,
        offPeakMultiplier: number,
        regionalAdjustment: number,
        caller: string = 'default'
    ): Promise<string> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        const pricingZoneId = this.generatePricingZoneId();
        
        const pricingZone: PricingZone = {
            id: pricingZoneId,
            name,
            basePrice,
            peakMultiplier,
            offPeakMultiplier,
            regionalAdjustment,
            isActive: true
        };

        this.pricingZones.set(pricingZoneId, pricingZone);

        // Emit event
        console.log(`PricingZoneCreated: ${pricingZoneId}`);

        return pricingZoneId;
    }

    async updatePricingZone(
        pricingZoneId: string,
        basePrice: number,
        peakMultiplier: number,
        offPeakMultiplier: number,
        regionalAdjustment: number,
        caller: string = 'default'
    ): Promise<boolean> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        const pricingZone = this.pricingZones.get(pricingZoneId);
        if (!pricingZone) {
            throw new Error('Pricing zone not found');
        }

        pricingZone.basePrice = basePrice;
        pricingZone.peakMultiplier = peakMultiplier;
        pricingZone.offPeakMultiplier = offPeakMultiplier;
        pricingZone.regionalAdjustment = regionalAdjustment;

        this.pricingZones.set(pricingZoneId, pricingZone);

        // Emit event
        console.log(`PricingZoneUpdated: ${pricingZoneId}`);

        return true;
    }

    async getPricingZone(pricingZoneId: string): Promise<PricingZone> {
        const pricingZone = this.pricingZones.get(pricingZoneId);
        if (!pricingZone) {
            throw new Error('Pricing zone not found');
        }
        return pricingZone;
    }

    async getPricingZoneForLocation(locationId: string): Promise<PricingZone> {
        const location = this.locations.get(locationId);
        if (!location) {
            throw new Error('Location not found');
        }

        const gridZone = this.gridZones.get(location.gridZone);
        if (!gridZone) {
            throw new Error('Grid zone not found');
        }

        return this.getPricingZone(gridZone.pricingZone);
    }

    // Admin functions
    async addVerifier(verifier: string, caller: string = 'default'): Promise<boolean> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        this.verifiers.set(verifier, true);
        return true;
    }

    async removeVerifier(verifier: string, caller: string = 'default'): Promise<boolean> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        this.verifiers.delete(verifier);
        return true;
    }

    async pauseRegistration(caller: string = 'default'): Promise<boolean> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        this.registrationPaused = true;
        return true;
    }

    async unpauseRegistration(caller: string = 'default'): Promise<boolean> {
        if (!this.verifiers.get(caller)) {
            throw new Error('Unauthorized access');
        }

        this.registrationPaused = false;
        return true;
    }

    // Helper functions
    private generateLocationId(owner: string): string {
        this.locationCounter++;
        return `loc_${owner}_${this.locationCounter}`;
    }

    private generateGridZoneId(): string {
        this.gridZoneCounter++;
        return `zone_${this.gridZoneCounter}`;
    }

    private generatePricingZoneId(): string {
        this.pricingZoneCounter++;
        return `price_${this.pricingZoneCounter}`;
    }

    private async findGridZoneForLocation(coordinates: Coordinates): Promise<string> {
        const gridZones = Array.from(this.gridZones.values());
        const nearestZone = GeoLib.findNearestGridZone(coordinates, gridZones);
        
        if (nearestZone) {
            return nearestZone.id;
        }

        // Create default zone if none found
        const defaultZoneId = await this.createGridZone(
            'Default Zone',
            [
                { latitude: -90, longitude: -180 },
                { latitude: 90, longitude: -180 },
                { latitude: 90, longitude: 180 },
                { latitude: -90, longitude: 180 }
            ],
            'default_price',
            {
                maxProductionCapacity: Number.MAX_SAFE_INTEGER,
                maxConsumptionDemand: Number.MAX_SAFE_INTEGER,
                allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER, LocationType.PROSUMER, LocationType.GRID_NODE],
                verificationRequired: false
            }
        );

        return defaultZoneId;
    }
}
