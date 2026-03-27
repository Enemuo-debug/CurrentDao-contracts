/**
 * @title Location Structure Library
 * @dev Data structures for geographic location registry
 * @author CurrentDAO
 */

export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface LocationData {
    id: string;
    owner: string;
    coordinates: Coordinates;
    gridZone: string;
    locationType: LocationType;
    verificationStatus: VerificationStatus;
    privacyLevel: PrivacyLevel;
    registeredAt: number;
    lastVerified: number;
    metadata: string;
}

export enum LocationType {
    PRODUCER = 0,
    CONSUMER = 1,
    PROSUMER = 2,
    GRID_NODE = 3
}

export enum VerificationStatus {
    UNVERIFIED = 0,
    PENDING = 1,
    VERIFIED = 2,
    REJECTED = 3
}

export enum PrivacyLevel {
    PUBLIC = 0,
    PRIVACY_ZONE = 1,
    PRIVATE = 2
}

export interface GridZone {
    id: string;
    name: string;
    boundaries: Coordinates[];
    pricingZone: string;
    isActive: boolean;
    restrictions: ZoneRestrictions;
}

export interface ZoneRestrictions {
    maxProductionCapacity: number;
    maxConsumptionDemand: number;
    allowedLocationTypes: LocationType[];
    verificationRequired: boolean;
}

export interface PricingZone {
    id: string;
    name: string;
    basePrice: number;
    peakMultiplier: number;
    offPeakMultiplier: number;
    regionalAdjustment: number;
    isActive: boolean;
}

export interface LocationVerification {
    locationId: string;
    verifier: string;
    verificationMethod: VerificationMethod;
    confidenceScore: number;
    verifiedAt: number;
    evidence: string;
}

export enum VerificationMethod {
    GPS_COORDINATES = 0,
    SATELLITE_IMAGERY = 1,
    THIRD_PARTY_ORACLE = 2,
    MANUAL_VERIFICATION = 3
}

export interface DistanceCalculation {
    fromLocation: string;
    toLocation: string;
    distance: number;
    calculationMethod: DistanceMethod;
    calculatedAt: number;
}

export enum DistanceMethod {
    HAVERSINE = 0,
    EUCLIDEAN = 1,
    MANHATTAN = 2
}

export interface PrivacyZone {
    center: Coordinates;
    radius: number;
    obscuredCoordinates: Coordinates;
    level: PrivacyLevel;
}

export enum LocationEventType {
    REGISTERED = 0,
    VERIFIED = 1,
    UPDATED = 2,
    PRIVACY_CHANGED = 3,
    ZONE_ASSIGNED = 4,
    DEACTIVATED = 5
}

export interface LocationEvent {
    eventType: LocationEventType;
    locationId: string;
    actor: string;
    timestamp: number;
    data: string;
}
