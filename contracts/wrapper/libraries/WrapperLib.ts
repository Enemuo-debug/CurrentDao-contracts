/**
 * @title WrapperLib
 * @dev Library for Asset Wrapper operations
 */
import { AssetType, SupportedAsset, WrappedTokenInfo, UserPosition, PriceFeed, FeeStructure } from '../structures/WrapperStructure';
import { SafeMath } from '../../token/libraries/SafeMath';

export class WrapperLib {
    // Constants
    public static readonly BASIS_POINTS = 10000;
    public static readonly DEFAULT_MIN_COLLATERAL_RATIO = 15000; // 150%
    public static readonly LIQUIDATION_THRESHOLD = 12000; // 120%
    public static readonly MAX_FEE = 1000; // 10%
    public static readonly MIN_FEE = 10; // 0.1%

    /**
     * @dev Calculate wrap fee based on asset type and amount
     */
    public static calculateWrapFee(assetType: AssetType, amount: number, feeStructure: FeeStructure): number {
        let baseFee = feeStructure.wrapFee;
        
        // Apply asset type specific adjustments
        switch (assetType) {
            case AssetType.STABLECOIN:
                baseFee = Math.floor(baseFee * 0.5); // 50% discount for stablecoins
                break;
            case AssetType.NATIVE:
                baseFee = Math.floor(baseFee * 0.8); // 20% discount for native assets
                break;
            case AssetType.ERC721:
            case AssetType.ERC1155:
                baseFee = Math.max(baseFee, 100); // Minimum 1% for NFTs
                break;
        }

        return SafeMath.mul(amount, baseFee).div(this.BASIS_POINTS);
    }

    /**
     * @dev Calculate unwrap fee
     */
    public static calculateUnwrapFee(amount: number, feeStructure: FeeStructure): number {
        return SafeMath.mul(amount, feeStructure.unwrapFee).div(this.BASIS_POINTS);
    }

    /**
     * @dev Calculate collateral ratio
     */
    public static calculateCollateralRatio(totalCollateral: number, totalSupply: number, collateralPrice: number): number {
        if (totalSupply === 0) return this.BASIS_POINTS * 2; // 200% if no supply
        
        const collateralValue = SafeMath.mul(totalCollateral, collateralPrice);
        const supplyValue = totalSupply;
        
        return SafeMath.mul(collateralValue, this.BASIS_POINTS).div(supplyValue);
    }

    /**
     * @dev Check if position is healthy
     */
    public static isPositionHealthy(collateralRatio: number, minRatio: number): boolean {
        return collateralRatio >= minRatio;
    }

    /**
     * @dev Calculate liquidation price
     */
    public static calculateLiquidationPrice(totalSupply: number, totalCollateral: number, minRatio: number): number {
        if (totalCollateral === 0) return 0;
        
        const requiredCollateralValue = SafeMath.mul(totalSupply, minRatio);
        return SafeMath.div(requiredCollateralValue, SafeMath.mul(totalCollateral, this.BASIS_POINTS));
    }

    /**
     * @dev Validate asset address format
     */
    public static isValidAssetAddress(address: string): boolean {
        // Basic validation for Stellar addresses
        return /^G[0-9A-Z]{55}$/.test(address) || address.length >= 32;
    }

    /**
     * @dev Validate amount
     */
    public static isValidAmount(amount: number): boolean {
        return amount > 0 && amount <= Number.MAX_SAFE_INTEGER;
    }

    /**
     * @dev Calculate health factor
     */
    public static calculateHealthFactor(collateralRatio: number, minRatio: number): number {
        if (minRatio === 0) return 0;
        return SafeMath.mul(collateralRatio, this.BASIS_POINTS).div(minRatio);
    }

    /**
     * @dev Apply protocol fee
     */
    public static applyProtocolFee(amount: number, protocolFeeBps: number): number {
        return SafeMath.mul(amount, protocolFeeBps).div(this.BASIS_POINTS);
    }

    /**
     * @dev Calculate max withdrawable amount
     */
    public static calculateMaxWithdrawable(totalCollateral: number, totalSupply: number, 
                                         collateralPrice: number, minRatio: number): number {
        const currentRatio = this.calculateCollateralRatio(totalCollateral, totalSupply, collateralPrice);
        
        if (currentRatio <= minRatio) return 0;
        
        const excessRatio = SafeMath.sub(currentRatio, minRatio);
        const excessCollateralValue = SafeMath.mul(totalSupply, excessRatio).div(this.BASIS_POINTS);
        
        return SafeMath.div(excessCollateralValue, collateralPrice);
    }

    /**
     * @dev Generate wrapped token ID
     */
    public static generateWrappedTokenId(originalAsset: string, assetType: AssetType): string {
        const timestamp = Date.now().toString();
        const hash = this.simpleHash(originalAsset + assetType + timestamp);
        return `WRAP_${assetType}_${hash}`;
    }

    /**
     * @dev Simple hash function for ID generation
     */
    private static simpleHash(input: string): string {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * @dev Validate fee structure
     */
    public static validateFeeStructure(feeStructure: FeeStructure): boolean {
        return feeStructure.wrapFee >= this.MIN_FEE && 
               feeStructure.wrapFee <= this.MAX_FEE &&
               feeStructure.unwrapFee >= this.MIN_FEE && 
               feeStructure.unwrapFee <= this.MAX_FEE &&
               feeStructure.protocolFee >= 0 && 
               feeStructure.protocolFee <= this.MAX_FEE;
    }

    /**
     * @dev Calculate risk score
     */
    public static calculateRiskScore(collateralRatio: number, assetType: AssetType, volatility: number): number {
        let baseScore = 50; // Base risk score
        
        // Adjust based on collateral ratio
        if (collateralRatio < 12000) baseScore += 30;
        else if (collateralRatio < 15000) baseScore += 15;
        else if (collateralRatio > 20000) baseScore -= 10;
        
        // Adjust based on asset type
        switch (assetType) {
            case AssetType.STABLECOIN:
                baseScore -= 20;
                break;
            case AssetType.NATIVE:
                baseScore -= 10;
                break;
            case AssetType.ERC721:
            case AssetType.ERC1155:
                baseScore += 25;
                break;
        }
        
        // Adjust based on volatility (0-100)
        baseScore += Math.floor(volatility / 2);
        
        return Math.max(0, Math.min(100, baseScore));
    }

    /**
     * @dev Format amount for display
     */
    public static formatAmount(amount: number, decimals: number = 18): string {
        const divisor = Math.pow(10, decimals);
        const formatted = (amount / divisor).toFixed(6);
        return formatted.replace(/\.?0+$/, '');
    }

    /**
     * @dev Parse amount from string
     */
    public static parseAmount(amountStr: string, decimals: number = 18): number {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return 0;
        
        const divisor = Math.pow(10, decimals);
        return Math.floor(amount * divisor);
    }
}
