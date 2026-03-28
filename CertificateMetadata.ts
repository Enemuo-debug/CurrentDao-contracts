export enum EnergyType {
    SOLAR = "SOLAR",
    WIND = "WIND",
    HYDRO = "HYDRO",
    GEOTHERMAL = "GEOTHERMAL",
    BIOMASS = "BIOMASS"
}

export interface CertificateMetadata {
    tokenId: string;
    energyType: EnergyType;
    quantityKWh: number;
    location: string;
    timestamp: number;
    producer: string;
    carbonCredits: number;
    isVerified: boolean;
}