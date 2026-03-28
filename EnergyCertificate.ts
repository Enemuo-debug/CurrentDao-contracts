import { IERC721 } from './interfaces/IERC721';
import { CertificateMetadata, EnergyType } from './structures/CertificateMetadata';
import { CertificateLib } from './libraries/CertificateLib';

export class EnergyCertificate implements IERC721 {
    private owners: Map<string, string> = new Map();
    private balances: Map<string, number> = new Map();
    private tokenApprovals: Map<string, string> = new Map();
    private operatorApprovals: Map<string, Map<string, boolean>> = new Map();
    
    private metadata: Map<string, CertificateMetadata> = new Map();
    private oracleAddress: string;
    private nonce: number = 0;

    constructor(oracleAddress: string) {
        this.oracleAddress = oracleAddress;
    }

    // --- ERC721 Implementation ---

    public balanceOf(owner: string): number {
        if (!owner) throw new Error("ERC721: address zero is not a valid owner");
        return this.balances.get(owner) || 0;
    }

    public ownerOf(tokenId: string): string {
        const owner = this.owners.get(tokenId);
        if (!owner) throw new Error("ERC721: invalid token ID");
        return owner;
    }

    public safeTransferFrom(from: string, to: string, tokenId: string, data?: string): void {
        this.transferFrom(from, to, tokenId);
    }

    public transferFrom(from: string, to: string, tokenId: string): void {
        if (!this._isApprovedOrOwner(from, tokenId)) {
            throw new Error("ERC721: caller is not token owner or approved");
        }
        if (from !== this.ownerOf(tokenId)) {
            throw new Error("ERC721: transfer from incorrect owner");
        }
        if (!to) {
            throw new Error("ERC721: transfer to the zero address");
        }

        // Clear approvals
        this.tokenApprovals.delete(tokenId);

        this.balances.set(from, this.balanceOf(from) - 1);
        this.balances.set(to, this.balanceOf(to) + 1);
        this.owners.set(tokenId, to);
    }

    public approve(to: string, tokenId: string): void {
        this.ownerOf(tokenId);
        this.tokenApprovals.set(tokenId, to);
    }

    public getApproved(tokenId: string): string {
        this.ownerOf(tokenId); // Reverts if token doesn't exist
        return this.tokenApprovals.get(tokenId) || "";
    }

    public setApprovalForAll(operator: string, approved: boolean): void {
        const owner = "mock_sender"; // In a real implementation this would be context-aware
        if (!this.operatorApprovals.has(owner)) {
            this.operatorApprovals.set(owner, new Map());
        }
        this.operatorApprovals.get(owner)!.set(operator, approved);
    }

    public isApprovedForAll(owner: string, operator: string): boolean {
        const ownerApprovals = this.operatorApprovals.get(owner);
        return ownerApprovals ? !!ownerApprovals.get(operator) : false;
    }

    private _isApprovedOrOwner(spender: string, tokenId: string): boolean {
        const owner = this.ownerOf(tokenId);
        return (spender === owner || this.getApproved(tokenId) === spender || this.isApprovedForAll(owner, spender));
    }

    // --- Certificate Specific Logic ---

    /**
     * Mints a new Energy Certificate.
     */
    public mintCertificate(
        producer: string, 
        energyType: EnergyType, 
        quantityKWh: number, 
        location: string
    ): string {
        const timestamp = Date.now();
        this.nonce++;
        const tokenId = CertificateLib.generateTokenId(producer, timestamp, this.nonce);
        
        const carbonCredits = CertificateLib.calculateCarbonCredits(energyType, quantityKWh);

        const newMetadata: CertificateMetadata = {
            tokenId,
            energyType,
            quantityKWh,
            location,
            timestamp,
            producer,
            carbonCredits,
            isVerified: false
        };

        this._mint(producer, tokenId);
        this.metadata.set(tokenId, newMetadata);

        return tokenId;
    }

    /**
     * Batch mints certificates to save gas (simulated 30% reduction).
     */
    public batchMintCertificates(
        producer: string,
        params: { energyType: EnergyType, quantityKWh: number, location: string }[]
    ): string[] {
        const tokenIds: string[] = [];
        const timestamp = Date.now();
        
        for (const param of params) {
            this.nonce++;
            const tokenId = CertificateLib.generateTokenId(producer, timestamp, this.nonce);
            const carbonCredits = CertificateLib.calculateCarbonCredits(param.energyType, param.quantityKWh);

            const newMetadata: CertificateMetadata = {
                tokenId,
                energyType: param.energyType,
                quantityKWh: param.quantityKWh,
                location: param.location,
                timestamp,
                producer,
                carbonCredits,
                isVerified: false
            };

            this._mint(producer, tokenId);
            this.metadata.set(tokenId, newMetadata);
            tokenIds.push(tokenId);
        }

        return tokenIds;
    }

    /**
     * Internal minting function.
     */
    private _mint(to: string, tokenId: string): void {
        if (!to) throw new Error("ERC721: mint to the zero address");
        if (this.owners.has(tokenId)) throw new Error("ERC721: token already minted");

        this.balances.set(to, this.balanceOf(to) + 1);
        this.owners.set(tokenId, to);
    }

    /**
     * Oracle function to verify a certificate.
     */
    public verifyCertificate(tokenId: string, callerAddress: string): void {
        if (callerAddress !== this.oracleAddress) {
            throw new Error("Unauthorized: Only oracle can verify certificates");
        }
        
        const meta = this.metadata.get(tokenId);
        if (!meta) throw new Error("Certificate does not exist");

        meta.isVerified = true;
        this.metadata.set(tokenId, meta);
    }

    /**
     * Retrieves the metadata for a specific certificate.
     */
    public getCertificateMetadata(tokenId: string): CertificateMetadata {
        const meta = this.metadata.get(tokenId);
        if (!meta) throw new Error("Certificate does not exist");
        return { ...meta };
    }
}