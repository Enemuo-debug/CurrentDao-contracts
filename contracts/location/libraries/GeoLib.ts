/**
 * @title Geographic Library
 * @dev Library for geographic calculations and verifications
 * @author CurrentDAO
 */

import { Coordinates, DistanceMethod, PrivacyZone, GridZone } from '../structures/LocationStructure';

export class GeoLib {
    // Earth radius in kilometers
    private static readonly EARTH_RADIUS_KM = 6371.0;
    
    // Accuracy constants (in kilometers)
    private static readonly ACCURACY_THRESHOLD = 1.0;
    private static readonly MAX_VERIFICATION_DISTANCE = 0.1;

    /**
     * @dev Calculate distance between two coordinates using Haversine formula
     * @param from Starting coordinates
     * @param to Ending coordinates
     * @return Distance in kilometers
     */
    static calculateDistance(
        from: Coordinates,
        to: Coordinates,
        method: DistanceMethod = DistanceMethod.HAVERSINE
    ): number {
        switch (method) {
            case DistanceMethod.HAVERSINE:
                return this.haversineDistance(from, to);
            case DistanceMethod.EUCLIDEAN:
                return this.euclideanDistance(from, to);
            case DistanceMethod.MANHATTAN:
                return this.manhattanDistance(from, to);
            default:
                return this.haversineDistance(from, to);
        }
    }

    /**
     * @dev Haversine distance calculation (most accurate for GPS coordinates)
     */
    private static haversineDistance(from: Coordinates, to: Coordinates): number {
        const lat1Rad = this.toRadians(from.latitude);
        const lat2Rad = this.toRadians(to.latitude);
        const deltaLatRad = this.toRadians(to.latitude - from.latitude);
        const deltaLonRad = this.toRadians(to.longitude - from.longitude);

        const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return this.EARTH_RADIUS_KM * c;
    }

    /**
     * @dev Euclidean distance calculation (faster but less accurate)
     */
    private static euclideanDistance(from: Coordinates, to: Coordinates): number {
        const latDiff = to.latitude - from.latitude;
        const lonDiff = to.longitude - from.longitude;
        return Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111.0; // Approximate km per degree
    }

    /**
     * @dev Manhattan distance calculation
     */
    private static manhattanDistance(from: Coordinates, to: Coordinates): number {
        const latDiff = Math.abs(to.latitude - from.latitude);
        const lonDiff = Math.abs(to.longitude - from.longitude);
        return (latDiff + lonDiff) * 111.0; // Approximate km per degree
    }

    /**
     * @dev Check if coordinates are within a specified radius
     */
    static isWithinRadius(
        center: Coordinates,
        point: Coordinates,
        radiusKm: number
    ): boolean {
        const distance = this.calculateDistance(center, point);
        return distance <= radiusKm;
    }

    /**
     * @dev Check if coordinates are within a grid zone
     */
    static isWithinGridZone(coordinates: Coordinates, gridZone: GridZone): boolean {
        if (gridZone.boundaries.length < 3) return false;
        
        return this.isPointInPolygon(coordinates, gridZone.boundaries);
    }

    /**
     * @dev Check if a point is within a polygon using ray casting algorithm
     */
    private static isPointInPolygon(point: Coordinates, polygon: Coordinates[]): boolean {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].longitude, yi = polygon[i].latitude;
            const xj = polygon[j].longitude, yj = polygon[j].latitude;
            
            const intersect = ((yi > point.latitude) !== (yj > point.latitude))
                && (point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * @dev Generate privacy zone coordinates
     */
    static generatePrivacyZone(
        original: Coordinates,
        privacyLevel: number
    ): PrivacyZone {
        let radius: number;
        
        switch (privacyLevel) {
            case 1: // PRIVACY_ZONE
                radius = 5.0; // 5km radius
                break;
            case 2: // PRIVATE
                radius = 20.0; // 20km radius
                break;
            default: // PUBLIC
                radius = 0.0;
        }

        const obscuredCoordinates = radius > 0 ? this.obscureCoordinates(original, radius) : original;

        return {
            center: original,
            radius,
            obscuredCoordinates,
            level: privacyLevel
        };
    }

    /**
     * @dev Obscure coordinates within a given radius
     */
    private static obscureCoordinates(original: Coordinates, radiusKm: number): Coordinates {
        // Add random offset within radius (simplified for demo)
        const randomAngle = Math.random() * 2 * Math.PI;
        const randomDistance = Math.random() * radiusKm;
        
        const latOffset = (randomDistance * Math.cos(randomAngle)) / 111.0;
        const lonOffset = (randomDistance * Math.sin(randomAngle)) / (111.0 * Math.cos(this.toRadians(original.latitude)));
        
        return {
            latitude: original.latitude + latOffset,
            longitude: original.longitude + lonOffset
        };
    }

    /**
     * @dev Verify coordinates against expected location
     */
    static verifyCoordinates(
        submitted: Coordinates,
        expected: Coordinates,
        toleranceKm: number = this.MAX_VERIFICATION_DISTANCE
    ): boolean {
        const distance = this.calculateDistance(submitted, expected);
        return distance <= toleranceKm;
    }

    /**
     * @dev Validate coordinate bounds
     */
    static validateCoordinates(coordinates: Coordinates): boolean {
        return coordinates.latitude >= -90 && coordinates.latitude <= 90 &&
               coordinates.longitude >= -180 && coordinates.longitude <= 180;
    }

    /**
     * @dev Calculate bearing between two points
     */
    static calculateBearing(from: Coordinates, to: Coordinates): number {
        const lat1Rad = this.toRadians(from.latitude);
        const lat2Rad = this.toRadians(to.latitude);
        const deltaLonRad = this.toRadians(to.longitude - from.longitude);

        const x = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
        const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

        const bearingRad = Math.atan2(x, y);
        return (this.toDegrees(bearingRad) + 360) % 360;
    }

    /**
     * @dev Find nearest grid zone to coordinates
     */
    static findNearestGridZone(coordinates: Coordinates, gridZones: GridZone[]): GridZone | null {
        if (gridZones.length === 0) return null;

        let nearestZone = null;
        let minDistance = Infinity;

        for (const zone of gridZones) {
            // Calculate distance to zone centroid
            const centroid = this.calculatePolygonCentroid(zone.boundaries);
            const distance = this.calculateDistance(coordinates, centroid);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestZone = zone;
            }
        }

        return nearestZone;
    }

    /**
     * @dev Calculate centroid of a polygon
     */
    private static calculatePolygonCentroid(polygon: Coordinates[]): Coordinates {
        let lat = 0, lon = 0;
        for (const point of polygon) {
            lat += point.latitude;
            lon += point.longitude;
        }
        return {
            latitude: lat / polygon.length,
            longitude: lon / polygon.length
        };
    }

    /**
     * @dev Calculate area of a polygon (in square kilometers)
     */
    static calculatePolygonArea(polygon: Coordinates[]): number {
        if (polygon.length < 3) return 0;

        let area = 0;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            area += polygon[j].longitude * polygon[i].latitude;
            area -= polygon[i].longitude * polygon[j].latitude;
        }
        
        area = Math.abs(area) / 2;
        // Convert from square degrees to square kilometers (approximate)
        return area * 111.0 * 111.0 * Math.cos(this.toRadians(polygon[0].latitude));
    }

    /**
     * @dev Utility function to convert degrees to radians
     */
    private static toRadians(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    /**
     * @dev Utility function to convert radians to degrees
     */
    private static toDegrees(radians: number): number {
        return radians * (180 / Math.PI);
    }

    /**
     * @dev Check if distance calculation meets accuracy requirements
     */
    static validateAccuracy(distance: number, expectedDistance: number): boolean {
        const difference = Math.abs(distance - expectedDistance);
        return difference <= this.ACCURACY_THRESHOLD;
    }

    /**
     * @dev Generate location hash for quick lookups
     */
    static generateLocationHash(coordinates: Coordinates, precision: number = 6): string {
        const latStr = coordinates.latitude.toFixed(precision);
        const lonStr = coordinates.longitude.toFixed(precision);
        return `${latStr},${lonStr}`;
    }

    /**
     * @dev Check if two locations are within trading distance
     */
    static canTrade(location1: Coordinates, location2: Coordinates, maxDistanceKm: number): boolean {
        const distance = this.calculateDistance(location1, location2);
        return distance <= maxDistanceKm;
    }
}
