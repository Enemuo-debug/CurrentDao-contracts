import { EnergyCertificate } from '../../contracts/nft/EnergyCertificate';
import { EnergyType } from '../../contracts/nft/structures/CertificateMetadata';
import { CertificateLib } from '../../contracts/nft/libraries/CertificateLib';

describe('Energy Certificate NFT Tests', () => {
    let certificate: EnergyCertificate;
    const oracleAddress = '0xOracleAddress';
    const user1 = '0xUser1';
    const user2 = '0xUser2';

    beforeEach(() => {
        certificate = new EnergyCertificate(oracleAddress);
    });

    it('should mint a new certificate and set correct metadata', () => {
        const tokenId = certificate.mintCertificate(user1, EnergyType.SOLAR, 1000, 'California');
        
        expect(certificate.balanceOf(user1)).toBe(1);
        expect(certificate.ownerOf(tokenId)).toBe(user1);

        const metadata = certificate.getCertificateMetadata(tokenId);
        expect(metadata.energyType).toBe(EnergyType.SOLAR);
        expect(metadata.quantityKWh).toBe(1000);
        expect(metadata.location).toBe('California');
        expect(metadata.producer).toBe(user1);
        expect(metadata.isVerified).toBe(false);
        expect(metadata.carbonCredits).toBeCloseTo(0.709, 3);
    });

    it('should allow transfers between users', () => {
        const tokenId = certificate.mintCertificate(user1, EnergyType.WIND, 500, 'Texas');
        
        // Simulating the transfer where `user1` is caller
        certificate.transferFrom(user1, user2, tokenId);

        expect(certificate.balanceOf(user1)).toBe(0);
        expect(certificate.balanceOf(user2)).toBe(1);
        expect(certificate.ownerOf(tokenId)).toBe(user2);
    });

    it('should allow the oracle to verify a certificate', () => {
        const tokenId = certificate.mintCertificate(user1, EnergyType.HYDRO, 2000, 'Washington');
        
        expect(certificate.getCertificateMetadata(tokenId).isVerified).toBe(false);

        certificate.verifyCertificate(tokenId, oracleAddress);

        expect(certificate.getCertificateMetadata(tokenId).isVerified).toBe(true);
    });

    it('should revert if non-oracle tries to verify', () => {
        const tokenId = certificate.mintCertificate(user1, EnergyType.BIOMASS, 100, 'Oregon');
        
        expect(() => {
            certificate.verifyCertificate(tokenId, user1);
        }).toThrow('Unauthorized: Only oracle can verify certificates');
    });

    it('should batch mint certificates efficiently', () => {
        const batchParams = [
            { energyType: EnergyType.SOLAR, quantityKWh: 100, location: 'Nevada' },
            { energyType: EnergyType.WIND, quantityKWh: 200, location: 'Nevada' },
            { energyType: EnergyType.GEOTHERMAL, quantityKWh: 300, location: 'Nevada' }
        ];

        const tokenIds = certificate.batchMintCertificates(user1, batchParams);

        expect(tokenIds.length).toBe(3);
        expect(certificate.balanceOf(user1)).toBe(3);
        
        const meta1 = certificate.getCertificateMetadata(tokenIds[0]);
        const meta2 = certificate.getCertificateMetadata(tokenIds[1]);
        const meta3 = certificate.getCertificateMetadata(tokenIds[2]);

        expect(meta1.energyType).toBe(EnergyType.SOLAR);
        expect(meta2.energyType).toBe(EnergyType.WIND);
        expect(meta3.energyType).toBe(EnergyType.GEOTHERMAL);
    });

    it('should accurately calculate carbon credits', () => {
        // 1000 kWh of Solar should offset 0.709 tons
        const credits = CertificateLib.calculateCarbonCredits(EnergyType.SOLAR, 1000);
        expect(credits).toBe(0.709);
    });
});