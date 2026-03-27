# Geographic Location Registry Contract

## Overview

The Geographic Location Registry is a comprehensive smart contract system that enables energy producers and consumers to register their geographic locations, facilitating location-based energy trading and regional pricing. The registry provides accurate location mapping, grid zone assignment, geographic verification, and privacy controls while maintaining gas optimization and security.

## Features

### 🌍 Location Registration System
- **GPS Coordinate Registration**: Energy producers and consumers can register precise GPS coordinates
- **Location Types**: Support for PRODUCER, CONSUMER, PROSUMER, and GRID_NODE locations
- **Automatic Grid Zone Assignment**: Locations are automatically assigned to appropriate grid zones based on coordinates
- **Metadata Support**: Additional information can be stored with each location

### 🗺️ Grid Zone Mapping
- **Dynamic Grid Zones**: Configurable geographic boundaries for energy grid management
- **Zone Restrictions**: Capacity limits and type restrictions per zone
- **Pricing Zone Integration**: Each grid zone links to a pricing zone for regional pricing
- **Automatic Assignment**: New locations are automatically assigned to the nearest grid zone

### 🔍 Geographic Verification
- **Multiple Verification Methods**: GPS coordinates, satellite imagery, third-party oracles, and manual verification
- **Confidence Scoring**: Each verification includes a confidence score
- **Verification History**: Complete audit trail of all verification attempts
- **Anti-Fraud Measures**: Prevents false location registrations

### 📏 Distance Calculation
- **Haversine Algorithm**: Accurate distance calculation within 1km accuracy
- **Multiple Methods**: Haversine, Euclidean, and Manhattan distance calculations
- **Trading Permissions**: Distance-based permissions for energy trading
- **Cached Results**: Optimized performance with distance calculation caching

### 🔐 Privacy Controls
- **Privacy Levels**: PUBLIC, PRIVACY_ZONE, and PRIVATE options
- **Coordinate Obscuration**: Exact coordinates hidden when privacy is enabled
- **Privacy Zones**: Configurable radius around private locations
- **Public Coordinates**: Obscured coordinates available for public viewing

### 💰 Regional Pricing Zones
- **Dynamic Pricing**: Base prices with peak and off-peak multipliers
- **Regional Adjustments**: Location-specific price adjustments
- **Zone Management**: Create and update pricing zones dynamically
- **Market Integration**: Reflects local market conditions

## Architecture

### Core Components

#### LocationRegistry.ts
The main contract implementing all location management functionality:
- Location registration and updates
- Grid zone management
- Verification processes
- Privacy controls
- Distance calculations

#### GeoLib.ts
Geographic calculation library providing:
- Distance calculations (Haversine, Euclidean, Manhattan)
- Coordinate validation
- Grid zone operations
- Privacy zone generation
- Trading eligibility checks

#### LocationStructure.ts
Data structures and enums:
- `Coordinates`: Latitude/longitude pairs
- `LocationData`: Complete location information
- `GridZone`: Grid zone definitions
- `PricingZone`: Pricing configuration
- Various enums for types and statuses

#### ILocationRegistry.ts
TypeScript interface defining:
- All public methods
- Integration interfaces
- Storage layout definitions
- Event and error definitions

## Usage Examples

### Registering a New Location

```typescript
import { LocationRegistry, LocationType, PrivacyLevel } from '../contracts/location';

const registry = new LocationRegistry();

// Register a solar farm
const locationId = await registry.registerLocation(
    { latitude: 40.7128, longitude: -74.0060 }, // NYC coordinates
    LocationType.PRODUCER,
    PrivacyLevel.PUBLIC,
    'Large-scale solar installation'
);
```

### Distance-Based Trading

```typescript
// Check if two locations can trade
const canTrade = await registry.canTrade(
    locationId1,
    locationId2,
    50 // 50km maximum trading distance
);

if (canTrade) {
    // Execute trade logic
}
```

### Privacy Controls

```typescript
// Update privacy level
await registry.updatePrivacyLevel(
    locationId,
    PrivacyLevel.PRIVATE,
    ownerAddress
);

// Get public (obscured) coordinates
const publicCoords = await registry.getPublicCoordinates(locationId);
```

### Grid Zone Management

```typescript
// Create a new grid zone
const zoneId = await registry.createGridZone(
    'California Grid Zone',
    [
        { latitude: 42.0, longitude: -125.0 },
        { latitude: 42.0, longitude: -114.0 },
        { latitude: 32.0, longitude: -114.0 },
        { latitude: 32.0, longitude: -125.0 }
    ],
    'california_pricing',
    {
        maxProductionCapacity: 15000000,
        maxConsumptionDemand: 12000000,
        allowedLocationTypes: [LocationType.PRODUCER, LocationType.CONSUMER],
        verificationRequired: true
    }
);
```

## Gas Optimization

The contract implements several gas optimization strategies:

### Storage Optimization
- **Packed Structs**: Efficient storage layout for location data
- **Mapping Indexes**: Quick lookups for owner, type, and zone queries
- **Caching Strategy**: Distance calculation results cached to avoid recomputation

### Computational Efficiency
- **Lazy Verification**: Verification only when required
- **Batch Operations**: Support for multiple location operations
- **Optimized Algorithms**: Efficient geographic calculations

### Event Emission
- **Selective Events**: Only emit essential events
- **Packed Event Data**: Minimize event data size
- **Batch Logging**: Group related operations

## Security Features

### Access Control
- **Role-Based Permissions**: Admin, verifier, and user roles
- **Owner-Only Operations**: Location owners can only modify their own locations
- **Verifier Requirements**: Only authorized verifiers can verify locations

### Anti-Fraud Measures
- **Coordinate Validation**: Prevents invalid coordinate submissions
- **Verification Requirements**: Mandatory verification for certain operations
- **Duplicate Prevention**: Prevents multiple registrations of the same location

### Data Protection
- **Privacy Controls**: Multiple levels of location privacy
- **Data Obscuration**: Private data is properly obscured
- **Access Logging**: All access to private data is logged

## Integration Guide

### Setting Up the Contract

1. **Deploy the Contract**
   ```bash
   npm run deploy:location deploy
   ```

2. **Configure Grid Zones**
   ```typescript
   // Set up your regional grid zones
   await createGridZoneForRegion('North America', boundaries, pricingZone);
   ```

3. **Add Verifiers**
   ```typescript
   await registry.addVerifier(verifierAddress);
   ```

### Integration with Trading System

```typescript
// Check trading eligibility
const isEligible = await registry.isLocationEligible(locationId);

// Get trading limits
const { productionLimit, consumptionLimit } = 
    await registry.getLocationTradingLimits(locationId);

// Find nearby trading partners
const nearbyProducers = await registry.getNearbyLocations(
    consumerLocationId,
    100, // 100km radius
    LocationType.PRODUCER
);
```

### Pricing Integration

```typescript
// Get current price for location
const pricingZone = await registry.getPricingZoneForLocation(locationId);
const currentPrice = await pricingOracle.getCurrentPrice(pricingZone.id);

// Calculate adjusted price
const adjustedPrice = pricingZone.basePrice * 
    pricingZone.peakMultiplier + 
    pricingZone.regionalAdjustment;
```

## Testing

The contract includes comprehensive test coverage:

### Running Tests
```bash
# Run all location tests
npm run test:location

# Run with coverage
npm run test:coverage
```

### Test Categories
- **Unit Tests**: Individual function testing
- **Integration Tests**: Component interaction testing
- **Gas Tests**: Gas usage optimization verification
- **Security Tests**: Access control and anti-fraud testing

### Test Coverage
- Location registration and management
- Grid zone operations
- Distance calculations
- Privacy controls
- Verification processes
- Pricing zone integration
- Error handling
- Edge cases

## Deployment

### Environment Configuration

```typescript
const config = {
    network: 'mainnet',
    gasLimit: 8000000,
    gasPrice: 20000000000,
    adminAddress: '0x...',
    verifiers: ['0x...', '0x...'],
    defaultGridZones: [...],
    defaultPricingZones: [...]
};
```

### Deployment Steps

1. **Deploy Contract**
   ```bash
   npm run deploy:location deploy
   ```

2. **Verify Deployment**
   ```bash
   npm run deploy:location verify
   ```

3. **Configure Initial Data**
   - Set up grid zones
   - Configure pricing zones
   - Add verifiers
   - Register initial locations

### Production Considerations

- **Security Audit**: Conduct thorough security audit before mainnet deployment
- **Gas Monitoring**: Monitor gas usage and optimize as needed
- **Access Control**: Secure admin and verifier keys
- **Backup Strategy**: Implement data backup and recovery procedures

## API Reference

### Core Methods

#### Location Management
- `registerLocation(coordinates, type, privacy, metadata, owner)`
- `updateLocation(locationId, coordinates, metadata, caller)`
- `deactivateLocation(locationId, caller)`
- `getLocation(locationId)`
- `getLocationsByOwner(owner)`
- `getLocationsByType(type)`
- `getLocationsByGridZone(zoneId)`

#### Grid Zone Management
- `createGridZone(name, boundaries, pricingZone, restrictions, caller)`
- `assignGridZone(locationId, caller)`
- `updateGridZoneBoundaries(zoneId, boundaries, caller)`

#### Verification
- `verifyLocation(locationId, method, evidence, verifier)`
- `requestVerification(locationId)`
- `getVerificationHistory(locationId)`

#### Privacy
- `updatePrivacyLevel(locationId, level, caller)`
- `getPublicCoordinates(locationId)`
- `isWithinPrivacyZone(locationId, coordinates)`

#### Distance & Trading
- `calculateDistance(fromLocationId, toLocationId)`
- `canTrade(locationId1, locationId2, maxDistance)`
- `getNearbyLocations(locationId, radius, type)`

#### Pricing
- `createPricingZone(name, basePrice, peakMultiplier, offPeakMultiplier, regionalAdjustment, caller)`
- `updatePricingZone(zoneId, ...prices, caller)`
- `getPricingZone(zoneId)`
- `getPricingZoneForLocation(locationId)`

#### Admin
- `addVerifier(verifier, caller)`
- `removeVerifier(verifier, caller)`
- `pauseRegistration(caller)`
- `unpauseRegistration(caller)`

### Events

- `LocationRegistered`
- `LocationUpdated`
- `LocationDeactivated`
- `GridZoneAssigned`
- `LocationVerified`
- `PrivacyLevelUpdated`
- `GridZoneCreated`
- `PricingZoneCreated`
- `PricingZoneUpdated`

### Errors

- `InvalidCoordinates`
- `LocationNotFound`
- `UnauthorizedAccess`
- `LocationAlreadyExists`
- `InvalidLocationType`
- `InvalidPrivacyLevel`
- `VerificationFailed`
- `InsufficientPermissions`
- `GridZoneNotFound`
- `PricingZoneNotFound`
- `RegistrationPaused`
- `DistanceCalculationFailed`
- `PrivacyViolation`

## Best Practices

### For Developers
1. **Validate Coordinates**: Always validate GPS coordinates before submission
2. **Handle Privacy**: Respect user privacy settings when displaying location data
3. **Cache Results**: Cache distance calculations and location queries
4. **Error Handling**: Implement proper error handling for all contract interactions

### For Operators
1. **Regular Verification**: Implement regular location verification schedules
2. **Monitor Gas**: Monitor gas usage and optimize operations
3. **Access Control**: Maintain strict access control for admin functions
4. **Data Backup**: Regularly backup location and configuration data

### For Users
1. **Privacy Settings**: Choose appropriate privacy levels for your locations
2. **Verification**: Complete verification processes promptly
3. **Accuracy**: Ensure coordinates are accurate for proper grid zone assignment
4. **Security**: Secure your private keys and access credentials

## Troubleshooting

### Common Issues

#### Location Registration Fails
- **Check Coordinates**: Ensure latitude (-90 to 90) and longitude (-180 to 180) are valid
- **Check Limits**: Verify you haven't exceeded maximum locations per owner
- **Check Status**: Ensure registration is not paused

#### Verification Fails
- **Check Permissions**: Ensure the verifier is authorized
- **Check Evidence**: Provide sufficient evidence for the verification method
- **Check Status**: Ensure location is in PENDING status

#### Distance Calculation Issues
- **Check Coordinates**: Ensure both locations have valid coordinates
- **Check Method**: Use appropriate distance calculation method
- **Check Cache**: Clear cache if stale results are suspected

#### Privacy Issues
- **Check Level**: Ensure privacy level is set correctly
- **Check Coordinates**: Verify obscured coordinates are being used when required
- **Check Access**: Ensure proper authorization for private data access

### Support

For technical support and questions:
- Review the test suite for usage examples
- Check the API reference for method signatures
- Consult the integration guide for setup instructions
- Open an issue for bug reports or feature requests

## License

This contract is part of the CurrentDAO energy trading platform and is released under the MIT License. See the LICENSE file for more details.

## Contributing

Contributions are welcome! Please follow the contribution guidelines:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Version History

### v1.0.0 (Current)
- Initial release of the Geographic Location Registry
- Core location registration and management
- Grid zone and pricing zone integration
- Privacy controls and verification system
- Distance calculation and trading permissions
- Comprehensive test suite and documentation

---

**Note**: This documentation is for the Geographic Location Registry Contract v1.0.0. Please ensure you're using the correct version for your implementation.
