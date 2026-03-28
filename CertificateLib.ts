import { CertificateMetadata, EnergyType } from '../structures/CertificateMetadata';
import crypto from 'crypto';

export class CertificateLib {
    // Standard conversion rates for carbon credits (kg CO2 per kWh)
    private static readonly CARBON_OFFSET_RATES = {
        [EnergyType.SOLAR]: 0.709,
        [EnergyType.WIND]: 0.985,
        [EnergyType.HYDRO]: 0.994,
        [EnergyType.GEOTHERMAL]: 0.962,
        [EnergyType.BIOMASS]: 0.828
    };

    /**
     * Calculates the carbon credits earned for a given energy production.
     * 1 carbon credit = 1 metric ton (1000 kg) of CO2 offset.
     */
    public static calculateCarbonCredits(energyType: EnergyType, quantityKWh: number): number {
        const offsetRate = this.CARBON_OFFSET_RATES[energyType] || 0;
        const totalKgOffset = quantityKWh * offsetRate;
        return totalKgOffset / 1000;
    }

    /**
     * Generates a unique token ID based on metadata attributes.
     */
    public static generateTokenId(producer: string, timestamp: number, nonce: number): string {
        const data = `${producer}-${timestamp}-${nonce}`;
        return `0x${crypto.createHash('sha256').update(data).digest('hex').substring(0, 40)}`;
    }
}